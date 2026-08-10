import { Request, Response } from "express";
import { z } from "zod";
import { Shift } from "../models/Shift.js";
import { serializeShift } from "../utils/serializers.js";

export async function listShifts(request: Request, response: Response) {
  const criteria = request.user?.role === "staff" ? { staffId: request.user.id } : {};
  const shifts = await Shift.find(criteria).sort({ createdAt: -1 }).limit(100);
  response.json({ shifts: shifts.map(serializeShift) });
}

export async function startShift(request: Request, response: Response) {
  const body = z.object({ name: z.string().min(2), note: z.string().optional() }).parse(request.body);
  const shift = await Shift.create({
    name: body.name,
    note: body.note,
    staffId: request.user?.id,
  });

  response.status(201).json({ shift: serializeShift(shift) });
}

export async function endShift(request: Request, response: Response) {
  const shift = await Shift.findById(request.params.id);
  if (!shift) {
    response.status(404).json({ message: "Không tìm thấy ca làm." });
    return;
  }

  if (request.user?.role === "staff" && shift.staffId.toString() !== request.user.id) {
    response.status(403).json({ message: "Không có quyền kết thúc ca này." });
    return;
  }

  shift.status = "Đã kết thúc";
  shift.endAt = new Date();
  await shift.save();

  response.json({ shift: serializeShift(shift) });
}

// ST-09: Submit shift report — staff submits summary of their shift
import { ParkingSession } from "../models/ParkingSession.js";
import { Incident } from "../models/Incident.js";

export async function submitShiftReport(request: Request, response: Response) {
  const body = z
    .object({
      handoverNote: z.string().optional(),
      handoverTo: z.string().optional(),
    })
    .parse(request.body);

  const shift = await Shift.findById(request.params.id);
  if (!shift) {
    response.status(404).json({ message: "Không tìm thấy ca làm." });
    return;
  }

  if (request.user?.role === "staff" && shift.staffId.toString() !== request.user.id) {
    response.status(403).json({ message: "Không có quyền nộp báo cáo ca này." });
    return;
  }

  // Auto-calculate shift stats
  const shiftStart = shift.startAt;
  const shiftEnd = shift.endAt || new Date();

  const [sessionCount, totalRevenue, incidentCount] = await Promise.all([
    ParkingSession.countDocuments({
      createdBy: shift.staffId,
      checkInAt: { $gte: shiftStart, $lte: shiftEnd },
    }),
    ParkingSession.aggregate([
      {
        $match: {
          createdBy: shift.staffId,
          checkOutAt: { $gte: shiftStart, $lte: shiftEnd },
          status: "Đã hoàn thành",
        },
      },
      { $group: { _id: null, total: { $sum: "$fee" } } },
    ]).then((r) => r[0]?.total || 0),
    Incident.countDocuments({
      createdBy: shift.staffId,
      createdAt: { $gte: shiftStart, $lte: shiftEnd },
    }),
  ]);

  // Update shift with report data
  shift.totalSessions = sessionCount;
  shift.totalRevenue = totalRevenue;
  shift.totalIncidents = incidentCount;
  shift.note = [shift.note, body.handoverNote].filter(Boolean).join("\n---\n") || shift.note;

  // End the shift if not already ended
  if (shift.status !== "Đã kết thúc") {
    shift.status = "Đã kết thúc";
    shift.endAt = new Date();
  }

  await shift.save();

  response.json({
    shift: serializeShift(shift),
    report: {
      totalSessions: sessionCount,
      totalRevenue: totalRevenue,
      totalIncidents: incidentCount,
      handoverNote: body.handoverNote ?? null,
      handoverAt: shift.endAt?.toISOString() ?? null,
    },
    message: "Đã nộp báo cáo ca làm việc.",
  });
}
