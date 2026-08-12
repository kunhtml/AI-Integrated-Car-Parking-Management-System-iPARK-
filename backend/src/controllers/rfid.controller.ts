import { Request, Response } from "express";
import { z } from "zod";
import { RfidCard, RfidCardDocument } from "../models/RfidCard.js";
import { Vehicle } from "../models/Vehicle.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";

function normalizePlate(plate: string): string {
  return (plate || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

function serializeCard(card: RfidCardDocument) {
  return {
    id: card._id.toString(),
    uid: card.uid,
    ownerName: card.ownerName,
    plate: card.plate,
    userType: card.userType,
    status: card.status,
    notes: card.notes,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

export async function listRfidCards(_request: Request, response: Response) {
  const cards = await RfidCard.find().sort({ createdAt: -1 }).limit(500);
  response.json({ cards: cards.map(serializeCard) });
}

/**
 * Danh sách cư dân đang có gói active (Subscription.status = active, endDate > now)
 * mà xe của họ CHƯA được gán vào thẻ RFID active nào.
 * Dùng cho form Thêm / Sửa thẻ RFID để admin/staff chọn và tự điền biển số.
 */
export async function listUnassignedResidents(
  _request: Request,
  response: Response,
) {
  const now = new Date();

  // Lấy danh sách biển số đã có thẻ active → loại trừ khỏi kết quả
  const assignedPlates = new Set(
    (await RfidCard.find({ status: "active" }).select("plate"))
      .map((c) => normalizePlate(c.plate || ""))
      .filter((p) => p.length > 0),
  );

  const subs = await Subscription.find({
    status: "active",
    endDate: { $gt: now },
  })
    .sort({ endDate: 1 })
    .populate({
      path: "primaryVehicleId",
      model: "Vehicle",
      select: "plate ownerName status",
    })
    .populate({ path: "userId", model: "User", select: "name email phone" });

  const residents = subs
    .map((sub: any) => {
      const vehicle = sub.primaryVehicleId;
      if (!vehicle) return null;
      const plate = normalizePlate(vehicle.plate || "");
      if (!plate) return null;
      if (assignedPlates.has(plate)) return null; // đã gán thẻ rồi
      const user = sub.userId;
      return {
        subscriptionId: sub._id.toString(),
        planName: sub.planName,
        endDate: sub.endDate,
        vehicleId: vehicle._id.toString(),
        plate,
        ownerName: vehicle.ownerName || user?.name || "",
        userId: user?._id?.toString() || sub.userId?.toString(),
        email: user?.email || "",
        phone: user?.phone || "",
        memberCode: sub.memberCode || null,
      };
    })
    .filter(Boolean);

  response.json({ residents, count: residents.length });
}

export async function getRfidCard(request: Request, response: Response) {
  const card = await RfidCard.findById(request.params.id);
  if (!card) {
    response
      .status(404)
      .json({ ok: false, message: "Không tìm thấy thẻ RFID." });
    return;
  }
  response.json({ card: serializeCard(card) });
}

export async function lookupRfidCardByUid(
  request: Request,
  response: Response,
) {
  const uid = String(request.params.uid || "").trim();
  if (!uid) {
    response
      .status(400)
      .json({ ok: false, message: "UID không được để trống." });
    return;
  }
  const card = await RfidCard.findOne({ uid });
  response.json({ card: card ? serializeCard(card) : null });
}

export async function createRfidCard(request: Request, response: Response) {
  // This legacy endpoint only registers Guest cards into inventory.
  // Member cards must be sold through rfidSales.service so they are linked 1:1
  // with an existing vehicle and its owner.
  const body = z
    .object({
      uid: z.string().trim().min(1),
      notes: z.string().trim().optional(),
    })
    .parse(request.body);

  const uid = body.uid.trim();
  const existing = await RfidCard.findOne({ uid });
  if (existing) {
    response.status(409).json({
      ok: false,
      code: "duplicate",
      message: `UID ${uid} already exists.`,
      card: serializeCard(existing),
    });
    return;
  }

  const card = await RfidCard.create({
    uid,
    ownerName: "Guest",
    plate: "",
    userType: "guest",
    cardType: "guest",
    status: "available",
    notes: body.notes,
  });
  response.status(201).json({
    ok: true,
    card: serializeCard(card),
  });
}
export async function updateRfidCard(request: Request, response: Response) {
  const body = z
    .object({
      ownerName: z.string().trim().optional(),
      plate: z.string().trim().optional(),
      userType: z.enum(["resident", "guest"]).optional(),
      notes: z.string().trim().optional(),
    })
    .parse(request.body);

  const card = await RfidCard.findById(request.params.id);
  if (!card) {
    response
      .status(404)
      .json({ ok: false, message: "Không tìm thấy thẻ RFID." });
    return;
  }

  if (body.ownerName !== undefined) card.ownerName = body.ownerName;
  if (body.plate !== undefined) card.plate = normalizePlate(body.plate);
  if (body.userType !== undefined) card.userType = body.userType;
  if (body.notes !== undefined) card.notes = body.notes;

  await card.save();
  response.json({ ok: true, card: serializeCard(card) });
}

export async function deleteRfidCard(request: Request, response: Response) {
  const card = await RfidCard.findByIdAndUpdate(
    request.params.id,
    { $set: { status: "inactive" } },
    { new: true },
  );
  if (!card) {
    response
      .status(404)
      .json({ ok: false, message: "Không tìm thấy thẻ RFID." });
    return;
  }
  response.json({
    ok: true,
    message: `Đã vô hiệu hóa thẻ ${card.uid}`,
    uid: card.uid,
  });
}

export async function setRfidCardStatus(request: Request, response: Response) {
  const body = z
    .object({
      status: z.enum(["active", "inactive"]),
    })
    .parse(request.body);

  const card = await RfidCard.findByIdAndUpdate(
    request.params.id,
    { $set: { status: body.status } },
    { new: true },
  );
  if (!card) {
    response
      .status(404)
      .json({ ok: false, message: "Không tìm thấy thẻ RFID." });
    return;
  }
  response.json({ ok: true, card: serializeCard(card) });
}

/**
 * Endpoint nội bộ: Python service gọi khi ESP32 quét được thẻ mới.
 * - Nếu UID chưa có: tạo mới (active, guest)
 * - Nếu đã có: trả về thông tin hiện tại
 */
export async function registerScannedCard(
  request: Request,
  response: Response,
) {
  const body = z
    .object({
      uid: z.string().trim().min(1),
      ownerName: z.string().trim().optional(),
      plate: z.string().trim().optional(),
      userType: z.enum(["resident", "guest"]).optional(),
    })
    .parse(request.body);

  const uid = body.uid.trim();
  const ownerName = body.ownerName?.trim() || "Guest";
  const plate = normalizePlate(body.plate || "");
  const userType = body.userType || "guest";
  let card = await RfidCard.findOne({ uid });
  if (card) {
    if (card.status === "inactive") {
      response.status(403).json({
        ok: false,
        code: "CARD_INACTIVE",
        message: "RFID card is inactive and cannot be used.",
      });
      return;
    }
    response.json({ ok: true, created: false, card: serializeCard(card) });
    return;
  }

  // A scanned unknown card enters Guest inventory. It cannot become Member
  // until the explicit card-sale flow binds it to an owner and vehicle.
  card = await RfidCard.create({
    uid,
    ownerName,
    plate,
    userType,
    cardType: "guest",
    status: "available",
  });
  response.status(201).json({
    ok: true,
    created: true,
    card: serializeCard(card),
  });
}

/**
 * Synchronization: return active cards for the ESP32 device.
 */export async function exportAllCards(_request: Request, response: Response) {
  const cards = await RfidCard.find({ status: "active" }).sort({
    createdAt: 1,
  });
  response.json({
    ok: true,
    cards: cards.map(serializeCard),
  });
}

/**
 * Tra cứu RFID theo biển số (phục vụ kiểm tra khi camera vào/ra).
 */
export async function lookupByPlate(request: Request, response: Response) {
  const plate = normalizePlate(String(request.params.plate || ""));
  if (!plate) {
    response.status(400).json({ ok: false, message: "Biển số không hợp lệ." });
    return;
  }
  const card = await RfidCard.findOne({ plate, status: "active" });

  // Check xem biển số có thuộc subscriber (gói active) hay không
  const now = new Date();
  const vehicle = await Vehicle.findOne({ plate });
  const subscription = vehicle
    ? await Subscription.findOne({
        primaryVehicleId: vehicle._id,
        status: "active",
        endDate: { $gt: now },
      })
    : null;
  const isSubscriber = !!subscription;
  const isResident = isSubscriber || vehicle?.status === "Đã đăng ký";

  if (card) {
    response.json({
      ok: true,
      isSubscriber,
      isResident,
      card: serializeCard(card),
      vehicle: vehicle
        ? { id: vehicle._id.toString(), ownerName: vehicle.ownerName }
        : null,
    });
    return;
  }
  // Fallback: tra trong Vehicle
  response.json({
    ok: true,
    isSubscriber,
    isResident,
    card: null,
    vehicle: vehicle
      ? {
          id: vehicle._id.toString(),
          plate: vehicle.plate,
          ownerName: vehicle.ownerName,
          status: vehicle.status,
        }
      : null,
  });
}

/**
 * Trả thẻ RFID thuộc về user đang đăng nhập (customer).
 * Match theo biển số: thẻ nào có plate khớp với một Vehicle của user hiện tại.
 * Sort theo createdAt desc, limit 20.
 */
export async function listMyRfidCards(request: Request, response: Response) {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "Chưa đăng nhập." });
    return;
  }
  const vehicles = await Vehicle.find({ userId }).select("plate").lean();
  const plates = new Set(
    vehicles.map((v) => (v.plate || "").trim().toUpperCase()),
  );
  if (plates.size === 0) {
    response.json({ cards: [] });
    return;
  }
  const cards = await RfidCard.find({
    plate: { $in: Array.from(plates) },
  })
    .sort({ createdAt: -1 })
    .limit(20);
  response.json({ cards: cards.map(serializeCard) });
}
