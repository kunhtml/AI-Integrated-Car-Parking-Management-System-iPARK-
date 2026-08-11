/// <reference types="jest" />
/**
 * Unit Tests: rfid.service.ts (validateEntry / validateExit)
 *
 * Chiến lược mock:
 *  - Mock toàn bộ model RfidCard, RfidScanLog, ParkingSession
 *  - Mock config/parking, utils/pricing, services/transaction.service
 *  - AppError dùng thật để kiểm tra statusCode
 */

import mongoose from "mongoose";

jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return {
    ...actual,
    connection: { readyState: 1 },
    Types: { ObjectId: jest.fn((v?: string) => v ?? "object_id") },
  };
});

jest.mock("../src/models/RfidCard.js", () => ({
  RfidCard: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../src/models/RfidScanLog.js", () => ({
  RfidScanLog: {
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../src/models/ParkingSession.js", () => ({
  ParkingSession: {
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../src/config/parking.js", () => ({
  parkingConfig: { totalCapacity: 30, safetyThreshold: 5, useDynamicPriority: true, reservedForMembers: 0 },
  allocateCarSlot: jest.fn((n: number) => `A-${String((n % 10) + 1).padStart(2, "0")}`),
  canEnterParking: jest.fn().mockResolvedValue({ allowed: true, mode: "dynamic" }),
}));

jest.mock("../src/services/pricing.service.js", () => ({
  getActivePricingConfig: jest.fn().mockResolvedValue({ freeMinutes: 20, hourlyRate: 10000, dailyMaxRate: 120000 }),
  calculateParkingFee: jest.fn().mockReturnValue({ totalFee: 15000, currency: "VND" }),
}));



jest.mock("../src/services/transaction.service.js", () => ({
  createPendingTransactionForSession: jest.fn().mockResolvedValue(undefined),
}));

// ─── Import sau khi mock ───────────────────────────────────────────────────────

import { RfidCard } from "../src/models/RfidCard.js";
import { RfidScanLog } from "../src/models/RfidScanLog.js";
import { ParkingSession } from "../src/models/ParkingSession.js";
import { validateEntry, validateExit } from "../src/services/rfid.service.js";
import { canEnterParking } from "../src/config/parking.js";
import { createPendingTransactionForSession } from "../src/services/transaction.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCard(overrides: Record<string, any> = {}): any {
  return {
    _id: { toString: () => "card_id_1" },
    cardId: "RFID-001",
    status: "available",
    notes: undefined,
    blockedReason: undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeSession(overrides: Record<string, any> = {}): any {
  return {
    _id: { toString: () => "session_id_1" },
    plate: "RFID-001",
    status: "Đang gửi",
    checkInAt: new Date("2026-07-11T08:00:00"),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── VALIDATE ENTRY ────────────────────────────────────────────────────────────

describe("validateEntry", () => {
  beforeEach(() => {
    (RfidScanLog.create as jest.Mock).mockResolvedValue({});
    (ParkingSession.countDocuments as jest.Mock).mockResolvedValue(0);
    (canEnterParking as jest.Mock).mockResolvedValue({ allowed: true, mode: "dynamic" });
  });

  it("tạo phiên gửi xe và gán thẻ khi quét vào hợp lệ", async () => {
    const card = makeCard();
    (RfidCard.findOne as jest.Mock).mockResolvedValue(card);
    (ParkingSession.findOne as jest.Mock).mockResolvedValue(null);
    const session = makeSession();
    (ParkingSession.create as jest.Mock).mockResolvedValue(session);

    const result = await validateEntry("rfid-001", "entry", "user_1");

    expect(RfidCard.findOne).toHaveBeenCalledWith({ cardId: "RFID-001" });
    expect(ParkingSession.create).toHaveBeenCalledTimes(1);
    expect(card.status).toBe("in-use");
    expect(card.save).toHaveBeenCalled();
    expect(result.session).toBe(session);
    expect(result.message).toContain("Đã tạo phiên gửi xe");
  });

  it("trả 404 khi thẻ không tồn tại", async () => {
    (RfidCard.findOne as jest.Mock).mockResolvedValue(null);

    await expect(validateEntry("RFID-999", "entry")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(RfidScanLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureReason: "Thẻ không tồn tại" }),
    );
  });

  it("trả 403 khi thẻ bị khóa", async () => {
    (RfidCard.findOne as jest.Mock).mockResolvedValue(makeCard({ status: "blocked", blockedReason: "Mất trộm" }));

    await expect(validateEntry("RFID-001", "entry")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("trả 403 khi thẻ bị báo mất", async () => {
    (RfidCard.findOne as jest.Mock).mockResolvedValue(makeCard({ status: "lost" }));

    await expect(validateEntry("RFID-001", "entry")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("trả 409 khi thẻ đang có phiên chưa checkout (anti-passback)", async () => {
    const card = makeCard({ status: "in-use" });
    (RfidCard.findOne as jest.Mock).mockResolvedValue(card);
    (ParkingSession.findOne as jest.Mock).mockResolvedValue(makeSession());

    await expect(validateEntry("RFID-001", "entry")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(ParkingSession.create).not.toHaveBeenCalled();
  });

  it("trả 409 khi bãi đã đầy", async () => {
    (RfidCard.findOne as jest.Mock).mockResolvedValue(makeCard());
    (ParkingSession.findOne as jest.Mock).mockResolvedValue(null);
    (ParkingSession.countDocuments as jest.Mock).mockResolvedValue(0);
    (canEnterParking as jest.Mock).mockResolvedValue({ allowed: false, reason: "Bãi gần đầy", mode: "dynamic" });

    await expect(validateEntry("RFID-001", "entry")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(ParkingSession.create).not.toHaveBeenCalled();
  });

  it("dùng biển số quét được thay vì placeholder cardId", async () => {
    const card = makeCard();
    (RfidCard.findOne as jest.Mock).mockResolvedValue(card);
    (ParkingSession.findOne as jest.Mock).mockResolvedValue(null);
    const session = makeSession();
    (ParkingSession.create as jest.Mock).mockResolvedValue(session);

    await validateEntry("rfid-001", "entry", undefined, undefined, "30A-12345");

    const created = (ParkingSession.create as jest.Mock).mock.calls[0][0];
    expect(created.plate).toBe("30A-12345");
    expect(created.entryDetectedPlate).toBe("30A-12345");
  });
});

// ─── VALIDATE EXIT ─────────────────────────────────────────────────────────────

describe("validateExit", () => {
  beforeEach(() => {
    (RfidScanLog.create as jest.Mock).mockResolvedValue({});
  });

  it("tự động chốt phiên và trả thẻ khi không mismatch", async () => {
    const card = makeCard({ status: "in-use" });
    (RfidCard.findOne as jest.Mock).mockResolvedValue(card);
    const session = makeSession();
    (ParkingSession.findOne as jest.Mock).mockResolvedValue(session);

    const result = await validateExit("rfid-001", "exit", "user_1");

    expect(result.mismatch).toBe(false);
    expect(session.status).toBe("Đã hoàn thành");
    expect(session.checkOutAt).toBeDefined();
    expect(session.fee).toBe(15000);
    expect(session.rfidReturnedAt).toBeDefined();
    expect(session.save).toHaveBeenCalled();
    expect(createPendingTransactionForSession).toHaveBeenCalledWith(session);
    expect(card.status).toBe("available");
    expect(card.save).toHaveBeenCalled();
  });

  it("trả 404 khi thẻ không tồn tại", async () => {
    (RfidCard.findOne as jest.Mock).mockResolvedValue(null);

    await expect(validateExit("RFID-999", "exit")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("trả 403 khi thẻ bị khóa", async () => {
    (RfidCard.findOne as jest.Mock).mockResolvedValue(makeCard({ status: "blocked" }));

    await expect(validateExit("RFID-001", "exit")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("trả 404 khi không có phiên đang hoạt động", async () => {
    (RfidCard.findOne as jest.Mock).mockResolvedValue(makeCard({ status: "in-use" }));
    (ParkingSession.findOne as jest.Mock).mockResolvedValue(null);

    await expect(validateExit("RFID-001", "exit")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("báo mismatch khi biển số quét ra không khớp biển số thật", async () => {
    const card = makeCard({ status: "in-use" });
    (RfidCard.findOne as jest.Mock).mockResolvedValue(card);
    const session = makeSession({ plate: "30A-99999" });
    (ParkingSession.findOne as jest.Mock).mockResolvedValue(session);

    const result = await validateExit("rfid-001", "exit", undefined, undefined, "30B-11111");

    expect(result.mismatch).toBe(true);
    expect(session.status).toBe("Đang gửi");
    expect(session.save).not.toHaveBeenCalled();
    expect(createPendingTransactionForSession).not.toHaveBeenCalled();
    expect(card.status).toBe("in-use");
  });

  it("không báo mismatch khi phiên dùng placeholder cardId", async () => {
    const card = makeCard({ status: "in-use" });
    (RfidCard.findOne as jest.Mock).mockResolvedValue(card);
    const session = makeSession({ plate: "RFID-001" });
    (ParkingSession.findOne as jest.Mock).mockResolvedValue(session);

    const result = await validateExit("rfid-001", "exit", undefined, undefined, "30A-12345");

    expect(result.mismatch).toBe(false);
    expect(session.plate).toBe("30A-12345");
    expect(session.save).toHaveBeenCalled();
  });
});
