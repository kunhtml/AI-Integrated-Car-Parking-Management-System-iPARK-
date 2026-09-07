"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Hộp thoại xác nhận dùng chung, thay thế window.confirm (chặn luồng, không
 * tùy biến được) bằng dialog cùng hệ thống CSS với các modal khác của app
 * (modal-overlay / modal-card — giống pattern payment-modal, devices-view).
 * Không thêm CSS mới.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Tự focus nút "Hủy" mỗi khi dialog mở — hành vi an toàn giống window.confirm.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="modal-overlay"
      onClick={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      role="dialog"
    >
      <div className="modal-card narrow" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <TriangleAlert
              color={tone === "danger" ? "#ef4444" : "var(--primary)"}
              size={20}
            />
            <h2 id={titleId}>{title}</h2>
          </div>
        </div>
        <p className="muted-text">{message}</p>
        <div className="users-form-actions">
          <button
            className="users-cancel-btn"
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={
              tone === "danger"
                ? "users-submit-btn small-button danger"
                : "users-submit-btn"
            }
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
