import { Request, Response } from "express";
import { z } from "zod";
import {
  detectOccupancyImage,
  detectStraddleImage,
  suggestDividersImage,
  detectCarsImage,
  LaneDivider,
  SlotPolygon,
} from "../services/ai.service.js";
import { Device } from "../models/Device.js";
import { Zone } from "../models/Zone.js";
import { ParkingSlot } from "../models/ParkingSlot.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { PenaltyConfig, PenaltyViolationType } from "../models/PenaltyConfig.js";
import { findActiveSubscriptionByPlate } from "../services/subscription.service.js";
import { saveUploadedImage } from "../services/upload.service.js";

// Form values arrive as strings; z.coerce.boolean treats "false" as true.
// Parse common truthy/falsy string forms explicitly instead.
const booleanFromForm = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value == null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  });

const slotSchema = z.object({
  slotCode: z.string().min(1),
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
});

const dividerSchema = z.object({
  start: z.tuple([z.number(), z.number()]),
  end: z.tuple([z.number(), z.number()]),
});

const optionsSchema = z.object({
  overlapThreshold: z.coerce.number().min(0).max(1).optional(),
  straddleThreshold: z.coerce.number().min(0).max(1).optional(),
  conf: z.coerce.number().min(0).max(1).optional(),
  imgsz: z.coerce.number().int().min(320).max(4096).optional(),
  model: z.enum(["aerial"]).optional(),
  classAgnostic: booleanFromForm,
  minAreaFrac: z.coerce.number().min(0).max(1).optional(),
  maxAreaFrac: z.coerce.number().min(0).max(1).optional(),
});

/**
 * POST /api/ai/detect-occupancy
 * Nhận ảnh bãi đỗ + polygon các ô, trả về trạng thái từng ô (occupied / straddling / intruded).
 * `slots` gửi dạng JSON string trong multipart form.
 */
export async function detectOccupancyHandler(request: Request, response: Response) {
  if (!request.file) {
    response.status(400).json({ message: "Vui lòng chọn ảnh để nhận diện." });
    return;
  }

  let slots: SlotPolygon[];
  try {
    const parsed = JSON.parse(String(request.body.slots ?? "[]"));
    slots = z.array(slotSchema).min(1).parse(parsed) as SlotPolygon[];
  } catch {
    response.status(400).json({ message: "Danh sách ô đỗ (slots) không hợp lệ." });
    return;
  }

  const options = optionsSchema.parse(request.body);

  try {
    const result = await detectOccupancyImage(request.file, slots, options);
    response.json(result);
  } catch (error) {
    response.status(502).json({
      message: error instanceof Error ? error.message : "AI service không phản hồi.",
    });
  }
}

const straddleOptionsSchema = z.object({
  conf: z.coerce.number().min(0).max(1).optional(),
  imgsz: z.coerce.number().int().min(320).max(4096).optional(),
  edgeRatio: z.coerce.number().min(0).max(0.45).optional(),
  model: z.enum(["aerial"]).optional(),
  classAgnostic: booleanFromForm,
  minAreaFrac: z.coerce.number().min(0).max(1).optional(),
  maxAreaFrac: z.coerce.number().min(0).max(1).optional(),
});

/**
 * POST /api/ai/detect-straddle
 * Nhận ảnh + đường ranh giới làn (cấu hình sẵn cho camera), trả về từng xe kèm cờ đỗ lấn.
 * `dividers` gửi dạng JSON string trong multipart form.
 */
export async function detectStraddleHandler(request: Request, response: Response) {
  if (!request.file) {
    response.status(400).json({ message: "Vui lòng chọn ảnh để nhận diện." });
    return;
  }

  let dividers: LaneDivider[];
  try {
    const parsed = JSON.parse(String(request.body.dividers ?? "[]"));
    dividers = z.array(dividerSchema).min(1).parse(parsed) as LaneDivider[];
  } catch {
    response.status(400).json({ message: "Đường ranh giới làn (dividers) không hợp lệ." });
    return;
  }

  const options = straddleOptionsSchema.parse(request.body);

  try {
    const result = await detectStraddleImage(request.file, dividers, options);
    response.json(result);
  } catch (error) {
    response.status(502).json({
      message: error instanceof Error ? error.message : "AI service không phản hồi.",
    });
  }
}

