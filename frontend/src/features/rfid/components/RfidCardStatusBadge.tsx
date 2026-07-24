import type { RfidCardStatus } from "@/types";

const STATUS_CONFIG: Record<
  RfidCardStatus,
  { label: string; className: string }
> = {
  available: { label: "Sẵn sàng", className: "badge success" },
  "in-use": { label: "Đang sử dụng", className: "badge info" },
  lost: { label: "Mất", className: "badge warning" },
  blocked: { label: "Đã khóa", className: "badge error" },
};

export function RfidCardStatusBadge({ status }: { status: RfidCardStatus }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "badge",
  };
  return <span className={config.className}>{config.label}</span>;
}
