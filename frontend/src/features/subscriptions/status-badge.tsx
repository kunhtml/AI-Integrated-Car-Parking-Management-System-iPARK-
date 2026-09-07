"use client";

import { statusLabel } from "./styles";

export function StatusBadge({ status }: { status: string }) {
  const label = statusLabel(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 100,
        fontSize: "11px",
        fontWeight: 700,
        padding: "4px 10px",
        background:
          status === "active"
            ? "#dcfce7"
            : status === "pending_payment" || status === "expired"
              ? "#fef9c3"
              : status === "cancelled"
                ? "#fee2e2"
                : "#f1f5f9",
        color:
          status === "active"
            ? "var(--success)"
            : status === "pending_payment" || status === "expired"
              ? "#854d0e"
              : status === "cancelled"
                ? "var(--danger)"
                : "#475569",
        border: "1px solid transparent",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
