<<<<<<< Updated upstream
import { Request, Response } from "express";

jest.mock("../src/models/ParkingSession.js", () => ({
  ParkingSession: {
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock("../src/models/User.js", () => ({
  User: {
    findById: jest.fn(),
  },
}));

jest.mock("../src/models/Transaction.js", () => ({
  Transaction: {
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock("../src/models/Subscription.js", () => ({
  Subscription: {
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock("../src/utils/serializers.js", () => ({
  serializeTransaction: jest.fn((transaction: any, session?: any, subscription?: any) => ({
    id: transaction._id?.toString?.() ?? transaction.id,
    sessionId: transaction.sessionId?.toString?.(),
    subscriptionId: transaction.subscriptionId?.toString?.(),
    session: session ? { id: session._id?.toString?.() } : undefined,
    subscription: subscription ? { id: subscription._id?.toString?.() } : undefined,
    reconciliation: session || subscription ? "reconciled" : "unresolved",
  })),
}));

import { listTransactions } from "../src/controllers/transactions.controller.js";
import { ParkingSession } from "../src/models/ParkingSession.js";
import { Transaction } from "../src/models/Transaction.js";
import { Subscription } from "../src/models/Subscription.js";

function makeResponse() {
  const res: any = {};
  res.setHeader = jest.fn();
  res.json = jest.fn().mockImplementation((data: any) => {
    res._json = data;
    return res;
  });
  return res as Response & { _json?: any };
}

describe("transactions controller", () => {
=======
/// <reference types="jest" />
/**
 * Unit Tests: Transactions controller (UC-29)
 *
 * Chiến lược mock:
 *  - Mock Transaction, ParkingSession, Subscription, User models
 *  - Mock serializers để kiểm tra các trường đối chiếu (reconciliation)
 *  - Kiểm tra pagination trong listTransactions + getTransaction (AF-02)
 */

import { Request, Response } from "express";

jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return {
    ...actual,
    isValidObjectId: jest.fn((id: string) => /^[0-9a-fA-F]{24}$/.test(id)),
    default: { isValidObjectId: (id: string) => /^[0-9a-fA-F]{24}$/.test(id) },
  };
});

const mockTransactionFind = jest.fn();
const mockTransactionCount = jest.fn();
const mockTransactionFindById = jest.fn();
jest.mock("../src/models/Transaction.js", () => ({
  Transaction: {
    find: (filter: unknown) => ({
      sort: () => ({ skip: () => ({ limit: () => mockTransactionFind(filter) }) }),
    }),
    countDocuments: mockTransactionCount,
    findById: mockTransactionFindById,
  },
}));

const mockSessionFind = jest.fn();
const mockSessionFindById = jest.fn();
jest.mock("../src/models/ParkingSession.js", () => ({
  ParkingSession: {
    find: (filter: unknown) => mockSessionFind(filter),
    findById: (id: string) => mockSessionFindById(id),
  },
}));

const mockSubscriptionFind = jest.fn();
const mockSubscriptionFindById = jest.fn();
jest.mock("../src/models/Subscription.js", () => ({
  Subscription: {
    find: (filter: unknown) => mockSubscriptionFind(filter),
    findById: (id: string) => mockSubscriptionFindById(id),
  },
}));

const mockUserFindById = jest.fn();
jest.mock("../src/models/User.js", () => ({
  User: {
    findById: (id: string, proj?: unknown) => ({
      select: () => mockUserFindById(id, proj),
    }),
  },
}));

const mockSerializeTransaction = jest.fn();
jest.mock("../src/utils/serializers.js", () => ({
  serializeTransaction: (...args: unknown[]) => mockSerializeTransaction(...args),
}));

import {
  listTransactions,
  getTransaction,
} from "../src/controllers/transactions.controller.js";
import { Transaction } from "../src/models/Transaction.js";
import { ParkingSession } from "../src/models/ParkingSession.js";
import { Subscription } from "../src/models/Subscription.js";

const objectId = (n = 1) => `${String(n).padStart(24, "0")}`;

function makeResponse() {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };
  return res as unknown as Response;
}

describe("TransactionsController — listTransactions", () => {
>>>>>>> Stashed changes
  beforeEach(() => {
    jest.clearAllMocks();
  });

<<<<<<< Updated upstream
  it("applies query filters, pagination, and loads related session/subscription data", async () => {
    const tx = {
      _id: { toString: () => "tx_1" },
      sessionId: { toString: () => "session_1" },
      subscriptionId: { toString: () => "sub_1" },
      userId: { toString: () => "user_1" },
      method: "cash",
      amount: 120000,
      status: "paid",
      createdAt: new Date("2026-08-20T10:00:00Z"),
    };
    const session = { _id: { toString: () => "session_1" }, plate: "88A-12345" };
    const subscription = { _id: { toString: () => "sub_1" }, planName: "VIP", startDate: new Date("2026-08-01"), endDate: new Date("2026-09-01"), status: "active" };

    const sortMock = jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([tx]),
      }),
    });

    (Transaction.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (Transaction.countDocuments as jest.Mock).mockResolvedValue(1);
    (ParkingSession.find as jest.Mock).mockResolvedValue([session]);
    (Subscription.find as jest.Mock).mockResolvedValue([subscription]);

    const req = {
      user: { id: "user_1", role: "admin" },
      query: {
        q: "88A-12345",
        status: "paid",
        method: "cash",
        sessionId: "session_1",
        from: "2026-08-01",
        to: "2026-08-31",
        page: "2",
        limit: "10",
      },
=======
  it("trả danh sách + pagination với filter & subscription (admin)", async () => {
    const tx = { _id: objectId(1), sessionId: objectId(2), subscriptionId: objectId(3) };
    mockTransactionFind.mockResolvedValue([tx]);
    mockTransactionCount.mockResolvedValue(1);
    mockSessionFind.mockResolvedValue([{ _id: objectId(2) }]);
    mockSubscriptionFind.mockResolvedValue([{ _id: objectId(3), planName: "Gói tháng" }]);
    mockSerializeTransaction.mockReturnValue({ id: "1", reconciliation: "reconciled" });

    const req = {
      query: { q: "30H", page: "1", limit: "10" },
      user: { id: "admin1", role: "admin" },
>>>>>>> Stashed changes
    } as unknown as Request;
    const res = makeResponse();

    await listTransactions(req, res);

<<<<<<< Updated upstream
    expect(Transaction.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid",
        method: "cash",
        sessionId: "session_1",
        $or: expect.any(Array),
      }),
    );
    expect(Transaction.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ status: "paid" }));
    expect(ParkingSession.find).toHaveBeenCalledWith(
      { _id: { $in: [session._id] } },
      expect.anything(),
    );
    expect(Subscription.find).toHaveBeenCalledWith({ _id: { $in: [subscription._id] } });
    expect(res._json.transactions).toHaveLength(1);
=======
    expect(Transaction.countDocuments).toHaveBeenCalled();
    expect(mockSerializeTransaction).toHaveBeenCalledWith(tx, expect.anything(), expect.anything());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({ total: 1, hasMore: false }),
      }),
    );
  });

  it("lọc theo sessionId (G3) khi admin", async () => {
    mockTransactionFind.mockImplementation((filter: unknown) => {
      expect(filter).toHaveProperty("sessionId", "123");
      return Promise.resolve([]);
    });
    mockTransactionCount.mockResolvedValue(0);

    const req = {
      query: { sessionId: "123" },
      user: { id: "admin1", role: "admin" },
    } as unknown as Request;
    const res = makeResponse();

    await listTransactions(req, res);
    expect(res.json).toHaveBeenCalled();
  });

  it("customer chỉ thấy giao dịch của mình (access filter)", async () => {
    mockUserFindById.mockResolvedValue({ email: "kh.1@gmail.com" });
    mockSessionFind.mockImplementation((filter: unknown) => {
      expect(filter).toHaveProperty("$or");
      return Promise.resolve([{ _id: objectId(2) }]);
    });
    mockSubscriptionFind.mockResolvedValue([{ _id: objectId(3) }]);
    mockTransactionFind.mockImplementation((filter: unknown) => {
      expect(filter).toHaveProperty("$and");
      return Promise.resolve([]);
    });
    mockTransactionCount.mockResolvedValue(0);

    const req = {
      query: {},
      user: { id: "cust1", role: "customer" },
    } as unknown as Request;
    const res = makeResponse();

    await listTransactions(req, res);
    expect(res.json).toHaveBeenCalled();
  });
});

describe("TransactionsController — getTransaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("trả 400 nếu id không hợp lệ", async () => {
    const req = { params: { id: "not-an-id" }, user: { id: "a", role: "admin" } } as unknown as Request;
    const res = makeResponse();
    await getTransaction(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("trả 404 nếu không tìm thấy giao dịch", async () => {
    mockTransactionFindById.mockResolvedValue(null);
    const req = { params: { id: objectId(1) }, user: { id: "a", role: "admin" } } as unknown as Request;
    const res = makeResponse();
    await getTransaction(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("trả chi tiết giao dịch + subscription (AF-02 reconciled)", async () => {
    const tx = { _id: objectId(1), sessionId: objectId(2), subscriptionId: objectId(3) };
    mockTransactionFindById.mockResolvedValue(tx);
    mockSessionFindById.mockResolvedValue({ _id: objectId(2) });
    mockSubscriptionFindById.mockResolvedValue({ _id: objectId(3), planName: "Gói tháng" });
    mockSerializeTransaction.mockReturnValue({ id: "1", reconciliation: "reconciled" });

    const req = { params: { id: objectId(1) }, user: { id: "admin1", role: "admin" } } as unknown as Request;
    const res = makeResponse();

    await getTransaction(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: expect.objectContaining({ reconciliation: "reconciled" }) }),
    );
  });

  it("customer bị từ chối xem giao dịch không thuộc về mình", async () => {
    const tx = { _id: objectId(1), userId: objectId(9), sessionId: objectId(2) };
    mockTransactionFindById.mockResolvedValue(tx);
    const req = { params: { id: objectId(1) }, user: { id: "cust1", role: "customer" } } as unknown as Request;
    const res = makeResponse();
    await getTransaction(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
>>>>>>> Stashed changes
  });
});
