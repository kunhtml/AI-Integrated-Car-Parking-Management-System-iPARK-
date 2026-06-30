import { Request, Response } from "express";
import { ParkingSlot } from "../models/ParkingSlot.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { Vehicle } from "../models/Vehicle.js";
import { User } from "../models/User.js";
import { Zone } from "../models/Zone.js";
import { getActivePricingConfigForZone } from "../services/pricing.service.js";
import { calculateParkingFee } from "../services/pricing.service.js";

/**
 * HM-04/HM-05: Public parking availability — no auth required.
 * Returns zones with available slot counts for public landing page.
 */
export async function publicAvailability(_request: Request, response: Response) {
  const zones = await Zone.find({ isActive: true }).sort({ displayOrder: 1 });

  const stats = await ParkingSlot.aggregate<{
    _id: { zoneId: string; status: string };
    count: number;
  }>([
    { $group: { _id: { zoneId: { $toString: "$zoneId" }, status: "$status" }, count: { $sum: 1 } } },
  ]);

  const statsMap = new Map<string, { total: number; empty: number; occupied: number }>();
  for (const row of stats) {
    const key = row._id.zoneId;
    if (!statsMap.has(key)) statsMap.set(key, { total: 0, empty: 0, occupied: 0 });
    const entry = statsMap.get(key)!;
    entry.total += row.count;
    if (row._id.status === "empty") entry.empty = row.count;
    if (row._id.status === "occupied") entry.occupied = row.count;
  }

  const result = zones.map((zone) => {
    const s = statsMap.get(zone._id.toString()) || { total: 0, empty: 0, occupied: 0 };
    return {
      zone: zone.name,
      description: zone.description,
      total: s.total,
      available: s.empty,
      occupied: s.occupied,
      allowedVehicleTypes: zone.allowedVehicleTypes,
    };
  });

  const totalAvailable = result.reduce((sum, z) => sum + z.available, 0);
  const totalCapacity = result.reduce((sum, z) => sum + z.total, 0);

  response.json({
    available: totalAvailable,
    capacity: totalCapacity,
    zones: result,
  });
}

/**
 * HM-04: Search parking info by query (zone name or vehicle type).
 */
export async function publicSearch(request: Request, response: Response) {
  const q = String(request.query.q || "").trim();
  if (!q) {
    response.status(400).json({ message: "Vui lòng nhập từ khóa tìm kiếm." });
    return;
  }

  const zones = await Zone.find({
    isActive: true,
    $or: [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { allowedVehicleTypes: { $regex: q, $options: "i" } },
    ],
  });

  const slotCounts = await Promise.all(
    zones.map(async (zone) => {
      const empty = await ParkingSlot.countDocuments({ zoneId: zone._id, status: "empty" });
      const total = await ParkingSlot.countDocuments({ zoneId: zone._id });
      return { zone: zone.name, description: zone.description, available: empty, total };
    }),
  );

  response.json({ results: slotCounts });
}

/**
 * HM-06: Tra cứu phiên gửi xe theo biển số (công khai)
 * Trả về thông tin đầy đủ: thông tin xe, phiên đang gửi, expiry time
 */
