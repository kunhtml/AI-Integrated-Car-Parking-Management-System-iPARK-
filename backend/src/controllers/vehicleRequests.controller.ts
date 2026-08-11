import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { Vehicle } from "../models/Vehicle.js";
import { VehicleRequest } from "../models/VehicleRequest.js";
import { Subscription } from "../models/Subscription.js";
import { serializeVehicle } from "../utils/serializers.js";
import { VehicleDocument } from "../models/Vehicle.js";

type SerializedRequest = {
  id: string;
  vehicleId: string;
  subscriptionId: string;
  userId: string;
  type: "edit" | "delete";
  status: "pending" | "approved" | "rejected";
  requestedChanges?: Record<string, unknown>;
  reason?: string;
  adminNote?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  vehicle?: ReturnType<typeof serializeVehicle>;
  user?: { name?: string; email?: string | null; phone?: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeRequest(
  vr: {
    _id: Types.ObjectId;
    vehicleId: unknown;
    subscriptionId: unknown;
    userId: unknown;
    type: "edit" | "delete";
    status: "pending" | "approved" | "rejected";
    requestedChanges?: Record<string, unknown>;
    reason?: string;
    adminNote?: string;
    resolvedBy?: Types.ObjectId;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  },
  includeVehicle = false,
): SerializedRequest {
  const vehicleIdRaw = vr.vehicleId as unknown as {
    _id: Types.ObjectId;
    plate: string;
    ownerName: string;
    vehicleType: string;
    status: string;
    userId?: Types.ObjectId;
    isCompanyVehicle: boolean;
    createdAt: Date;
    updatedAt: Date;
    brand?: string;
    chassisNo?: string;
    color?: string;
    engineNo?: string;
    model?: string;
    ownerAddress?: string;
    year?: number;
  } | null;
  const vehicleIdStr =
    vehicleIdRaw != null &&
    typeof vehicleIdRaw === "object" &&
    "_id" in vehicleIdRaw
      ? vehicleIdRaw._id.toString()
      : String(vr.vehicleId);

  const subscriptionIdRaw = vr.subscriptionId as unknown as {
    _id: Types.ObjectId;
  } | null;
  const subscriptionIdStr =
    subscriptionIdRaw != null &&
    typeof subscriptionIdRaw === "object" &&
    "_id" in subscriptionIdRaw
      ? subscriptionIdRaw._id.toString()
      : String(vr.subscriptionId);

  const userIdRaw = vr.userId as unknown as { _id: Types.ObjectId } | null;
  const userIdStr =
    userIdRaw != null && typeof userIdRaw === "object" && "_id" in userIdRaw
      ? userIdRaw._id.toString()
      : String(vr.userId);

  const resolvedByRaw = vr.resolvedBy as unknown as {
    _id: Types.ObjectId;
  } | null;
  const resolvedByStr =
    resolvedByRaw != null &&
    typeof resolvedByRaw === "object" &&
    "_id" in resolvedByRaw
      ? resolvedByRaw._id.toString()
      : vr.resolvedBy?.toString();

  const vehicle =
    includeVehicle && vehicleIdRaw != null
      ? serializeVehicle(vehicleIdRaw as unknown as VehicleDocument)
      : undefined;

  return {
    id: vr._id.toString(),
    vehicleId: vehicleIdStr,
    subscriptionId: subscriptionIdStr,
    userId: userIdStr,
    type: vr.type,
    status: vr.status,
    requestedChanges: vr.requestedChanges,
    reason: vr.reason,
    adminNote: vr.adminNote,
    resolvedBy: resolvedByStr,
    resolvedAt: vr.resolvedAt,
    vehicle,
    user: (() => {
      const u = vr.userId as unknown as {
        _id: Types.ObjectId;
        name?: string;
        email?: string;
        phone?: string;
      } | null;
      if (!u || typeof u !== "object") return null;
      return { name: u.name, email: u.email ?? null, phone: u.phone ?? null };
    })(),
    createdAt: vr.createdAt,
    updatedAt: vr.updatedAt,
  };
}

export async function listVehicleRequests(
  request: Request,
  response: Response,
) {
  const isAdmin = request.user?.role === "admin";

  let filter: Record<string, unknown> = {};
  if (isAdmin) {
    if (request.query.status && request.query.status !== "all")
      filter.status = request.query.status;
    if (request.query.type) filter.type = request.query.type;
  } else {
    filter.userId = request.user?.id;
    if (request.query.status && request.query.status !== "all")
      filter.status = request.query.status;
  }

  const requests = await VehicleRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate({ path: "vehicleId", model: "Vehicle" })
    .populate({ path: "subscriptionId", model: "Subscription", select: "id" })
    .populate({ path: "userId", model: "User", select: "name email phone" })
    .populate({ path: "resolvedBy", model: "User", select: "name" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serialized = requests.map((r: any) => serializeRequest(r, true));
  response.json({ requests: serialized });
}

export async function createVehicleRequest(
  request: Request,
  response: Response,
) {
  const body = z
    .object({
      vehicleId: z.string().min(1),
      subscriptionId: z.string().min(1),
      type: z.enum(["edit", "delete"]),
      requestedChanges: z
        .object({
          plate: z.string().optional(),
          ownerName: z.string().optional(),
          ownerPhone: z.string().optional(),
          ownerAddress: z.string().optional(),
          brand: z.string().optional(),
          model: z.string().optional(),
          color: z.string().optional(),
          year: z.number().optional(),
          engineNo: z.string().optional(),
          chassisNo: z.string().optional(),
          imageUrl: z.string().optional(),
          status: z.string().optional(),
        })
        .optional(),
      reason: z.string().optional(),
    })
    .parse(request.body);

  const vehicle = await Vehicle.findById(body.vehicleId);
  if (!vehicle) {
    response.status(404).json({ message: "Không tìm thấy phương tiện." });
    return;
  }

  const sub = await Subscription.findById(body.subscriptionId);
  if (!sub) {
    response.status(404).json({ message: "Không tìm thấy gói đăng ký." });
    return;
  }

  if (sub.userId.toString() !== request.user?.id) {
    response
      .status(403)
      .json({ message: "Bạn không có quyền gửi yêu cầu cho gói này." });
    return;
  }

  const existing = await VehicleRequest.findOne({
    vehicleId: body.vehicleId,
    subscriptionId: body.subscriptionId,
    type: body.type,
    status: "pending",
  });
  if (existing) {
    response
      .status(409)
      .json({ message: "Bạn đã có yêu cầu đang chờ duyệt cho xe này." });
    return;
  }

  if (body.type === "edit" && vehicle.status === "Blacklist") {
    vehicle.status = "Cần duyệt";
    vehicle.rejectionReason = undefined;
    await vehicle.save();
  }

  const req = await VehicleRequest.create({
    vehicleId: body.vehicleId,
    subscriptionId: body.subscriptionId,
    userId: request.user?.id,
    type: body.type,
    requestedChanges: body.requestedChanges,
    reason: body.reason,
  });

  response.status(201).json({
    request: {
      id: req._id.toString(),
      vehicleId: String(body.vehicleId),
      subscriptionId: String(body.subscriptionId),
      userId: String(request.user?.id ?? ""),
      type: req.type,
      status: req.status,
      requestedChanges: req.requestedChanges,
      reason: req.reason,
      adminNote: undefined,
      resolvedBy: undefined,
      resolvedAt: undefined,
      vehicle: undefined,
      user: request.user
        ? {
            name: request.user.name,
            email: request.user.email ?? null,
            phone: null,
          }
        : null,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    },
  });
}

export async function resolveVehicleRequest(
  request: Request,
  response: Response,
) {
  const body = z
    .object({
      id: z.string().min(1),
      action: z.enum(["approved", "rejected"]),
      adminNote: z.string().optional(),
    })
    .parse(request.body);

  const vr = await VehicleRequest.findById(body.id);
  if (!vr) {
    response.status(404).json({ message: "Không tìm thấy yêu cầu." });
    return;
  }
  if (vr.status !== "pending") {
    response.status(409).json({ message: "Yêu cầu này đã được xử lý." });
    return;
  }

  vr.status = body.action;
  vr.adminNote = body.adminNote;
  vr.resolvedBy = request.user?.id
    ? new mongoose.Types.ObjectId(request.user.id)
    : undefined;
  vr.resolvedAt = new Date();

  if (body.action === "approved") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vehicleDoc = (await Vehicle.findById(vr.vehicleId)) as any;
    const sub = vr.subscriptionId
      ? await Subscription.findById(vr.subscriptionId)
      : null;

    // Xe mới đăng ký → chỉ cần cập nhật status
    if (
      vr.type === "edit" &&
      vr.requestedChanges?.status === "Đã đăng ký" &&
      vehicleDoc
    ) {
      vehicleDoc.status = "Đã đăng ký";
      await vehicleDoc.save();
    } else if (vr.type === "edit" && vr.requestedChanges && vehicleDoc && sub) {
      const changes = vr.requestedChanges as Record<string, unknown>;
      if (changes.plate) {
        const existing = await Vehicle.findOne({
          plate: (changes.plate as string).toUpperCase().replace(/[\s-]+/g, ""),
        });
        if (existing && existing._id.toString() !== vehicleDoc._id.toString()) {
          response
            .status(409)
            .json({ message: "Biển số đã tồn tại trong hệ thống." });
          return;
        }
        vehicleDoc.plate = (changes.plate as string)
          .toUpperCase()
          .replace(/[\s-]+/g, "");
      }
      if (changes.ownerName !== undefined)
        vehicleDoc.ownerName = changes.ownerName as string;
      if (changes.ownerPhone !== undefined)
        vehicleDoc.ownerPhone = changes.ownerPhone as string | undefined;
      if (changes.ownerAddress !== undefined)
        vehicleDoc.ownerAddress = changes.ownerAddress as string | undefined;
      if (changes.brand !== undefined)
        vehicleDoc.brand = changes.brand as string | undefined;
      if (changes.model !== undefined)
        vehicleDoc.model = changes.model as string | undefined;
      if (changes.color !== undefined)
        vehicleDoc.color = changes.color as string | undefined;
      if (changes.year !== undefined)
        vehicleDoc.year = changes.year as number | undefined;
      if (changes.engineNo !== undefined)
        vehicleDoc.engineNo = changes.engineNo as string | undefined;
      if (changes.chassisNo !== undefined)
        vehicleDoc.chassisNo = changes.chassisNo as string | undefined;
      if (changes.imageUrl !== undefined)
        vehicleDoc.imageUrl = changes.imageUrl as string | undefined;
      await vehicleDoc.save();
    }

    if (vr.type === "delete" && sub && sub.primaryVehicleId) {
      // Sau migration, mỗi sub chỉ gắn 1 xe — không thể xoá Vehicle của sub khác nếu
      // đây không phải primary vehicle của sub hiện tại.
      if (sub.primaryVehicleId.toString() === vr.vehicleId.toString()) {
        await Vehicle.findByIdAndDelete(vr.vehicleId.toString());
        await Subscription.findByIdAndDelete(sub._id);
      } else {
        console.warn(
          `[vehicleRequests] Vehicle ${vr.vehicleId.toString()} is not the primary of subscription ${sub._id}, skipping delete.`,
        );
      }
    }
  }

  await vr.save();
  await vr.populate({ path: "vehicleId", model: "Vehicle" });
  await vr.populate({
    path: "userId",
    model: "User",
    select: "name email phone",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serialized = serializeRequest(
    vr as any,
    vr.type === "edit" && body.action === "approved",
  );
  const extra =
    vr.type === "edit" && body.action === "approved"
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { vehicle: serializeVehicle(vr.vehicleId as any) }
      : {};

  response.json({ request: serialized, ...extra });
}
