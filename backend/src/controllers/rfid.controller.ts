import { createAuditLog } from "../services/auditLog.service.js";
import { AuditLog } from "../models/AuditLog.js";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { RfidCard, RfidCardDocument } from "../models/RfidCard.js";
import { Vehicle } from "../models/Vehicle.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { ParkingSession } from "../models/ParkingSession.js";

function normalizePlate(plate: string): string {
  return (plate || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

function normalizeUid(uid?: string | null): string {
  return (uid || "")
    .trim()
    .toUpperCase()
    .replace(/[\s:-]+/g, "");
}

function serializeCard(card: RfidCardDocument) {
  return {
    id: card._id.toString(),
    uid: normalizeUid(card.uid),
    cardId: card.cardId,
    ownerName: card.ownerName,
    plate: card.plate,
    userType: card.userType,
    cardType: card.cardType,
    status: card.status,
    userId: card.userId?.toString(),
    vehicleId: card.vehicleId?.toString(),
    notes: card.notes,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

export async function listRfidCards(_request: Request, response: Response) {
  const cards = await RfidCard.find().sort({ createdAt: -1 }).limit(500);
  // Gộp phiên đỗ xe đang mở theo thẻ để hiển thị trạng thái "Đang dùng" và
  // lấy biển số thực tế của phiên (thẻ Khách khi dùng sẽ có biển của phiên).
  const identifiers = cards.flatMap((card) =>
    [card.uid, card.cardId].filter(Boolean),
  );
  const activeSessions = identifiers.length
    ? await ParkingSession.find({
        status: "Đang gửi",
        $or: [
          { rfidCardId: { $in: identifiers } },
          { exitRfidUid: { $in: identifiers } },
        ],
      })
        .select("plate checkInAt rfidCardId exitRfidUid")
        .lean()
    : [];
  const activeByKey = new Map<
    string,
    { plate: string; checkInAt?: Date; rfidCardId?: string }
  >();
  for (const session of activeSessions) {
    for (const key of [session.rfidCardId, session.exitRfidUid]) {
      if (key) {
        activeByKey.set(String(key).toUpperCase(), {
          plate: session.plate || "",
          checkInAt: session.checkInAt,
          rfidCardId: session.rfidCardId,
        });
      }
    }
  }
  const serialized = cards.map((card) => {
    const session =
      activeByKey.get(card.uid.toUpperCase()) ||
      (card.cardId ? activeByKey.get(card.cardId.toUpperCase()) : undefined);
    return {
      ...serializeCard(card),
      activeSession: session
        ? { plate: session.plate, checkInAt: session.checkInAt }
        : null,
    };
  });
  response.json({ cards: serialized });
}

/**
 * Danh sách cư dân đang có gói active (Subscription.status = active, endDate > now)
 * mà xe của họ CHƯA được gán vào thẻ RFID active nào.
 * Dùng cho form Thêm / Sửa thẻ RFID để admin/staff chọn và tự điền biển số.
 */
export async function listRfidAssignments(
  _request: Request,
  response: Response,
) {
  const cards = await RfidCard.find()
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(500)
    .lean();
  const identifiers = cards.flatMap((card) =>
    [card.uid, card.cardId].filter(Boolean),
  );
  const sessions = identifiers.length
    ? await ParkingSession.find({
        status: "Đang gửi",
        $or: [
          { rfidCardId: { $in: identifiers } },
          { exitRfidUid: { $in: identifiers } },
        ],
      }).lean()
    : [];
  const activeByIdentifier = new Map<string, (typeof sessions)[number]>();
  for (const session of sessions) {
    for (const identifier of [session.rfidCardId, session.exitRfidUid]) {
      if (identifier) activeByIdentifier.set(identifier.toUpperCase(), session);
    }
  }
  response.json({
    assignments: cards.map((card) => {
      const session =
        activeByIdentifier.get(card.uid.toUpperCase()) ||
        (card.cardId
          ? activeByIdentifier.get(card.cardId.toUpperCase())
          : undefined);
      const isMember = card.cardType === "member";
      return {
        id: card._id.toString(),
        uid: card.uid,
        cardId: card.cardId || card.uid,
        cardType: card.cardType,
        status: card.status,
        ownerName: isMember ? card.ownerName : session?.ownerName || "Guest",
        plate: isMember ? card.plate : session?.plate || "",
        sessionId: session?._id.toString(),
        sessionStatus: session ? session.status : "Không có phiên",
        updatedAt: card.updatedAt,
      };
    }),
  });
}
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
  const uid = normalizeUid(request.params.uid);
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
  const body = z
    .object({
      uid: z.string().trim().min(1).optional(),
      cardId: z.string().trim().min(1).optional(),
      ownerName: z.string().trim().optional(),
      plate: z.string().trim().optional(),
      userType: z.enum(["resident", "guest"]).optional(),
      notes: z.string().trim().optional(),
    })
    .refine((d) => Boolean(d.uid || d.cardId), {
      message: "Phải cung cấp uid hoặc cardId.",
    })
    .transform((d) => ({
      ...d,
      uid: d.uid || d.cardId!,
    }))
    .parse(request.body);

  const uid = normalizeUid(body.uid);
  const isMember = body.userType === "resident";
  const plate = normalizePlate(body.plate || "");

  // Khi tạo thẻ cho cư dân: tìm gói dịch vụ active của xe để bind 1-1.
  // Nếu không tìm thấy gói active → vẫn tạo thẻ member nhưng không bind
  // (admin có thể bind sau qua giao diện sửa thẻ).
  let boundSubscriptionId: string | null = null;
  let memberUserId: string | null = null;
  let memberVehicleId: string | null = null;
  if (isMember && plate) {
    const vehicle = await Vehicle.findOne({ plate });
    if (vehicle) {
      memberVehicleId = vehicle._id.toString();
      memberUserId = vehicle.userId?.toString() || null;
      const sub = await Subscription.findOne({
        primaryVehicleId: vehicle._id,
        status: "active",
        endDate: { $gt: new Date() },
      });
      if (sub) boundSubscriptionId = sub._id.toString();
    }
  }

  const existing = await RfidCard.findOne({ uid });
  if (existing) {
    // Nếu UID đã tồn tại và là thẻ guest, cho phép nâng cấp thành member card
    // (thay vì báo lỗi duplicate) để hỗ trợ kịch bản cấp thẻ thay thế.
    if (isMember && existing.cardType === "guest") {
      existing.ownerName = body.ownerName?.trim() || plate || "Thành viên";
      existing.plate = plate;
      existing.userType = "resident";
      existing.cardType = "member";
      existing.status = "active";
      if (body.notes?.trim()) existing.notes = body.notes.trim();
      if (memberVehicleId)
        existing.vehicleId = new mongoose.Types.ObjectId(memberVehicleId);
      if (memberUserId)
        existing.userId = new mongoose.Types.ObjectId(memberUserId);
      await existing.save();

      if (boundSubscriptionId) {
        await Subscription.updateOne(
          { _id: boundSubscriptionId },
          { $set: { rfidCardId: existing._id } },
        );
      }

      response.status(200).json({
        ok: true,
        upgraded: true,
        card: serializeCard(existing),
      });
      return;
    }

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
    cardId: body.cardId || uid,
    ownerName: isMember
      ? body.ownerName?.trim() || plate || "Thành viên"
      : "Guest",
    plate: isMember ? plate : "",
    userType: isMember ? "resident" : "guest",
    cardType: isMember ? "member" : "guest",
    status: isMember ? "active" : "available",
    notes: body.notes,
    ...(memberVehicleId ? { vehicleId: memberVehicleId } : {}),
    ...(memberUserId ? { userId: memberUserId } : {}),
  });

  // Gán rfidCardId vào gói dịch vụ để cổng nhận diện thẻ này thuộc gói nào.
  if (boundSubscriptionId) {
    await Subscription.updateOne(
      { _id: boundSubscriptionId },
      { $set: { rfidCardId: card._id } },
    );
  }

  if (request.user?.id) {
    await createAuditLog({
      action: "rfid_card_created",
      entityType: "RfidCard",
      entityId: card._id,
      performedBy: request.user.id,
      changes: {
        new: {
          uid: card.uid,
          cardType: card.cardType,
          status: card.status,
          ownerName: card.ownerName,
          plate: card.plate,
        },
      },
    }).catch((err) => console.error("Error creating audit log for create card:", err));
  }

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

  const changesBefore = {
    ownerName: card.ownerName,
    plate: card.plate,
    userType: card.userType,
    notes: card.notes,
  };
  if (body.ownerName !== undefined) card.ownerName = body.ownerName;
  if (body.plate !== undefined) card.plate = normalizePlate(body.plate);
  if (body.userType !== undefined) card.userType = body.userType;
  if (body.notes !== undefined) card.notes = body.notes;

  await card.save();

  if (request.user?.id) {
    await createAuditLog({
      action: "rfid_card_updated",
      entityType: "RfidCard",
      entityId: card._id,
      performedBy: request.user.id,
      changes: {
        old: changesBefore,
        new: {
          ownerName: card.ownerName,
          plate: card.plate,
          userType: card.userType,
          notes: card.notes,
        },
      },
    }).catch((err) => console.error("Error creating audit log for rfid update:", err));
  }

  if (request.user?.id) {
    await createAuditLog({
      action: "rfid_card_restored",
      entityType: "RfidCard",
      entityId: card._id,
      performedBy: request.user.id,
      changes: {
        new: {
          status: "available",
          cardType: "guest",
          userType: "guest",
          ownerName: "Guest",
        },
      },
    }).catch((err) => console.error("Error creating audit log for restore:", err));
  }

  response.json({ ok: true, card: serializeCard(card) });
}

export async function deleteRfidCard(request: Request, response: Response) {
  const card = await RfidCard.findByIdAndDelete(request.params.id);
  if (!card) {
    response
      .status(404)
      .json({ ok: false, message: "Không tìm thấy thẻ RFID." });
    return;
  }
  response.json({
    ok: true,
    message: `Đã xóa thẻ ${card.uid}`,
    uid: card.uid,
  });
}

/**
 * Khôi phục một thẻ đang bị hỏng/mất (nhưng vẫn quét được bình thường) về trạng
 * thái hoạt động: hạ xuống loại Khách (guest), làm mới toàn bộ thông tin và ngắt
 * liên kết với gói dịch vụ.
 */
export async function restoreRfidCard(request: Request, response: Response) {
  const card = await RfidCard.findById(request.params.id);
  if (!card) {
    response
      .status(404)
      .json({ ok: false, message: "Không tìm thấy thẻ RFID." });
    return;
  }
  // Cho phép `force=true` để admin khôi phục thẻ đang gắn với phiên gửi xe
  // (ví dụ: thẻ cũ đã được thay thế, cần đóng phiên đang mở và làm sạch dữ
  // liệu để tái sử dụng làm thẻ guest). Mặc định vẫn chặn để tránh xóa nhầm
  // phiên đang hoạt động.
  const body = z
    .object({ force: z.coerce.boolean().optional() })
    .parse(request.body ?? {});
  if (card.status === "in-use" && !body.force) {
    response.status(409).json({
      ok: false,
      message:
        "Không thể khôi phục thẻ đang được sử dụng cho xe. Hãy trả thẻ trước.",
    });
    return;
  }
  // Nếu force, đóng phiên gửi xe đang mở của thẻ để dọn trạng thái in-use.
  if (card.status === "in-use" && body.force) {
    const identifiers = [card.uid, card.cardId].filter(Boolean) as string[];
    await ParkingSession.updateMany(
      {
        status: "Đang gửi",
        $or: [
          { rfidCardId: { $in: identifiers } },
          { exitRfidUid: { $in: identifiers } },
        ],
      },
      {
        $set: {
          status: "Đã hoàn thành",
          checkOutAt: new Date(),
          rfidReturnedAt: new Date(),
        },
      },
    );
  }

  card.status = "available";
  card.cardType = "guest";
  card.userType = "guest";
  card.ownerName = "Guest";
  card.plate = "";
  card.userId = undefined;
  card.vehicleId = undefined;
  card.replacementOf = undefined;
  card.replacedBy = undefined;
  card.damagedAt = undefined;
  card.damagedReason = undefined;
  card.lostAt = undefined;
  card.blockedAt = undefined;
  card.blockedReason = undefined;
  card.returnedAt = new Date();
  await card.save();

  // Gỡ liên kết với gói dịch vụ nếu thẻ này vẫn được gán, và ngắt quan hệ
  // thay thế (replacementOf/replacedBy) để không còn tham chiếu mồ côi.
  await Promise.all([
    Subscription.updateMany(
      { rfidCardId: card._id },
      { $unset: { rfidCardId: 1 } },
    ),
    RfidCard.updateMany(
      { $or: [{ replacementOf: card._id }, { replacedBy: card._id }] },
      { $unset: { replacementOf: 1, replacedBy: 1 } },
    ),
  ]);

  response.json({ ok: true, card: serializeCard(card) });
}

export async function setRfidCardStatus(request: Request, response: Response) {
  const body = z
    .object({
      status: z.enum(["active", "inactive"]),
    })
    .parse(request.body);

  const prevCard = await RfidCard.findById(request.params.id);
  const card = await RfidCard.findByIdAndUpdate(
    request.params.id,
    { $set: { status: body.status } },
    { new: true },
  );
  if (card && prevCard && request.user?.id) {
    await createAuditLog({
      action: "rfid_card_status_changed",
      entityType: "RfidCard",
      entityId: card._id,
      performedBy: request.user.id,
      changes: {
        old: { status: prevCard.status },
        new: { status: card.status },
      },
    }).catch((err) => console.error("Error creating audit log for status change:", err));
  }
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

  const uid = normalizeUid(body.uid);
  const ownerName = body.ownerName?.trim() || "Guest";
  const plate = normalizePlate(body.plate || "");
  const userType = body.userType || "guest";
  let card = await RfidCard.findOne({ uid });
  if (card) {
    const blockedStatuses = ["inactive", "lost", "blocked", "damaged"];
    if (blockedStatuses.includes(card.status)) {
      response.status(403).json({
        ok: false,
        code: `CARD_${card.status.toUpperCase().replace(/-/g, "_")}`,
        message: `RFID card is ${card.status} and cannot be used.`,
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
 */ export async function exportAllCards(
  _request: Request,
  response: Response,
) {
  const cards = await RfidCard.find({
    status: { $in: ["active", "in-use", "available"] },
  }).sort({
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
// Staff desk lookup sau khi quét thẻ: trả toàn bộ thông tin thẻ + xe + gói.
export async function lookupByUid(request: Request, response: Response) {
  const uid = normalizeUid(request.params.uid);
  if (!uid) {
    response
      .status(400)
      .json({ ok: false, message: "UID không được để trống." });
    return;
  }
  const card = await RfidCard.findOne({ $or: [{ uid }, { cardId: uid }] });
  if (!card) {
    response.json({ ok: true, card: null, vehicle: null, subscription: null });
    return;
  }
  const plate = card.plate ? normalizePlate(card.plate) : "";
  const now = new Date();
  const vehicle = plate ? await Vehicle.findOne({ plate }) : null;
  const subscription = vehicle
    ? await Subscription.findOne({
        primaryVehicleId: vehicle._id,
        status: "active",
        endDate: { $gt: now },
      })
    : null;
  // Thẻ đang gắn phiên nào thì báo luôn để staff khỏi phải thử.
  const activeSession =
    card.status === "in-use"
      ? await ParkingSession.findOne({
          status: "Đang gửi",
          $or: [
            ...(card.uid ? [{ rfidCardId: card.uid }] : []),
            ...(card.cardId ? [{ rfidCardId: card.cardId }] : []),
          ],
        })
          .select("plate checkInAt")
          .sort({ checkInAt: -1 })
          .lean()
      : null;
  // Anti-passback theo biển: xe của thẻ này còn phiên đang gửi (vào bằng đường khác).
  const plateActiveSession = plate
    ? await ParkingSession.findOne({
        status: "Đang gửi",
        $or: [{ plate }, { entryDetectedPlate: plate }, { manualPlate: plate }],
      })
        .select("plate checkInAt")
        .sort({ checkInAt: -1 })
        .lean()
    : null;
  response.json({
    ok: true,
    card: serializeCard(card),
    vehicle: vehicle
      ? {
          id: vehicle._id.toString(),
          plate: vehicle.plate,
          ownerName: vehicle.ownerName,
          status: vehicle.status,
        }
      : null,
    isSubscriber: !!subscription,
    subscription: subscription
      ? { planName: subscription.planName, endDate: subscription.endDate }
      : null,
    activeSession: activeSession
      ? { plate: activeSession.plate, checkInAt: activeSession.checkInAt }
      : null,
    plateActiveSession: plateActiveSession
      ? {
          plate: plateActiveSession.plate,
          checkInAt: plateActiveSession.checkInAt,
        }
      : null,
  });
}

export async function lookupByPlate(request: Request, response: Response) {
  const plate = normalizePlate(String(request.params.plate || ""));
  if (!plate) {
    response.status(400).json({ ok: false, message: "Biển số không hợp lệ." });
    return;
  }
  const card = await RfidCard.findOne({
    plate,
    status: { $in: ["active", "in-use"] },
  });

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

export async function replaceActiveSessionRfid(
  request: Request,
  response: Response,
) {
  const body = z
    .object({ plate: z.string().min(3), cardId: z.string().min(1) })
    .parse(request.body);
  const plate = normalizePlate(body.plate);
  const session = await ParkingSession.findOne({
    plate,
    status: "Đang gửi",
  }).sort({ checkInAt: -1 });
  if (!session) {
    response
      .status(404)
      .json({
        ok: false,
        message: "Không tìm thấy phiên đang gửi của biển số này.",
      });
    return;
  }
  const card = await RfidCard.findOne({
    $or: [{ _id: body.cardId }, { cardId: body.cardId }, { uid: body.cardId }],
    status: "available",
  });
  if (!card) {
    response
      .status(409)
      .json({
        ok: false,
        message: "Thẻ RFID không tồn tại hoặc không còn sẵn sàng.",
      });
    return;
  }
  session.rfidCardId = card.cardId || card.uid;
  session.rfidAssignedAt = new Date();
  await session.save();
  card.status = "in-use";
  card.plate = plate;
  await card.save();
  response.json({ ok: true, session, card: serializeCard(card) });
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
  const vehicles = await Vehicle.find({ userId }).select("_id plate").lean();
  const plates = vehicles.map((vehicle) =>
    (vehicle.plate || "").trim().toUpperCase(),
  );
  const cards = await RfidCard.find({
    cardType: "member",
    $or: [
      { userId },
      ...(plates.length ? [{ plate: { $in: plates } }] : []),
      ...(vehicles.length
        ? [{ vehicleId: { $in: vehicles.map((vehicle) => vehicle._id) } }]
        : []),
    ],
  })
    .sort({ createdAt: -1 })
    .limit(50);
  response.json({ cards: cards.map(serializeCard) });
}

export async function getRfidReportsStatus(_request: Request, response: Response) {
  const [available, inUse, lost, blocked, total] = await Promise.all([
    RfidCard.countDocuments({ status: "available" }),
    RfidCard.countDocuments({ status: "in-use" }),
    RfidCard.countDocuments({ status: "lost" }),
    RfidCard.countDocuments({ status: "blocked" }),
    RfidCard.countDocuments(),
  ]);
  response.json({ available, inUse, lost, blocked, total });
}

export async function getRfidReportsUsage(request: Request, response: Response) {
  const { from, to } = request.query;
  const query: Record<string, unknown> = {};
  if (from || to) {
    query.createdAt = {};
    if (from) (query.createdAt as Record<string, unknown>).$gte = new Date(String(from));
    if (to) (query.createdAt as Record<string, unknown>).$lte = new Date(String(to));
  }
  // Group scan logs by date
  const RfidScanLog = (await import("../models/RfidScanLog.js")).RfidScanLog;
  const logs = await RfidScanLog.find(query).sort({ createdAt: 1 });
  // Aggregate by day
  const byDay: Record<string, { day: string; total: number; success: number; failed: number; blocked: number }> = {};
  for (const log of logs) {
    const day = log.createdAt.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { day, total: 0, success: 0, failed: 0, blocked: 0 };
    byDay[day].total++;
    const s = log.status as string;
    if (s === "success") byDay[day].success++;
    else if (s === "failed" || s === "mismatch") byDay[day].failed++;
    else if (s === "blocked") byDay[day].blocked++;
  }
  response.json({ rows: Object.values(byDay) });
}


/**
 * Lấy lịch sử thay đổi thẻ RFID (AuditLog) và lịch sử quét thẻ (RfidScanLog).
 */
export async function getRfidCardHistoryHandler(request: Request, response: Response) {
  const { id } = request.params;
  const isObjectId = mongoose.isValidObjectId(id);
  
  const card = await RfidCard.findOne(
    isObjectId ? { $or: [{ _id: id }, { uid: id }, { cardId: id }] } : { $or: [{ uid: id }, { cardId: id }] }
  );

  if (!card) {
    response.status(404).json({ ok: false, message: "Không tìm thấy thẻ RFID." });
    return;
  }

  const cardObjectId = card._id;
  const cardIdentifiers = [card.uid, card.cardId].filter(Boolean) as string[];

  // 1. Audit logs liên quan đến thẻ này
  const auditLogs = await AuditLog.find({
    entityType: "RfidCard",
    entityId: cardObjectId,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("performedBy", "name email");

  // 2. Scan logs liên quan đến thẻ này
  const RfidScanLog = (await import("../models/RfidScanLog.js")).RfidScanLog;
  const scanLogs = await RfidScanLog.find({
    cardId: { $in: cardIdentifiers },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("performedBy", "name email");

  // Map lại format dễ hiển thị ở frontend
  const auditHistory = auditLogs.map((log: any) => ({
    id: log._id.toString(),
    action: log.action,
    actionLabel: mapRfidActionLabel(log.action),
    performedBy: log.performedBy
      ? {
          id: log.performedBy._id?.toString(),
          name: log.performedBy.name,
          email: log.performedBy.email,
        }
      : null,
    changes: log.changes || {},
    createdAt: log.createdAt.toISOString(),
  }));

  const scanHistory = scanLogs.map((log: any) => ({
    id: log._id.toString(),
    action: log.action,
    status: log.status,
    failureReason: log.failureReason || null,
    plateDetected: log.plateDetected || null,
    performedBy: log.performedBy ? log.performedBy.name : null,
    createdAt: log.createdAt.toISOString(),
  }));

  response.json({
    ok: true,
    card: serializeCard(card),
    auditHistory,
    scanHistory,
    history: scanHistory, // backward compatibility với frontend rfid-cards-view
  });
}

function mapRfidActionLabel(action: string): string {
  const map: Record<string, string> = {
    rfid_card_created: "Tạo thẻ mới",
    rfid_card_updated: "Cập nhật thông tin thẻ",
    rfid_card_status_changed: "Thay đổi trạng thái thẻ",
    rfid_card_restored: "Khôi phục thẻ",
    rfid_card_deleted: "Xóa thẻ",
    rfid_card_sold: "Bán thẻ thành viên",
    rfid_card_returned: "Trả thẻ / Thu hồi thẻ",
    rfid_card_lost: "Báo mất thẻ",
    rfid_card_damaged: "Báo hỏng thẻ",
  };
  return map[action] || action;
}


/**
 * Xóa thẻ hoặc reset dữ liệu thẻ hàng loạt (bulk-clear).
 */
export async function bulkClearRfidCards(request: Request, response: Response) {
  const body = z
    .object({
      mode: z.enum(["reset", "delete"]),
      ids: z.array(z.string()).optional(),
      confirm: z.string(),
    })
    .parse(request.body);

  if (body.confirm !== "RESET_ALL_RFID_DATA") {
    response.status(400).json({ ok: false, message: "Chuỗi xác nhận không chính xác." });
    return;
  }

  const query: any = {};
  if (body.ids && body.ids.length > 0) {
    query._id = { $in: body.ids.filter((id) => mongoose.isValidObjectId(id)) };
  }

  if (body.mode === "delete") {
    // Xóa thẻ: ngắt liên kết xe và phiên, sau đó xóa thẻ khỏi DB
    const cards = await RfidCard.find(query);
    const cardIds = cards.map((c) => c._id);
    const uids = cards.map((c) => c.uid).filter(Boolean);

    await Promise.all([
      Vehicle.updateMany({ rfidCardId: { $in: cardIds } }, { $unset: { rfidCardId: 1 } }),
      Subscription.updateMany({ rfidCardId: { $in: cardIds } }, { $unset: { rfidCardId: 1 } }),
      RfidCard.deleteMany({ _id: { $in: cardIds } }),
    ]);

    response.json({
      ok: true,
      message: `Đã xóa thành công ${cardIds.length} thẻ RFID.`,
      count: cardIds.length,
    });
    return;
  }

  if (body.mode === "reset") {
    // Reset về guest available
    const cards = await RfidCard.find(query);
    const cardIds = cards.map((c) => c._id);

    await Promise.all([
      Vehicle.updateMany({ rfidCardId: { $in: cardIds } }, { $unset: { rfidCardId: 1 } }),
      Subscription.updateMany({ rfidCardId: { $in: cardIds } }, { $unset: { rfidCardId: 1 } }),
      RfidCard.updateMany(
        { _id: { $in: cardIds } },
        {
          $set: {
            status: "available",
            cardType: "guest",
            userType: "guest",
            ownerName: "Guest",
          },
          $unset: {
            plate: 1,
            userId: 1,
            vehicleId: 1,
            notes: 1,
            blockedReason: 1,
          },
        }
      ),
    ]);

    response.json({
      ok: true,
      message: `Đã reset thành công ${cardIds.length} thẻ RFID về trạng thái khách có sẵn.`,
      count: cardIds.length,
    });
    return;
  }

  response.status(400).json({ ok: false, message: "Chế độ không hợp lệ." });
}
