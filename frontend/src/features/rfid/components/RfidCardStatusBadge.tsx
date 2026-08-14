import type { RfidCardStatus } from "@/types";

const STATUS_CONFIG: Record<
  RfidCardStatus,
  { label: string; className: string }
> = {
  active: { label: "Đang kích hoạt", className: "badge success" },
  inactive: { label: "Không hoạt động", className: "badge" },
  available: { label: "Sẵn sàng", className: "badge success" },
  "pending-sale": { label: "Chờ bán", className: "badge warning" },
  "in-use": { label: "Đang sử dụng", className: "badge info" },
  lost: { label: "Mất", className: "badge warning" },
  blocked: { label: "Đã khóa", className: "badge error" },
  damaged: { label: "Hỏng", className: "badge error" },
  returned: { label: "Đã trả", className: "badge" },
};

export function RfidCardStatusBadge({ status }: { status: RfidCardStatus }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "badge",
  };
  return <span className={config.className}>{config.label}</span>;
}