export async function lookupSession(request: Request, response: Response) {
  const plate = String(request.query.plate || "").trim().toUpperCase();

  if (!plate || plate.length < 5) {
    response.status(400).json({ message: "Vui lòng nhập biển số xe (ít nhất 5 ký tự)." });
    return;
  }

  // 1. Kiểm tra xe đã đăng ký trong hệ thống
  const vehicle = await Vehicle.findOne({ plate }).select("plate ownerName vehicleType status brand color ownerEmail");

  // 2a. Kiểm tra phiên đỗ đang hoạt động
  const activeSession = await ParkingSession.findOne({ plate, status: "Đang gửi" })
    .sort({ checkInAt: -1 })
    .populate("slotId");

  // 2b. Nếu không có phiên đang gửi, kiểm tra phiên đã hoàn thành gần đây (< 24h)
  let completedSession = null;
  if (!activeSession) {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    completedSession = await ParkingSession.findOne({
      plate,
      status: "Đã hoàn thành",
      checkOutAt: { $gte: last24h },
    })
      .sort({ checkOutAt: -1 })
      .populate("slotId");
  }

  if (!activeSession && !completedSession) {
    // Không có phiên đang gửi - kiểm tra lịch sử
    const recentSessions = await ParkingSession.find({ plate })
      .sort({ checkInAt: -1 })
      .limit(5)
      .select("checkInAt checkOutAt slot fee paymentStatus status");

    response.json({
      found: false,
      plate,
      vehicle: vehicle ? {
        plate: vehicle.plate,
        ownerName: vehicle.ownerName,
        vehicleType: vehicle.vehicleType,
        status: vehicle.status,
        brand: vehicle.brand,
        color: vehicle.color,
      } : null,
      message: `Không tìm thấy phiên gửi xe nào đang hoạt động cho biển số ${plate}.`,
      recentSessions: recentSessions.map(s => ({
        checkInAt: s.checkInAt,
        checkOutAt: s.checkOutAt,
        slot: s.slot,
        fee: s.fee,
        paymentStatus: s.paymentStatus,
        status: s.status,
      })),
    });
    return;
  }

  // Nếu có phiên đã hoàn thành gần đây → hiển thị thông tin đã thanh toán
  if (completedSession) {
    const slotDoc = completedSession.slotId as any;
    response.json({
      found: true,
      plate,
      vehicle: vehicle ? {
        plate: vehicle.plate,
        ownerName: vehicle.ownerName,
        vehicleType: vehicle.vehicleType,
        status: vehicle.status,
        brand: vehicle.brand,
        color: vehicle.color,
      } : null,
      session: {
        id: completedSession._id,
        plate: completedSession.plate,
        ownerName: completedSession.ownerName,
        ownerEmail: completedSession.ownerEmail || null,
        slot: completedSession.slot,
        zone: slotDoc?.zoneId ? (await Zone.findById(slotDoc.zoneId))?.name : null,
        checkInAt: completedSession.checkInAt.toISOString(),
        checkInDate: completedSession.checkInAt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
        checkOutAt: completedSession.checkOutAt?.toISOString(),
        currentFee: completedSession.fee || 0,
        paymentStatus: completedSession.paymentStatus,
        paidAmount: completedSession.paidAmount || 0,
        fee: completedSession.fee,
        isPrepaid: false,
        isCompleted: true,
      },
    });
    return;
  }

  // activeSession is guaranteed non-null here (returned early if both are null)
  const session = activeSession!;

  // Convert checkInAt from UTC to local (UTC+7) before calculating fee
  const activeSessionCheckInLocal = new Date(session.checkInAt);
  activeSessionCheckInLocal.setHours(activeSessionCheckInLocal.getHours() + 7);

  // Tính thời gian đã gửi
  const parkingMinutes = Math.round((Date.now() - activeSessionCheckInLocal.getTime()) / 60000);
  const hours = Math.floor(parkingMinutes / 60);
  const mins = parkingMinutes % 60;
  const duration = hours > 0 ? `${hours} giờ ${mins} phút` : `${mins} phút`;

  // Lấy thông tin pricing để tính phí
  const slotDoc = session.slotId as any;
  const pricing = await getActivePricingConfigForZone(slotDoc?.zoneId);
  const feeBreakdown = calculateParkingFee(activeSessionCheckInLocal, new Date(), pricing);
  const currentFee = feeBreakdown.totalFee;

  // Kiểm tra xem đã thanh toán trước chưa
  const isPrepaid = session.paymentStatus === "fully_paid" || session.paymentStatus === "partial_paid";

  // Lấy thông tin user nếu có
  let userEmail: string | null = null;
  let userPhone: string | null = null;
  if (session.ownerUserId) {
    const user = await User.findById(session.ownerUserId).select("email phone");
    userEmail = user?.email || null;
    userPhone = user?.phone || null;
  }

  response.json({
    found: true,
    plate,
    vehicle: vehicle ? {
      plate: vehicle.plate,
      ownerName: vehicle.ownerName,
      vehicleType: vehicle.vehicleType,
      status: vehicle.status,
      brand: vehicle.brand,
      color: vehicle.color,
    } : null,
    session: {
      id: session._id,
      plate: session.plate,
      ownerName: session.ownerName,
      ownerEmail: session.ownerEmail || userEmail || null,
      slot: session.slot,
      zone: slotDoc?.zoneId ? (await Zone.findById(slotDoc.zoneId))?.name : null,
      checkInAt: session.checkInAt.toISOString(),
      checkInDate: session.checkInAt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
      parkingMinutes,
      duration,
      currentFee,
      feeBreakdown,
      paymentStatus: session.paymentStatus,
      paidAmount: session.paidAmount || 0,
      prepaidCheckoutAt: session.prepaidCheckoutAt
        ? session.prepaidCheckoutAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        : undefined,
      expectedCheckOutAt: session.expectedCheckOutAt?.toISOString(),
      isPrepaid,
      entryGate: session.entryGate || null,
    },
    user: {
      email: userEmail || null,
      phone: userPhone || null,
    },
  });
}

