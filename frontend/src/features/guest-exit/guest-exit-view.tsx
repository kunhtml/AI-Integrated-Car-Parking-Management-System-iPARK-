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
          `${apiBaseUrl}/public/session/${sessionInfo.id}/payment-status`
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
      console.error("Camera error:", err);
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
        `${apiBaseUrl}/public/lookup?plate=${encodeURIComponent(plate.trim())}`
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
        }
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
        setError(d.message || "Không mở được barie. Vui lòng liên hệ nhân viên.");
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
    <div className="guest-exit-container">
      <div className="guest-exit-card">
        {/* ── Header ── */}
        <div className="guest-exit-header">
          <DoorOpen size={32} />
          <h1>Ra bãi xe</h1>
          <p>Quét mã QR hoặc nhập biển số để thanh toán và ra bãi</p>
        </div>

        {/* ── Step: Scan ── */}
        {step === "scan" && (
          <div className="guest-exit-scan">
            {/* QR Scanner */}
            {showScanner && (
              <div className="guest-exit-scanner">
                <video ref={videoRef} className="guest-exit-video" />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <button
                  className="guest-exit-close-scanner"
                  onClick={() => setShowScanner(false)}
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {/* Camera Button */}
            {!showScanner && (
              <button
                className="guest-exit-camera-btn"
                onClick={() => setShowScanner(true)}
              >
                <Camera size={24} />
                <span>Quét mã QR</span>
              </button>
            )}

            {/* Divider */}
            <div className="guest-exit-divider">
              <span>hoặc</span>
            </div>

            {/* Manual Input */}
            <form className="guest-exit-form" onSubmit={handleSearch}>
              <label htmlFor="plate">Biển số xe</label>
              <div className="guest-exit-input-row">
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
              {error && <p className="guest-exit-error">{error}</p>}
            </form>
          </div>
        )}

        {/* ── Step: Session Info ── */}
        {step === "session" && sessionInfo && (
          <div className="guest-exit-session">
            {/* Vehicle Info */}
            <div className="guest-exit-vehicle-info">
              <Car size={20} />
              <span className="guest-exit-plate">{sessionInfo.plate}</span>
              {sessionInfo.ownerName && (
                <span className="guest-exit-owner">{sessionInfo.ownerName}</span>
              )}
            </div>

            {/* Parking Details */}
            <div className="guest-exit-details">
              <div className="guest-exit-detail-item">
                <Clock size={16} />
                <span>Thời gian gửi</span>
                <strong>{formatDuration(durationMs)}</strong>
              </div>
              {sessionInfo.slot && (
                <div className="guest-exit-detail-item">
                  <MapPin size={16} />
                  <span>Vị trí</span>
                  <strong>{sessionInfo.slot}</strong>
                </div>
              )}
              <div className="guest-exit-detail-item">
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
            <div className="guest-exit-fee">
              <div className="guest-exit-fee-label">Phí gửi xe</div>
              <div className="guest-exit-fee-amount">{formatVND(amountToPay)}</div>
              {sessionInfo.isPrepaid && (
                <div className="guest-exit-prepaid">
                  Đã thanh toán trước
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="guest-exit-actions">
              <button
                className="guest-exit-btn-secondary"
                onClick={reset}
              >
                Quay lại
              </button>
              {!sessionInfo.isPrepaid && amountToPay > 0 && (
                <button
                  className="guest-exit-btn-primary"
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
                  className="guest-exit-btn-primary"
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
          <div className="guest-exit-payos">
            <QrCode size={24} />
            <h3>Quét mã QR để thanh toán</h3>
            <p>Sử dụng app ngân hàng hoặc ví điện tử để quét mã</p>

            <div className="guest-exit-qr">
              <QRCodeSVG value={payosData.qrCode} size={200} />
            </div>

            {payosData.checkoutUrl && (
              <a
                href={payosData.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="guest-exit-checkout-link"
              >
                Mở trang thanh toán
              </a>
            )}

            <div className="guest-exit-waiting">
              <Loader2 size={16} className="animate-spin" />
              <span>Đang chờ thanh toán...</span>
            </div>

            <button
              className="guest-exit-btn-secondary"
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
          <div className="guest-exit-gate">
            <Loader2 size={48} className="animate-spin" />
            <h3>Đang mở barie...</h3>
            <p>Vui lòng chờ trong giây lát</p>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === "success" && (
          <div className="guest-exit-success">
            <CheckCircle2 size={64} />
            <h3>Thanh toán thành công!</h3>
            <p>Barie đã mở. Bạn có thể ra bãi xe.</p>

            {sessionInfo && (
              <div className="guest-exit-receipt">
                <div className="guest-exit-receipt-item">
                  <span>Biển số</span>
                  <strong>{sessionInfo.plate}</strong>
                </div>
                <div className="guest-exit-receipt-item">
                  <span>Phí thanh toán</span>
                  <strong>{formatVND(amountToPay)}</strong>
                </div>
              </div>
            )}

            <button className="guest-exit-btn-primary" onClick={reset}>
              Hoàn tất
            </button>
          </div>
        )}

        {/* ── Error State ── */}
        {step === "error" && (
          <div className="guest-exit-error-state">
            <X size={48} />
            <h3>{error || "Đã xảy ra lỗi"}</h3>
            <button className="guest-exit-btn-primary" onClick={reset}>
              Thử lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
