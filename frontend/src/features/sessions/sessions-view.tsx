"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  Download,
  Eye,
  Search,
  ShieldAlert,
  CarFront,
  CheckCircle2,
  Clock,
  TrendingUp,
  X,
  LogOut,
  Square,
  CheckSquare,
} from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";
import type { ParkingSession } from "@/types";

const PAGE_SIZE = 12;

type StatusFilter = "all" | "Đang gửi" | "Đã hoàn thành" | "Đã hủy";
type PayFilter = "all" | "paid" | "unpaid";

// Round AI confidence to 1 decimal so we never display 0.5552893...%
function formatConfidence(value?: number): string | null {
  if (value === undefined || value === null) return null;
  // Values may arrive as 0..1 or 0..100 — normalize.
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

// Format a live duration: "9h 56m" / "11 phút"
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} phút`;
}

function completedDuration(checkIn: string, checkOut?: string): string | null {
  if (!checkOut) return null;
  const [inHour, inMinute] = checkIn.split(":").map(Number);
  const [outHour, outMinute] = checkOut.split(":").map(Number);
  if (![inHour, inMinute, outHour, outMinute].every(Number.isFinite)) return null;
  let minutes = outHour * 60 + outMinute - (inHour * 60 + inMinute);
  if (minutes < 0) minutes += 24 * 60;
  return formatDuration(minutes);
}

function LiveMinutes({ checkIn, checkInAt }: { checkIn: string; checkInAt?: string }) {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    function calc() {
      const now = new Date();
      const checkInDate = checkInAt ? new Date(checkInAt) : new Date();
      if (!checkInAt || Number.isNaN(checkInDate.getTime())) {
        const [h, m] = checkIn.split(":").map(Number);
        checkInDate.setHours(h, m, 0, 0);
        if (checkInDate > now) checkInDate.setDate(checkInDate.getDate() - 1);
      }
      const diff = Math.floor((now.getTime() - checkInDate.getTime()) / 60000);
      setMinutes(Math.max(0, diff));
    }
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [checkIn, checkInAt]);

  return (
    <span className="session-live-min">
      <Clock size={12} />
      {formatDuration(minutes)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Đang gửi")
    return (
      <span className="status-pill status-active" aria-label="Phiên đang hoạt động">
        <span className="pulse-dot" aria-hidden /> Đang gửi
      </span>
    );
  if (status === "Đã hoàn thành")
    return (
      <span className="status-pill status-done">
        <CheckCircle2 size={11} /> Hoàn thành
      </span>
    );
  return <span className="status-pill status-cancelled">{status}</span>;
}

function PayBadge({ paymentStatus, paymentMethod }: { paymentStatus?: string; paymentMethod?: string }) {
  if (paymentMethod === "subscription")
    return <span className="pay-pill pay-paid">Theo gói thành viên</span>;
  if (paymentStatus === "fully_paid")
    return <span className="pay-pill pay-paid">Đã thanh toán</span>;
  if (paymentStatus === "partial_paid")
    return <span className="pay-pill pay-partial">Một phần</span>;
  return <span className="pay-pill pay-unpaid">Chưa thanh toán</span>;
}

function paymentMethodLabel(paymentMethod?: string, paymentStatus?: string) {
  if (paymentMethod === "payos") return "Thanh toán PayOS";
  if (paymentMethod === "cash") return "Thanh toán tiền mặt";
  if (paymentMethod === "subscription") return "Theo gói thành viên";
  if (paymentStatus === "fully_paid") return "Đã thanh toán (chưa xác định phương thức)";
  return "Chưa thanh toán";
}

function MatchBadge({ match }: { match?: string }) {
  if (match === "Khớp") return <span className="status-pill status-done">Khớp</span>;
  if (match === "Không khớp")
    return (
      <span className="status-pill status-warn">
        <ShieldAlert size={11} /> Không khớp
      </span>
    );
  return <span className="status-pill status-neutral">Chưa checkout</span>;
}

// Empty state with reset CTA when filters are active
function EmptyState({ hasFilter, onReset }: { hasFilter: boolean; onReset: () => void }) {
  return (
    <div className="empty-state">
      <CarFront size={42} />
      <h3>Không có phiên nào</h3>
      <p>{hasFilter ? "Thử đổi bộ lọc hoặc từ khóa tìm kiếm." : "Chưa có phiên đỗ xe nào trong hệ thống."}</p>
      {hasFilter && (
        <button type="button" className="small-button" onClick={onReset}>
          <X size={14} /> Xóa bộ lọc
        </button>
      )}
    </div>
  );
}

export function SessionsView() {
  const {
    currentUser,
    viewAs,
    filteredSessions,
    searchText,
    setSearchText,
    setSessions,
    completeSession,
  } = useParkingApp();

  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailSession, setDetailSession] = useState<ParkingSession | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;

  // Refresh provisional fees so active sessions reflect the current parking time.
  useEffect(() => {
    let cancelled = false;

    async function refreshSessions() {
      try {
        const response = await apiFetch("/parking-sessions");
        if (!cancelled && response.ok) {
          const data = await response.json();
          setSessions(data.sessions ?? []);
        }
      } catch {
        // Keep the most recently loaded session data if the refresh fails.
      }
    }

    void refreshSessions();
    const interval = window.setInterval(() => void refreshSessions(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [setSessions]);

  // Dùng viewAs để xác định chế độ hiển thị
  const isCustomer = currentUser.role === "staff" ? viewAs === "customer" : currentUser.role === "customer";
  const isAdmin = currentUser.role === "admin";

  // Keyboard shortcut: "/" focuses search (admin only)
  useEffect(() => {
    if (isCustomer) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && confirmId) {
        setConfirmId(null);
      }
      if (e.key === "Escape" && detailSession) {
        setDetailSession(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCustomer, confirmId, detailSession]);

  const stats = useMemo(() => {
    let active = 0;
    let done = 0;
    let revenue = 0;
    let overstayed = 0;
    for (const s of filteredSessions) {
      if (s.status === "Đang gửi") active++;
      if (s.status === "Đã hoàn thành") done++;
      if (s.paymentStatus === "fully_paid") revenue += s.fee;
      if ((s as any).isOverstayed) overstayed++;
    }
    return {
      active,
      done,
      revenue,
      overstayed,
      total: filteredSessions.length,
    };
  }, [filteredSessions]);

  const visible = useMemo(() => {
    return filteredSessions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (payFilter === "paid" && s.paymentStatus !== "fully_paid")
        return false;
      if (payFilter === "unpaid" && s.paymentStatus === "fully_paid")
        return false;
      return true;
    });
  }, [filteredSessions, statusFilter, payFilter]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const filtersActive = statusFilter !== "all" || payFilter !== "all";
  const allSelected =
    pageItems.length > 0 && pageItems.every((s) => selected.has(s.id));

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (pageItems.every((s) => prev.has(s.id))) {
        const next = new Set(prev);
        pageItems.forEach((s) => next.delete(s.id));
        return next;
      }
      const next = new Set(prev);
      pageItems.forEach((s) => next.add(s.id));
      return next;
    });
  }, [pageItems]);

  const resetFilters = useCallback(() => {
    setStatusFilter("all");
    setPayFilter("all");
    setSearchText("");
    setCurrentPage(1);
    setSelected(new Set());
  }, [setSearchText]);

  async function handleCheckout(id: string, plate: string) {
    setCheckingOut(id);
    try {
      await completeSession(id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setCheckingOut(null);
      setConfirmId(null);
    }
  }

  async function handleBulkCheckout() {
    const ids = Array.from(selected);
    for (const id of ids) {
      await handleCheckout(id, "");
    }
  }

  // Compute fee display — never show "0 ₫" for active sessions
  function renderFee(session: (typeof pageItems)[number]) {
    if (session.paymentMethod === "subscription") {
      return <span className="fee-meta">Đã bao gồm trong gói thành viên</span>;
    }
    if (session.feeBreakdown) {
      return (
        <>
          <strong>{currency.format(session.fee)}</strong>
          <span className="fee-meta">
            {session.feeBreakdown.totalMinutes} phút ·{" "}
            {session.feeBreakdown.billableHours}h tính phí
          </span>
        </>
      );
    }
    if (session.status === "Đang gửi") {
      return (
        <>
          <strong className="fee-pending">Chưa tính</strong>
          <span className="fee-meta">Sẽ tính khi checkout</span>
        </>
      );
    }
    if (session.status === "Đã hoàn thành") {
      return session.fee > 0 ? (
        <strong>{currency.format(session.fee)}</strong>
      ) : (
        <strong className="fee-pending">0 ₫</strong>
      );
    }
    return <span className="muted">—</span>;
  }

  // Get accent class for card left border based on status
  function cardAccent(status: string, isOverstayed?: boolean) {
    if (isOverstayed) return "is-overstayed";
    if (status === "Đã hoàn thành") return "is-done";
    if (status === "Đã hủy") return "is-cancelled";
    return "is-active";
  }

  const aiConf = (v?: number) => formatConfidence(v);

  return (
    <section className={isCustomer ? "full-width-section" : "sessions-section"}>
      <div
        className={`panel ${isCustomer ? "full-width-panel" : "wide"} sessions-panel`}
      >
        {/* Header */}
        <div className="panel-heading sessions-header">
          <div>
            <p>Quản lý phiên</p>
            <h2>Danh sách phiên đỗ xe</h2>
          </div>
          {!isCustomer && (
            <div className="sessions-header-actions">
              <div className="search-box" role="search">
                <Search size={16} aria-hidden />
                <input
                  ref={searchRef}
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm biển số, mã phiên, chủ xe… (/)"
                  value={searchText}
                  aria-label="Tìm kiếm phiên"
                />
                {searchText && (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => setSearchText("")}
                    title="Xóa"
                    aria-label="Xóa tìm kiếm"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="sessions-stats" role="status" aria-live="polite">
          <div className="stat-card">
            <div className="stat-icon stat-icon-blue">
              <CarFront size={18} />
            </div>
            <div>
              <p>Tổng phiên</p>
              <strong>{stats.total}</strong>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-amber">
              <Clock size={18} />
            </div>
            <div>
              <p>Đang gửi</p>
              <strong>{stats.active}</strong>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-green">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p>Hoàn thành</p>
              <strong>{stats.done}</strong>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-purple">
              <TrendingUp size={18} />
            </div>
            <div>
              <p>Doanh thu (đã TT)</p>
              <strong>{currency.format(stats.revenue)}</strong>
            </div>
          </div>
          {stats.overstayed > 0 && (
            <div className="stat-card stat-card-warn">
              <div className="stat-icon stat-icon-red">
                <ShieldAlert size={18} />
              </div>
              <div>
                <p>Quá hạn</p>
                <strong>{stats.overstayed}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Filter chips */}
        <div className="sessions-filters">
          <div className="filter-group">
            <span className="filter-label">Trạng thái:</span>
            {(
              ["all", "Đang gửi", "Đã hoàn thành", "Đã hủy"] as StatusFilter[]
            ).map((s) => (
              <button
                key={s}
                type="button"
                className={`chip ${statusFilter === s ? "chip-active" : ""}`}
                onClick={() => {
                  setStatusFilter(s);
                  setCurrentPage(1);
                }}
                aria-pressed={statusFilter === s}
              >
                {s === "all" ? "Tất cả" : s}
              </button>
            ))}
          </div>
          <div className="filter-group">
            <span className="filter-label">Thanh toán:</span>
            {(
              [
                { v: "all", l: "Tất cả" },
                { v: "paid", l: "Đã thanh toán" },
                { v: "unpaid", l: "Chưa thanh toán" },
              ] as { v: PayFilter; l: string }[]
            ).map((p) => (
              <button
                key={p.v}
                type="button"
                className={`chip ${payFilter === p.v ? "chip-active" : ""}`}
                onClick={() => {
                  setPayFilter(p.v);
                  setCurrentPage(1);
                }}
                aria-pressed={payFilter === p.v}
              >
                {p.l}
              </button>
            ))}
          </div>
          {filtersActive && (
            <button type="button" className="chip chip-ghost" onClick={resetFilters}>
              <X size={12} /> Xóa lọc
            </button>
          )}
        </div>

        {/* Bulk action bar (admin only) */}
        {isAdmin && selected.size > 0 && (
          <div className="sessions-bulk-bar" role="region" aria-label="Thao tác hàng loạt">
            <span>
              Đã chọn <strong>{selected.size}</strong> phiên
            </span>
            <button
              type="button"
              className="small-button"
              onClick={() => setSelected(new Set())}
            >
              <X size={14} /> Bỏ chọn
            </button>
            <button
              type="button"
              className="small-button btn-force-checkout"
              onClick={handleBulkCheckout}
              disabled={checkingOut !== null}
            >
              <LogOut size={14} /> Checkout {selected.size} phiên
            </button>
          </div>
        )}

        {/* Content */}
        {pageItems.length === 0 ? (
          <EmptyState hasFilter={filtersActive || !!searchText} onReset={resetFilters} />
        ) : (
          /* LIST VIEW — denser for ops scanning */
          <div className="sessions-list-wrap">
            <table className="sessions-table" role="table">
              <thead>
                <tr>
                  {isAdmin && (
                    <th className="col-check">
                      <button
                        type="button"
                        className="session-card-checkbox"
                        onClick={toggleSelectAll}
                        aria-label={allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                      >
                        {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </th>
                  )}
                  <th>Biển số</th>
                  <th>Chủ xe</th>
                  <th>Vị trí</th>
                  <th>Vào</th>
                  <th>Thời gian ra</th>
                  <th>Thời lượng</th>
                  <th>Trạng thái</th>
                  <th>Thanh toán</th>
                  <th className="col-fee">Phí</th>
                  <th className="col-act"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((session) => {
                  const isOverstayed = (session as any).isOverstayed;
                  const isSelected = selected.has(session.id);
                  return (
                    <tr
                      key={session.id}
                      className={`${cardAccent(session.status, isOverstayed)} ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setDetailSession(session)}
                    >
                      {isAdmin && (
                        <td className="col-check" onClick={(event) => event.stopPropagation()}>
                          {session.status === "Đang gửi" ? (
                            <button
                              type="button"
                              className="session-card-checkbox"
                              onClick={() => toggleSelect(session.id)}
                              aria-label={isSelected ? "Bỏ chọn" : "Chọn"}
                              aria-pressed={isSelected}
                            >
                              {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                          ) : null}
                        </td>
                      )}
                      <td>
                        <div className="cell-plate">
                          <CarFront size={14} aria-hidden />
                          <strong>{session.plate}</strong>
                          <span className="cell-id">
                            #{session.id.slice(-8).toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="cell-owner">{session.owner || "—"}</td>
                      <td className="val-mono">{session.slot}</td>
                      <td className="val-mono">
                        {session.checkInDate} {session.checkIn}
                      </td>
                      <td>
                        {session.checkOut ? (
                          <span className="val-mono">
                            {session.checkOutDate ? `${session.checkOutDate} ` : ""}
                            {session.checkOut}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {session.status === "Đang gửi" ? (
                          <LiveMinutes checkIn={session.checkIn} checkInAt={session.checkInAt} />
                        ) : completedDuration(session.checkIn, session.checkOut) ? (
                          <span className="val-mono">
                            {completedDuration(session.checkIn, session.checkOut)}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="cell-pills">
                          <StatusBadge status={session.status} />
                          {isOverstayed && (
                            <span
                              className="status-pill status-warn"
                              title={`Quá hạn ${(session as any).overdueMinutes || 0} phút`}
                            >
                              <ShieldAlert size={12} /> Quá hạn
                            </span>
                          )}
                          <MatchBadge match={session.matchStatus} />
                        </div>
                      </td>
                      <td>
                        <PayBadge paymentStatus={session.paymentStatus} paymentMethod={session.paymentMethod} />
                      </td>
                      <td className="col-fee">{renderFee(session)}</td>
                      <td className="col-act" onClick={(event) => event.stopPropagation()}>
                        {isAdmin && session.status === "Đang gửi" ? (
                          confirmId === session.id ? (
                            <div className="confirm-inline confirm-inline-list">
                              <button
                                type="button"
                                className="small-button btn-confirm-yes"
                                disabled={checkingOut === session.id}
                                onClick={() => handleCheckout(session.id, session.plate)}
                              >
                                {checkingOut === session.id ? "…" : "Có"}
                              </button>
                              <button
                                type="button"
                                className="small-button btn-confirm-no"
                                onClick={() => setConfirmId(null)}
                                disabled={checkingOut === session.id}
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="small-button btn-force-checkout"
                              disabled={checkingOut !== null && checkingOut !== session.id}
                              onClick={() => setConfirmId(session.id)}
                              title="Checkout"
                              aria-label={`Checkout phiên ${session.plate}`}
                            >
                              <LogOut size={14} />
                            </button>
                          )
                        ) : session.status === "Đã hoàn thành" ? (
                          <a
                            className="small-button"
                            href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/parking-sessions/${session.id}/receipt/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            title="Tải biên lai"
                          >
                            <Download size={14} />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {detailSession && (
          <div
            className="modal-overlay"
            role="presentation"
            onClick={() => setDetailSession(null)}
          >
            <section
              className="modal-card session-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="session-detail-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-title">
                  <Eye size={18} aria-hidden />
                  <div>
                    <p className="muted-text">Chi tiết phiên đỗ xe</p>
                    <h3 id="session-detail-title">{detailSession.plate}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setDetailSession(null)}
                  aria-label="Đóng chi tiết phiên"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="session-detail-grid">
                <div><span>Mã phiên</span><strong>#{detailSession.id.slice(-8).toUpperCase()}</strong></div>
                <div><span>Chủ xe</span><strong>{detailSession.owner || "Khách vãng lai"}</strong></div>
                <div><span>Vị trí</span><strong>{detailSession.slot || "—"}</strong></div>
                <div><span>Thời gian vào</span><strong>{detailSession.checkInDate} {detailSession.checkIn}</strong></div>
                <div><span>Thời gian ra</span><strong>{detailSession.checkOut ? `${detailSession.checkOutDate ?? ""} ${detailSession.checkOut}`.trim() : "Chưa ra bãi"}</strong></div>
                <div><span>Thời lượng</span><strong>{detailSession.status === "Đang gửi" ? <LiveMinutes checkIn={detailSession.checkIn} checkInAt={detailSession.checkInAt} /> : completedDuration(detailSession.checkIn, detailSession.checkOut) ?? "—"}</strong></div>
              </div>

              <div className="session-detail-status">
                <div><span>Trạng thái</span><StatusBadge status={detailSession.status} /> <MatchBadge match={detailSession.matchStatus} /></div>
                <div><span>Thanh toán</span><PayBadge paymentStatus={detailSession.paymentStatus} paymentMethod={detailSession.paymentMethod} /></div>
                <div><span>Phương thức</span><strong>{paymentMethodLabel(detailSession.paymentMethod, detailSession.paymentStatus)}</strong></div>
                <div><span>Phí {detailSession.status === "Đang gửi" ? "tạm tính" : ""}</span>{renderFee(detailSession)}</div>
              </div>

              {(detailSession.manualEntryReason || detailSession.manualExitReason || (detailSession.exitRfidManualVerified && detailSession.verificationNote)) && (
                <div className="session-detail-notes">
                  <h4>Ghi chú xử lý thủ công</h4>
                  {detailSession.manualEntryReason && (
                    <p><strong>Vào thủ công:</strong> {detailSession.manualEntryReason}</p>
                  )}
                  {detailSession.manualExitReason && (
                    <p>
                      <strong>
                        {detailSession.status === "Đang gửi"
                          ? "Lần thử ra thủ công (chưa checkout):"
                          : "Ra thủ công:"}
                      </strong>{" "}
                      {detailSession.manualExitReason}
                    </p>
                  )}
                  {detailSession.exitRfidManualVerified && detailSession.verificationNote && (
                    <p><strong>Xác minh RFID thủ công:</strong> {detailSession.verificationNote}</p>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Pagination */}
        {visible.length > PAGE_SIZE && (
          <div className="pagination sessions-pagination">
            <button
              className="small-button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              type="button"
            >
              ← Trước
            </button>
            <span className="pagination-info">
              Trang <strong>{currentPage}</strong> / {totalPages} (
              {visible.length} phiên)
            </span>
            <button
              className="small-button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              type="button"
            >
              Sau →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