/**
 * HM-06: Tính phí cho thời gian ra dự kiến
 * POST /api/public/calculate-fee
 */
export async function calculateExitFee(request: Request, response: Response) {
  const { plate, expectedExitTime, extendMinutes } = request.body;

  if (!plate || plate.length < 5) {
    response.status(400).json({ message: "Vui lòng nhập biển số xe hợp lệ." });
    return;
  }

  const session = await ParkingSession.findOne({ plate: plate.toUpperCase(), status: "Đang gửi" })
    .sort({ checkInAt: -1 })
    .populate("slotId");

  if (!session) {
    response.status(404).json({ message: `Không tìm thấy phiên gửi xe đang hoạt động cho biển số ${plate}.` });
    return;
  }

  // Convert checkInAt from UTC to local (UTC+7) before calculating fee
  const sessionCheckInLocal = new Date(session.checkInAt);
  sessionCheckInLocal.setHours(sessionCheckInLocal.getHours() + 7);

  // Xác định thời gian ra
  let exitTime: Date;
  if (expectedExitTime) {
    exitTime = new Date(expectedExitTime);
  } else if (extendMinutes) {
    exitTime = new Date(Date.now() + extendMinutes * 60 * 1000);
  } else {
    exitTime = new Date(); // Thanh toán ngay
  }

  // Tính phí
  const slotDoc = session.slotId as any;
  const pricing = await getActivePricingConfigForZone(slotDoc?.zoneId);
  const feeBreakdown = calculateParkingFee(sessionCheckInLocal, exitTime, pricing);

  // Nếu đã thanh toán trước, chỉ tính phí cho thời gian gia hạn
  let additionalFee = feeBreakdown.totalFee;
  let totalFee = feeBreakdown.totalFee;

  if (session.paymentStatus === "fully_paid") {
    // Đã thanh toán đủ - tính phí bổ sung nếu gia hạn
    const paidAt = session.updatedAt;
    const currentFee = calculateParkingFee(sessionCheckInLocal, paidAt, pricing);
    additionalFee = Math.max(0, feeBreakdown.totalFee - currentFee.totalFee);
    totalFee = additionalFee;
  }

  // Lưu phí dự kiến vào phiên để bước tạo giao dịch/PayOS dùng đúng số tiền
  if (session.paymentStatus !== "fully_paid") {
    session.fee = feeBreakdown.totalFee;
    await session.save();
  }

  response.json({
    plate: session.plate,
    sessionId: session._id,
    checkInAt: session.checkInAt,
    exitTime,
    duration: feeBreakdown,
    additionalFee,
    totalFee,
    isPrepaid: session.paymentStatus === "fully_paid" || session.paymentStatus === "partial_paid",
  });
}

