"use client";

import { useState } from "react";
import { AlertCircle, CreditCard, Loader2, X } from "lucide-react";

function validateCardId(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Mã thẻ RFID là bắt buộc.";
  if (v.length < 3) return "Mã thẻ phải có ít nhất 3 ký tự.";
  if (v.length > 50) return "Mã thẻ không được quá 50 ký tự.";
  return undefined;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  registerFn: (body: {
    cardId: string;
    notes?: string;
  }) => Promise<Response>;
};

export function RegisterRfidDialog({
  open,
  onClose,
  onSuccess,
  registerFn,
}: Props) {
  const [cardId, setCardId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateCardId(cardId);
    setFieldError(err);
    if (err) return;

    setPending(true);
    setError("");
    try {
      const res = await registerFn({
        cardId: cardId.trim(),
        notes: notes.trim() || undefined,
      });
      const data = await res.json();
      if (res.ok) {
        setCardId("");
        setNotes("");
        setFieldError(undefined);
        onSuccess();
        onClose();
      } else {
        setError(data.message || "Không đăng ký được thẻ.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !pending && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <CreditCard size={24} />
          <h3>Đăng ký thẻ RFID mới</h3>
          <button
            className="ghost-button"
            disabled={pending}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <form className="stack-form" noValidate onSubmit={handleSubmit}>
          {error && <p className="muted-text error">{error}</p>}
          <label>
            Mã thẻ RFID
            <input
              autoFocus
              maxLength={50}
              onChange={(e) => {
                setCardId(e.target.value);
                if (fieldError) setFieldError(undefined);
              }}
              placeholder="VD: RFID-009"
              required
              type="text"
              value={cardId}
            />
            {fieldError && (
              <span className="field-error">
                <AlertCircle size={13} />
                {fieldError}
              </span>
            )}
          </label>
          <label>
            Ghi chú
            <input
              maxLength={255}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tùy chọn..."
              type="text"
              value={notes}
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
            <button className="full-button" disabled={pending} type="submit">
              {pending ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <CreditCard size={18} />
              )}
              {pending ? "Đang lưu…" : "Đăng ký"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
