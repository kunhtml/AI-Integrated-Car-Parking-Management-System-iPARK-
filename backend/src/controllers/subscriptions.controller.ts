import mongoose from "mongoose";
import { Request, Response } from "express";
import { Subscription } from "../models/Subscription.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";

function serializeSubscription(subscription: any) {
  const vehicles = Array.isArray(subscription.registeredVehicleIds)
    ? subscription.registeredVehicleIds.map((vehicle: any) => ({
        id: vehicle._id?.toString?.() || vehicle.toString?.() || "",
        plate: vehicle.plate || "",
        ownerName: vehicle.ownerName || "",
        status: vehicle.status || "",
      }))
    : [];

  return {
    id: subscription._id?.toString?.() || "",
    userId: subscription.userId?._id?.toString?.() || subscription.userId?.toString?.() || "",
    customerName: subscription.userId?.name || subscription.userId?.email || "Khách hàng",
    customerEmail: subscription.userId?.email || "",
    planId: subscription.planId?.toString?.() || "",
    planName: subscription.planName,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    status: subscription.status,
    autoRenew: Boolean(subscription.autoRenew),
    renewalCount: subscription.renewalCount || 0,
    registeredVehicles: vehicles,
    registeredPlates: subscription.registeredPlates || [],
    isValidNow:
      ["active", "cancelled"].includes(subscription.status) &&
      new Date(subscription.startDate).getTime() <= Date.now() &&
      new Date(subscription.endDate).getTime() >= Date.now(),
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

function serializePlan(plan: any) {
  return {
    id: plan._id?.toString?.() || "",
    name: plan.name,
    description: plan.description || "",
    duration: plan.duration,
    durationDays: plan.durationDays,
    price: plan.price || 0,
    maxVehicles: plan.maxVehicles ?? -1,
    isActive: Boolean(plan.isActive),
  };
}

export async function listSubscriptions(request: Request, response: Response) {
  if (mongoose.connection.readyState !== 1) {
    response.json({ subscriptions: [], plans: [] });
    return;
  }

  const criteria =
    request.user?.role === "customer"
      ? { userId: new mongoose.Types.ObjectId(request.user.id) }
      : {};

  const [subscriptions, plans] = await Promise.all([
    Subscription.find(criteria)
      .populate("userId", "name email memberCode")
      .populate("registeredVehicleIds", "plate ownerName status")
      .sort({ updatedAt: -1 })
      .limit(200),
    SubscriptionPlan.find({}).sort({ price: 1 }),
  ]);

  response.json({
    subscriptions: subscriptions.map(serializeSubscription),
    plans: plans.map(serializePlan),
  });
}
