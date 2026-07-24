"use client";

import { use, useState } from "react";
import {
  ArrowLeft,
  CreditCard,
  History,
  Loader2,
  MapPin,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { RoleGuard } from "@/components/layout/role-guard";
import { RfidCardStatusBadge } from "@/features/rfid/components/RfidCardStatusBadge";
import { CardHistoryTimeline } from "@/features/rfid/components/CardHistoryTimeline";
import { useRfidCardDetail } from "@/features/rfid/hooks/useRfidCardDetail";

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

function CardDetailContent({ cardId }: { cardId: string }) {
  const { card, activeSession, scanCount, history, loading, error, load } =
    useRfidCardDetail(cardId);
  const [showHistory, setShowHistory] = useState(false);

  if (loading) {
    return (
      <section className="content-single">
        <div className="panel">
          <p className="muted-text">
            <Loader2 className="spin" size={16} /> Đang tải…
          </p>
        </div>
      </section>
    );
  }

  if (error || !card) {
    return (
      <section className="content-single">
        <div className="panel">
          <p className="muted-text error">{error || "Không tìm thấy thẻ."}</p>
          <Link className="ghost-button" href="/dashboard/rfid-cards">
            <ArrowLeft size={14} /> Quay lại
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="content-grid">
      {/* ───── Left: Card info ───── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>
                <Link href="/dashboard/rfid-cards">RFID Cards</Link> / {card.cardId}
              </p>
              <h2>
                <CreditCard size={28} /> Chi tiết thẻ RFID
              </h2>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                className="ghost-button"
                onClick={() => void load()}
                type="button"
              >
                <RefreshCw size={14} />
              </button>
              <button
                className="ghost-button"
                onClick={() => setShowHistory(!showHistory)}
                type="button"
              >
                <History size={14} />
              </button>
              <Link className="ghost-button" href="/dashboard/rfid-cards">
                <ArrowLeft size={14} />
              </Link>
            </div>
          </div>
          <div className="stack-form">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted-text">Mã thẻ:</span>
              <strong>{card.cardId}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted-text">Trạng thái:</span>
              <RfidCardStatusBadge status={card.status} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted-text">Ngày tạo:</span>
              <span>{fmt(card.createdAt)}</span>
            </div>
            {card.issuedAt && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted-text">Ngày phát:</span>
                <span>{fmt(card.issuedAt)}</span>
              </div>
            )}
            {card.lastUsedAt && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted-text">Lần dùng cuối:</span>
                <span>{fmt(card.lastUsedAt)}</span>
              </div>
            )}
            {card.lostAt && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted-text">Ngày báo mất:</span>
                <span>{fmt(card.lostAt)}</span>
              </div>
            )}
            {card.blockedAt && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted-text">Ngày khóa:</span>
                <span>{fmt(card.blockedAt)}</span>
              </div>
            )}
            {card.blockedReason && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted-text">Lý do khóa:</span>
                <span>{card.blockedReason}</span>
              </div>
            )}
            {card.notes && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted-text">Ghi chú:</span>
                <span>{card.notes}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted-text">Tổng lần quét:</span>
              <span>{scanCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ───── Right: Active session ───── */}
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Phiếu gửi xe</p>
            <h2>
              <MapPin size={28} /> Phiếu hiện tại
            </h2>
          </div>
        </div>
          {activeSession ? (
            <div className="stack-form">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted-text">Mã phiếu:</span>
                <strong>{String(activeSession._id)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted-text">Biển số:</span>
                <span>
                  {String(
                    activeSession.plate ||
                      activeSession.plateNumber ||
                      "—",
                  )}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted-text">Slot:</span>
                <span>{String(activeSession.slot || "—")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted-text">Trạng thái:</span>
                <span className="badge info">
                  {String(activeSession.status || "—")}
                </span>
              </div>
            </div>
          ) : (
            <p className="muted-text">Không có phiếu gửi xe đang active.</p>
          )}
      </div>

      {showHistory && (
        <CardHistoryTimeline
          cardId={card.cardId}
          loading={false}
          logs={history}
          onClose={() => setShowHistory(false)}
        />
      )}
    </section>
  );
}

export default function CardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = use(params);
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <CardDetailContent cardId={cardId} />
    </RoleGuard>
  );
}