/**
 * Tính phí nhanh theo ngày + tùy chọn ra trước/sau 22h
 * POST /api/public/calculate-fee-quick
 */
export async function calculateFeeQuick(request: Request, response: Response) {
  const { plate, exitDate, exitAfter22h } = request.body;

  if (!plate || plate.length < 5) {
    response.status(400).json({ message: "Vui lòng nhập biển số xe hợp lệ." });
    return;
  }

  const session = await ParkingSession.findOne({ plate: plate.toUpperCase(), status: "Đang gửi" })
    .sort({ checkInAt: -1 })
    .populate("slotId");

  if (!session) {
    response.status(404).json({ message: `Không tìm thấy phiên gửi xe đang hoạt động cho biển số ${plate}.` });
    return;
  }

  const slotDoc = session.slotId as any;
  const pricing = await getActivePricingConfigForZone(slotDoc?.zoneId);
  const dayRate = pricing?.dayRate || 5000;
  const nightRate = pricing?.nightRate || 10000;

  // Tính giờ ra: nếu chọn sau 22h thì 22:00, không thì 21:00
  const exitHour = exitAfter22h ? 22 : 21;

  let exitTime: Date;
  if (exitDate) {
    // Parse date string as LOCAL date to avoid UTC offset issues (server is UTC+7)
    const [year, month, day] = exitDate.split("-").map(Number);
    const d = new Date(year, month - 1, day, exitHour, 0, 0, 0);
    exitTime = d;
  } else {
    // Mặc định: ngày mai, giờ đã chọn
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(exitHour, 0, 0, 0);
    exitTime = d;
  }

  // exitTime is built with server-local getters; compare checkInAt in the same frame.
  const checkInLocal = new Date(session.checkInAt);

  // Không cho ra quá khứ
  if (exitTime <= checkInLocal) {
    response.status(400).json({ message: "Thời gian ra phải sau giờ vào." });
    return;
  }

  const feeBreakdown = calculateParkingFee(checkInLocal, exitTime, pricing);
  const additionalFee = session.paymentStatus === "fully_paid"
    ? Math.max(0, feeBreakdown.totalFee - (session.paidAmount || 0))
    : feeBreakdown.totalFee;

  // Lưu phí vào session để createSessionTransaction đọc đúng giá trị
  session.fee = feeBreakdown.totalFee;
  await session.save();

  response.json({
    plate: session.plate,
    sessionId: session._id,
    checkInAt: session.checkInAt,
    exitTime,
    exitHour,
    feeBreakdown,
    dayRate,
    nightRate,
    totalFee: feeBreakdown.totalFee,
    additionalFee,
    paymentStatus: session.paymentStatus,
    paidAmount: session.paidAmount,
    isPrepaid: session.paymentStatus === "fully_paid" || session.paymentStatus === "partial_paid",
  });
}

/**
 * HM-06: Thanh toán trước / Pre-checkout
 * POST /api/public/pre-checkout
 */