const carsOptionsSchema = z.object({
  conf: z.coerce.number().min(0).max(1).optional(),
  imgsz: z.coerce.number().int().min(320).max(4096).optional(),
  model: z.enum(["aerial"]).optional(),
  classAgnostic: booleanFromForm,
  minAreaFrac: z.coerce.number().min(0).max(1).optional(),
  maxAreaFrac: z.coerce.number().min(0).max(1).optional(),
});

/**
 * POST /api/ai/detect-cars
 * Đếm xe TỰ ĐỘNG trong ảnh — không cần cấu hình ô đỗ/ranh giới.
 * Hợp với bãi xe đỗ lệch, vị trí không cố định.
 */
export async function detectCarsHandler(request: Request, response: Response) {
  if (!request.file) {
    response.status(400).json({ message: "Vui lòng chọn ảnh để nhận diện." });
    return;
  }

  const options = carsOptionsSchema.parse(request.body);

  try {
    const result = await detectCarsImage(request.file, options);
    response.json(result);
  } catch (error) {
    response.status(502).json({
      message: error instanceof Error ? error.message : "AI service không phản hồi.",
    });
  }
}

/**
 * POST /api/ai/suggest-dividers
 * Nhận ảnh, trả về danh sách đường ranh giới làn GỢI Ý (đặt vào khe giữa các xe).
 */
export async function suggestDividersHandler(request: Request, response: Response) {
  if (!request.file) {
    response.status(400).json({ message: "Vui lòng chọn ảnh để gợi ý." });
    return;
  }

  const { minCluster } = z
    .object({ minCluster: z.coerce.number().int().min(1).max(100).optional() })
    .parse(request.body);

  try {
    const result = await suggestDividersImage(request.file, { minCluster });
    response.json(result);
  } catch (error) {
    response.status(502).json({
      message: error instanceof Error ? error.message : "AI service không phản hồi.",
    });
  }
}

/**
 * GET /api/ai/devices
 * Danh sách camera (id + tên) để chọn khi lưu/đọc ranh giới làn.
 */
export async function listAiDevicesHandler(_request: Request, response: Response) {
  const devices = await Device.find().select("name gate laneDividers").sort({ name: 1 });
  response.json({
    devices: devices.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      gate: d.gate,
      dividerCount: d.laneDividers?.length ?? 0,
    })),
  });
}

/**
 * GET /api/ai/devices/:id/dividers
 * Đọc ranh giới làn đã lưu của một camera.
 */
export async function getDeviceDividersHandler(request: Request, response: Response) {
  const device = await Device.findById(request.params.id).select("laneDividers");
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy camera." });
    return;
  }
  response.json({ dividers: device.laneDividers ?? [] });
}

/**
 * PUT /api/ai/devices/:id/dividers
 * Lưu (ghi đè) ranh giới làn cho một camera.
 */
export async function saveDeviceDividersHandler(request: Request, response: Response) {
  const dividers = z.array(dividerSchema).parse(request.body.dividers) as LaneDivider[];
  const device = await Device.findByIdAndUpdate(
    request.params.id,
    { laneDividers: dividers },
    { returnDocument: "after" },
  );
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy camera." });
    return;
  }
  response.json({ dividers: device.laneDividers ?? [], saved: true });
}

/**
 * GET /api/ai/zones
 * Danh sách khu vực đỗ (Zone A/B/C...) kèm số cấu hình AI đã lưu.
 */
export async function listAiZonesHandler(_request: Request, response: Response) {
  const zones = await Zone.find({ isActive: true })
    .select("name cameraId laneDividers displayOrder")
    .sort({ displayOrder: 1, name: 1 });
  response.json({
    zones: zones.map((z) => ({
      id: z._id.toString(),
      name: z.name,
      cameraId: z.cameraId?.toString() ?? null,
      dividerCount: z.laneDividers?.length ?? 0,
      slotCount: 0, // deprecated: per-slot polygons now live on ParkingSlot.aiPolygon
    })),
  });
}

/**
 * GET /api/ai/zones/:id/config
 * Đọc cấu hình AI (ranh giới làn + polygon ô đỗ + camera) của một khu vực.
 */
export async function getZoneConfigHandler(request: Request, response: Response) {
  const zone = await Zone.findById(request.params.id).select(
    "name cameraId laneDividers",
  );
  if (!zone) {
    response.status(404).json({ message: "Không tìm thấy khu vực." });
    return;
  }
  response.json({
    id: zone._id.toString(),
    name: zone.name,
    cameraId: zone.cameraId?.toString() ?? null,
    dividers: zone.laneDividers ?? [],
    slots: [], // deprecated: per-slot polygons now live on ParkingSlot.aiPolygon
  });
}

