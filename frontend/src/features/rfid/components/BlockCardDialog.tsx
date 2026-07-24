"use client";

import { useState } from "react";
import { ShieldBan, Loader2, X } from "lucide-react";
import type { RfidCard } from "@/types";

type Props = {
  card: RfidCard;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export function BlockCardDialog({ card, open, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm(reason);
      setReason("");
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !pending && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <ShieldBan className="text-danger" size={24} />
          <h3>Khóa thẻ RFID</h3>
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
        <label>
          Lý do khóa
          <input
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Hỏng chip, mất thẻ..."
            type="text"
            value={reason}
          />
        </label>
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
            className="full-button danger"
            disabled={pending}
            onClick={() => void handleConfirm()}
            type="button"
          >
            {pending ? <Loader2 className="spin" size={18} /> : <ShieldBan size={18} />}
            {pending ? "Đang khóa…" : "Khóa thẻ"}
          </button>
        </div>
      </div>
    </div>
  );
}
