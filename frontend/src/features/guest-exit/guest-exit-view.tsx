"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  DoorOpen,
  Loader2,
  MapPin,
  QrCode,
  Search,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { apiBaseUrl } from "@/lib/constants";
import { logger } from "@/lib/logger";

// ─── Types ─────────────────────────────────────────────────────────
type ExitStep =
  | "scan"
  | "session"
  | "payos_waiting"
  | "success"
  | "error"
  | "gate_opened";

type SessionInfo = {
  id: string;
  plate: string;
  ownerName?: string;
  slot?: string;
  zone?: string;
  checkInAt: string;
  parkingMinutes?: number;
  duration?: string;
  currentFee: number;
  paymentStatus: string;
  paidAmount?: number;
  isPrepaid?: boolean;
  isCompleted?: boolean;
  entryGate?: string;
};

type PayOSData = {
  qrCode: string;
  checkoutUrl?: string;
  paymentCode?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────
function formatDuration(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

function formatVND(value: number) {
  return value.toLocaleString("vi-VN") + "đ";
}

// ─── Main Component ───────────────────────────────────────────────
export function GuestExitView() {
  const [step, setStep] = useState<ExitStep>("scan");
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [payosData, setPayosData] = useState<PayOSData | null>(null);
  const [gateStatus, setGateStatus] = useState<
    "idle" | "opening" | "opened" | "failed"
  >("idle");

  const [now, setNow] = useState(() => Date.now());

  // QR Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Update timer for live duration
  useEffect(() => {
    if (step === "session") {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }
  }, [step]);

  // Handle PayOS return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payosStatus = params.get("payos_status");
    if (payosStatus === "success") {
      handlePaymentSuccess();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payosStatus === "cancelled") {
      setStep("session");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Poll payment status
  useEffect(() => {
    if (step !== "payos_waiting" || !sessionInfo) return;
    const poll = setInterval(async () => {
      try {
        const r = await fetch(
          `${apiBaseUrl}/public/session/${sessionInfo.id}/payment-status`,
        );
        const d = await r.json();
        if (
          d.paymentStatus === "fully_paid" ||
          d.paymentStatus === "partial_paid" ||
          d.isCompleted
        ) {
          clearInterval(poll);
          await handlePaymentSuccess();
        }
      } catch {
        /* silent */
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [step, sessionInfo]);

  // QR Scanner
  useEffect(() => {
    if (showScanner) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => stopScanner();
  }, [showScanner]);

  async function startScanner() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanQRCode();
      }
    } catch (err) {
      logger.error("Camera error:", { err });
      setError("Không thể truy cập camera. Vui lòng nhập biển số thủ công.");
      setShowScanner(false);
    }
  }

  function stopScanner() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function scanQRCode() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const scan = () => {
      if (!showScanner || !video.videoWidth) {
        requestAnimationFrame(scan);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0);

      // Simple QR detection - in production, use jsQR or html5-qrcode library
      // For now, we'll rely on manual input
      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!plate.trim()) {
      setError("Vui lòng nhập biển số xe.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const r = await fetch(
        `${apiBaseUrl}/public/lookup?plate=${encodeURIComponent(plate.trim())}`,
      );
      const d = await r.json();
      if (d.found && d.session) {
        setSessionInfo(d.session);
        setStep(d.session.isCompleted ? "success" : "session");
      } else {
        setError(d.message || "Không tìm thấy phiên gửi xe.");
      }
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  async function handleProceedToPayment() {
    if (!sessionInfo) return;
    setLoading(true);
    setError("");
    try {
      // Calculate fee
      const feeRes = await fetch(`${apiBaseUrl}/public/calculate-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: sessionInfo.plate }),
      });
      const feeData = await feeRes.json();
      if (!feeRes.ok || !feeData.sessionId) {
        setError(feeData.message || "Không thể tính phí.");
        return;
      }

      // Create transaction
      const r = await fetch(
        `${apiBaseUrl}/transactions/session/${sessionInfo.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const d = await r.json();
      if (d.sessionPaymentStatus === "fully_paid") {
        await handlePaymentSuccess();
      } else if (d.payos?.qrCode) {
        setPayosData(d.payos);
        setStep("payos_waiting");
      } else {
        setError(d.message || "Không thể tạo mã thanh toán.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePaymentSuccess() {
    if (!sessionInfo) return;
    setStep("gate_opened");
    setGateStatus("opening");
    try {
      const r = await fetch(`${apiBaseUrl}/exit/open-gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionInfo.id }),
      });
      const d = await r.json();
      if (d.ok) {
        setGateStatus("opened");
        setStep("success");
      } else {
        setGateStatus("failed");
        setError(
          d.message || "Không mở được barie. Vui lòng liên hệ nhân viên.",
        );
      }
    } catch {
      setGateStatus("failed");
      setError("Lỗi kết nối khi mở barie.");
    }
  }

  function reset() {
    setStep("scan");
    setPlate("");
    setError("");
    setSessionInfo(null);
    setPayosData(null);
    setGateStatus("idle");
    setShowScanner(false);
  }

  const durationMs = sessionInfo
    ? now - new Date(sessionInfo.checkInAt).getTime()
    : 0;
  const amountToPay = sessionInfo
    ? Math.max(0, (sessionInfo.currentFee || 0) - (sessionInfo.paidAmount || 0))
    : 0;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] p-6 max-[640px]:p-3">
      <div className="w-full max-w-[540px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-9 shadow-xl max-[640px]:p-5">
        {/* ── Header ── */}
        <div className="mb-7 text-center [&>h1]:mb-2 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-[var(--fg)] [&>p]:text-sm [&>p]:text-[var(--fg-muted)]">
          <DoorOpen size={32} />
          <h1>Ra bãi xe</h1>
          <p>Quét mã QR hoặc nhập biển số để thanh toán và ra bãi</p>
        </div>

        {/* ── Step: Scan ── */}
        {step === "scan" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
            {/* QR Scanner */}
            {showScanner && (
              <div className="relative mb-6 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-black">
                <video ref={videoRef} className="w-full aspect-video object-cover" />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <button
                  className="absolute top-3 right-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  onClick={() => setShowScanner(false)}
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {/* Camera Button */}
            {!showScanner && (
              <button
                className="inline-flex cursor-pointer items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 text-[var(--fg-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                onClick={() => setShowScanner(true)}
              >
                <Camera size={24} />
                <span>Quét mã QR</span>
              </button>
            )}

            {/* Divider */}
            <div className="my-5 flex items-center gap-3 text-xs text-[var(--fg-muted)] before:h-px before:flex-1 before:bg-[var(--border)] after:h-px after:flex-1 after:bg-[var(--border)]">
              <span>hoặc</span>
            </div>

            {/* Manual Input */}
            <form className="flex flex-col gap-4" onSubmit={handleSearch}>
              <label htmlFor="plate">Biển số xe</label>
              <div className="flex gap-2.5 max-[640px]:flex-col [&>input]:flex-1 [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3.5 [&>input]:py-2.5 [&>input]:font-mono [&>input]:text-base [&>input]:font-bold [&>input]:tracking-wider [&>input]:uppercase [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)]">
                <input
                  id="plate"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  placeholder="VD: 51K-238.79"
                  autoComplete="off"
                />
                <button type="submit" disabled={loading}>
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                  Tìm kiếm
                </button>
              </div>
              {error && <p className="rounded-[var(--radius)] border border-[rgba(239,68,68,0.3)] bg-[var(--danger-soft)] p-3.5 text-sm text-[var(--danger)]">{error}</p>}
            </form>
          </div>
        )}

        {/* ── Step: Session Info ── */}
        {step === "session" && sessionInfo && (
          <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-5">
            {/* Vehicle Info */}
            <div className="mb-4 flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
              <Car size={20} />
              <span className="flex items-center justify-between border-b border-[var(--border)] pb-3 [&>strong]:font-mono [&>strong]:text-xl [&>strong]:font-black [&>strong]:tracking-wider [&>strong]:text-[var(--fg)]">{sessionInfo.plate}</span>
              {sessionInfo.ownerName && (
                <span className="flex items-center gap-1.5 text-xs text-[var(--primary)]">
                  {sessionInfo.ownerName}
                </span>
              )}
            </div>

            {/* Parking Details */}
            <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
              <div className="flex flex-col gap-0.5 [&>span]:text-xs [&>span]:text-[var(--fg-muted)] [&>strong]:text-sm [&>strong]:font-semibold [&>strong]:text-[var(--fg)]">
                <Clock size={16} />
                <span>Thời gian gửi</span>
                <strong>{formatDuration(durationMs)}</strong>
              </div>
              {sessionInfo.slot && (
                <div className="flex flex-col gap-0.5 [&>span]:text-xs [&>span]:text-[var(--fg-muted)] [&>strong]:text-sm [&>strong]:font-semibold [&>strong]:text-[var(--fg)]">
                  <MapPin size={16} />
                  <span>Vị trí</span>
                  <strong>{sessionInfo.slot}</strong>
                </div>
              )}
              <div className="flex flex-col gap-0.5 [&>span]:text-xs [&>span]:text-[var(--fg-muted)] [&>strong]:text-sm [&>strong]:font-semibold [&>strong]:text-[var(--fg)]">
                <Clock size={16} />
                <span>Vào lúc</span>
                <strong>
                  {new Date(sessionInfo.checkInAt).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </div>
            </div>

            {/* Fee */}
            <div className="flex items-center justify-between rounded-[var(--radius)] border border-[rgba(59,130,246,0.2)] bg-[var(--primary-soft)] p-3.5">
              <div className="text-sm font-medium text-[var(--primary-hover)]">Phí gửi xe</div>
              <div className="text-xl font-extrabold text-[var(--primary-hover)]">
                {formatVND(amountToPay)}
              </div>
              {sessionInfo.isPrepaid && (
                <div className="rounded-[var(--radius)] border border-[rgba(16,185,129,0.3)] bg-[var(--success-soft)] p-3 text-xs text-[var(--success)]">Đã thanh toán trước</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 max-[640px]:flex-col">
              <button className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-5 py-3 text-sm font-semibold text-[var(--fg)] transition-all hover:bg-[var(--bg-hover)] disabled:opacity-50" onClick={reset}>
                Quay lại
              </button>
              {!sessionInfo.isPrepaid && amountToPay > 0 && (
                <button
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border-none bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--primary-hover)] disabled:opacity-50"
                  onClick={handleProceedToPayment}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <CreditCard size={18} />
                  )}
                  Thanh toán
                </button>
              )}
              {sessionInfo.isPrepaid && (
                <button
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border-none bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--primary-hover)] disabled:opacity-50"
                  onClick={handlePaymentSuccess}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <DoorOpen size={18} />
                  )}
                  Mở barie
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step: PayOS Waiting ── */}
        {step === "payos_waiting" && payosData && (
          <div className="my-5 flex flex-col items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-5">
            <QrCode size={24} />
            <h3>Quét mã QR để thanh toán</h3>
            <p>Sử dụng app ngân hàng hoặc ví điện tử để quét mã</p>

            <div className="rounded-lg bg-white p-3 shadow-sm">
              <QRCodeSVG value={payosData.qrCode} size={200} />
            </div>

            {payosData.checkoutUrl && (
              <a
                href={payosData.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--primary)] hover:underline"
              >
                Mở trang thanh toán
              </a>
            )}

            <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
              <Loader2 size={16} className="animate-spin" />
              <span>Đang chờ thanh toán...</span>
            </div>

            <button
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-5 py-3 text-sm font-semibold text-[var(--fg)] transition-all hover:bg-[var(--bg-hover)] disabled:opacity-50"
              onClick={() => {
                setPayosData(null);
                setStep("session");
              }}
            >
              Hủy
            </button>
          </div>
        )}

        {/* ── Step: Gate Opening ── */}
        {step === "gate_opened" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center text-[var(--success)]">
            <Loader2 size={48} className="animate-spin" />
            <h3>Đang mở barie...</h3>
            <p>Vui lòng chờ trong giây lát</p>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center text-[var(--success)]">
            <CheckCircle2 size={64} />
            <h3>Thanh toán thành công!</h3>
            <p>Barie đã mở. Bạn có thể ra bãi xe.</p>

            {sessionInfo && (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-4 text-sm">
                <div className="flex justify-between py-1.5 border-b border-[var(--border)] last:border-none">
                  <span>Biển số</span>
                  <strong>{sessionInfo.plate}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--border)] last:border-none">
                  <span>Phí thanh toán</span>
                  <strong>{formatVND(amountToPay)}</strong>
                </div>
              </div>
            )}

            <button className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border-none bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--primary-hover)] disabled:opacity-50" onClick={reset}>
              Hoàn tất
            </button>
          </div>
        )}

        {/* ── Error State ── */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-[var(--danger)]">
            <X size={48} />
            <h3>{error || "Đã xảy ra lỗi"}</h3>
            <button className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border-none bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--primary-hover)] disabled:opacity-50" onClick={reset}>
              Thử lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