const zoneConfigSchema = z.object({
  cameraId: z.string().length(24).optional().nullable(),
  dividers: z.array(dividerSchema).optional(),
  slots: z.array(slotSchema).optional(),
});

/**
 * PUT /api/ai/zones/:id/config
 * Lưu (ghi đè) cấu hình AI theo khu vực: ranh giới làn, polygon ô đỗ, camera.
 * Chỉ ghi đè trường nào được gửi lên.
 */
export async function saveZoneConfigHandler(request: Request, response: Response) {
  const body = zoneConfigSchema.parse(request.body);

  const update: {
    laneDividers?: LaneDivider[];
    cameraId?: string | null;
  } = {};
  if (body.dividers !== undefined) update.laneDividers = body.dividers as LaneDivider[];
  if (body.cameraId !== undefined) update.cameraId = body.cameraId;

  const zone = await Zone.findByIdAndUpdate(request.params.id, update, {
    returnDocument: "after",
  }).select("name cameraId laneDividers");
  if (!zone) {
    response.status(404).json({ message: "Không tìm thấy khu vực." });
    return;
  }
  response.json({
    id: zone._id.toString(),
    name: zone.name,
    cameraId: zone.cameraId?.toString() ?? null,
    dividers: zone.laneDividers ?? [],
    slots: [], // deprecated
    saved: true,
  });
}

/**
 * GET /api/ai/zones/:id/slots
 * Liệt kê các ô đỗ THẬT của khu vực kèm polygon AI đã cấu hình (nếu có).
 * Chỉ trả về số ô đúng bằng số ô đỗ thật trong DB — không thể cấu hình dư.
 */
export async function getZoneSlotsHandler(request: Request, response: Response) {
  const zone = await Zone.findById(request.params.id).select("name");
  if (!zone) {
    response.status(404).json({ message: "Không tìm thấy khu vực." });
    return;
  }
  const slots = await ParkingSlot.find({ zoneId: zone._id })
    .select("slotCode slotType status aiPolygon")
    .sort({ slotCode: 1 });
  response.json({
    zoneId: zone._id.toString(),
    zoneName: zone.name,
    slots: slots.map((s) => ({
      slotId: s._id.toString(),
      slotCode: s.slotCode,
      slotType: s.slotType,
      status: s.status,
      polygon: s.aiPolygon ?? [],
      configured: !!(s.aiPolygon && s.aiPolygon.length >= 3),
    })),
  });
}

const slotPolygonsSchema = z.object({
  polygons: z
    .array(
      z.object({
        slotCode: z.string().min(1),
        polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
      }),
    )
    .min(1),
});

/**
 * PUT /api/ai/zones/:id/slots
 * Lưu polygon AI cho từng ô đỗ THẬT của khu vực (gán theo slotCode).
 * Chỉ chấp nhận slotCode có thật trong khu vực; mã lạ sẽ bị từ chối.
 */
export async function saveZoneSlotsHandler(request: Request, response: Response) {
  const body = slotPolygonsSchema.parse(request.body);

  const zone = await Zone.findById(request.params.id).select("name");
  if (!zone) {
    response.status(404).json({ message: "Không tìm thấy khu vực." });
    return;
  }

  const realSlots = await ParkingSlot.find({ zoneId: zone._id }).select("slotCode");
  const validCodes = new Set(realSlots.map((s) => s.slotCode));

  const unknown = body.polygons.filter((p) => !validCodes.has(p.slotCode.toUpperCase()));
  if (unknown.length > 0) {
    response.status(400).json({
      message: `Các mã ô không thuộc khu vực này: ${unknown.map((u) => u.slotCode).join(", ")}.`,
    });
    return;
  }

  await Promise.all(
    body.polygons.map((p) =>
      ParkingSlot.updateOne(
        { zoneId: zone._id, slotCode: p.slotCode.toUpperCase() },
        { $set: { aiPolygon: p.polygon } },
      ),
    ),
  );

  response.json({ saved: true, count: body.polygons.length });
}

/**
 * POST /api/ai/zones/:id/scan-violations
 * Quét ảnh khu vực, đối chiếu với polygon các ô THẬT đã cấu hình, trả về danh
 * sách ỨNG VIÊN vi phạm (đỗ lấn vạch / chiếm ô) kèm biển số truy từ phiên gửi.
 * KHÔNG tự lập vé — chỉ gợi ý để nhân viên xem ảnh rồi duyệt.
 */
