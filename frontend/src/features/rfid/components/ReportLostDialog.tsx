"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import type { RfidCard } from "@/types";

type Props = {
  card: RfidCard;
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function ReportLostDialog({ card, open, onClose, onConfirm }: Props) {
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
          <AlertTriangle className="text-warning" size={24} />
          <h3>Báo mất thẻ RFID</h3>
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
        <p>Bạn có chắc chắn muốn báo mất thẻ này?</p>
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
            className="full-button warning"
            disabled={pending}
            onClick={() => void handleConfirm()}
            type="button"
          >
            {pending ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <AlertTriangle size={18} />
            )}
            {pending ? "Đang xử lý…" : "Báo mất"}
          </button>
        </div>
      </div>
    </div>
  );
}
