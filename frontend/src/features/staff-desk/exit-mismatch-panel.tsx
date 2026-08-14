"use client";

import { useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";

import { resolveBridgeImageUrl } from "@/features/staff-desk/use-camera-events";

export type ExitMismatch = {
  exception: true;
  exceptionType: string;
  reason: string;
  sessionId: string;
  currentPlate: string;
  cardBoundPlate: string;
  entryPlate: string;
  exitPlate: string;
  scannedUid: string;
  expectedUid: string;
  entryImageUrl: string;
  exitImageUrl: string;
  allowedActions: string[];
};

function can(mismatch: ExitMismatch, action: string) {
  return mismatch.allowedActions.includes(action);
}

function PlateImage({ src, label, plate, warn }: { src?: string; label: string; plate: string; warn?: boolean }) {
  const url = resolveBridgeImageUrl(src || "");
  return (
    <div className={`staff-desk__mismatch-shot ${warn ? "is-warn" : ""}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} />
      ) : (
        <div className="staff-desk__mismatch-shot-empty">Không có ảnh</div>
      )}
      <p>
        {label}
        <strong>{plate || "—"}</strong>
      </p>
    </div>
  );
}

export function ExitMismatchPanel({
  mismatch,
  pending,
  error,
  onRetry,
  onReject,
  onResolve,
}: {
  mismatch: ExitMismatch;
  pending: boolean;
  error: string;
  onRetry: () => void;
  onReject: () => void;
  onResolve: (action: string, manualPlate: string, note: string) => void;
}) {
  const wrongCard = mismatch.exceptionType === "wrong_card" || mismatch.exceptionType === "two_vehicles";
  const correctSession = can(mismatch, "correct_session_plate");
  const defaultPlate = correctSession ? mismatch.exitPlate : mismatch.entryPlate || mismatch.exitPlate;
  const [manualPlate, setManualPlate] = useState(defaultPlate);
  const [note, setNote] = useState("");
  const noteOk = note.trim().length >= 8;

  return (
    <div className="staff-desk__mismatch">
      <div className="staff-desk__alert staff-desk__alert--danger">
        <ShieldAlert size={18} />
        <span>
          <strong>{wrongCard ? "THẺ KHÔNG KHỚP XE HIỆN TẠI" : "SAI LỆCH ĐỊNH DANH"}</strong>
          <br />
          Barrier đang đóng. {mismatch.reason}
        </span>
      </div>

      <div className="staff-desk__mismatch-photos">
        <PlateImage src={mismatch.entryImageUrl} label="Lúc vào" plate={mismatch.entryPlate} />
        <PlateImage
          src={mismatch.exitImageUrl}
          label="Xe hiện tại"
          plate={mismatch.exitPlate}
          warn={mismatch.entryPlate !== mismatch.exitPlate}
        />
      </div>

      <dl className="staff-desk__mismatch-meta">
        <div>
          <dt>Xe đang ra</dt>
          <dd>{mismatch.currentPlate || mismatch.exitPlate || "—"}</dd>
        </div>
        {mismatch.cardBoundPlate ? (
          <div>
            <dt>Thẻ đang dùng cho</dt>
            <dd className="is-warn">{mismatch.cardBoundPlate}</dd>
          </div>
        ) : null}
        <div>
          <dt>UID lúc vào</dt>
          <dd>{mismatch.expectedUid || "—"}</dd>
        </div>
        <div>
          <dt>UID vừa quẹt</dt>
          <dd className={mismatch.expectedUid && mismatch.scannedUid !== mismatch.expectedUid ? "is-warn" : ""}>
            {mismatch.scannedUid || "—"}
          </dd>
        </div>
      </dl>

      {!wrongCard && (can(mismatch, "correct_exit_plate") || can(mismatch, "correct_session_plate")) ? (
        <label className="staff-desk__mismatch-field">
          {correctSession ? "Hiệu chỉnh biển phiên" : "Hiệu chỉnh biển RA"}
          <input
            value={manualPlate}
            onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
            placeholder="VD: 51A-123.45"
          />
        </label>
      ) : null}

      {!wrongCard ? (
        <label className="staff-desk__mismatch-field">
          Lý do xử lý *
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bắt buộc khi xác nhận hoặc hiệu chỉnh"
          />
        </label>
      ) : (
        <p className="staff-desk__hint">Yêu cầu khách đưa đúng thẻ lúc vào. Không xác nhận thẻ xe khác.</p>
      )}

      {error ? <p className="staff-desk__hint staff-desk__hint--warn">{error}</p> : null}

      <div className="staff-desk__mismatch-actions">
        <button className="btn btn-ghost" disabled={pending} onClick={onReject} type="button">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
          Từ chối
        </button>
        <button className="btn btn-primary" disabled={pending} onClick={onRetry} type="button">
          Quẹt lại
        </button>
        {can(mismatch, "confirm") ? (
          <button
            className="btn btn-primary"
            disabled={pending || !noteOk}
            onClick={() => onResolve("confirm", manualPlate, note)}
            type="button"
          >
            <ShieldCheck size={14} /> Xác nhận đúng
          </button>
        ) : null}
        {can(mismatch, "correct_exit_plate") ? (
          <button
            className="btn btn-primary"
            disabled={pending || !noteOk || manualPlate.trim().length < 5}
            onClick={() => onResolve("correct_exit_plate", manualPlate, note)}
            type="button"
          >
            Hiệu chỉnh biển ra
          </button>
        ) : null}
        {can(mismatch, "correct_session_plate") ? (
          <button
            className="btn btn-primary"
            disabled={pending || !noteOk || manualPlate.trim().length < 5}
            onClick={() => onResolve("correct_session_plate", manualPlate, note)}
            type="button"
          >
            Sửa biển phiên
          </button>
        ) : null}
        {can(mismatch, "accept_uid") ? (
          <button
            className="btn btn-primary"
            disabled={pending || !noteOk}
            onClick={() => onResolve("accept_uid", manualPlate, note)}
            type="button"
          >
            Chấp nhận UID này
          </button>
        ) : null}
      </div>
    </div>
  );
}
