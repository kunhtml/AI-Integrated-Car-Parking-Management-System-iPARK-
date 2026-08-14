import mongoose from "mongoose";
import { ParkingSession, ParkingSessionDocument } from "../models/ParkingSession.js";
import { RfidCard } from "../models/RfidCard.js";
import { ParkingCameraLog } from "../models/ParkingCameraLog.js";
import { findActiveSubscriptionByPlate } from "./subscription.service.js";
import { calculateParkingFee, getActivePricingConfig } from "./pricing.service.js";

type SessionDoc = mongoose.HydratedDocument<ParkingSessionDocument>;

export type ExitExceptionType =
  | "wrong_card"
  | "plate_mismatch"
  | "uid_mismatch"
  | "plate_and_uid_mismatch"
  | "entry_ocr_wrong"
  | "two_vehicles";

export type ExitExceptionEvidence = {
  entryPlate: string;
  exitPlate: string;
  scannedUid: string;
  expectedUid: string;
  cardBoundPlate: string;
  entryImageUrl: string;
  exitImageUrl: string;
};

export type ExitExceptionPayload = {
  verified: false;
  exception: true;
  exceptionType: ExitExceptionType;
  reason: string;
  sessionId: string;
  currentPlate: string;
  cardBoundPlate: string;
  entryPlate: string;
  exitPlate: string;
  scannedUid: string;
  expectedUid: string;
  entryImageUrl: string;
  exitImageUrl: string;
  allowedActions: string[];
};

function displayPlate(value?: string | null) {
  return (value || "").toUpperCase().trim();
}

function platesEqual(a?: string | null, b?: string | null) {
  const na = displayPlate(a).replace(/[^A-Z0-9]/g, "");
  const nb = displayPlate(b).replace(/[^A-Z0-9]/g, "");
  return Boolean(na && nb && na === nb);
}

export async function findExpectedEntryUid(session: SessionDoc) {
  const entryLog = await ParkingCameraLog.findOne({
    sessionId: session._id,
    direction: "in",
    rfidUid: { $exists: true, $nin: [null, ""] },
  })
    .sort({ createdAt: -1 })
    .lean();
  return (entryLog?.rfidUid || session.rfidCardId || "").trim();
}

export async function findCardBoundPlate(uid: string, sessionId: string) {
  const card = await RfidCard.findOne({ uid });

  // Chỉ RFID Member được gắn cố định với một biển số. `plate` trên RFID Guest
  // là dữ liệu vận hành tạm thời và có thể còn lại từ phiên đã hoàn thành.
  // Không được dùng dữ liệu lịch sử đó để chặn xe đang ra.
  const memberPlate =
    card?.cardType === "member" ? displayPlate(card.plate) : "";
  if (memberPlate) return { card, boundPlate: memberPlate };

  // Với RFID Guest, chỉ một phiên Đang gửi khác mới là bằng chứng thẻ đang
  // được xe khác sử dụng. Bao gồm cả cardId để tương thích các luồng cũ lưu
  // `rfidCardId` bằng cardId thay vì UID.
  const cardIdentifiers = Array.from(
    new Set(
      [uid, card?.cardId]
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim().toUpperCase()),
    ),
  );
  const otherSession = await ParkingSession.findOne({
    _id: { $ne: sessionId },
    status: "Đang gửi",
    $or: [
      { rfidCardId: { $in: cardIdentifiers } },
      { exitRfidUid: uid.trim() },
    ],
  }).lean();

  return { card, boundPlate: displayPlate(otherSession?.plate) };
}

function uidMatchesSession(
  uid: string,
  expectedUid: string,
  cardPlate: string,
  sessionPlate: string,
) {
  if (expectedUid && uid === expectedUid) return true;
  if (cardPlate && platesEqual(cardPlate, sessionPlate)) return true;
  return false;
}

