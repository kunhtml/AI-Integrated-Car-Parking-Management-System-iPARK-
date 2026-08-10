"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  Smartphone,
  User,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";

type SubPayos = {
  qrCode: string;
  checkoutUrl: string;
  orderCode: string;
  amount: number;
  accountNumber?: string;
  accountName?: string;
  bin?: string;
};

type Props = {
  payos: SubPayos;
  subscriptionId: string;
  renewMode: boolean;
  renewBaseEnd: number;
  plate: string;
  onClose: () => void;
  onPaid: () => void;
};

const BANK_NAMES: Record<string, string> = {
  "970436": "Vietcombank",
  "970415": "VietinBank",
  "970405": "Agribank",
  "970422": "MB Bank",
  "970423": "TPBank",
  "970407": "Techcombank",
  "970418": "BIDV",
  "970432": "VPBank",
  "970403": "Sacombank",
  "970454": "SHB",
  "970426": "ACB",
  "970441": "VIB",
  "970443": "SHINHAN VN",
  "970444": "KienlongBank",
  "970448": "OCB",
  "970449": "LPB",
  "970452": "KBank VN",
  "970457": "Woori VN",
  "970458": "HDBank",
  "970460": "PGBank",
  "970461": "ABBank",
  "970462": "DongA Bank",
  "970463": "BacABank",
  "970464": "MSB",
  "970465": "CBBank",
  "970466": "PVcomBank",
  "970467": "NamABank",
  "970468": "VietBank",
  "969500": "TPVision",
  "971100": "VTL",
};

function buildVietQrDeepLinks(payos: SubPayos): { primary: string; fallback: string } | null {
  if (!payos.bin || !payos.accountNumber || !payos.amount) return null;
  const params = new URLSearchParams({
    bin: payos.bin,
    account: payos.accountNumber,
    amount: String(Math.round(payos.amount)),
    memo: `iPARK ${payos.orderCode}`.slice(0, 100),
  });
  return {
    primary: `vietqr://pay?${params.toString()}`,
    fallback: `https://dl.vietqr.io/pay?${params.toString()}`,
  };
}

function buildCheckoutLink(payos: SubPayos): string {
  return payos.checkoutUrl || `https://pay.payos.vn/`;
}

