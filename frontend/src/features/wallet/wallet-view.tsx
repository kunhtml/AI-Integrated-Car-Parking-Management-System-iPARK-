"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  Calendar,
  ChartLine,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  FolderSearch,
  Printer,
  Loader2,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import type { TransactionItem } from "@/types";
import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";

const PAGE_SIZE = 9;

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


function getInitials(name?: string): string {
  if (!name || !name.trim()) return "K";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#2563eb,#7c3aed)",
  "linear-gradient(135deg,#0ea5e9,#2563eb)",
  "linear-gradient(135deg,#10b981,#059669)",
  "linear-gradient(135deg,#f59e0b,#ea580c)",
  "linear-gradient(135deg,#ef4444,#db2777)",
];

function avatarGradient(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function methodLabel(method: string) {
  if (method === "payos") return "PayOS";
  if (method === "cash") return "Tiền mặt";
  return method || "—";
}

type TransactionCardProps = {
  item: TransactionItem;
  isCustomer: boolean;
  isAdmin: boolean;
  onView: (item: TransactionItem) => void;
  onCancel: (item: TransactionItem) => void;
  onConfirm: (id: string) => void;
};

function TransactionCard({ item, isCustomer, isAdmin, onView, onCancel, onConfirm }: TransactionCardProps) {
  const isTopUp = item.content?.startsWith("TOPUP") ?? false;
  const hasPayOSLink = !!item.payosCheckoutUrl;
  const status = item.sessionPaymentStatus || item.status;
  const invoiceNo = item.payosOrderCode ? String(item.payosOrderCode) : item.id.slice(-8).toUpperCase();
  const title = isTopUp
    ? "Nạp tiền vào ví"
    : item.plate
      ? `Gửi xe ${item.plate}${item.slot ? ` · ${item.slot}` : ""}`
      : "Thanh toán đỗ xe";

  return (
    <div
      className="wallet-card"
      onClick={() => onView(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView(item);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="wallet-card-top">
        <div className="wallet-avatar" style={{ background: avatarGradient(item.ownerName || item.id) }}>
          {getInitials(item.ownerName)}
        </div>
        <div className="wallet-customer">
          <span className="wallet-customer-name">
            {item.ownerName && item.ownerName !== "Guest" && item.ownerName !== "Guest RFID"
              ? item.ownerName
              : (item.subscription ? "Khách thành viên" : "Khách vãng lai")}
          </span>
          <span
            className="wallet-customer-handle"
            style={{
              fontWeight: 500,
              color: item.subscription || item.sessionPaymentStatus === "free" ? "#16a34a" : "var(--muted)",
            }}
          >
            {isTopUp
              ? "Nạp tiền ví"
              : item.subscription || item.sessionPaymentStatus === "free"
                ? "Có gói đăng ký"
                : "Không có gói đăng ký"}
          </span>
        </div>
        <StatusBadge status={status} received={item.sessionPaidAmount} total={item.sessionFee} />
      </div>

      <div className="wallet-card-divider" />

      <div className="wallet-card-meta">
        <div>
          <span className="wallet-card-invoice">#{invoiceNo}</span>
          {item.plate && <span className="wallet-card-plate"> · {item.plate}</span>}
        </div>
        <h5 className="wallet-card-title">{title}</h5>
      </div>

      <div className="wallet-card-bottom">
        <span className="wallet-amount">
          <Banknote size={16} />
          {currency.format(item.amount)}
        </span>
        <span className="wallet-date">
          <Calendar size={13} />
          {formatTransactionDate(item.createdAt)}
        </span>
      </div>

      <div className="wallet-card-actions" onClick={(e) => e.stopPropagation()}>
        {item.status === "pending" && hasPayOSLink && (
          <a
            className="small-button"
            href={item.payosCheckoutUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={14} /> Mở link
          </a>
        )}
        {item.status === "pending" && isAdmin && (
          <>
            <button className="small-button" onClick={() => onCancel(item)} style={{ color: "#ef4444" }} type="button">
              <X size={14} /> Hủy
            </button>
            {!isTopUp && (
              <button className="small-button" onClick={() => onConfirm(item.id)} type="button">
                Xác nhận
              </button>
            )}
          </>
        )}
        {item.status === "paid" && !isCustomer && (
          <span style={{ color: "var(--success, #22c55e)", fontWeight: 600 }}>✓ Đã thanh toán</span>
        )}
      </div>
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
  const isAdmin = currentUser?.role === "admin";

  const [checkingSessionId, setCheckingSessionId] = useState<string | null>(null);
  const [sessionCheckResult, setSessionCheckResult] = useState<{ id: string; status: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Modal chi tiết giao dịch
  const [detailTransaction, setDetailTransaction] = useState<TransactionItem | null>(null);

  // Reset phân trang khi bộ lọc thay đổi
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, statusFilter, methodFilter, fromDate, toDate, transactionList]);

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

  async function handleCancelTransaction(item: TransactionItem) {
    if (!window.confirm("Hủy giao dịch này? Giao dịch sẽ bị xóa hoàn toàn.")) return;
    try {
      await apiFetch(`/transactions/${item.id}/cancel`, { method: "POST" });
      const r = await apiFetch("/transactions");
      if (r.ok) {
        const d = await r.json();
        setTransactionList(d.transactions ?? []);
      }
    } catch { /* silent */ }
  }

  if (!currentUser) return null;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
  const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
  const filteredTransactions = transactionList.filter((item) => {
    const effectiveStatus = item.sessionPaymentStatus || item.status;
    const createdAt = parseTransactionDate(item.createdAt);
    const searchableValues = [
      item.plate,
      item.ownerName,
      item.ownerEmail,
      item.slot,
      item.id,
      item.payosOrderCode,
      item.content,
      item.sessionId,
      item.subscriptionId,
      item.session?.id,
      item.subscription?.planName,
      item.subscription?.memberCode,
    ];
    const matchesQuery =
      !normalizedQuery ||
      searchableValues.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));

    if (!matchesQuery) return false;
    if (statusFilter !== "all" && effectiveStatus !== statusFilter) return false;
    if (methodFilter !== "all" && item.method !== methodFilter) return false;
    if (from && (!createdAt || createdAt < from)) return false;
    if (to && (!createdAt || createdAt > to)) return false;
    return true;
  });

  const filtersActive =
    searchQuery !== "" || statusFilter !== "all" || methodFilter !== "all" || fromDate !== "" || toDate !== "";

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);
  const totalSpend = transactionList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const latestTransaction = [...transactionList]
    .sort((a, b) => (parseTransactionDate(b.createdAt)?.getTime() ?? 0) - (parseTransactionDate(a.createdAt)?.getTime() ?? 0))[0];

  return (
    <section className="wallet-page">
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
      <div className="wallet-history-panel">
        <header className="wallet-page-heading">
          <div>
            <p className="wallet-eyebrow">Giao dịch</p>
            <h1>Lịch sử giao dịch</h1>
          </div>
          <div className="wallet-heading-icon" aria-hidden="true">
            <FileText size={24} strokeWidth={1.7} />
          </div>
        </header>

        <div className="wallet-stats" aria-label="Tổng quan giao dịch">
          <div className="wallet-stat-card">
            <div className="wallet-stat-icon wallet-stat-icon-blue"><ChartLine size={22} /></div>
            <div className="wallet-stat-content">
              <span className="wallet-stat-label">Tổng số</span>
              <strong>{transactionList.length}</strong>
              <span className="wallet-stat-caption">giao dịch</span>
            </div>
          </div>
          <div className="wallet-stat-card">
            <div className="wallet-stat-icon wallet-stat-icon-purple"><Wallet size={22} /></div>
            <div className="wallet-stat-content">
              <span className="wallet-stat-label">Tổng chi tiêu</span>
              <strong>{currency.format(totalSpend)}</strong>
              <span className="wallet-stat-caption">tất cả giao dịch</span>
            </div>
          </div>
          <div className="wallet-stat-card">
            <div className="wallet-stat-icon wallet-stat-icon-indigo"><Clock3 size={22} /></div>
            <div className="wallet-stat-content">
              <span className="wallet-stat-label">Giao dịch gần đây</span>
              <strong>{latestTransaction ? currency.format(latestTransaction.amount) : "Không có"}</strong>
              <span className="wallet-stat-caption">{latestTransaction ? formatTransactionDate(latestTransaction.createdAt) : "Chưa có dữ liệu"}</span>
            </div>
          </div>
        </div>

        <div className="wallet-toolbar">
          <div className="wallet-toolbar-title">
            <h2>Tất cả giao dịch</h2>
            <span>{filteredTransactions.length} kết quả</span>
          </div>
          <div className="search-box">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Tìm kiếm giao dịch"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm kiếm giao dịch..."
              value={searchQuery}
            />
            {searchQuery && (
              <button aria-label="Xóa tìm kiếm" className="search-clear" onClick={() => setSearchQuery("")} title="Xóa tìm kiếm" type="button">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="wallet-filters">
          <div className="filter-bar">
            <select aria-label="Lọc theo trạng thái" className="filter-select" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ thanh toán</option>
              <option value="paid">Đã thanh toán</option>
              <option value="fully_paid">Đã thanh toán đủ</option>
              <option value="partial_paid">Thanh toán một phần</option>
              <option value="unpaid">Chưa thanh toán</option>
              <option value="failed">Thất bại</option>
              <option value="cancelled">Đã hủy</option>
            </select>
            <select aria-label="Lọc theo phương thức" className="filter-select" onChange={(event) => setMethodFilter(event.target.value)} value={methodFilter}>
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
          </div>
        </div>

        {visibleTransactions.length === 0 ? (
          <div className="wallet-empty-state">
            <div className="wallet-empty-illustration" aria-hidden="true">
              <FolderSearch size={68} strokeWidth={1.25} />
            </div>
            <h2>{transactionList.length === 0 ? "Bạn chưa có giao dịch nào" : "Không tìm thấy giao dịch"}</h2>
            <p>{transactionList.length === 0 ? "Các giao dịch thanh toán của bạn sẽ xuất hiện ở đây." : "Hãy thử thay đổi từ khóa hoặc bộ lọc để xem kết quả khác."}</p>
          </div>
        ) : (
          <>
            <div className="wallet-card-grid">
              {visibleTransactions.map((item) => (
                <TransactionCard
                  isAdmin={isAdmin}
                  isCustomer={isCustomer}
                  item={item}
                  key={item.id}
                  onCancel={handleCancelTransaction}
                  onConfirm={confirmTransaction}
                  onView={setDetailTransaction}
                />
              ))}
            </div>
            {filteredTransactions.length > visibleCount && (
              <div className="wallet-load-more">
                <button onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} type="button">
                  <ChevronDown size={16} />
                  Tải thêm ({filteredTransactions.length - visibleCount} còn lại)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal chi tiết hóa đơn */}
      {detailTransaction && (
        <div className="wallet-modal-overlay">
          <div className="wallet-invoice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wallet-invoice-head">
              <div className="wallet-invoice-brand">
                <strong>iPARK</strong>
                <span>Hóa đơn thanh toán</span>
              </div>
              <div className="wallet-invoice-order">
                <strong>Hóa đơn # {detailTransaction.payosOrderCode ? String(detailTransaction.payosOrderCode) : detailTransaction.id.slice(-8).toUpperCase()}</strong>
                <StatusBadge
                  status={detailTransaction.sessionPaymentStatus || detailTransaction.status}
                  received={detailTransaction.sessionPaidAmount}
                  total={detailTransaction.sessionFee}
                />
              </div>
              <button
                aria-label="Đóng"
                className="wallet-invoice-close"
                onClick={() => setDetailTransaction(null)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="wallet-invoice-divider" />

            <div className="wallet-invoice-grid">
              <div className="wallet-invoice-block">
                <strong>Khách hàng</strong>
                <span>{detailTransaction.ownerName || "—"}</span>
                <span>{detailTransaction.ownerEmail || "—"}</span>
              </div>
              <div className="wallet-invoice-block">
                <strong>Thông tin xe</strong>
                <span>Biển số: {detailTransaction.plate || "—"}</span>
                <span>Vị trí: {detailTransaction.slot || "—"}</span>
              </div>
              <div className="wallet-invoice-block">
                <strong>Đối chiếu</strong>
                {detailTransaction.reconciliation === "not_applicable" && <span>Không liên quan đến phiên/gói</span>}
                {detailTransaction.reconciliation === "unresolved" && (
                  <span style={{ color: "var(--danger)" }}>⚠ Chưa đối chiếu được</span>
                )}
                {detailTransaction.reconciliation === "reconciled" && detailTransaction.session && (
                  <>
                    <span>Phiên: #{detailTransaction.session.id || detailTransaction.sessionId}</span>
                    <span>Vào: {detailTransaction.session.checkIn ? formatTransactionDate(detailTransaction.session.checkIn) : "—"}</span>
                    <span>Ra: {detailTransaction.session.checkOut ? formatTransactionDate(detailTransaction.session.checkOut) : "—"}</span>
                    <span>Phí: {currency.format(detailTransaction.session.fee ?? detailTransaction.sessionFee ?? 0)}</span>
                  </>
                )}
                {detailTransaction.reconciliation === "reconciled" && detailTransaction.subscription && (
                  <>
                    <span>Gói: {detailTransaction.subscription.name || "Gói thuê bao"}</span>
                    <span>Kỳ hạn: {detailTransaction.subscription.startDate ? formatTransactionDate(detailTransaction.subscription.startDate) : "—"} → {detailTransaction.subscription.endDate ? formatTransactionDate(detailTransaction.subscription.endDate) : "—"}</span>
                    <span>Giá: {currency.format(detailTransaction.subscription.price ?? detailTransaction.amount)}</span>
                  </>
                )}
              </div>
              <div className="wallet-invoice-block">
                <strong>Phương thức thanh toán</strong>
                <span>{methodLabel(detailTransaction.method)}</span>
                {detailTransaction.payosOrderCode && <span>Mã PayOS: {detailTransaction.payosOrderCode}</span>}
              </div>
              <div className="wallet-invoice-block">
                <strong>Thời gian</strong>
                <span>Tạo: {formatTransactionDate(detailTransaction.createdAt)}</span>
                {detailTransaction.paidAt && <span>Thanh toán: {formatTransactionDate(detailTransaction.paidAt)}</span>}
              </div>
              <div className="wallet-invoice-block">
                <strong>Đối chiếu</strong>
                {detailTransaction.reconciliation === "not_applicable" && (
                  <span>Không liên quan đến phiên/gói</span>
                )}
                {detailTransaction.reconciliation === "unresolved" && (
                  <span style={{ color: "var(--danger)" }}>⚠ Chưa đối chiếu được</span>
                )}
                {detailTransaction.reconciliation === "reconciled" && detailTransaction.sessionId && (
                  <>
                    <span>Phiên: #{detailTransaction.session?.id?.slice(-8).toUpperCase() ?? detailTransaction.sessionId.substring(detailTransaction.sessionId.length - 8).toUpperCase()}</span>
                    {detailTransaction.session?.checkInAt && (
                      <span>Vào: {formatTransactionDate(detailTransaction.session.checkInAt)}</span>
                    )}
                    {detailTransaction.session?.checkOutAt && (
                      <span>Ra: {formatTransactionDate(detailTransaction.session.checkOutAt)}</span>
                    )}
                    <span>Phí: {currency.format(detailTransaction.session?.fee ?? 0)}</span>
                  </>
                )}
                {detailTransaction.reconciliation === "reconciled" && detailTransaction.subscriptionId && detailTransaction.subscription && (
                  <>
                    <span>Gói: {detailTransaction.subscription.planName || "—"}</span>
                    {detailTransaction.subscription.memberCode && <span>Mã: {detailTransaction.subscription.memberCode}</span>}
                    {detailTransaction.subscription.startDate && (
                      <span>Kỳ hạn: {formatTransactionDate(detailTransaction.subscription.startDate)} → {detailTransaction.subscription.endDate ? formatTransactionDate(detailTransaction.subscription.endDate) : "—"}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="wallet-invoice-summary">
              <h3>Chi tiết đơn hàng</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>STT</th>
                      <th>Nội dung</th>
                      <th className="right">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>01</td>
                      <td>
                        {detailTransaction.content?.startsWith("TOPUP")
                          ? "Nạp tiền vào ví"
                          : detailTransaction.plate
                            ? `Gửi xe ${detailTransaction.plate}${detailTransaction.slot ? ` · ${detailTransaction.slot}` : ""}`
                            : "Thanh toán đỗ xe"}
                      </td>
                      <td className="right"><strong>{currency.format(detailTransaction.amount)}</strong></td>
                    </tr>
                    <tr>
                      <td className="right" colSpan={2}>Tạm tính</td>
                      <td className="right">{currency.format(detailTransaction.amount)}</td>
                    </tr>
                    <tr className="wallet-invoice-total">
                      <td className="right" colSpan={2}>Tổng cộng</td>
                      <td className="right"><strong>{currency.format(detailTransaction.amount)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="wallet-invoice-actions">
              <button className="small-button" onClick={() => window.print()} type="button">
                <Printer size={14} /> In hóa đơn
              </button>
              <button className="small-button" onClick={() => setDetailTransaction(null)} type="button">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
