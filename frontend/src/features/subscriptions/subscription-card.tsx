"use client";

import { CalendarClock, Car, CheckCircle, CreditCard, RefreshCcw, ShieldAlert, Star, XCircle } from "lucide-react";
import type { Subscription, SubscriptionVehicle } from "@/types";
import { daysRemaining, formatDate, isVehicleBlocked } from "./styles";
import { StatusBadge } from "./status-badge";

type Props = {
  subscription: Subscription;
  renewing: boolean;
  cancelling: boolean;
  onRenew: (id: string) => void;
  onContinuePayment: (id: string) => Promise<boolean> | void;
  onCancel: (id: string) => void;
  onViewVehicle: (vehicleId: string) => void;
};

function describeVehicle(v: SubscriptionVehicle): string {
  const parts = [v.brand, v.model, v.color].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Chưa cập nhật thông tin xe";
}

export function SubscriptionCard({ subscription, renewing, cancelling, onRenew, onContinuePayment, onCancel, onViewVehicle }: Props) {
  const s = subscription;
  const days = daysRemaining(s.endDate);
  const canRenew = s.status === "active" || s.status === "expired";
  const canContinuePayment = s.status === "pending_payment";
  const primary = s.primaryVehicle ?? null;
  const blocked = primary ? isVehicleBlocked(primary.status) : false;

  const isActive = s.status === "active" && days > 0;
  const isExpiring = isActive && days <= 7;
  const isExpired = s.status === "expired" || days === 0;
  const isPending = s.status === "pending_payment";

  const daysColor = isExpired ? "#ef4444" : isExpiring ? "#f59e0b" : "#10b981";
  const accentColor = isActive ? "#3b82f6" : isPending ? "#f59e0b" : isExpired ? "#6b7280" : "#3b82f6";
  const bgAccentSoft = isActive ? "#eff6ff" : isPending ? "#fffbeb" : "#f9fafb";
  const borderColor = isActive ? "#bfdbfe" : isPending ? "#fde68a" : "#e5e7eb";

  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        overflow: "hidden",
        transition: "all 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* Status top bar */}
      <div
        style={{
          height: 4,
          background: isActive
            ? "linear-gradient(90deg, #3b82f6, #06b6d4)"
            : isPending
              ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
              : isExpired
                ? "linear-gradient(90deg, #9ca3af, #d1d5db)"
                : "#e5e7eb",
        }}
      />

      <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Top row: plan + badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Star size={13} color={accentColor} fill={isActive ? accentColor : "none"} />
              <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", fontWeight: 700 }}>
                {s.planName}
              </span>
            </div>
            {s.memberCode && (
              <div style={{ fontSize: "1.05rem", fontWeight: 800, fontFamily: "monospace", color: "#0f172a", letterSpacing: 0.5 }}>
                {s.memberCode}
              </div>
            )}
          </div>
          <StatusBadge status={s.status} />
        </div>

        {/* Vehicle */}
        {primary && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#f8fafc",
              border: "1px solid #f1f5f9",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: bgAccentSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: `1px solid ${borderColor}`,
              }}
            >
              <Car size={18} color={accentColor} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a" }}>{primary.plate}</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{describeVehicle(primary)}</div>
              {blocked && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, color: "#dc2626", fontSize: "0.78rem", fontWeight: 600 }}>
                  <ShieldAlert size={12} /> "{primary.status}" — không đủ điều kiện gửi xe.
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onViewVehicle(primary.id)}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#64748b",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                minHeight: 30,
                flexShrink: 0,
              }}
            >
              Chi tiết
            </button>
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Bắt đầu
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem", color: "#475569" }}>
              <CalendarClock size={12} color="#94a3b8" /> {formatDate(s.startDate)}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Hết hạn
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem", color: "#475569" }}>
              <CalendarClock size={12} color="#94a3b8" /> {formatDate(s.endDate)}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Còn lại
            </span>
            <span
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: daysColor,
                fontFamily: "monospace",
              }}
            >
              {days > 0 ? `${days} ngày` : "Hết hạn"}
            </span>
          </div>
        </div>

        {/* Pending payment warning */}
        {canContinuePayment && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              fontSize: "0.83rem",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              lineHeight: 1.45,
            }}
          >
            <CreditCard size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Đang chờ thanh toán. Bấm <strong>Tiếp tục thanh toán</strong> để mở lại QR.</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
          {canContinuePayment && (
            <button
              type="button"
              onClick={() => onContinuePayment(s.id)}
              disabled={renewing}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 16px",
                borderRadius: 10,
                border: "1.5px solid #fde68a",
                background: "#fffbeb",
                color: "#b45309",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: renewing ? "not-allowed" : "pointer",
                opacity: renewing ? 0.6 : 1,
                transition: "all 0.15s",
                minHeight: 40,
              }}
            >
              <CreditCard size={14} />
              {renewing ? "Đang mở QR..." : "Tiếp tục thanh toán"}
            </button>
          )}
          {canContinuePayment && (
            <button
              type="button"
              onClick={() => onCancel(s.id)}
              disabled={renewing || cancelling}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 16px",
                borderRadius: 10,
                border: "1.5px solid #fecaca",
                background: "#fff1f2",
                color: "#be123c",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: renewing || cancelling ? "not-allowed" : "pointer",
                opacity: renewing || cancelling ? 0.6 : 1,
                transition: "all 0.15s",
                minHeight: 40,
              }}
            >
              <XCircle size={14} />
              {cancelling ? "Đang hủy..." : "Hủy yêu cầu"}
            </button>
          )}
          {canRenew && (
            <button
              type="button"
              onClick={() => onRenew(s.id)}
              disabled={renewing}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: renewing ? "not-allowed" : "pointer",
                opacity: renewing ? 0.6 : 1,
                transition: "all 0.15s",
                boxShadow: "0 2px 8px rgba(59,130,246,0.35)",
                minHeight: 40,
              }}
            >
              <RefreshCcw size={14} />
              {renewing ? "Đang xử lý..." : "Gia hạn ngay"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
