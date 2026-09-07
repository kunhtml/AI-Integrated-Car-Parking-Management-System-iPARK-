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

  const daysColor = isExpired ? "var(--danger)" : isExpiring ? "var(--warning)" : "var(--success)";
  const accentColor = isActive ? "var(--primary)" : isPending ? "var(--warning)" : isExpired ? "var(--fg-muted)" : "var(--primary)";
  const bgAccentSoft = isActive ? "var(--primary-soft)" : isPending ? "var(--warning-soft)" : "var(--bg)";
  const borderColor = isActive ? "var(--primary)" : isPending ? "var(--warning)" : "var(--border)";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        overflow: "hidden",
        transition: "all 0.2s",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Status top bar */}
      <div
        style={{
          height: 4,
          background: isActive
            ? "linear-gradient(90deg, var(--primary), var(--primary-hover))"
            : isPending
              ? "linear-gradient(90deg, var(--warning), var(--warning))"
              : isExpired
                ? "linear-gradient(90deg, var(--fg-muted), var(--border))"
                : "var(--border)",
        }}
      />

      <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Top row: plan + badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Star size={13} color={accentColor} fill={isActive ? accentColor : "none"} />
              <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--fg-subtle)", fontWeight: 700 }}>
                {s.planName}
              </span>
            </div>
            {s.memberCode && (
              <div style={{ fontSize: "1.05rem", fontWeight: 800, fontFamily: "monospace", color: "var(--fg)", letterSpacing: 0.5 }}>
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
              background: "var(--bg)",
              border: "1px solid var(--border)",
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
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--fg)" }}>{primary.plate}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--fg-muted)" }}>{describeVehicle(primary)}</div>
              {blocked && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, color: "var(--danger)", fontSize: "0.78rem", fontWeight: 600 }}>
                  <ShieldAlert size={12} /> "{primary.status}" — không đủ điều kiện gửi xe.
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onViewVehicle(primary.id)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--fg-muted)",
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
            <span style={{ fontSize: "0.68rem", color: "var(--fg-subtle)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Bắt đầu
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem", color: "var(--fg-muted)" }}>
              <CalendarClock size={12} color="var(--fg-subtle)" /> {formatDate(s.startDate)}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "0.68rem", color: "var(--fg-subtle)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Hết hạn
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem", color: "var(--fg-muted)" }}>
              <CalendarClock size={12} color="var(--fg-subtle)" /> {formatDate(s.endDate)}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "0.68rem", color: "var(--fg-subtle)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
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
              background: "var(--warning-soft)",
              border: "1px solid var(--border)",
              color: "var(--warning)",
              fontSize: "0.83rem",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              lineHeight: 1.45,
            }}
          >
            <CreditCard size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
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
                border: "1.5px solid var(--warning)",
                background: "var(--warning-soft)",
                color: "var(--warning)",
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
                border: "1.5px solid var(--danger)",
                background: "var(--danger-soft)",
                color: "var(--danger)",
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
                background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
                color: "var(--primary-fg)",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: renewing ? "not-allowed" : "pointer",
                opacity: renewing ? 0.6 : 1,
                transition: "all 0.15s",
                boxShadow: "var(--shadow-md)",
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
