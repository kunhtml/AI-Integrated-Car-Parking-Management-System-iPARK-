import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { createPurchaseRequest } from "../src/controllers/rfidPurchase.controller.js";
import { PricingConfig } from "../src/models/PricingConfig.js";
import { Vehicle } from "../src/models/Vehicle.js";
import { RfidCard } from "../src/models/RfidCard.js";
import { RfidPurchaseRequest } from "../src/models/RfidPurchaseRequest.js";
import { Transaction } from "../src/models/Transaction.js";

afterEach(() => mock.restoreAll());

test("new purchases use the current database price for request and transaction", async () => {
  const userId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  let activePrice = 50000;
  const requests: Record<string, unknown>[] = [];
  const transactions: Record<string, unknown>[] = [];
  const previousEnvPrice = process.env.RFID_CARD_SALE_PRICE;
  process.env.RFID_CARD_SALE_PRICE = "99999";

  mock.method(Vehicle, "findOne", async () => ({ _id: vehicleId, plate: "30A12345" }));
  mock.method(RfidCard, "findOne", async () => null);
  mock.method(RfidPurchaseRequest, "findOne", async () => null);
  mock.method(PricingConfig, "findOne", () => ({ sort: async () => ({ rfidCardSalePrice: activePrice }) }));
  mock.method(RfidPurchaseRequest, "create", async (values: Record<string, unknown>) => {
    requests.push(values);
    return { ...values, _id: new mongoose.Types.ObjectId(), save: async () => undefined };
  });
  mock.method(Transaction, "create", async (values: Record<string, unknown>) => {
    transactions.push(values);
    return { ...values, _id: new mongoose.Types.ObjectId() };
  });

  const request = { body: { vehicleId: vehicleId.toString(), salePrice: 1 }, user: { id: userId.toString() } } as Request;
  const response = {
    status(code: number) { assert.equal(code, 201); return this; },
    json() { return this; },
  } as Response;

  try {
    await createPurchaseRequest(request, response);
    activePrice = 60000;
    await createPurchaseRequest(request, response);
    assert.deepEqual(requests.map((item) => item.salePrice), [50000, 60000]);
    assert.deepEqual(transactions.map((item) => item.amount), [50000, 60000]);
    assert.deepEqual(transactions.map((item) => item.salePrice), [50000, 60000]);
  } finally {
    if (previousEnvPrice === undefined) delete process.env.RFID_CARD_SALE_PRICE;
    else process.env.RFID_CARD_SALE_PRICE = previousEnvPrice;
  }
});
