"use client";

import type { RfidScanLog } from "@/types";

const SCAN_ACTION_LABELS: Record<string, string> = {
  entry: "Xe vào",
  exit: "Xe ra",
  assign: "Gán thẻ",
  return: "Trả thẻ",
  block: "Khóa",
  unblock: "Mở khóa",
  "report-lost": "Báo mất",
};

function fmt(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type Props = {
  logs: RfidScanLog[];
  loading?: boolean;
  showCardId?: boolean;
};

export function RfidScanLogTable({
  logs,
  loading,
  showCardId = true,
}: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Thời gian</th>
            {showCardId && <th>Mã thẻ</th>}
            <th>Hành động</th>
            <th>Trạng thái</th>
            <th>Biển số</th>
            <th>Nhân viên</th>
            <th>Lý do lỗi</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{fmt(log.createdAt)}</td>
              {showCardId && (
                <td>
                  <strong>{log.cardId}</strong>
                </td>
              )}
              <td>{SCAN_ACTION_LABELS[log.action] || log.action}</td>
              <td>
                <span
                  className={
                    log.status === "success" ? "badge success" : "badge warning"
                  }
                >
                  {log.status}
                </span>
              </td>
              <td>
                {log.plateDetected || <span className="muted-cell">—</span>}
              </td>
              <td>
                {log.performedBy || <span className="muted-cell">—</span>}
              </td>
              <td>
                {log.failureReason || <span className="muted-cell">—</span>}
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td className="muted-cell" colSpan={showCardId ? 7 : 6}>
                {loading ? "Đang tải…" : "Chưa có lịch sử quét."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