export function PaymentModal({ payos, subscriptionId, renewMode, renewBaseEnd, plate, onClose, onPaid }: Props) {
  const [status, setStatus] = useState<"waiting" | "paid" | "expired">("waiting");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [pollTick, setPollTick] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const r = await apiFetch(`/subscriptions/${subscriptionId}/payment-status`);
        const d = await r.json();
        if (cancelled) return;
        const paidRenew = renewMode && d.endDate && new Date(d.endDate).getTime() > renewBaseEnd;
        const paidNew = !renewMode && d.status === "active";
        if (paidRenew || paidNew) {
          setStatus("paid");
          clearInterval(interval);
          onPaid();
        } else {
          setPollTick((n) => n + 1);
        }
      } catch {
        /* silent retry */
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [subscriptionId, renewMode, renewBaseEnd, onPaid]);

  async function checkNow() {
    setChecking(true);
    setError(null);
    try {
      const r = await apiFetch(`/subscriptions/${subscriptionId}/payment-status`);
      const d = await r.json();
      const paidRenew = renewMode && d.endDate && new Date(d.endDate).getTime() > renewBaseEnd;
      const paidNew = !renewMode && d.status === "active";
      if (paidRenew || paidNew) {
        setStatus("paid");
        onPaid();
      } else {
        setError("Chưa nhận được thanh toán. Vui lòng chờ 10–30 giây sau khi chuyển khoản hoặc kiểm tra lại nội dung.");
      }
    } catch {
      setError("Không kiểm tra được trạng thái thanh toán.");
    } finally {
      setTimeout(() => setChecking(false), 400);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      /* ignore */
    }
  }

  const hasAccount = Boolean(payos.accountNumber && payos.bin && payos.accountName);
  const bankLabel = payos.bin ? BANK_NAMES[payos.bin] ?? `Ngân hàng ${payos.bin}` : "Ngân hàng";
  const vietqrLinks = buildVietQrDeepLinks(payos);
  const checkoutLink = buildCheckoutLink(payos);

  function openAppBank() {
    if (!vietqrLinks) return;
    const start = Date.now();
    window.location.href = vietqrLinks.primary;
    setTimeout(() => {
      if (Date.now() - start < 1500) {
        window.open(vietqrLinks.fallback, "_blank", "noopener,noreferrer");
      }
    }, 700);
  }

  return (
    <div className="pay-modal-overlay" role="dialog" onClick={onClose}>
      <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header gradient */}
        <div className="pay-modal-header">
          <div className="pay-modal-header-text">
            <span className="pay-modal-tag">
              <QrCode size={12} /> PayOS · VietQR
            </span>
            <h2 className="pay-modal-title">
              {renewMode ? "Thanh toán gia hạn" : "Thanh toán mua gói"}
            </h2>
            <p className="pay-modal-sub">
              {status === "paid"
                ? "Thanh toán đã được xác nhận."
                : `Quét QR hoặc chuyển khoản tay cho xe ${plate}.`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="pay-modal-close"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        {status === "paid" ? (
          <div className="pay-modal-success">
            <div className="pay-modal-check">
              <Check size={32} strokeWidth={3} />
            </div>
            <h3>{renewMode ? "Gia hạn thành công!" : "Đăng ký thành công!"}</h3>
            <p>Cảm ơn bạn. Đang cập nhật trạng thái gói…</p>
          </div>
        ) : (
          <>
            {/* Amount banner */}
            <div className="pay-modal-amount">
              <span className="pay-modal-amount-label">Số tiền cần thanh toán</span>
              <strong className="pay-modal-amount-value">{currency.format(payos.amount)}</strong>
            </div>

            {/* QR Code */}
            <div className="pay-modal-qr-wrap">
              <div className="pay-modal-qr">
                <div className="pay-modal-qr-brand">
                  <QrCode size={14} /> iPARK · {bankLabel}
                </div>
                <QRCodeSVG value={payos.qrCode} size={180} level="M" marginSize={0} />
                <div className="pay-modal-qr-foot">
                  Mã đơn: <strong>{payos.orderCode}</strong>
                </div>
              </div>
            </div>

            {/* Manual transfer */}
            {hasAccount ? (
              <div className="pay-bank-card">
                <div className="pay-bank-card-head">
                  <span className="pay-bank-head-icon">
                    <Building2 size={13} />
                  </span>
                  <span>Chuyển khoản thủ công</span>
                </div>
                <div className="pay-bank-row">
                  <span className="pay-bank-label">
                    <span className="pay-bank-icon indigo">
                      <Building2 size={12} />
                    </span>
                    Ngân hàng
                  </span>
                  <span className="pay-bank-value">
                    <strong>{bankLabel}</strong>
                    {payos.bin && <small> · {payos.bin}</small>}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(payos.bin!, "bin")}
                    className="pay-copy-btn"
                    title="Sao chép mã BIN"
                  >
                    {copiedKey === "bin" ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (
                      <Copy size={11} />
                    )}
                    <span className="pay-copy-label">
                      {copiedKey === "bin" ? "Đã chép" : "Sao chép"}
                    </span>
                  </button>
                </div>
                <div className="pay-bank-row">
                  <span className="pay-bank-label">
                    <span className="pay-bank-icon cyan">
                      <User size={12} />
                    </span>
                    Chủ tài khoản
                  </span>
                  <span className="pay-bank-value">{payos.accountName}</span>
                  <button
                    type="button"
                    onClick={() => copy(payos.accountName!, "name")}
                    className="pay-copy-btn"
                    title="Sao chép tên"
                  >
                    {copiedKey === "name" ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (
                      <Copy size={11} />
                    )}
                    <span className="pay-copy-label">
                      {copiedKey === "name" ? "Đã chép" : "Sao chép"}
                    </span>
                  </button>
                </div>
                <div className="pay-bank-row memo">
                  <span className="pay-bank-label">
                    <span className="pay-bank-icon amber">
                      <Banknote size={12} />
                    </span>
                    Nội dung CK
                  </span>
                  <span className="pay-bank-value mono accent">iPARK {payos.orderCode}</span>
                  <button
                    type="button"
                    onClick={() => copy(`iPARK ${payos.orderCode}`, "memo")}
                    className="pay-copy-btn"
                    title="Sao chép nội dung"
                  >
                    {copiedKey === "memo" ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (
                      <Copy size={11} />
                    )}
                    <span className="pay-copy-label">
                      {copiedKey === "memo" ? "Đã chép" : "Sao chép"}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="pay-modal-warn">
                <strong>Không tải được thông tin tài khoản từ PayOS.</strong>
                <span>
                  Bấm "Mở trang PayOS" để thanh toán trực tiếp, hoặc liên hệ admin kiểm tra KYC
                  merchant.
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="pay-modal-actions">
              <button type="button" className="pay-cta" onClick={checkNow} disabled={checking}>
                <span className="pay-cta-icon">
                  {checking ? <Loader2 size={18} className="spin" /> : <Check size={18} strokeWidth={3} />}
                </span>
                <span className="pay-cta-text">{checking ? "Đang kiểm tra…" : "Tôi đã thanh toán"}</span>
                {pollTick > 0 && !checking && (
                  <span className="pay-cta-badge">
                    <Loader2 size={10} className="spin" /> đang chờ
                  </span>
                )}
              </button>
              <div className="pay-secondary-actions">
                {vietqrLinks && (
                  <button type="button" className="pay-secondary" onClick={openAppBank}>
                    <span className="pay-secondary-icon indigo">
                      <Smartphone size={15} />
                    </span>
                    <span>Mở app ngân hàng</span>
                  </button>
                )}
                <a
                  href={checkoutLink}
                  target="_blank"
                  rel="noreferrer"
                  className="pay-secondary"
                >
                  <span className="pay-secondary-icon cyan">
                    <ExternalLink size={15} />
                  </span>
                  <span>Mở trang PayOS</span>
                </a>
              </div>
            </div>

            {error && <div className="pay-modal-error">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}
