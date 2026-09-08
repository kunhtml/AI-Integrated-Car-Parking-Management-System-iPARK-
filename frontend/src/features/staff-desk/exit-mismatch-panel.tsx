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
    <div
      className={`overflow-hidden rounded-lg border bg-[#f8fafc] ${
        warn ? "border-[#f0b4b4]" : "border-[#e5e7eb]"
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="block h-[92px] w-full object-cover" />
      ) : (
        <div className="grid h-[92px] place-items-center text-xs text-[#64748b]">
        Không có ảnh
      </div>
      )}
      <p className="m-0 px-2 py-1.5 text-[11px] text-[#64748b]">
        {label}
        <strong className="block text-[13px] text-[#0f172a]">{plate || "—"}</strong>
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
    <div className="grid gap-2.5">
      <div className="flex items-start gap-2 rounded-[7px] border border-[#f0b4b4] bg-[#fef2f2] px-3 py-2.5 text-xs leading-[1.45] text-[#9f1239]">
        <ShieldAlert size={18} />
        <span>
          <strong>{wrongCard ? "THẺ KHÔNG KHỚP XE HIỆN TẠI" : "SAI LỆCH ĐỊNH DANH"}</strong>
          <br />
          Barrier đang đóng. {mismatch.reason}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PlateImage src={mismatch.entryImageUrl} label="Lúc vào" plate={mismatch.entryPlate} />
        <PlateImage
          src={mismatch.exitImageUrl}
          label="Xe hiện tại"
          plate={mismatch.exitPlate}
          warn={mismatch.entryPlate !== mismatch.exitPlate}
        />
      </div>

      <dl className="m-0 grid grid-cols-2 gap-x-2.5 gap-y-1.5 text-[13px] font-semibold">
        <div>
          <dt className="text-[11px] font-medium text-[#64748b]">Xe đang ra</dt>
          <dd className="m-0">{mismatch.currentPlate || mismatch.exitPlate || "—"}</dd>
        </div>
        {mismatch.cardBoundPlate ? (
          <div>
            <dt className="text-[11px] font-medium text-[#64748b]">Thẻ đang dùng cho</dt>
            <dd className="m-0 text-[#be123c]">{mismatch.cardBoundPlate}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[11px] font-medium text-[#64748b]">UID lúc vào</dt>
          <dd className="m-0">{mismatch.expectedUid || "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-[#64748b]">UID vừa quẹt</dt>
          <dd className={
              mismatch.expectedUid && mismatch.scannedUid !== mismatch.expectedUid
                ? "m-0 text-[#be123c]"
                : "m-0"
            }>
            {mismatch.scannedUid || "—"}
          </dd>
        </div>
      </dl>

      {!wrongCard && (can(mismatch, "correct_exit_plate") || can(mismatch, "correct_session_plate")) ? (
        <label className="grid gap-1 text-xs text-[#334155]">
          {correctSession ? "Hiệu chỉnh biển phiên" : "Hiệu chỉnh biển RA"}
          <input
            className="min-h-10 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3 py-2 font-mono text-sm font-bold uppercase tracking-[0.04em] text-[#0f172a] focus:border-[#60a5fa] focus:outline-2 focus:outline-[#93c5fd]"
            value={manualPlate}
            onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
            placeholder="VD: 51A-123.45"
          />
        </label>
      ) : null}

      {!wrongCard ? (
        <label className="grid gap-1 text-xs text-[#334155]">
          Lý do xử lý *
          <textarea
            rows={2}
            className="w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] focus:border-[#60a5fa] focus:outline-2 focus:outline-[#93c5fd]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bắt buộc khi xác nhận hoặc hiệu chỉnh"
          />
        </label>
      ) : (
        <p className="text-xs leading-[1.45] text-[#667085]">Yêu cầu khách đưa đúng thẻ lúc vào. Không xác nhận thẻ xe khác.</p>
      )}

      {error ? <p className="text-xs leading-[1.45] font-semibold text-[#a16207]">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55" disabled={pending} onClick={onReject} type="button">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
          Từ chối
        </button>
        <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55" disabled={pending} onClick={onRetry} type="button">
          Quẹt lại
        </button>
        {can(mismatch, "confirm") ? (
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
            disabled={pending || !noteOk}
            onClick={() => onResolve("confirm", manualPlate, note)}
            type="button"
          >
            <ShieldCheck size={14} /> Xác nhận đúng
          </button>
        ) : null}
        {can(mismatch, "correct_exit_plate") ? (
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
            disabled={pending || !noteOk || manualPlate.trim().length < 5}
            onClick={() => onResolve("correct_exit_plate", manualPlate, note)}
            type="button"
          >
            Hiệu chỉnh biển ra
          </button>
        ) : null}
        {can(mismatch, "correct_session_plate") ? (
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
            disabled={pending || !noteOk || manualPlate.trim().length < 5}
            onClick={() => onResolve("correct_session_plate", manualPlate, note)}
            type="button"
          >
            Sửa biển phiên
          </button>
        ) : null}
        {can(mismatch, "accept_uid") ? (
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
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
