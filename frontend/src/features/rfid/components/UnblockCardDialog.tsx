"use client";

import { useState } from "react";
import { ShieldCheck, Loader2, X } from "lucide-react";
import type { RfidCard } from "@/types";

type Props = {
  card: RfidCard;
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function UnblockCardDialog({ card, open, onClose, onConfirm }: Props) {
  const [pending, setPending] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !pending && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <ShieldCheck className="text-success" size={24} />
          <h3>Mở khóa thẻ RFID</h3>
          <button
            className="ghost-button"
            disabled={pending}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <p>
          Mã thẻ: <strong>{card.cardId}</strong>
        </p>
        <p>
          Trạng thái hiện tại:{" "}
          <span className="badge error">
            {card.status === "blocked" ? "Đã khóa" : card.status === "lost" ? "Mất" : "Đang sử dụng"}
          </span>
        </p>
        <p>Thẻ sẽ được chuyển về trạng thái "Sẵn sàng" và có thể sử dụng lại.</p>
        <div className="modal-actions">
          <button
            className="ghost-button"
            disabled={pending}
            onClick={onClose}
            type="button"
          >
            Hủy
          </button>
          <button
            className="full-button success"
            disabled={pending}
            onClick={() => void handleConfirm()}
            type="button"
          >
            {pending ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <ShieldCheck size={18} />
            )}
            {pending ? "Đang xử lý…" : "Mở khóa"}
          </button>
        </div>
      </div>
    </div>
  );
}
