"use client";

import { useState, useEffect } from "react";
import { CreditCard, ExternalLink, Eye, Loader2, RefreshCw, Search, Wallet, X } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";

function parseTransactionDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTransactionDate(value?: string) {
  const date = parseTransactionDate(value);
  return date
    ? date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--border, #eee)" }}>
      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{label}</span>
      <span style={{ fontWeight: 500, fontSize: "0.9rem", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

export function WalletView() {
  const {
    currentUser,
    viewAs,
    sessions,
    setSessions,
    transactionList,
    setTransactionList,
    confirmTransaction,
  } = useParkingApp();

  // Dùng viewAs để xác định chế độ hiển thị
  const isCustomer = currentUser?.role === "staff" ? viewAs === "customer" : currentUser?.role === "customer";

  const [checkingSessionId, setCheckingSessionId] = useState<string | null>(null);
  const [sessionCheckResult, setSessionCheckResult] = useState<{ id: string; status: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modal chi tiết giao dịch
  const [detailTransaction, setDetailTransaction] = useState<(typeof transactionList)[0] | null>(null);

  // Lấy phiên chưa thanh toán của user hiện tại
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

  // Auto-poll payment status when checking
  useEffect(() => {
    if (!sessionCheckResult || !unpaidSession) return;
    if (sessionCheckResult.status !== "fully_paid") return;
    const interval = setInterval(async () => {
      try {
        const r = await apiFetch(`/public/session/${unpaidSession.id}/payment-status`);
        const d = await r.json();
        if (d.paymentStatus === "fully_paid") {
          setSessionCheckResult({ id: unpaidSession.id, status: d.paymentStatus });
          clearInterval(interval);
        }
      } catch { /* silent */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionCheckResult, unpaidSession?.id]);

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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
  const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
  const filteredTransactions = transactionList.filter((item) => {
    const effectiveStatus = item.sessionPaymentStatus || item.status;
    const createdAt = parseTransactionDate(item.createdAt);
    const matchesQuery =
      !normalizedQuery ||
      [item.plate, item.ownerName, item.ownerEmail, item.slot, item.id]
        .some((value) => value?.toLowerCase().includes(normalizedQuery));

    if (!matchesQuery) return false;
    if (statusFilter !== "all" && effectiveStatus !== statusFilter) return false;
    if (methodFilter !== "all" && item.method !== methodFilter) return false;
    if (from && (!createdAt || createdAt < from)) return false;
    if (to && (!createdAt || createdAt > to)) return false;
    return true;
  });

  const filtersActive =
    searchQuery !== "" || statusFilter !== "all" || methodFilter !== "all" || fromDate !== "" || toDate !== "";

  const rows = filteredTransactions.map((item) => {
    const isTopUp = item.content?.startsWith("TOPUP") ?? false;
    const hasPayOSLink = !!item.payosCheckoutUrl;

    return [
      // Thời gian
      <span key={`${item.id}-t`} className="muted-cell" style={{ fontSize: "0.8rem" }}>
        {formatTransactionDate(item.createdAt)}
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
        {item.method === "payos" ? "PayOS" : item.method === "cash" ? "Tiền mặt" : item.method}
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
        if (item.status === "pending") {
          return (
            <div className="inline-actions" key={item.id}>
              {hasPayOSLink && (
                <a
                  className="small-button"
                  href={item.payosCheckoutUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink size={14} /> Mở link
                </a>
              )}
              {isCustomer && (
                <button
                  className="small-button"
                  onClick={() => setDetailTransaction(item)}
                  type="button"
                >
                  <Eye size={14} />
                </button>
              )}
              {currentUser.role === "admin" && (
                <button
                  className="small-button"
                  onClick={async () => {
                    if (window.confirm("Hủy giao dịch này? Giao dịch sẽ bị xóa hoàn toàn.")) {
                      try {
                        await apiFetch(`/transactions/${item.id}/cancel`, { method: "POST" });
                        // Reload transactions
                        const r = await apiFetch("/transactions");
                        if (r.ok) {
                          const d = await r.json();
                          setTransactionList(d.transactions ?? []);
                        }
                      } catch { /* silent */ }
                    }
                  }}
                  style={{ color: "#ef4444" }}
                  type="button"
                >
                  <X size={14} /> Hủy
                </button>
              )}
              {currentUser.role === "admin" && !isTopUp && (
                <button
                  className="small-button"
                  onClick={() => confirmTransaction(item.id)}
                  type="button"
                >
                  Xác nhận
                </button>
              )}
            </div>
          );
        }
        if (item.status === "paid") {
          return (
            <div className="inline-actions" key={item.id}>
              <span style={{ color: "var(--color-success)" }}>✓</span>
              {isCustomer && (
                <button
                  className="small-button"
                  onClick={() => setDetailTransaction(item)}
                  type="button"
                >
                  <Eye size={14} />
                </button>
              )}
            </div>
          );
        }
        return (
          <div className="inline-actions" key={item.id}>
            {isCustomer && (
              <button
                className="small-button"
                onClick={() => setDetailTransaction(item)}
                type="button"
              >
                <Eye size={14} />
              </button>
            )}
            {currentUser.role !== "customer" && "—"}
          </div>
        );
      })(),
    ];
  });

  return (
    <section className="content-grid">
      {/* Session chưa thanh toán */}
      {isCustomer && unpaidSession && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Thanh toán</p>
              <h2>Phiên chưa thanh toán</h2>
            </div>
            <Wallet size={22} />
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

          {/* Payment Link */}
          {(unpaidSession as unknown as { payosCheckoutUrl?: string }).payosCheckoutUrl && (
            <div style={{ marginBottom: "16px" }}>
              <a className="full-button" href={(unpaidSession as unknown as { payosCheckoutUrl: string }).payosCheckoutUrl} rel="noreferrer" target="_blank" type="button">
                <ExternalLink size={16} /> Mở link thanh toán PayOS
              </a>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button className="small-button" onClick={handleCheckPaymentStatus} disabled={checkingSessionId === unpaidSession.id} type="button">
              {checkingSessionId === unpaidSession.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Kiểm tra thanh toán
            </button>
          </div>

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
        <div className="filter-bar">
          <div className="search-box">
            <Search size={16} />
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm biển số, chủ xe, email, slot…"
              value={searchQuery}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery("")} title="Xóa tìm kiếm" type="button">
                <X size={14} />
              </button>
            )}
          </div>
          <select className="filter-select" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ thanh toán</option>
            <option value="paid">Đã thanh toán</option>
            <option value="fully_paid">Đã thanh toán đủ</option>
            <option value="partial_paid">Thanh toán một phần</option>
            <option value="unpaid">Chưa thanh toán</option>
            <option value="failed">Thất bại</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select className="filter-select" onChange={(event) => setMethodFilter(event.target.value)} value={methodFilter}>
            <option value="all">Tất cả phương thức</option>
            <option value="payos">PayOS</option>
            <option value="cash">Tiền mặt</option>
          </select>
          <input aria-label="Từ ngày" className="filter-select" onChange={(event) => setFromDate(event.target.value)} title="Từ ngày" type="date" value={fromDate} />
          <input aria-label="Đến ngày" className="filter-select" min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} title="Đến ngày" type="date" value={toDate} />
          {filtersActive && (
            <button
              className="small-button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setMethodFilter("all");
                setFromDate("");
                setToDate("");
              }}
              type="button"
            >
              <X size={14} /> Xóa lọc
            </button>
          )}
          <span className="filter-count">{filteredTransactions.length} / {transactionList.length} giao dịch</span>
        </div>
        {rows.length === 0 ? (
          <p className="muted-cell" style={{ padding: "1rem 0" }}>
            {transactionList.length === 0 ? "Chưa có giao dịch nào." : "Không có giao dịch phù hợp bộ lọc."}
          </p>
        ) : (
          <DataTable
            headers={["Thời gian", "Biển số", "Chủ xe", "Email", "Slot", "Số tiền", "PT", "Trạng thái", "Thao tác"]}
            rows={rows}
          />
        )}
      </div>

      {/* Modal chi tiết giao dịch */}
      {detailTransaction && (
        <div
          onClick={() => setDetailTransaction(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(255,255,255,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-primary, #fff)", borderRadius: "16px", padding: "24px",
              width: "min(420px, 92vw)", maxHeight: "90vh", overflowY: "auto", textAlign: "left",
              boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Chi tiết giao dịch</h3>
              <button onClick={() => setDetailTransaction(null)} type="button" style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <DetailRow label="Mã giao dịch" value={detailTransaction.id} />
              <DetailRow label="Biển số" value={detailTransaction.plate} />
              <DetailRow label="Chủ xe" value={detailTransaction.ownerName || "—"} />
              <DetailRow label="Email" value={detailTransaction.ownerEmail || "—"} />
              <DetailRow label="Slot" value={detailTransaction.slot || "—"} />
              <DetailRow label="Số tiền" value={currency.format(detailTransaction.amount)} />
              <DetailRow label="Phương thức" value={detailTransaction.method === "payos" ? "PayOS" : detailTransaction.method === "cash" ? "Tiền mặt" : detailTransaction.method} />
              <DetailRow label="Trạng thái" value={detailTransaction.status} />
              <DetailRow label="Thời gian" value={formatTransactionDate(detailTransaction.createdAt)} />
              {detailTransaction.paidAt && <DetailRow label="Thanh toán lúc" value={formatTransactionDate(detailTransaction.paidAt)} />}
              {detailTransaction.payosOrderCode && <DetailRow label="Mã PayOS" value={detailTransaction.payosOrderCode} />}
              {detailTransaction.content && <DetailRow label="Nội dung" value={detailTransaction.content} />}
            </div>

            <button
              onClick={() => setDetailTransaction(null)}
              type="button"
              className="small-button"
              style={{ marginTop: "20px", width: "100%" }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
