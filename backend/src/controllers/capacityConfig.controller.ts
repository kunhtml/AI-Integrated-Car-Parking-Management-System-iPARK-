import { Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Subscription } from "../models/Subscription.js";
import { ParkingSlot } from "../models/ParkingSlot.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { Zone } from "../models/Zone.js";
import {
  CapacityConfigError,
  getOrCreateGlobalConfig,
  updateGlobalCapacity,
  updateZoneCapacity,
} from "../services/capacityConfig.service.js";
import {
  serializeCapacityChangeLog,
  serializeCapacityConfig,
} from "../utils/serializers.js";
import { CapacityChangeLog } from "../models/CapacityChangeLog.js";

const globalUpdateSchema = z.object({
  globalCapacity: z.number().int().min(1),
  reason: z.string().trim().max(500).optional(),
});

const zoneUpdateSchema = z.object({
  capacity: z.number().int().min(1),
  walkInQuota: z.number().int().min(0),
  subscriberQuota: z.number().int().min(0),
  reason: z.string().trim().max(500).optional(),
});

function handleServiceError(error: unknown, response: Response): boolean {
  if (error instanceof CapacityConfigError) {
    response.status(error.status).json({ message: error.message });
    return true;
  }
  return false;
}

export async function getCapacityConfigHandler(_request: Request, response: Response) {
  const global = await getOrCreateGlobalConfig();
  const zones = await Zone.find({ isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .lean();
  response.json({
    config: serializeCapacityConfig(global),
    zones: zones.map((z) => ({
      id: z._id.toString(),
      name: z.name,
      capacity: z.capacity,
      walkInQuota: z.walkInQuota ?? 0,
      subscriberQuota: z.subscriberQuota ?? 0,
      isActive: z.isActive,
    })),
  });
}

export async function updateGlobalCapacityHandler(request: Request, response: Response) {
  const body = globalUpdateSchema.parse(request.body);
  try {
    const updated = await updateGlobalCapacity(
      body.globalCapacity,
      request.user?.id,
      body.reason,
    );
    response.json({ config: serializeCapacityConfig(updated) });
  } catch (error) {
    if (handleServiceError(error, response)) return;
    throw error;
  }
}

export async function updateZoneCapacityHandler(request: Request, response: Response) {
  const body = zoneUpdateSchema.parse(request.body);
  try {
    const zone = await updateZoneCapacity(
      String(request.params.id),
      {
        capacity: body.capacity,
        walkInQuota: body.walkInQuota,
        subscriberQuota: body.subscriberQuota,
      },
      request.user?.id,
      body.reason,
    );
    response.json({
      zone: {
        id: zone._id.toString(),
        name: zone.name,
        capacity: zone.capacity,
        walkInQuota: zone.walkInQuota,
        subscriberQuota: zone.subscriberQuota,
        isActive: zone.isActive,
      },
    });
  } catch (error) {
    if (handleServiceError(error, response)) return;
    throw error;
  }
}

export async function getCapacityHistoryHandler(request: Request, response: Response) {
  const filter: Record<string, unknown> = {};
  if (request.query.entityType === "global" || request.query.entityType === "zone") {
    filter.entityType = request.query.entityType;
  }
  if (typeof request.query.zoneId === "string" && request.query.zoneId) {
    filter.zoneId = request.query.zoneId;
  }
  const limitRaw = Number(request.query.limit);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? limitRaw : 50;
  const logs = await CapacityChangeLog.find(filter)
    .sort({ changedAt: -1 })
    .limit(limit)
    .populate({ path: "changedBy", model: "User", select: "name email" })
    .populate({ path: "zoneId", model: "Zone", select: "name" });
  response.json({ history: logs.map((l) => serializeCapacityChangeLog(l)) });
}

export async function getCapacityUsageHandler(_request: Request, response: Response) {
  const global = await getOrCreateGlobalConfig();
  const zones = await Zone.find({ isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .lean();

  const activeSessions = await ParkingSession.find({ status: "Đang gửi" })
    .select("vehicleId zone")
    .lean();

  const zoneNameToId = new Map<string, string>();
  for (const z of zones) zoneNameToId.set(z.name, z._id.toString());

  const vehicleIds = Array.from(
    new Set(
      activeSessions
        .map((s) => s.vehicleId)
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id))
        .map((id) => id.toString()),
    ),
  );

  let subscriberVehicleIds = new Set<string>();
  if (vehicleIds.length > 0) {
    const subs = await Subscription.find({
      primaryVehicleId: { $in: vehicleIds.map((id) => new mongoose.Types.ObjectId(id)) },
      status: "active",
    })
      .select("primaryVehicleId")
      .lean();
    for (const s of subs) {
      if (s.primaryVehicleId) subscriberVehicleIds.add(s.primaryVehicleId.toString());
    }
  }

  const walkInByZone = new Map<string, number>();
  const subscriberByZone = new Map<string, number>();
  for (const session of activeSessions) {
    if (!session.zone) continue;
    const zoneId = zoneNameToId.get(session.zone);
    if (!zoneId) continue;
    const isSubscriber = session.vehicleId
      ? subscriberVehicleIds.has(session.vehicleId.toString())
      : false;
    if (isSubscriber) {
      subscriberByZone.set(zoneId, (subscriberByZone.get(zoneId) ?? 0) + 1);
    } else {
      walkInByZone.set(zoneId, (walkInByZone.get(zoneId) ?? 0) + 1);
    }
  }

  let globalOccupied = 0;
  let globalWalkIn = 0;
  let globalSubscriber = 0;

  const perZone = zones.map((z) => {
    const id = z._id.toString();
    const walkIn = walkInByZone.get(id) ?? 0;
    const subscriber = subscriberByZone.get(id) ?? 0;
    const total = walkIn + subscriber;
    globalOccupied += total;
    globalWalkIn += walkIn;
    globalSubscriber += subscriber;
    return {
      zoneId: id,
      zoneName: z.name,
      capacity: z.capacity,
      walkInQuota: z.walkInQuota ?? 0,
      subscriberQuota: z.subscriberQuota ?? 0,
      occupied: total,
      walkInOccupied: walkIn,
      subscriberOccupied: subscriber,
      walkInOver: z.walkInQuota > 0 && walkIn > z.walkInQuota,
      subscriberOver: z.subscriberQuota > 0 && subscriber > z.subscriberQuota,
    };
  });

  response.json({
    global: {
      capacity: global.globalCapacity,
      occupied: globalOccupied,
      walkInOccupied: globalWalkIn,
      subscriberOccupied: globalSubscriber,
      over: globalOccupied > global.globalCapacity,
    },
    perZone,
  });
}

export async function getZoneSlotsHandler(request: Request, response: Response) {
  const zoneIdParam = typeof request.query.zoneId === "string" ? request.query.zoneId : "";
  if (!mongoose.isValidObjectId(zoneIdParam)) {
    response.status(400).json({ message: "zoneId không hợp lệ." });
    return;
  }
  const zone = await Zone.findById(zoneIdParam).lean();
  if (!zone) {
    response.status(404).json({ message: "Zone không tồn tại." });
    return;
  }

  const slots = await ParkingSlot.find({ zoneId: zone._id })
    .sort({ floor: 1, slotCode: 1 })
    .lean();

  // Lấy session active đang gắn vào slot để biết walk-in / subscriber
  const sessionIds = slots
    .map((s) => s.currentSessionId)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  const sessionById = new Map<string, { vehicleId?: mongoose.Types.ObjectId; plate?: string }>();
  if (sessionIds.length > 0) {
    const sessions = await ParkingSession.find({ _id: { $in: sessionIds } })
      .select("vehicleId plate")
      .lean();
    for (const s of sessions) sessionById.set(s._id.toString(), { vehicleId: s.vehicleId, plate: s.plate });
  }

  const vehicleIds = Array.from(
    new Set(
      Array.from(sessionById.values())
        .map((s) => s.vehicleId)
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id))
        .map((id) => id.toString()),
    ),
  );
  const subscriberVehicleIds = new Set<string>();
  if (vehicleIds.length > 0) {
    const subs = await Subscription.find({
      primaryVehicleId: { $in: vehicleIds.map((id) => new mongoose.Types.ObjectId(id)) },
      status: "active",
    })
      .select("primaryVehicleId")
      .lean();
    for (const s of subs) {
      if (s.primaryVehicleId) subscriberVehicleIds.add(s.primaryVehicleId.toString());
    }
  }

  const summary = {
    total: slots.length,
    empty: 0,
    occupied: 0,
    reserved: 0,
    maintenance: 0,
    walkInOccupied: 0,
    subscriberOccupied: 0,
    byFloor: new Map<number, { total: number; empty: number; occupied: number; reserved: number; maintenance: number }>(),
  };

  const items = slots.map((s) => {
    const session = s.currentSessionId ? sessionById.get(s.currentSessionId.toString()) : undefined;
    const isSubscriber = session?.vehicleId
      ? subscriberVehicleIds.has(session.vehicleId.toString())
      : false;
    summary[s.status as "empty" | "occupied" | "reserved" | "maintenance"] += 1;
    if (s.status === "occupied") {
      if (isSubscriber) summary.subscriberOccupied += 1;
      else summary.walkInOccupied += 1;
    }
    const floorStats = summary.byFloor.get(s.floor) ?? {
      total: 0,
      empty: 0,
      occupied: 0,
      reserved: 0,
      maintenance: 0,
    };
    floorStats.total += 1;
    floorStats[s.status as keyof typeof floorStats] += 1;
    summary.byFloor.set(s.floor, floorStats);

    return {
      id: s._id.toString(),
      slotCode: s.slotCode,
      floor: s.floor,
      slotType: s.slotType,
      status: s.status,
      currentSessionId: s.currentSessionId?.toString() ?? null,
      currentPlate: session?.plate ?? null,
      isSubscriber,
      features: s.features ?? [],
      notes: s.notes ?? null,
    };
  });

  const floors = Array.from(summary.byFloor.entries())
    .map(([floor, stats]) => ({ floor, ...stats }))
    .sort((a, b) => a.floor - b.floor);

  response.json({
    zone: {
      id: zone._id.toString(),
      name: zone.name,
      capacity: zone.capacity,
      walkInQuota: zone.walkInQuota ?? 0,
      subscriberQuota: zone.subscriberQuota ?? 0,
    },
    summary: {
      total: summary.total,
      empty: summary.empty,
      occupied: summary.occupied,
      reserved: summary.reserved,
      maintenance: summary.maintenance,
      walkInOccupied: summary.walkInOccupied,
      subscriberOccupied: summary.subscriberOccupied,
      walkInOver:
        zone.walkInQuota > 0 && summary.walkInOccupied > zone.walkInQuota,
      subscriberOver:
        zone.subscriberQuota > 0 && summary.subscriberOccupied > zone.subscriberQuota,
    },
    floors,
    slots: items,
  });
}
