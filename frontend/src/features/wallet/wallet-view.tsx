"use client";

import { Package, QrCode, Settings, Wallet } from "lucide-react";
import { useState, useEffect, type FormEvent } from "react";
import { CreditCard, ExternalLink, Loader2, PlusCircle, QrCode, RefreshCw } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";
import { TransactionHistoryView } from "@/features/wallet/transaction-history-view";
import { QRCodeSVG } from "qrcode.react";

function StatusBadge({
  status,
  received,
  total,
}: {
  status: string;
  received?: number;
  total?: number;
}) {
  if (status === "fully_paid" || status === "paid")
    return <span className="badge success">Đã thanh toán</span>;
  if (status === "partial_paid")
    return (
      <span className="badge warning">
        Một phần
        {received !== undefined && total !== undefined && total > 0
          ? <>: {received.toLocaleString("vi-VN")}đ / {total.toLocaleString("vi-VN")}đ</>
          : ""}
      </span>
    );
  if (status === "unpaid")
    return <span className="badge danger">Chưa thanh toán</span>;
  if (status === "pending")
    return <span className="badge warning">Chờ thanh toán</span>;
  if (status === "failed")
    return <span className="badge danger">Thất bại</span>;
  if (status === "cancelled")
    return <span className="badge danger">Đã hủy</span>;
  return <span className="badge">{status}</span>;
}

