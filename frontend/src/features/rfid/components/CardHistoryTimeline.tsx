"use client";

import { Loader2, X } from "lucide-react";
import type { RfidScanLog } from "@/types";

const SCAN_ACTION_LABELS: Record<string, string> = {
  entry: "ENTRY",
  exit: "EXIT",
  assign: "ASSIGN",
  return: "RETURN",
  block: "BLOCK",
  unblock: "UNBLOCK",
  "report-lost": "REPORT-LOST",
};

const ACTION_ICONS: Record<string, string> = {
  entry: "🚗",
  exit: "🚙",
  assign: "📋",
  return: "🔄",
  block: "🔒",
  unblock: "🔓",
  "report-lost": "⚠️",
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
  cardId: string;
  logs: RfidScanLog[];
  loading?: boolean;
  onClose: () => void;
};

export function CardHistoryTimeline({ cardId, logs, loading, onClose }: Props) {
  return (
    <div className="panel wide">
      <div className="panel-heading">
        <div>
          <p>Lịch sử thẻ</p>
          <h2>{cardId}</h2>
        </div>
        <button className="ghost-button" onClick={onClose} type="button">
          <X size={14} /> Đóng
        </button>
      </div>
      {loading ? (
        <p className="muted-text">
          <Loader2 className="spin" size={16} /> Đang tải lịch sử…
        </p>
      ) : logs.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
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
                  <td>
                    {ACTION_ICONS[log.action] || ""}{" "}
                    {SCAN_ACTION_LABELS[log.action] || log.action}
                  </td>
                  <td>
                    <span
                      className={
                        log.status === "success"
                          ? "badge success"
                          : "badge warning"
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
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted-text">Chưa có lịch sử cho thẻ này.</p>
      )}
    </div>
  );
}
