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
            ? "var(--success-soft)"
            : status === "pending_payment" || status === "expired"
              ? "var(--warning-soft)"
              : status === "cancelled"
                ? "var(--danger-soft)"
                : "var(--surface-2)",
        color:
          status === "active"
            ? "var(--success)"
            : status === "pending_payment" || status === "expired"
              ? "var(--warning)"
              : status === "cancelled"
                ? "var(--danger)"
                : "var(--fg-muted)",
        border: "1px solid transparent",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