export function WalletView() {
  const {
    currentUser,
    paymentConfigState,
    pricingConfigState,
    membershipActive,
    membershipExpiresAt,
    updatePaymentConfig,
    purchaseParkingPackage,
    activateMembership,
    sessions,
    setSessions,
    transactionList,
    confirmTransaction,
  } = useParkingApp();

  const [topUpMsg, setTopUpMsg] = useState("");
  const [payosData, setPayosData] = useState<{ qrCode: string; checkoutUrl: string; orderCode: string } | null>(null);
  const [checkingSessionId, setCheckingSessionId] = useState<string | null>(null);
  const [sessionCheckResult, setSessionCheckResult] = useState<{ id: string; status: string } | null>(null);

  // QR modal cho một giao dịch bất kỳ trong bảng lịch sử
  const [qrModal, setQrModal] = useState<{ sessionId: string; plate: string; amount: number } | null>(null);
  const [qrModalData, setQrModalData] = useState<{ qrCode: string; checkoutUrl: string; orderCode: string; amount?: number } | null>(null);
  const [qrModalLoading, setQrModalLoading] = useState(false);
  const [qrModalResult, setQrModalResult] = useState<string | null>(null);

  async function openQrModal(item: { sessionId?: string; plate?: string; amount: number }) {
    if (!item.sessionId) return;
    setQrModal({ sessionId: item.sessionId, plate: item.plate || "—", amount: item.amount });
    setQrModalData(null);
    setQrModalResult(null);
    setQrModalLoading(true);
    try {
      const r = await apiFetch(`/transactions/session/${item.sessionId}`, { method: "POST" });
      const d = await r.json();
      if (d.payos?.qrCode) {
        setQrModalData(d.payos);
      } else if (d.sessionPaymentStatus === "fully_paid") {
        setQrModalResult("fully_paid");
      } else {
        setQrModalResult("error");
      }
    } catch {
      setQrModalResult("error");
    } finally {
      setQrModalLoading(false);
    }
  }

  async function checkQrModalPayment() {
    if (!qrModal) return;
    setQrModalLoading(true);
    try {
      const r = await apiFetch(`/public/session/${qrModal.sessionId}/payment-status`);
      const d = await r.json();
      setQrModalResult(d.paymentStatus);
      // Chỉ tắt QR khi đã trả ĐỦ. Trả một phần vẫn còn nợ → giữ QR để trả tiếp.
      if (d.paymentStatus === "fully_paid") {
        setQrModalData(null);
      }
    } catch {
      setQrModalResult("error");
    } finally {
      setQrModalLoading(false);
    }
  }

  function closeQrModal() {
    setQrModal(null);
    setQrModalData(null);
    setQrModalResult(null);
  }

  // Auto-poll khi modal QR đang mở
  useEffect(() => {
    if (!qrModal || !qrModalData) return;
    const interval = setInterval(async () => {
      try {
        const r = await apiFetch(`/public/session/${qrModal.sessionId}/payment-status`);
        const d = await r.json();
        if (d.paymentStatus === "fully_paid") {
          setQrModalResult(d.paymentStatus);
          setQrModalData(null);
          clearInterval(interval);
        }
      } catch { /* silent */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [qrModal, qrModalData]);

  // Lấy phiên chưa thanh toán của user hiện tại — kể cả phiên đã checkout
  // (status "Đã hoàn thành") nhưng vẫn còn nợ phí.
  const unpaidSession = sessions.find(
    (s) =>
      s.status !== "Đã hủy" &&
      s.ownerEmail?.toLowerCase() === currentUser?.email?.toLowerCase() &&
      s.paymentStatus !== "fully_paid" &&
      (s.fee || 0) - (s.paidAmount || 0) > 0,
  );

  async function handleCheckPaymentStatus() {
    if (!unpaidSession) return;
    setCheckingSessionId(unpaidSession.id);
    setSessionCheckResult(null);
    try {
      const r = await apiFetch(`/public/session/${unpaidSession.id}/payment-status`);
      const d = await r.json();
      setSessionCheckResult({ id: unpaidSession.id, status: d.paymentStatus });
    } catch {
      setSessionCheckResult({ id: unpaidSession.id, status: "error" });
    } finally {
      setCheckingSessionId(null);
    }
  }

  async function handleCreatePayment() {
    if (!unpaidSession) return;
    try {
      const r = await apiFetch(`/transactions/session/${unpaidSession.id}`, { method: "POST" });
      const d = await r.json();
      if (d.payos?.qrCode) {
        setPayosData(d.payos);
      }
    } catch { /* silent */ }
  }

  // Auto-poll payment status when QR is shown
  useEffect(() => {
    if (!payosData || !unpaidSession) return;
    const interval = setInterval(async () => {
      try {
        const r = await apiFetch(`/public/session/${unpaidSession.id}/payment-status`);
        const d = await r.json();
        if (d.paymentStatus === "fully_paid") {
          setPayosData(null);
          setSessionCheckResult({ id: unpaidSession.id, status: d.paymentStatus });
          clearInterval(interval);
        }
      } catch { /* silent */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [payosData, unpaidSession?.id]);

  // Auto-reload sessions every 30s to keep unpaid/partial_paid status fresh
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(async () => {
      try {
        const r = await apiFetch("/parking-sessions");
        if (r.ok) {
          const d = await r.json();
          if (d.sessions && setSessions) {
            setSessions(d.sessions);
          }
        }
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUser, setSessions]);

  if (!currentUser) return null;

  async function handleTopUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0);
    if (amount < 10000) {
      setTopUpMsg("Số tiền tối thiểu là 10,000 VND.");
      return;
    }
    const response = await apiFetch("/transactions/top-up", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
    const data = await response.json();
    setTopUpMsg(data.message || (response.ok ? "Đã tạo yêu cầu nạp tiền." : "Lỗi."));
    if (response.ok) event.currentTarget.reset();
  }

  async function handleConfirmTopUp(id: string) {
    const response = await apiFetch(`/transactions/${id}/confirm-topup`, {
      method: "POST",
    });
    const data = await response.json();
    setTopUpMsg(data.message || (response.ok ? "Đã xác nhận nạp tiền." : "Không xác nhận được."));
  }

  const rows = transactionList.map((item) => {
    const isTopUp = item.content?.startsWith("TOPUP") ?? false;
    const hasPayOSLink = !!item.payosCheckoutUrl;
    // Giao dịch phiên gửi xe chưa thanh toán xong → cho phép quét QR
    const owedAmount = (item.sessionFee ?? 0) - (item.sessionPaidAmount ?? 0);
    const canPayQr =
      !isTopUp &&
      !!item.sessionId &&
      item.sessionPaymentStatus !== "fully_paid" &&
      owedAmount > 0;

    return [
      // Thời gian
      <span key={`${item.id}-t`} className="muted-cell" style={{ fontSize: "0.8rem" }}>
        {new Date(item.createdAt).toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>,

      // Biển số
      <span key={`${item.id}-p`} style={{ fontWeight: 600 }}>
        {item.plate || (isTopUp ? "—" : "—")}
      </span>,

      // Chủ xe
      item.ownerName || "—",

      // Email
      <span key={`${item.id}-e`} className="muted-cell" style={{ fontSize: "0.8rem" }}>
        {item.ownerEmail || "—"}
      </span>,

      // Slot
      <span key={`${item.id}-s`} className="muted-cell" style={{ fontSize: "0.8rem" }}>
        {item.slot || "—"}
      </span>,

      // Số tiền
      currency.format(item.amount),

      // Phương thức
      <span key={`${item.id}-m`} className="muted-cell" style={{ fontSize: "0.8rem" }}>
        {item.method === "payos" ? "PayOS" : item.method === "wallet" ? "Ví" : item.method === "cash" ? "Tiền mặt" : item.method}
      </span>,

      // Trạng thái giao dịch
      <StatusBadge
        key={`${item.id}-st`}
        status={item.sessionPaymentStatus || item.status}
        received={item.sessionPaidAmount}
        total={item.sessionFee}
      />,

      // Thao tác
      (() => {
        const qrButton = canPayQr ? (
          <button
            className="small-button"
            onClick={() => openQrModal({ sessionId: item.sessionId, plate: item.plate, amount: owedAmount })}
            type="button"
          >
            <QrCode size={14} /> QR thanh toán
          </button>
        ) : null;

        if (item.status === "pending" && currentUser.role === "admin") {
          return (
            <div className="inline-actions" key={item.id}>
              {qrButton}
              {hasPayOSLink && (
                <a
                  className="small-button"
                  href={item.payosCheckoutUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Mở link
                </a>
              )}
              {!isTopUp && (
                <button
                  className="small-button"
                  onClick={() => confirmTransaction(item.id)}
                  type="button"
                >
                  Xác nhận
                </button>
              )}
              {isTopUp && (
                <button
                  className="small-button"
                  onClick={() => handleConfirmTopUp(item.id)}
                  type="button"
                >
                  Nạp ví
                </button>
              )}
            </div>
          );
        }
        if (qrButton) {
          return <div className="inline-actions" key={item.id}>{qrButton}</div>;
        }
        if (item.status === "paid") {
          return <span key={`${item.id}-ok`} style={{ color: "var(--color-success)" }}>✓</span>;
        }
        return "—";
      })(),
    ];
  });

  return (
    <section className="content-grid">
      {/* Top-up form for customer */}
      {currentUser.role === "customer" && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Nạp tiền</p>
              <h2>Nạp tiền vào ví</h2>
            </div>
            <PlusCircle size={22} />
          </div>
          <div className="profile-lines" style={{ marginBottom: 12 }}>
            <span>
              Số dư hiện tại: <strong>{currency.format(currentUser.wallet || 0)}</strong>
            </span>
          </div>
          <form className="stack-form" onSubmit={handleTopUp}>
            <label>
              Số tiền nạp (VND)
              <input min={10000} name="amount" placeholder="50000" required step={1000} type="number" />
            </label>
            <button className="full-button" type="submit">
              <PlusCircle size={18} />
              Tạo yêu cầu nạp tiền
            </button>
            {topUpMsg && <p className="muted-cell">{topUpMsg}</p>}
          </form>
          <p className="muted-cell" style={{ marginTop: 8, fontSize: "0.8rem" }}>
            Sau khi tạo yêu cầu, admin sẽ xác nhận khi nhận được tiền chuyển khoản.
          </p>
        </div>
      )}

      {/* Session chưa thanh toán */}
      {currentUser.role === "customer" && unpaidSession && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Thanh toán</p>
              <h2>Phiên chưa thanh toán</h2>
            </div>
            <QrCode size={22} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>{unpaidSession.plate}</span>
              <span className="badge warning">
                {unpaidSession.paymentStatus === "partial_paid" ? "Thanh toán một phần" : "Chưa thanh toán"}
              </span>
              {unpaidSession.status === "Đã hoàn thành" && (
                <span className="badge danger">Đã ra bãi · còn nợ phí</span>
              )}
              <span className="muted-cell" style={{ fontSize: "0.85rem" }}>
                {unpaidSession.slot} · {unpaidSession.checkInDate} {unpaidSession.checkIn}
              </span>
            </div>
            {unpaidSession.paymentStatus === "partial_paid" && unpaidSession.paidAmount !== undefined ? (
              <p style={{ color: "var(--warning, #fbbf24)", fontWeight: 700, fontSize: "1.1rem" }}>
                Còn thiếu: {currency.format(Math.max(0, (unpaidSession.fee || 0) - unpaidSession.paidAmount))}
              </p>
            ) : unpaidSession.fee > 0 ? (
              <p style={{ color: "var(--primary)", fontWeight: 700, fontSize: "1.2rem" }}>
                {currency.format(unpaidSession.fee)}
              </p>
            ) : null}
          </div>

      <TransactionHistoryView />
          {/* QR Payment */}
          {payosData ? (
            <div style={{ background: "var(--bg-secondary)", borderRadius: "12px", padding: "20px", textAlign: "center", marginBottom: "16px" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "12px" }}>Quét mã QR để thanh toán</p>
              <div style={{ background: "#fff", borderRadius: "12px", padding: "12px", display: "inline-block", marginBottom: "12px" }}>
                <QRCodeSVG value={payosData.qrCode} size={160} level="M" marginSize={0} />
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "8px" }}>Mã đơn: {payosData.orderCode}</p>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                {payosData.checkoutUrl && (
                  <a className="small-button" href={payosData.checkoutUrl} rel="noreferrer" target="_blank" type="button">
                    <ExternalLink size={14} /> Mở PayOS
                  </a>
                )}
                <button className="small-button" onClick={handleCheckPaymentStatus} disabled={checkingSessionId === unpaidSession.id} type="button">
                  {checkingSessionId === unpaidSession.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Kiểm tra
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="full-button" onClick={handleCreatePayment} type="button">
                <QrCode size={16} /> Tạo mã QR thanh toán
              </button>
              <button className="small-button" onClick={handleCheckPaymentStatus} disabled={checkingSessionId === unpaidSession.id} type="button">
                {checkingSessionId === unpaidSession.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Kiểm tra thanh toán
              </button>
            </div>
          )}

          {/* Kết quả check */}
          {sessionCheckResult && (
            <div style={{
              marginTop: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: sessionCheckResult.status === "fully_paid" ? "rgba(34,197,94,0.1)" : "rgba(251,191,36,0.1)",
              color: sessionCheckResult.status === "fully_paid" ? "#22c55e" : "#fbbf24",
              fontSize: "0.9rem",
            }}>
              {sessionCheckResult.status === "fully_paid"
                ? "Thanh toán thành công!"
                : sessionCheckResult.status === "partial_paid"
                  ? "Thanh toán một phần."
                  : "Chưa nhận được thanh toán."}
            </div>
          )}
        </div>
      )}

      {/* Transaction history */}
      <div className="panel full">
        <div className="panel-heading">
          <div>
            <p>Giao dịch</p>
            <h2>Lịch sử thanh toán</h2>
          </div>
          <CreditCard size={22} />
        </div>
        {rows.length === 0 ? (
          <p className="muted-cell" style={{ padding: "1rem 0" }}>Chưa có giao dịch nào.</p>
        ) : (
          <DataTable
            headers={["Thời gian", "Biển số", "Chủ xe", "Email", "Slot", "Số tiền", "PT", "Trạng thái", "Thao tác"]}
            rows={rows}
          />
        )}
      </div>

      {/* QR Payment Modal */}
      {qrModal && (
        <div
          onClick={closeQrModal}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-primary, #fff)", borderRadius: "16px", padding: "24px",
              width: "min(380px, 92vw)", maxHeight: "90vh", overflowY: "auto", textAlign: "center",
              boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Thanh toán PayOS</h3>
              <button onClick={closeQrModal} type="button" style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <span style={{ fontWeight: 600 }}>{qrModal.plate}</span>
              <span style={{ color: "var(--primary)", fontWeight: 700 }}>{currency.format(qrModal.amount)}</span>
            </div>

            {qrModalLoading && !qrModalData ? (
              <div style={{ padding: "40px 0", display: "flex", justifyContent: "center" }}>
                <Loader2 size={28} className="animate-spin" />
              </div>
            ) : qrModalData ? (
              <>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "12px" }}>Quét mã QR để thanh toán</p>
                <div style={{ background: "#fff", borderRadius: "12px", padding: "12px", display: "inline-block", marginBottom: "12px" }}>
                  <QRCodeSVG value={qrModalData.qrCode} size={200} level="M" marginSize={0} />
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "12px" }}>Mã đơn: {qrModalData.orderCode}</p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                  {qrModalData.checkoutUrl && (
                    <a className="small-button" href={qrModalData.checkoutUrl} rel="noreferrer" target="_blank">
                      <ExternalLink size={14} /> Mở PayOS
                    </a>
                  )}
                  <button className="small-button" onClick={checkQrModalPayment} disabled={qrModalLoading} type="button">
                    {qrModalLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Kiểm tra thanh toán
                  </button>
                </div>
              </>
            ) : null}

            {qrModalResult && (
              <div style={{
                marginTop: "16px", padding: "10px 14px", borderRadius: "8px",
                background: qrModalResult === "fully_paid" ? "rgba(34,197,94,0.1)" : qrModalResult === "partial_paid" ? "rgba(251,191,36,0.1)" : "rgba(239,68,68,0.1)",
                color: qrModalResult === "fully_paid" ? "#22c55e" : qrModalResult === "partial_paid" ? "#fbbf24" : "#ef4444",
                fontSize: "0.9rem",
              }}>
                {qrModalResult === "fully_paid"
                  ? "Thanh toán thành công! Bạn có thể đóng cửa sổ này."
                  : qrModalResult === "partial_paid"
                    ? "Đã thanh toán một phần."
                    : "Chưa nhận được thanh toán. Vui lòng thử lại sau khi chuyển khoản."}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
