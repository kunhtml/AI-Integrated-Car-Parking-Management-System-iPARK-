import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { AuditLog } from "../models/AuditLog.js";
import { ShiftSchedule } from "../models/ShiftSchedule.js";
import { User } from "../models/User.js";
import { createAuditLog } from "../services/auditLog.service.js";
import {
  serializeAuditLog,
  serializeShiftSchedule,
} from "../utils/serializers.js";

/** Snapshot gọn cho audit — không lưu Document populate / ObjectId dump. */
function staffRefId(staff: unknown): string | null {
  if (!staff) return null;
  if (typeof staff === "string") return staff;
  const obj = staff as {
    _id?: { toString(): string };
    toString?: () => string;
  };
  if (obj._id?.toString) return obj._id.toString();
  if (typeof obj.toString === "function") {
    const s = obj.toString();
    if (s && s !== "[object Object]") return s;
  }
  return null;
}

function staffDisplay(staff: unknown): {
  staffId: string | null;
  staffName: string | null;
  staffEmail: string | null;
} {
  if (!staff) return { staffId: null, staffName: null, staffEmail: null };
  if (typeof staff === "string") {
    return { staffId: staff, staffName: null, staffEmail: null };
  }
  const obj = staff as { name?: string; email?: string };
  return {
    staffId: staffRefId(staff),
    staffName: typeof obj.name === "string" ? obj.name : null,
    staffEmail: typeof obj.email === "string" ? obj.email : null,
  };
}

