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
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    } as unknown as Request;
    const res = makeResponse();

    await listTransactions(req, res);

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
  });
});