export async function classifyExitMismatch(params: {
  session: SessionDoc;
  uid: string;
}): Promise<ExitExceptionPayload | null> {
  const uid = params.uid.trim();
  const session = params.session;
  const sessionPlate = displayPlate(session.plate);
  const exitPlate = displayPlate(session.exitDetectedPlate) || sessionPlate;
  const expectedUid = await findExpectedEntryUid(session);
  const { boundPlate } = await findCardBoundPlate(uid, session._id.toString());
  const uidOk = uidMatchesSession(uid, expectedUid, boundPlate, sessionPlate);
  const exitMatchesSession = platesEqual(exitPlate, sessionPlate);
  const cardAgreesWithExit = boundPlate ? platesEqual(boundPlate, exitPlate) : false;
  const cardAgreesWithSession = boundPlate ? platesEqual(boundPlate, sessionPlate) : false;

  let exceptionType: ExitExceptionType | null = null;
  let reason = "";
  let allowedActions: string[] = [];

  if (boundPlate && !cardAgreesWithSession && !cardAgreesWithExit) {
    exceptionType = "wrong_card";
    reason = `Thẻ không khớp với biển số xe hiện tại (${sessionPlate || exitPlate}). Thẻ đang sử dụng cho xe ${boundPlate}.`;
    allowedActions = ["retry", "reject"];
  } else if (boundPlate && cardAgreesWithExit && !cardAgreesWithSession) {
    const other = await ParkingSession.findOne({
      _id: { $ne: session._id },
      status: "Đang gửi",
      plate: boundPlate,
    }).lean();
    if (other) {
      exceptionType = "two_vehicles";
      reason = `Camera và thẻ cùng nhận ${boundPlate}, nhưng phiên hiện tại là ${sessionPlate} và xe ${boundPlate} vẫn đang gửi. Không đổi biển phiên.`;
      allowedActions = ["retry", "reject"];
    } else if (uidOk) {
      exceptionType = "entry_ocr_wrong";
      reason = `OCR lúc vào ghi ${sessionPlate}, camera ra và RFID cùng nhận ${exitPlate}. Có thể biển phiên sai.`;
      allowedActions = ["retry", "reject", "correct_session_plate"];
    } else {
      exceptionType = "wrong_card";
      reason = `Thẻ không khớp với biển số xe hiện tại (${sessionPlate}). Thẻ đang sử dụng cho xe ${boundPlate}.`;
      allowedActions = ["retry", "reject"];
    }
  } else if (uidOk && !exitMatchesSession) {
    exceptionType = "plate_mismatch";
    reason = `Thẻ khớp phiên ${sessionPlate}, nhưng camera cổng ra đọc ${exitPlate}.`;
    allowedActions = ["retry", "reject", "confirm", "correct_exit_plate"];
  } else if (exitMatchesSession && !uidOk) {
    exceptionType = "uid_mismatch";
    reason = `Biển số khớp phiên ${sessionPlate}, nhưng UID thẻ không khớp thẻ lúc vào.`;
    allowedActions = ["retry", "reject", "accept_uid"];
  } else if (!uidOk && !exitMatchesSession) {
    exceptionType = "plate_and_uid_mismatch";
    reason = `Biển ra (${exitPlate}) và UID thẻ đều không khớp phiên ${sessionPlate}.`;
    allowedActions = ["retry", "reject", "confirm", "correct_exit_plate", "accept_uid"];
  }

  if (!exceptionType) return null;

  const evidence: ExitExceptionEvidence = {
    entryPlate: sessionPlate,
    exitPlate,
    scannedUid: uid,
    expectedUid,
    cardBoundPlate: boundPlate,
    entryImageUrl: session.entryImageUrl || "",
    exitImageUrl: session.exitImageUrl || "",
  };

  session.matchStatus = "Không khớp";
  session.verificationStatus = "Chờ duyệt";
  session.exitRfidUid = uid;
  session.exceptionType = exceptionType;
  session.exceptionEvidence = evidence;
  await session.save();

  return {
    verified: false,
    exception: true,
    exceptionType,
    reason,
    sessionId: session._id.toString(),
    currentPlate: sessionPlate || exitPlate,
    cardBoundPlate: boundPlate,
    entryPlate: sessionPlate,
    exitPlate,
    scannedUid: uid,
    expectedUid,
    entryImageUrl: evidence.entryImageUrl,
    exitImageUrl: evidence.exitImageUrl,
    allowedActions,
  };
}

export async function settleExitAfterVerify(session: SessionDoc) {
  const isMemberSession = session.customerType === "member";
  const activeSubscription = isMemberSession
    ? null
    : await findActiveSubscriptionByPlate(session.plate);

  let amountDue = 0;
  let isSubscriber = false;
  let paymentStatus = session.paymentStatus || "unpaid";

  if (isMemberSession || activeSubscription) {
    isSubscriber = true;
    amountDue = 0;
    paymentStatus = "fully_paid";
    session.paymentStatus = "fully_paid";
    session.paymentMethod = session.paymentMethod || "subscription";
  } else {
    if (session.fee == null || session.fee === 0) {
      const pricing = await getActivePricingConfig();
      const feeBreakdown = calculateParkingFee(session.checkInAt, new Date(), pricing);
      session.fee = feeBreakdown.totalFee;
      session.feeBreakdown = feeBreakdown;
    }
    amountDue = (session.fee || 0) - (session.paidAmount || 0);
    if (amountDue <= 0) {
      paymentStatus = "fully_paid";
      amountDue = 0;
    }
  }

  session.exitState = "rfid_verified";
  session.exitRfidVerifiedAt = new Date();
  session.matchStatus = "Khớp";
  session.verificationStatus = "Đã duyệt";
  session.exceptionType = "";
  await session.save();

  const canOpenGate = amountDue <= 0 && paymentStatus === "fully_paid";
  return {
    verified: true as const,
    sessionId: session._id.toString(),
    amountDue,
    paymentStatus,
    isSubscriber,
    canOpenGate,
  };
}