function toIso(value?: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function scheduleAuditSnapshot(schedule: {
  staffId?: unknown;
  date?: Date | string;
  shiftType?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  note?: string | null;
  location?: string | null;
  deviceId?: unknown;
  checkedInAt?: Date | string | null;
  completedAt?: Date | string | null;
}) {
  const staff = staffDisplay(schedule.staffId);
  return {
    staffId: staff.staffId,
    staffName: staff.staffName,
    staffEmail: staff.staffEmail,
    date: toIso(schedule.date ?? null),
    shiftType: schedule.shiftType ?? null,
    startTime: schedule.startTime ?? null,
    endTime: schedule.endTime ?? null,
    status: schedule.status ?? null,
    note: schedule.note ?? null,
    location: schedule.location ?? null,
    checkedInAt: toIso(schedule.checkedInAt ?? null),
    completedAt: toIso(schedule.completedAt ?? null),
  };
}

function canManageSchedules(user?: { role?: string | null }) {
  return user?.role === "admin" || user?.role === "manager";
}

// SHIFT-01: người được gán ca phải là staff đang hoạt động — chặn staff bị
// khóa, customer và user không tồn tại trên mọi thao tác gán.
async function getAssignableStaff(staffId: string) {
  const staff = await User.findById(staffId);
  if (!staff) {
    return { error: 404, message: "Không tìm thấy nhân viên" as const };
  }
  if (staff.role !== "staff") {
    return {
      error: 400,
      message: "Người này không phải là nhân viên" as const,
    };
  }
  if (staff.status !== "Đang hoạt động") {
    return {
      error: 409,
      message: "Nhân viên này đã bị khóa, không thể gán ca mới" as const,
    };
  }
  return { staff };
}

// SHIFT-01: kiểm tra trùng ca tính trên trạng thái SAU update (staffId mới +
// date/shiftType mới), không chỉ khi đổi date/shiftType.
async function findConflict(values: {
  excludeId?: mongoose.Types.ObjectId | string;
  staffId: string;
  date: Date;
  shiftType: string;
}) {
  const filter: Record<string, unknown> = {
    staffId: values.staffId,
    date: values.date,
    shiftType: values.shiftType,
    status: { $ne: "cancelled" },
  };
  if (values.excludeId) filter._id = { $ne: values.excludeId };
  return ShiftSchedule.findOne(filter);
}

const createScheduleSchema = z.object({
  staffId: z.string().min(1, "ID nhân viên là bắt buộc"),
  date: z.string().min(1, "Ngày là bắt buộc"),
  shiftType: z.enum(["morning", "afternoon", "evening", "night"]),
  startTime: z.string().min(1, "Giờ bắt đầu là bắt buộc"),
  endTime: z.string().min(1, "Giờ kết thúc là bắt buộc"),
  note: z.string().optional(),
  location: z.string().optional(),
  deviceId: z.string().optional(),
});

const updateScheduleSchema = z.object({
  staffId: z.string().optional(),
  date: z.string().optional(),
  shiftType: z.enum(["morning", "afternoon", "evening", "night"]).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z
    .enum(["scheduled", "checked_in", "completed", "cancelled"])
    .optional(),
  note: z.string().optional(),
  location: z.string().optional(),
  deviceId: z.string().optional(),
});

// Default shift times by type
const DEFAULT_SHIFT_TIMES: Record<string, { start: string; end: string }> = {
  morning: { start: "06:00", end: "14:00" },
  afternoon: { start: "14:00", end: "18:00" },
  evening: { start: "18:00", end: "22:00" },
  night: { start: "22:00", end: "06:00" },
};

function shiftDateTime(date: Date, time: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return new Date(
    Date.UTC(part("year"), part("month") - 1, part("day"), hour, minute) -
      7 * 60 * 60 * 1000,
  );
}

function shiftEndAt(schedule: {
  date: Date;
  startTime: string;
  endTime: string;
}) {
  const start = shiftDateTime(schedule.date, schedule.startTime);
  const end = shiftDateTime(schedule.date, schedule.endTime);
  if (!start || !end) return null;
  if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

// A shift that has passed its scheduled end cannot remain checked in indefinitely.
async function closeExpiredCheckedInShifts(now = new Date()) {
  const activeSchedules = await ShiftSchedule.find({ status: "checked_in" })
    .select("date startTime endTime")
    .lean();
  const expiredIds = activeSchedules
    .filter((schedule) => {
      const end = shiftEndAt(schedule);
      return end !== null && end <= now;
    })
    .map((schedule) => schedule._id);

  if (expiredIds.length > 0) {
    await ShiftSchedule.updateMany(
      { _id: { $in: expiredIds }, status: "checked_in" },
      { $set: { status: "completed" } },
    );
  }
}

// GET /api/shift-schedules - List schedules
export async function listShiftSchedules(request: Request, response: Response) {
  try {
    await closeExpiredCheckedInShifts();
    const { staffId, fromDate, toDate, month, year } = request.query;

    const query: Record<string, unknown> = {};

    // Filter by staff (staff can only see their own, admin can see all)
    if (request.user?.role === "staff") {
      query.staffId = request.user.id;
    } else if (staffId) {
      query.staffId = staffId;
    }

    // Date filtering
    if (fromDate && toDate) {
      query.date = {
        $gte: new Date(fromDate as string),
        $lte: new Date(toDate as string),
      };
    } else if (month && year) {
      const startOfMonth = new Date(
        parseInt(year as string),
        parseInt(month as string) - 1,
        1,
      );
      const endOfMonth = new Date(
        parseInt(year as string),
        parseInt(month as string),
        0,
        23,
        59,
        59,
      );
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const schedules = await ShiftSchedule.find(query)
      .populate("staffId", "name email phone avatarUrl")
      .populate("assignedBy", "name email")
      .sort({ date: 1, startTime: 1 });

    response.json({ schedules: schedules.map(serializeShiftSchedule) });
  } catch (error) {
    console.error("Error listing shift schedules:", error);
    response.status(500).json({ message: "Lỗi khi lấy danh sách lịch ca" });
  }
}

// GET /api/shift-schedules/my - Get my schedule (for staff view)
export async function getMySchedule(request: Request, response: Response) {
  try {
    await closeExpiredCheckedInShifts();
    const { fromDate, toDate, month, year } = request.query;

    const query: Record<string, unknown> = { staffId: request.user?.id };

    if (fromDate && toDate) {
      query.date = {
        $gte: new Date(fromDate as string),
        $lte: new Date(toDate as string),
      };
    } else if (month && year) {
      const startOfMonth = new Date(
        parseInt(year as string),
        parseInt(month as string) - 1,
        1,
      );
      const endOfMonth = new Date(
        parseInt(year as string),
        parseInt(month as string),
        0,
        23,
        59,
        59,
      );
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    } else {
      // Default: current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      );
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const schedules = await ShiftSchedule.find(query)
      .populate("assignedBy", "name email")
      .sort({ date: 1, startTime: 1 });

    response.json({ schedules: schedules.map(serializeShiftSchedule) });
  } catch (error) {
    console.error("Error getting my schedule:", error);
    response.status(500).json({ message: "Lỗi khi lấy lịch làm việc của bạn" });
  }
}

// GET /api/shift-schedules/my/current - Check whether the staff member is on duty now.
export async function getMyCurrentShift(request: Request, response: Response) {
  await closeExpiredCheckedInShifts();

  const now = new Date();
  const schedules = await ShiftSchedule.find({
    staffId: request.user?.id,
    status: "checked_in",
  })
    .sort({ date: -1, startTime: -1 })
    .limit(10);
  const activeSchedule = schedules.find((schedule) => {
    const start = shiftDateTime(schedule.date, schedule.startTime);
    const end = shiftEndAt(schedule);
    return start !== null && end !== null && now >= start && now < end;
  });

  response.json({
    active: Boolean(activeSchedule),
    schedule: activeSchedule ? serializeShiftSchedule(activeSchedule) : null,
  });
}

// GET /api/shift-schedules/week - Get weekly schedule
export async function getWeeklySchedule(request: Request, response: Response) {
  try {
    await closeExpiredCheckedInShifts();
    const { weekStart } = request.query;

    let startDate: Date;
    if (weekStart) {
      startDate = new Date(weekStart as string);
    } else {
      // Default: start of current week (Monday)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const query: Record<string, unknown> = {
      date: { $gte: startDate, $lt: endDate },
    };

    // Staff can only see their own schedule
    if (request.user?.role === "staff") {
      query.staffId = request.user.id;
    } else if (request.query.staffId) {
      query.staffId = request.query.staffId;
    }

    const schedules = await ShiftSchedule.find(query)
      .populate("staffId", "name email phone avatarUrl")
      .populate("assignedBy", "name email")
      .sort({ date: 1, startTime: 1 });

    response.json({ schedules: schedules.map(serializeShiftSchedule) });
  } catch (error) {
    console.error("Error getting weekly schedule:", error);
    response.status(500).json({ message: "Lỗi khi lấy lịch tuần" });
  }
}

// POST /api/shift-schedules - Create schedule
export async function createShiftSchedule(
  request: Request,
  response: Response,
) {
  try {
    if (!canManageSchedules(request.user)) {
      response.status(403).json({
        message: "Chỉ admin hoặc manager mới có quyền gán lịch làm việc",
      });
      return;
    }

    const body = createScheduleSchema.parse(request.body);

    const staffCheck = await getAssignableStaff(body.staffId);
    if ("error" in staffCheck) {
      response
        .status(staffCheck.error ?? 400)
        .json({ message: staffCheck.message });
      return;
    }

    const existingSchedule = await findConflict({
      staffId: body.staffId,
      date: new Date(body.date),
      shiftType: body.shiftType,
    });

    if (existingSchedule) {
      response.status(400).json({
        message:
          "Nhân viên này đã có lịch ca này trong ngày. Vui lòng chọn ca khác hoặc xóa lịch cũ.",
      });
      return;
    }

    const schedule = await ShiftSchedule.create({
      staffId: body.staffId,
      date: new Date(body.date),
      shiftType: body.shiftType,
      startTime: body.startTime,
      endTime: body.endTime,
      note: body.note,
      location: body.location,
      deviceId: body.deviceId,
      assignedBy: request.user!.id,
      status: "scheduled",
    });

    await schedule.populate("staffId", "name email phone avatarUrl");
    await schedule.populate("assignedBy", "name email");

    await createAuditLog({
      action: "shift_schedule_assigned",
      entityType: "ShiftSchedule",
      entityId: schedule._id,
      performedBy: request.user!.id,
      changes: {
        new: scheduleAuditSnapshot(schedule),
      },
    });

    response.status(201).json({ schedule: serializeShiftSchedule(schedule) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      response
        .status(400)
        .json({ message: error.issues[0]?.message, errors: error.issues });
      return;
    }
    console.error("Error creating shift schedule:", error);
    response.status(500).json({ message: "Lỗi khi tạo lịch ca" });
  }
}

// POST /api/shift-schedules/bulk - Create multiple schedules
export async function bulkCreateShiftSchedules(
  request: Request,
  response: Response,
) {
  try {
    if (!canManageSchedules(request.user)) {
      response.status(403).json({
        message: "Chỉ admin hoặc manager mới có quyền gán lịch làm việc",
      });
      return;
    }

    const body = z
      .object({
        schedules: z.array(createScheduleSchema).min(1),
      })
      .parse(request.body);

    const createdSchedules = [];

    for (const scheduleData of body.schedules) {
      // SHIFT-01: bỏ qua mục không hợp lệ (user không tồn tại/không phải staff/bị khóa).
      const staffCheck = await getAssignableStaff(scheduleData.staffId);
      if ("error" in staffCheck) continue;

      const existingSchedule = await findConflict({
        staffId: scheduleData.staffId,
        date: new Date(scheduleData.date),
        shiftType: scheduleData.shiftType,
      });

      if (existingSchedule) continue;

      const schedule = await ShiftSchedule.create({
        staffId: scheduleData.staffId,
        date: new Date(scheduleData.date),
        shiftType: scheduleData.shiftType,
        startTime: scheduleData.startTime,
        endTime: scheduleData.endTime,
        note: scheduleData.note,
        location: scheduleData.location,
        deviceId: scheduleData.deviceId,
        assignedBy: request.user!.id,
        status: "scheduled",
      });

      createdSchedules.push(schedule);
    }

    const populatedSchedules = await ShiftSchedule.populate(createdSchedules, [
      { path: "staffId", select: "name email phone avatarUrl" },
      { path: "assignedBy", select: "name email" },
    ]);

    await Promise.all(
      populatedSchedules.map((schedule) =>
        createAuditLog({
          action: "shift_schedule_assigned",
          entityType: "ShiftSchedule",
          entityId: schedule._id,
          performedBy: request.user!.id,
          changes: {
            new: scheduleAuditSnapshot(schedule),
          },
        }),
      ),
    );

    response.status(201).json({
      schedules: populatedSchedules.map(serializeShiftSchedule),
      message: `Đã tạo ${createdSchedules.length} lịch ca`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      response
        .status(400)
        .json({ message: error.issues[0]?.message, errors: error.issues });
      return;
    }
    console.error("Error bulk creating shift schedules:", error);
    response.status(500).json({ message: "Lỗi khi tạo lịch ca hàng loạt" });
  }
}

// PATCH /api/shift-schedules/:id - Update schedule
export async function updateShiftSchedule(
  request: Request,
  response: Response,
) {
  try {
    if (!canManageSchedules(request.user)) {
      response.status(403).json({
        message: "Chỉ admin hoặc manager mới có quyền sửa lịch làm việc",
      });
      return;
    }

    const body = updateScheduleSchema.parse(request.body);
    const schedule = await ShiftSchedule.findById(request.params.id).populate(
      "staffId",
      "name email",
    );

    if (!schedule) {
      response.status(404).json({ message: "Không tìm thấy lịch ca" });
      return;
    }

    // SHIFT-01: nếu đổi nhân viên, người mới phải là staff đang hoạt động.
    if (body.staffId && body.staffId !== schedule.staffId.toString()) {
      const staffCheck = await getAssignableStaff(body.staffId);
      if ("error" in staffCheck) {
        response
          .status(staffCheck.error ?? 400)
          .json({ message: staffCheck.message });
        return;
      }
    }

    // SHIFT-01: conflict check tính trên trạng thái SAU update (staffId mới +
    // date/shiftType mới) — đổi riêng staffId gây trùng cũng bị chặn.
    const conflict = await findConflict({
      excludeId: schedule._id,
      staffId: body.staffId || schedule.staffId.toString(),
      date: body.date ? new Date(body.date) : schedule.date,
      shiftType: body.shiftType || schedule.shiftType,
    });

    if (conflict) {
      response
        .status(400)
        .json({ message: "Nhân viên đã có lịch ca này trong ngày" });
      return;
    }

    const previousValues = scheduleAuditSnapshot(schedule);

    // Update fields
    if (body.staffId) schedule.staffId = body.staffId as any;
    if (body.date) schedule.date = new Date(body.date);
    if (body.shiftType) schedule.shiftType = body.shiftType;
    if (body.startTime) schedule.startTime = body.startTime;
    if (body.endTime) schedule.endTime = body.endTime;
    if (body.status) schedule.status = body.status;
    if (body.note !== undefined) schedule.note = body.note;
    if (body.location !== undefined) schedule.location = body.location;
    if (body.deviceId !== undefined) schedule.deviceId = body.deviceId as any;

    await schedule.save();
    await schedule.populate("staffId", "name email phone avatarUrl");
    await schedule.populate("assignedBy", "name email");

    await createAuditLog({
      action:
        body.staffId && body.staffId !== previousValues.staffId
          ? "shift_schedule_handover"
          : "shift_schedule_updated",
      entityType: "ShiftSchedule",
      entityId: schedule._id,
      performedBy: request.user!.id,
      changes: {
        old: previousValues,
        new: scheduleAuditSnapshot(schedule),
      },
    });

    response.json({ schedule: serializeShiftSchedule(schedule) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      response
        .status(400)
        .json({ message: error.issues[0]?.message, errors: error.issues });
      return;
    }
    console.error("Error updating shift schedule:", error);
    response.status(500).json({ message: "Lỗi khi cập nhật lịch ca" });
  }
}

// DELETE /api/shift-schedules/:id - Delete schedule
export async function deleteShiftSchedule(
  request: Request,
  response: Response,
) {
  try {
    if (!canManageSchedules(request.user)) {
      response.status(403).json({
        message: "Chỉ admin hoặc manager mới có quyền xóa lịch làm việc",
      });
      return;
    }

    const schedule = await ShiftSchedule.findById(request.params.id).populate(
      "staffId",
      "name email",
    );

    if (!schedule) {
      response.status(404).json({ message: "Không tìm thấy lịch ca" });
      return;
    }

    await createAuditLog({
      action: "shift_schedule_deleted",
      entityType: "ShiftSchedule",
      entityId: schedule._id,
      performedBy: request.user!.id,
      changes: {
        old: scheduleAuditSnapshot(schedule),
      },
    });

    await ShiftSchedule.findByIdAndDelete(request.params.id);

    response.json({ message: "Đã xóa lịch ca" });
  } catch (error) {
    console.error("Error deleting shift schedule:", error);
    response.status(500).json({ message: "Lỗi khi xóa lịch ca" });
  }
}

export async function getScheduleHistory(request: Request, response: Response) {
  try {
    const scheduleId = request.params.id;
    // SEC-02: staff chỉ được xem lịch sử của ca mình được gán.
    if (request.user?.role === "staff") {
      const schedule =
        await ShiftSchedule.findById(scheduleId).select("staffId");
      if (!schedule || schedule.staffId.toString() !== request.user.id) {
        response.status(404).json({ message: "Không tìm thấy lịch ca" });
        return;
      }
    }

    const logs = await AuditLog.find({
      entityType: "ShiftSchedule",
      entityId: scheduleId,
    })
      .populate("performedBy", "name email role")
      .sort({ createdAt: -1 })
      .limit(50);

    response.json({ history: logs.map((log) => serializeAuditLog(log)) });
  } catch (error) {
    console.error("Error getting schedule history:", error);
    response.status(500).json({ message: "Lỗi khi lấy lịch sử ca làm" });
  }
}

// POST /api/shift-schedules/:id/check-in - Staff check-in
export async function checkInShift(request: Request, response: Response) {
  try {
    await closeExpiredCheckedInShifts();
    const schedule = await ShiftSchedule.findById(request.params.id);

    if (!schedule) {
      response.status(404).json({ message: "Không tìm thấy lịch ca" });
      return;
    }

    // Only the assigned staff can check in
    if (
      schedule.staffId.toString() !== request.user?.id &&
      !canManageSchedules(request.user)
    ) {
      response
        .status(403)
        .json({ message: "Bạn không có quyền check-in ca này" });
      return;
    }

    if (schedule.status !== "scheduled") {
      response
        .status(400)
        .json({ message: `Ca này đang ở trạng thái "${schedule.status}"` });
      return;
    }

    // Check if it's within the scheduled time.
    // Ca đêm là ca xuyên đêm (vd 22:00 → 06:00 hôm sau), nên cho
    // phép check-in "trễ" từ 12h TRƯỚC scheduledStart (tức là từ 10:00 sáng hôm
    // trước cho tới khi ca kết thúc). Điều này đảm bảo nhân viên ca đêm có thể
    // check-in ngay khi vào ca, kể cả khi 02:00 sáng hôm sau.
    const now = new Date();
    const scheduledStart = shiftDateTime(schedule.date, schedule.startTime);
    const scheduledEnd = shiftEndAt(schedule);
    if (!scheduledStart || !scheduledEnd) {
      response.status(400).json({ message: "Thời gian ca làm không hợp lệ" });
      return;
    }

    // earlyCheckin: mốc sớm nhất được phép check-in.
    // - Ca thường (không xuyên đêm): scheduledStart - 30 phút.
    // - Ca xuyên đêm (end <= start): scheduledStart - 12 giờ (đủ rộng cho
    //   nhân viên ca đêm check-in vào giữa đêm, vd 02:15 AM).
    const isOvernight = scheduledEnd.getTime() <= scheduledStart.getTime();
    const earlyMinutes = isOvernight ? 12 * 60 : 30;
    const earlyThreshold = new Date(scheduledStart);
    earlyThreshold.setMinutes(earlyThreshold.getMinutes() - earlyMinutes);

    if (now < earlyThreshold) {
      response.status(400).json({
        message: `Chưa đến giờ check-in. Vui lòng check-in sau ${earlyThreshold.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`,
      });
      return;
    }

    if (now >= scheduledEnd) {
      response.status(400).json({
        message: "Ca làm đã kết thúc, không thể check-in.",
      });
      return;
    }

    const checkedInAt = new Date();
    schedule.status = "checked_in";
    schedule.checkedInAt = checkedInAt;
    await schedule.save();
    await schedule.populate("staffId", "name email phone avatarUrl");
    await schedule.populate("assignedBy", "name email");

    await createAuditLog({
      action: "shift_schedule_checked_in",
      entityType: "ShiftSchedule",
      entityId: schedule._id,
      performedBy: request.user!.id,
      changes: {
        new: {
          ...scheduleAuditSnapshot(schedule),
          checkedInAt: checkedInAt.toISOString(),
        },
      },
    });

    response.json({ schedule: serializeShiftSchedule(schedule) });
  } catch (error) {
    console.error("Error checking in shift:", error);
    response.status(500).json({ message: "Lỗi khi check-in ca làm" });
  }
}

// POST /api/shift-schedules/:id/complete - Complete shift
export async function completeShift(request: Request, response: Response) {
  try {
    const schedule = await ShiftSchedule.findById(request.params.id);

    if (!schedule) {
      response.status(404).json({ message: "Không tìm thấy lịch ca" });
      return;
    }

    if (
      schedule.staffId.toString() !== request.user?.id &&
      !canManageSchedules(request.user)
    ) {
      response
        .status(403)
        .json({ message: "Bạn không có quyền hoàn thành ca này" });
      return;
    }

    if (schedule.status !== "checked_in") {
      response.status(400).json({ message: "Ca này chưa được check-in" });
      return;
    }

    const completedAt = new Date();
    schedule.status = "completed";
    schedule.completedAt = completedAt;
    await schedule.save();
    await schedule.populate("staffId", "name email phone avatarUrl");
    await schedule.populate("assignedBy", "name email");

    await createAuditLog({
      action: "shift_schedule_completed",
      entityType: "ShiftSchedule",
      entityId: schedule._id,
      performedBy: request.user!.id,
      changes: {
        new: {
          ...scheduleAuditSnapshot(schedule),
          completedAt: completedAt.toISOString(),
        },
      },
    });

    response.json({ schedule: serializeShiftSchedule(schedule) });
  } catch (error) {
    console.error("Error completing shift:", error);
    response.status(500).json({ message: "Lỗi khi hoàn thành ca làm" });
  }
}

// GET /api/shift-schedules/types - Get shift types
export async function getShiftTypes(request: Request, response: Response) {
  response.json({
    shiftTypes: [
      {
        key: "morning",
        label: "Ca sáng",
        startTime: "06:00",
        endTime: "14:00",
      },
      {
        key: "afternoon",
        label: "Ca chiều",
        startTime: "14:00",
        endTime: "18:00",
      },
      { key: "evening", label: "Ca tối", startTime: "18:00", endTime: "22:00" },
      { key: "night", label: "Ca đêm", startTime: "22:00", endTime: "06:00" },
    ],
  });
}

// GET /api/shift-schedules/staffs - Get list of staff (for admin to select)
export async function getStaffsForSchedule(
  request: Request,
  response: Response,
) {
  try {
    if (!canManageSchedules(request.user)) {
      response.status(403).json({
        message: "Chỉ admin hoặc manager mới có quyền xem danh sách nhân viên",
      });
      return;
    }

    const staffs = await User.find({ role: "staff", status: "Đang hoạt động" })
      .select("name email phone avatarUrl")
      .sort({ name: 1 });

    response.json({
      staffs: staffs.map((staff) => ({
        id: staff._id.toString(),
        name: staff.name,
        email: staff.email,
        phone: staff.phone ?? null,
        avatarUrl: staff.avatarUrl ?? null,
      })),
    });
  } catch (error) {
    console.error("Error getting staff list:", error);
    response.status(500).json({ message: "Lỗi khi lấy danh sách nhân viên" });
  }
}

// GET /api/shift-schedules/stats - Get work statistics for all staff (admin only)
export async function getShiftStats(request: Request, response: Response) {
  try {
    if (!canManageSchedules(request.user)) {
      response
        .status(403)
        .json({ message: "Chỉ admin hoặc manager mới có quyền xem thống kê" });
      return;
    }

    const { month, year } = request.query;

    // Default to current month
    const targetYear = year
      ? parseInt(year as string)
      : new Date().getFullYear();
    const targetMonth = month
      ? parseInt(month as string)
      : new Date().getMonth() + 1;

    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    // Get all staff
    const staffs = await User.find({ role: "staff", status: "Đang hoạt động" })
      .select("name email phone avatarUrl")
      .sort({ name: 1 });

    // Get all schedules for the month
    const schedules = await ShiftSchedule.find({
      date: { $gte: startOfMonth, $lte: endOfMonth },
    }).populate("staffId", "name");

    // Calculate stats for each staff
    // SHIFT-01: populate staffId có thể null (user bị xóa cũ) — đếm vào bucket
    // "unassigned" thay vì dereference .staffId._id gây 500.
    const staffStats = staffs.map((staff) => {
      const staffSchedules = schedules.filter(
        (s) =>
          s.staffId &&
          (s.staffId as { _id?: unknown })._id?.toString() ===
            staff._id.toString(),
      );

      const total = staffSchedules.length;
      const completed = staffSchedules.filter(
        (s) => s.status === "completed",
      ).length;
      const checkedIn = staffSchedules.filter(
        (s) => s.status === "checked_in",
      ).length;
      const scheduled = staffSchedules.filter(
        (s) => s.status === "scheduled",
      ).length;
      const cancelled = staffSchedules.filter(
        (s) => s.status === "cancelled",
      ).length;

      return {
        staffId: staff._id.toString(),
        name: staff.name,
        email: staff.email,
        phone: staff.phone ?? null,
        avatarUrl: staff.avatarUrl ?? null,
        total,
        completed,
        checkedIn,
        scheduled,
        cancelled,
      };
    });

    const orphanSchedules = schedules.filter((s) => !s.staffId);

    // Calculate totals
    const unassignedStats = {
      staffId: null,
      name: "(Nhân viên không còn trong hệ thống)",
      email: null,
      phone: null,
      avatarUrl: null,
      total: orphanSchedules.length,
      completed: orphanSchedules.filter((s) => s.status === "completed").length,
      checkedIn: orphanSchedules.filter((s) => s.status === "checked_in")
        .length,
      scheduled: orphanSchedules.filter((s) => s.status === "scheduled").length,
      cancelled: orphanSchedules.filter((s) => s.status === "cancelled").length,
    };
    const allStats = orphanSchedules.length
      ? [...staffStats, unassignedStats]
      : staffStats;
    const totals = {
      total: allStats.reduce((sum, s) => sum + s.total, 0),
      completed: allStats.reduce((sum, s) => sum + s.completed, 0),
      checkedIn: allStats.reduce((sum, s) => sum + s.checkedIn, 0),
      scheduled: allStats.reduce((sum, s) => sum + s.scheduled, 0),
      cancelled: allStats.reduce((sum, s) => sum + s.cancelled, 0),
    };

    response.json({
      month: targetMonth,
      year: targetYear,
      stats: allStats,
      totals,
    });
  } catch (error) {
    console.error("Error getting shift stats:", error);
    response.status(500).json({ message: "Lỗi khi lấy thống kê lịch ca" });
  }
}