export async function preCheckout(request: Request, response: Response) {
  const { plate, email, expectedExitTime } = request.body;

  if (!plate || plate.length < 5) {
    response.status(400).json({ message: "Vui lòng nhập biển số xe hợp lệ." });
    return;
  }

  const session = await ParkingSession.findOne({ plate: plate.toUpperCase(), status: "Đang gửi" })
    .sort({ checkInAt: -1 })
    .populate("slotId");

  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên gửi xe đang hoạt động." });
    return;
  }

  // exitTime is built with server-local getters; compare in the same frame.
  const confirmCheckInLocal = new Date(session.checkInAt);

  // Xác định thời gian ra
  const exitTime = expectedExitTime ? new Date(expectedExitTime) : new Date();

  // Tính phí
  const slotDoc = session.slotId as any;
  const pricing = await getActivePricingConfigForZone(slotDoc?.zoneId);
  const feeBreakdown = calculateParkingFee(confirmCheckInLocal, exitTime, pricing);

  // Lưu phí dự kiến; KHÔNG đổi trạng thái khi chưa thật sự trả tiền.
  session.fee = feeBreakdown.totalFee;
  session.paymentMethod = "payos";
  await session.save();

  // Tạo mã thanh toán unique
  const paymentCode = `IPK-${Date.now()}-${plate.replace(/[.\-\s]/g, "")}`;

  response.json({
    success: true,
    plate: session.plate,
    sessionId: session._id,
    checkInAt: session.checkInAt,
    exitTime,
    duration: feeBreakdown,
    totalFee: feeBreakdown.totalFee,
    paymentCode,
    paymentStatus: session.paymentStatus,
    message: "Đã chuẩn bị thanh toán. Vui lòng quét mã QR để hoàn tất.",
  });
}

/**
 * HM-06: Xác nhận thanh toán thành công
 * POST /api/public/confirm-payment
 */
export async function confirmPayment(request: Request, response: Response) {
  const { sessionId, paymentCode } = request.body;

  if (!sessionId) {
    response.status(400).json({ message: "Thiếu mã phiên." });
    return;
  }

  const session = await ParkingSession.findById(sessionId);
  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên." });
    return;
  }

  // Cập nhật trạng thái thanh toán
  session.paymentStatus = "fully_paid";
  session.paidAmount = session.fee;
  session.paymentMethod = "payos";
  await session.save();

  response.json({
    success: true,
    plate: session.plate,
    sessionId: session._id,
    paymentStatus: "fully_paid",
    message: "Thanh toán thành công. Bạn có thể ra bãi xe khi sẵn sàng.",
  });
}

/**
 * HM-06: Gia hạn thời gian gửi xe
 * POST /api/public/extend-session
 */
