"use client";

import { History, ShieldBan, ShieldCheck, AlertTriangle } from "lucide-react";
import type { RfidCard } from "@/types";
import { RfidCardStatusBadge } from "./RfidCardStatusBadge";

function fmt(value?: string | null) {
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
  cards: RfidCard[];
  loading?: boolean;
  onViewHistory: (card: RfidCard) => void;
  onBlock: (card: RfidCard) => void;
  onReportLost: (card: RfidCard) => void;
  onUnblock: (card: RfidCard) => void;
};

export function RfidCardTable({
  cards,
  loading,
  onViewHistory,
  onBlock,
  onReportLost,
  onUnblock,
}: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã thẻ</th>
            <th>Trạng thái</th>
            <th>Ngày tạo</th>
            <th>Lần dùng cuối</th>
            <th>Ghi chú</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
              <td>
                <strong>{card.cardId}</strong>
              </td>
              <td>
                <RfidCardStatusBadge status={card.status} />
              </td>
              <td>{fmt(card.createdAt)}</td>
              <td>{fmt(card.lastUsedAt)}</td>
              <td>
                {card.status === "blocked" && card.blockedReason
                  ? card.blockedReason
                  : card.notes || <span className="muted-cell">—</span>}
              </td>
              <td>
                <div className="inline-actions">
                  <button
                    className="small-button"
                    onClick={() => onViewHistory(card)}
                    title="Xem lịch sử"
                    type="button"
                  >
                    <History size={14} />
                  </button>
                  {card.status === "available" && (
                    <>
                      <button
                        className="small-button danger"
                        onClick={() => onBlock(card)}
                        title="Khóa thẻ"
                        type="button"
                      >
                        <ShieldBan size={14} />
                      </button>
                      <button
                        className="small-button warning"
                        onClick={() => onReportLost(card)}
                        title="Báo mất"
                        type="button"
                      >
                        <AlertTriangle size={14} />
                      </button>
                    </>
                  )}
                  {(card.status === "blocked" ||
                    card.status === "lost" ||
                    card.status === "in-use") && (
                    <button
                      className="small-button success"
                      onClick={() => onUnblock(card)}
                      title="Mở khóa / Khôi phục"
                      type="button"
                    >
                      <ShieldCheck size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {cards.length === 0 && (
            <tr>
              <td className="muted-cell" colSpan={6}>
                {loading
                  ? "Đang tải…"
                  : "Chưa có thẻ RFID nào. Đăng ký ở form bên trái."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
