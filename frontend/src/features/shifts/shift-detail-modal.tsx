"use client";

import { Calendar, CheckCircle, Clock, MapPin, User, X } from "lucide-react";
import type { ShiftScheduleItem } from "@/types";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  evening: "Ca tối",
  night: "Ca đêm",
};
const SHIFT_COLORS: Record<string, { bg: string; color: string }> = {
  morning: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b" },
  afternoon: { bg: "rgba(249,115,22,0.1)", color: "#f97316" },
  evening: { bg: "rgba(139,92,246,0.1)", color: "#8b5cf6" },
  night: { bg: "rgba(6,182,212,0.1)", color: "#06b6d4" },
};
const STATUS_LABELS: Record<string, string> = {
  scheduled: "Chưa điểm danh",
  checked_in: "Đang làm",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  scheduled: { bg: "rgba(148,163,184,0.1)", color: "#64748b" },
  checked_in: { bg: "rgba(16,185,129,0.1)", color: "#10b981" },
  completed: { bg: "rgba(59,130,246,0.1)", color: "#3b82f6" },
  cancelled: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
};

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ShiftDetailModal({
  schedule,
  onClose,
}: {
  schedule: ShiftScheduleItem;
  onClose: () => void;
}) {
  const sc = SHIFT_COLORS[schedule.shiftType] ?? SHIFT_COLORS.morning;
  const st = STATUS_COLORS[schedule.status] ?? STATUS_COLORS.scheduled;

  return (
    <div className="sub-modal-overlay" onClick={onClose}>
      <div
        className="sub-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <div className="sub-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: sc.bg,
                color: sc.color,
              }}
            >
              <Calendar size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {SHIFT_LABELS[schedule.shiftType] ?? schedule.shiftType}
              </h3>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  color: "var(--fg-muted)",
                  marginTop: 2,
                }}
              >
                <Clock size={11} />
                {formatDate(schedule.date)}
              </span>
            </div>
          </div>
          <button
            className="sub-modal-close"
            onClick={onClose}
            type="button"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sub-modal-content" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Status badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  color: st.color,
                  background: st.bg,
                  padding: "4px 10px",
                  borderRadius: 999,
                }}
              >
                {STATUS_LABELS[schedule.status]}
              </span>
            </div>

            {/* Time range */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <Clock size={15} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
              <span>
                <strong>{schedule.startTime}</strong> – <strong>{schedule.endTime}</strong>
              </span>
            </div>

            {/* Staff name */}
            {schedule.staffName && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <User size={15} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
                <span>{schedule.staffName}</span>
              </div>
            )}

            {/* Check-in time */}
            {schedule.checkedInAt && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <CheckCircle size={15} style={{ color: "#10b981", flexShrink: 0 }} />
                <span>Điểm danh lúc: {formatDateTime(schedule.checkedInAt)}</span>
              </div>
            )}

            {/* Completion time */}
            {schedule.completedAt && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <CheckCircle size={15} style={{ color: "#3b82f6", flexShrink: 0 }} />
                <span>Hoàn thành lúc: {formatDateTime(schedule.completedAt)}</span>
              </div>
            )}

            {/* Location */}
            {schedule.location && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <MapPin size={15} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
                <span>{schedule.location}</span>
              </div>
            )}

            {/* Assigned by */}
            {schedule.assignedByName && (
              <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
                Phân công bởi: {schedule.assignedByName}
              </div>
            )}

            {/* Note */}
            {schedule.note && (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--fg-muted)",
                  background: "rgba(148,163,184,0.08)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  lineHeight: 1.5,
                }}
              >
                {schedule.note}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