export async function extendSession(request: Request, response: Response) {
  const { plate, extendMinutes, expectedExtendTime } = request.body;

  if (!plate || plate.length < 5) {
    response.status(400).json({ message: "Vui lòng nhập biển số xe hợp lệ." });
    return;
  }

  const session = await ParkingSession.findOne({ plate: plate.toUpperCase(), status: "Đang gửi" })
    .sort({ checkInAt: -1 })
    .populate("slotId");

  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên gửi xe đang hoạt động." });
    return;
  }

  // Giờ ra dự kiến hiện tại (đã trả tiền tới mốc này) làm cơ sở gia hạn
  const checkInLocal = new Date(session.checkInAt);
  const oldExit = session.expectedCheckOutAt || session.prepaidCheckoutAt || new Date();

  // Tính giờ ra mới + số phút gia hạn
  let newExit: Date;
  if (expectedExtendTime) {
    newExit = new Date(expectedExtendTime);
    if (newExit <= oldExit) {
      response.status(400).json({ message: "Thời gian gia hạn phải sau giờ ra dự kiến hiện tại." });
      return;
    }
  } else if (extendMinutes && extendMinutes >= 30) {
    newExit = new Date(oldExit.getTime() + extendMinutes * 60000);
  } else {
    response.status(400).json({ message: "Thời gian gia hạn tối thiểu là 30 phút." });
    return;
  }
  const actualExtendMinutes = Math.round((newExit.getTime() - oldExit.getTime()) / 60000);

  // Phí gia hạn = phí(checkIn→giờ ra mới) − phí đã tính trước đó (session.fee).
  // calculateParkingFee tự áp giá ngày (06h-22h) / đêm (22h-06h) và cộng thêm ngày.
  const slotDoc = session.slotId as any;
  const pricing = await getActivePricingConfigForZone(slotDoc?.zoneId);
  const feeNew = calculateParkingFee(checkInLocal, newExit, pricing);
  const extensionFee = Math.max(0, feeNew.totalFee - (session.fee || 0));

  // Nếu PayOS bật, tạo link thanh toán thật cho khoản phí gia hạn
  const { PaymentConfig } = await import("../models/PaymentConfig.js");
  const cfg = await PaymentConfig.findOne({ isActive: true });
  const payosClientId = cfg?.payosClientId || process.env.PAYTOS_CLIENT_ID;
  const payosApiKey = cfg?.payosApiKey || process.env.PAYTOS_API_KEY;
  const payosEnabled = (cfg?.payosEnabled || process.env.PAYTOS_USE === "true") && payosClientId && payosApiKey;

  let payos: Record<string, unknown> | undefined;
  if (payosEnabled && extensionFee > 0) {
    const { createPayOSPayment } = await import("../services/payos.service.js");
    const { Transaction } = await import("../models/Transaction.js");
    const baseUrl = process.env.API_URL || process.env.BASE_URL || "http://localhost:4000";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    const payosResult = await createPayOSPayment({
      amount: extensionFee,
      sessionId: String(session._id),
      label: "iPARK EXT",
      baseUrl,
      frontendUrl,
    });

    if (payosResult.success) {
      // Tạo giao dịch pending để webhook đối chiếu orderCode
      await Transaction.create({
        sessionId: session._id,
        userId: session.ownerUserId,
        method: "payos",
        gateway: "payos",
        amount: extensionFee,
        status: "pending",
        content: `IPARK-EXT-${String(session._id)}`,
        payosOrderCode: String(payosResult.orderCode),
      });

      payos = {
        qrCode: payosResult.qrCode,
        checkoutUrl: payosResult.checkoutUrl,
        orderCode: payosResult.orderCode,
        amount: extensionFee,
        accountNumber: payosResult.accountNumber,
        accountName: payosResult.accountName,
        bin: payosResult.bin,
        description: payosResult.description,
      };
    } else {
      console.warn("[Extend] PayOS failed:", payosResult.error);
    }
  }

  // Cập nhật phiên: phí = phí tới giờ ra mới, dời giờ ra dự kiến, hạ trạng thái thanh toán
  // (xe đã trả phần cũ nhưng giờ còn nợ phần gia hạn → partial_paid / unpaid).
  session.fee = feeNew.totalFee;
  session.feeBreakdown = feeNew;
  session.expectedCheckOutAt = newExit;
  session.prepaidCheckoutAt = newExit;
  session.paymentStatus = (session.paidAmount || 0) >= session.fee
    ? "fully_paid"
    : (session.paidAmount || 0) > 0
      ? "partial_paid"
      : "unpaid";
  await session.save();

  response.json({
    success: true,
    plate: session.plate,
    sessionId: session._id,
    currentFee: session.fee,
    extendMinutes: actualExtendMinutes,
    extensionFee,
    totalFeeAfterExtension: session.fee,
    expectedCheckOutAt: session.expectedCheckOutAt?.toISOString(),
    paymentStatus: session.paymentStatus,
    payos,
    message: `Gia hạn thêm ${actualExtendMinutes} phút. Phí gia hạn: ${extensionFee.toLocaleString("vi-VN")}đ`,
  });
}

/**
 * HM-06: Tra cứu nhanh - chỉ kiểm tra phiên đang gửi
 */