export async function scanZoneViolationsHandler(request: Request, response: Response) {
  if (!request.file) {
    response.status(400).json({ message: "Vui lòng chọn ảnh để quét." });
    return;
  }

  const options = z
    .object({
      model: z.enum(["aerial"]).optional(),
      conf: z.coerce.number().min(0).max(1).optional(),
      imgsz: z.coerce.number().int().min(320).max(4096).optional(),
      edgeRatio: z.coerce.number().min(0).max(0.45).optional(),
    })
    .parse(request.body);

  const zone = await Zone.findById(request.params.id).select("name laneDividers");
  if (!zone) {
    response.status(404).json({ message: "Không tìm thấy khu vực." });
    return;
  }

  // Ranh giới làn đã cấu hình cho khu vực (dùng để bắt xe đỗ lấn vạch)
  const dividers = (zone.laneDividers ?? []) as LaneDivider[];
  if (dividers.length === 0) {
    response.status(400).json({ message: "Khu vực chưa cấu hình ranh giới làn nào." });
    return;
  }

  // Các ô thật đã cấu hình polygon — dùng để map khung xe lấn vạch về ô → truy biển số
  const slots = await ParkingSlot.find({
    zoneId: zone._id,
    aiPolygon: { $exists: true, $ne: null },
  }).select("slotCode aiPolygon currentSessionId slotType");
  const configured = slots.filter((s) => s.aiPolygon && s.aiPolygon.length >= 3);

  let straddle;
  try {
    straddle = await detectStraddleImage(request.file, dividers, {
      model: options.model ?? "aerial",
      conf: options.conf,
      imgsz: options.imgsz,
      edgeRatio: options.edgeRatio,
    });
  } catch (error) {
    response.status(502).json({
      message: error instanceof Error ? error.message : "AI service không phản hồi.",
    });
    return;
  }

  // Lưu ảnh toàn khu vực làm bằng chứng vi phạm (dùng chung cho mọi vé trong ảnh)
  let evidenceImageUrl: string | null = null;
  try {
    evidenceImageUrl = await saveUploadedImage(request.file, "violation");
  } catch {
    evidenceImageUrl = null;
  }

  // Bảng giá phạt để gợi ý số tiền
  const configs = await PenaltyConfig.find({ isActive: true });
  const amountByType = new Map<PenaltyViolationType, number>(
    configs.map((c) => [c.violationType, c.amount]),
  );

  // Chỉ lấy xe đỗ lấn vạch
  const straddlingCars = straddle.cars.filter((c) => c.straddling);

  const candidates = [];
  let idx = 0;
  for (const car of straddlingCars) {
    idx += 1;
    const violationType: PenaltyViolationType = "over_line";

    // Tâm khung xe (chuẩn hoá 0..1)
    const [x1, y1, x2, y2] = car.box;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    // Map về ô đỗ: ô có polygon chứa tâm khung xe
    const matchedSlot = configured.find(
      (s) => s.aiPolygon && pointInPolygon(cx, cy, s.aiPolygon as [number, number][]),
    );

    let plate: string | null = null;
    let sessionId: string | null = null;
    let ownerType: "member" | "guest" | "unknown" = "unknown";

    if (matchedSlot?.currentSessionId) {
      const session = await ParkingSession.findById(matchedSlot.currentSessionId).select("plate");
      if (session) {
        plate = session.plate;
        sessionId = session._id.toString();
        const sub = await findActiveSubscriptionByPlate(session.plate);
        ownerType = sub ? "member" : "guest";
      }
    }

    candidates.push({
      slotCode: matchedSlot?.slotCode ?? `Xe #${idx}`,
      status: "straddling",
      coverage: car.conf,
      straddling: true,
      plate,
      sessionId,
      ownerType,
      violationType,
      suggestedAmount: amountByType.get(violationType) ?? 0,
      evidenceImageUrl,
    });
  }

  response.json({
    zoneId: zone._id.toString(),
    zoneName: zone.name,
    vehicleCount: straddle.vehicleCount,
    evidenceImageUrl,
    candidates,
  });
}

/**
 * Kiểm tra điểm (x,y) có nằm trong đa giác không (ray-casting). Toạ độ chuẩn hoá 0..1.
 */
function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
