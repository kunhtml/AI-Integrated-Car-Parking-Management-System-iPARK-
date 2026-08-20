import mongoose from "mongoose";
import { ShiftSchedule } from "../models/ShiftSchedule.js";
import { AppError } from "../utils/AppError.js";

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

function getVietnamDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function getShiftDateTime(date: Date, time: string) {
  const { year, month, day } = getVietnamDateParts(date);
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 7 * 60 * 60 * 1000);
}

function isWithinShift(at: Date, schedule: { date: Date; startTime: string; endTime: string }) {
  const start = getShiftDateTime(schedule.date, schedule.startTime);
  const end = getShiftDateTime(schedule.date, schedule.endTime);
  if (!start || !end) return false;
  if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
  return at >= start && at < end;
}

export async function findResponsibleStaffAt(
  at: Date,
  options: { includeCompleted?: boolean } = {},
): Promise<mongoose.Types.ObjectId | null> {
  const statuses: Array<"checked_in" | "completed"> = options.includeCompleted
    ? ["checked_in", "completed"]
    : ["checked_in"];
  const schedules = await ShiftSchedule.find({
    date: {
      $gte: new Date(at.getTime() - 48 * 60 * 60 * 1000),
      $lte: new Date(at.getTime() + 24 * 60 * 60 * 1000),
    },
    status: { $in: statuses },
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  return schedules.find((schedule) => isWithinShift(at, schedule))?.staffId ?? null;
}

export async function requireResponsibleStaffAt(at: Date) {
  const staffId = await findResponsibleStaffAt(at);
  if (!staffId) {
    throw new AppError("Không có nhân viên đang điểm danh ca để chịu trách nhiệm cho phiên gửi xe này.", 409);
  }
  return staffId;
}
