/// <reference types="jest" />
/**
 * Unit Tests: rfid.controller.ts (scanRfidEntry / scanRfidExit / registerRfid)
 *
 * Chiến lược mock:
 *  - Mock toàn bộ module rfid.service, serializers, validations
 *  - Tạo req/res giả để kiểm tra response trả về
 */

import { Request, Response } from "express";

jest.mock("../src/services/rfid.service.js", () => ({
  registerCard: jest.fn(),
  validateEntry: jest.fn(),
  validateExit: jest.fn(),
  confirmExitWithMismatch: jest.fn(),
}));

jest.mock("../src/utils/serializers.js", () => ({
  serializeParkingSession: jest.fn((s: any) => ({ id: s._id?.toString?.() ?? "session_id", plate: s.plate, status: s.status })),
  serializeScanLog: jest.fn((l: any) => ({ id: l._id?.toString?.() ?? "log_id", action: l.action })),
}));

jest.mock("../src/validations/rfid.validation.js", () => ({
  registerRfidSchema: { parse: (input: any) => ({ body: input.body }) },
  scanRfidSchema: { parse: (input: any) => ({ body: input.body }) },
  confirmExitRfidSchema: { parse: (input: any) => ({ body: input.body }) },
}));

// ─── Import sau khi mock ───────────────────────────────────────────────────────

import {
  registerRfid,
  scanRfidEntry,
  scanRfidExit,
} from "../src/controllers/rfid.controller.js";
import * as rfidService from "../src/services/rfid.service.js";
import { serializeParkingSession } from "../src/utils/serializers.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    cookies: {},
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

function mockResponse() {
  const res: any = {};
  res._status = 200;
  res._json = null;
  res.status = jest.fn().mockImplementation((code: number) => {
    res._status = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((data: any) => {
    res._json = data;
    return res;
  });
  return res as Response & { _status: number; _json: any };
}

function makeCard(overrides: Record<string, any> = {}): any {
  return { _id: { toString: () => "card_id_1" }, cardId: "RFID-001", status: "available", ...overrides };
}

function makeSession(overrides: Record<string, any> = {}): any {
  return { _id: { toString: () => "session_id_1" }, plate: "RFID-001", status: "Đang gửi", ...overrides };
}

// ─── REGISTER ──────────────────────────────────────────────────────────────────

describe("registerRfid", () => {
  it("trả 201 và serialize thẻ khi đăng ký thành công", async () => {
    const card = makeCard();
    (rfidService.registerCard as jest.Mock).mockResolvedValue(card);
    const req = mockRequest({ body: { cardId: "RFID-001", notes: "test" } });
    const res = mockResponse();

    await registerRfid(req, res);

    expect(res._status).toBe(201);
    expect(res._json.card.cardId).toBe("RFID-001");
  });
});

// ─── SCAN ENTRY ────────────────────────────────────────────────────────────────

describe("scanRfidEntry", () => {
  it("trả session đã serialize khi quét vào tạo phiên thành công", async () => {
    const card = makeCard();
    const session = makeSession();
    (rfidService.validateEntry as jest.Mock).mockResolvedValue({
      card,
      session,
      message: "Đã tạo phiên gửi xe và gán thẻ thành công.",
    });
    const req = mockRequest({ body: { cardId: "RFID-001", gate: "entry" }, user: { id: "user_1" } });
    const res = mockResponse();

    await scanRfidEntry(req, res);

    expect(res._status).toBe(200);
    expect(res._json.valid).toBe(true);
    expect(serializeParkingSession).toHaveBeenCalledWith(session);
    expect(res._json.session.plate).toBe("RFID-001");
    expect(res._json.message).toContain("Đã tạo phiên gửi xe");
  });
});

// ─── SCAN EXIT ─────────────────────────────────────────────────────────────────

describe("scanRfidExit", () => {
  it("trả mismatch=false và session khi không lệch biển số", async () => {
    const card = makeCard({ status: "in-use" });
    const session = makeSession();
    (rfidService.validateExit as jest.Mock).mockResolvedValue({ card, session, mismatch: false });
    const req = mockRequest({ body: { cardId: "RFID-001", gate: "exit" } });
    const res = mockResponse();

    await scanRfidExit(req, res);

    expect(res._status).toBe(200);
    expect(res._json.valid).toBe(true);
    expect(res._json.mismatch).toBe(false);
    expect(res._json.session).toBe(session);
  });

  it("trả mismatch=true khi biển số không khớp", async () => {
    const card = makeCard({ status: "in-use" });
    const session = makeSession({ plate: "30A-99999" });
    (rfidService.validateExit as jest.Mock).mockResolvedValue({ card, session, mismatch: true });
    const req = mockRequest({ body: { cardId: "RFID-001", gate: "exit", plateDetected: "30B-11111" } });
    const res = mockResponse();

    await scanRfidExit(req, res);

    expect(res._json.mismatch).toBe(true);
    expect(res._json.session).toBe(session);
  });
});