export async function quickLookup(request: Request, response: Response) {
  const plate = String(request.query.plate || "").trim().toUpperCase();

  if (!plate || plate.length < 5) {
    response.status(400).json({ message: "Vui lòng nhập biển số xe." });
    return;
  }

  const session = await ParkingSession.findOne({ plate, status: "Đang gửi" })
    .select("plate ownerName checkInAt slot fee paymentStatus")
    .sort({ checkInAt: -1 });

  if (!session) {
    response.json({
      found: false,
      message: `Không tìm thấy phiên gửi xe nào với biển số ${plate}.`,
      plate,
    });
    return;
  }

  // Convert checkInAt from UTC to local (UTC+7)
  const lookupCheckInLocal = new Date(session.checkInAt);
  lookupCheckInLocal.setHours(lookupCheckInLocal.getHours() + 7);

  const parkingMinutes = Math.round((Date.now() - lookupCheckInLocal.getTime()) / 60000);
  const hours = Math.floor(parkingMinutes / 60);
  const minutes = parkingMinutes % 60;
  const duration = hours > 0 ? `${hours}h ${minutes}p` : `${minutes} phút`;

  response.json({
    found: true,
    session: {
      plate: session.plate,
      ownerName: session.ownerName,
      slot: session.slot,
      checkInAt: session.checkInAt,
      duration,
      parkingMinutes,
      currentFee: session.fee,
      paymentStatus: session.paymentStatus,
      isPrepaid: session.paymentStatus === "fully_paid" || session.paymentStatus === "partial_paid",
    },
  });
}

/**
 * Public endpoint: Check transaction status for a session
 * Used by frontend to poll for PayOS payment confirmation
 */
export async function checkSessionPaymentStatus(request: Request, response: Response) {
  const sessionId = String(request.params.sessionId || "").trim();

  if (!sessionId) {
    response.status(400).json({ message: "Vui lòng cung cấp sessionId." });
    return;
  }

  try {
    const session = await ParkingSession.findById(sessionId);
    if (!session) {
      response.status(404).json({ message: "Không tìm thấy phiên gửi xe." });
      return;
    }

    // Chủ động hỏi PayOS xem giao dịch pending đã thanh toán chưa.
    // Cần cho localhost nơi PayOS không gọi webhook tới server được.
    // Chạy khi phiên còn nợ phí, BẤT KỂ status (kể cả đã checkout/hoàn thành).
    if (session.paymentStatus !== "fully_paid" && (session.fee || 0) - (session.paidAmount || 0) > 0) {
      try {
        const { reconcileSessionPayment } = await import("../services/payos-webhook.service.js");
        if (await reconcileSessionPayment(session)) {
          await session.populate("slotId");
        }
      } catch (err) {
        console.warn("[checkSessionPaymentStatus] reconcile failed:", err);
      }
    }

    // Tìm transaction paid gần nhất CỦA PHIÊN NÀY (không lấy nhầm phiên khác)
    const transaction = await import("../models/Transaction.js").then(m =>
      m.Transaction.findOne({
        sessionId: session._id,
        status: "paid",
      }).sort({ paidAt: -1 }),
    );

    // Nếu là phiên đã hoàn thành, trả thông tin từ transaction
    if (session.status === "Đã hoàn thành") {
      response.json({
        sessionId: session._id.toString(),
        paymentStatus: session.paymentStatus,
        isPrepaid: false,
        isCompleted: true,
        transaction: transaction ? {
          id: transaction._id.toString(),
          status: transaction.status,
          amount: transaction.amount,
          paidAt: transaction.paidAt?.toISOString(),
          gateway: transaction.gateway,
          payosOrderCode: transaction.payosOrderCode,
        } : null,
      });
      return;
    }

    // Phiên đang gửi - trả thông tin thông thường
    response.json({
      sessionId: session._id.toString(),
      paymentStatus: session.paymentStatus,
      isPrepaid: session.paymentStatus === "fully_paid" || session.paymentStatus === "partial_paid",
      isCompleted: false,
      transaction: transaction ? {
        id: transaction._id.toString(),
        status: transaction.status,
        amount: transaction.amount,
        gateway: transaction.gateway,
        payosOrderCode: transaction.payosOrderCode,
      } : null,
    });
  } catch {
    response.status(500).json({ message: "Lỗi server." });
  }
}
