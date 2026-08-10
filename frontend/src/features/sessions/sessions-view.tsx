"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Download,
  Eye,
  Search,
  ShieldAlert,
  CarFront,
  CheckCircle2,
  Clock,
  TrendingUp,
  Filter,
  X,
} from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { currency } from "@/lib/constants";

const PAGE_SIZE = 12;

type StatusFilter = "all" | "Đang gửi" | "Đã hoàn thành" | "Đã hủy";
type PayFilter = "all" | "paid" | "partial" | "unpaid";

function LiveMinutes({ checkIn }: { checkIn: string }) {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    function calc() {
      const now = new Date();
      const [h, m] = checkIn.split(":").map(Number);
      const checkInDate = new Date();
      checkInDate.setHours(h, m, 0, 0);
      if (checkInDate > now) checkInDate.setDate(checkInDate.getDate() - 1);
      const diff = Math.floor((now.getTime() - checkInDate.getTime()) / 60000);
      setMinutes(diff);
    }
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [checkIn]);

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return (
    <span className="session-live-min">
      <Clock size={12} />
      {hours > 0 ? `${hours}h ${mins}m` : `${mins} phút`}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Đang gửi") return <span className="status-pill status-active">● {status}</span>;
  if (status === "Đã hoàn thành") return <span className="status-pill status-done">{status}</span>;
  return <span className="status-pill status-cancelled">{status}</span>;
}

function PayBadge({ paymentStatus }: { paymentStatus?: string }) {
  if (paymentStatus === "fully_paid") return <span className="pay-pill pay-paid">Đã thanh toán</span>;
  if (paymentStatus === "partial_paid") return <span className="pay-pill pay-partial">Một phần</span>;
  return <span className="pay-pill pay-unpaid">Chưa thanh toán</span>;
}

function MatchBadge({ match }: { match?: string }) {
  if (match === "Khớp") return <span className="status-pill status-done">Khớp</span>;
  if (match === "Không khớp") return <span className="status-pill status-warn">Không khớp</span>;
  return <span className="status-pill status-neutral">Chưa checkout</span>;
}

export function SessionsView() {
  const {
    currentUser,
    filteredSessions,
    searchText,
    setSearchText,
  } = useParkingApp();

  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  if (!currentUser) return null;

  const isCustomer = currentUser.role === "customer";

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
    return { active, done, revenue, overstayed, total: filteredSessions.length };
  }, [filteredSessions]);

  const visible = useMemo(() => {
    return filteredSessions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (payFilter === "paid" && s.paymentStatus !== "fully_paid") return false;
      if (payFilter === "partial" && s.paymentStatus !== "partial_paid") return false;
      if (payFilter === "unpaid" && s.paymentStatus === "fully_paid") return false;
      return true;
    });
  }, [filteredSessions, statusFilter, payFilter]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filtersActive = statusFilter !== "all" || payFilter !== "all";

  return (
    <section className={isCustomer ? "full-width-section" : "sessions-section"}>
      <div className={`panel ${isCustomer ? "full-width-panel" : "wide"} sessions-panel`}>
        {/* Header */}
        <div className="panel-heading sessions-header">
          <div>
            <p>Quản lý phiên</p>
            <h2>Danh sách phiên đỗ xe</h2>
          </div>
          {!isCustomer && (
            <div className="sessions-header-actions">
              <div className="search-box">
                <Search size={16} />
                <input
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm biển số, mã phiên, chủ xe…"
                  value={searchText}
                />
                {searchText && (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => setSearchText("")}
                    title="Xóa"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className={`small-button sessions-filter-toggle ${showFilters || filtersActive ? "active" : ""}`}
                onClick={() => setShowFilters((v) => !v)}
              >
                <Filter size={14} /> Bộ lọc
              </button>
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="sessions-stats">
          <div className="stat-card">
            <div className="stat-icon stat-icon-blue"><CarFront size={18} /></div>
            <div>
              <p>Tổng phiên</p>
              <strong>{stats.total}</strong>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-amber"><Clock size={18} /></div>
            <div>
              <p>Đang gửi</p>
              <strong>{stats.active}</strong>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-green"><CheckCircle2 size={18} /></div>
            <div>
              <p>Hoàn thành</p>
              <strong>{stats.done}</strong>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-purple"><TrendingUp size={18} /></div>
            <div>
              <p>Doanh thu (đã TT)</p>
              <strong>{currency.format(stats.revenue)}</strong>
            </div>
          </div>
          {stats.overstayed > 0 && (
            <div className="stat-card stat-card-warn">
              <div className="stat-icon stat-icon-red"><ShieldAlert size={18} /></div>
              <div>
                <p>Quá hạn</p>
                <strong>{stats.overstayed}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Filter chips */}
        {showFilters && (
          <div className="sessions-filters">
            <div className="filter-group">
              <span className="filter-label">Trạng thái:</span>
              {(["all", "Đang gửi", "Đã hoàn thành", "Đã hủy"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${statusFilter === s ? "chip-active" : ""}`}
                  onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                >
                  {s === "all" ? "Tất cả" : s}
                </button>
              ))}
            </div>
            <div className="filter-group">
              <span className="filter-label">Thanh toán:</span>
              {([
                { v: "all", l: "Tất cả" },
                { v: "paid", l: "Đã TT" },
                { v: "partial", l: "Một phần" },
                { v: "unpaid", l: "Chưa TT" },
              ] as { v: PayFilter; l: string }[]).map((p) => (
                <button
                  key={p.v}
                  type="button"
                  className={`chip ${payFilter === p.v ? "chip-active" : ""}`}
                  onClick={() => { setPayFilter(p.v); setCurrentPage(1); }}
                >
                  {p.l}
                </button>
              ))}
            </div>
            {filtersActive && (
              <button
                type="button"
                className="chip chip-ghost"
                onClick={() => { setStatusFilter("all"); setPayFilter("all"); }}
              >
                <X size={12} /> Xóa lọc
              </button>
            )}
          </div>
        )}

        {/* Cards */}
        {pageItems.length === 0 ? (
          <div className="empty-state">
            <CarFront size={42} />
            <h3>Không có phiên nào</h3>
            <p>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
          </div>
        ) : (
          <div className="sessions-grid">
            {pageItems.map((session) => {
              const isOverstayed = (session as any).isOverstayed;
              return (
                <article key={session.id} className={`session-card ${isOverstayed ? "is-overstayed" : ""}`}>
                  <header className="session-card-head">
                    <div className="session-card-plate">
                      <CarFront size={14} />
                      <span>{session.plate}</span>
                    </div>
                    <StatusBadge status={session.status} />
                  </header>

                  <div className="session-card-id">#{session.id.slice(-8).toUpperCase()}</div>

                  <div className="session-card-grid">
                    <div className="session-card-row">
                      <span className="lbl">Chủ xe</span>
                      <span className="val">{session.owner || "—"}</span>
                    </div>
                    <div className="session-card-row">
                      <span className="lbl">Vị trí</span>
                      <span className="val val-mono">{session.slot}</span>
                    </div>
                    <div className="session-card-row">
                      <span className="lbl">Vào</span>
                      <span className="val">
                        {session.checkInDate} <span className="val-mono">{session.checkIn}</span>
                      </span>
                    </div>
                    <div className="session-card-row">
                      <span className="lbl">Ra</span>
                      <span className="val">
                        {session.checkOut ? (
                          <span className="val-mono">{session.checkOut}</span>
                        ) : session.status === "Đang gửi" ? (
                          <LiveMinutes checkIn={session.checkIn} />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* AI detection */}
                  {(session.entryDetectedPlate || session.exitDetectedPlate) && (
                    <div className="session-card-ai">
                      <div className="ai-row">
                        <span className="lbl">AI vào</span>
                        <span className="ai-val">
                          {session.entryDetectedPlate || session.plate}
                          {session.entryConfidence ? <em>{session.entryConfidence}%</em> : null}
                        </span>
                      </div>
                      {session.exitDetectedPlate && (
                        <div className="ai-row">
                          <span className="lbl">AI ra</span>
                          <span className="ai-val">
                            {session.exitDetectedPlate}
                            {session.exitConfidence ? <em>{session.exitConfidence}%</em> : null}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Images */}
                  {(session.entryImageUrl || session.exitImageUrl) && (
                    <div className="session-card-imgs">
                      {session.entryImageUrl && (
                        <a href={session.entryImageUrl} target="_blank" rel="noreferrer" title="Ảnh vào">
                          <Eye size={14} /> Vào
                        </a>
                      )}
                      {session.exitImageUrl && (
                        <a href={session.exitImageUrl} target="_blank" rel="noreferrer" title="Ảnh ra">
                          <Eye size={14} /> Ra
                        </a>
                      )}
                    </div>
                  )}

                  <footer className="session-card-foot">
                    <div className="session-card-fee">
                      <span className="lbl">Phí</span>
                      <strong>
                        {session.feeBreakdown ||
                        session.status === "Đã hoàn thành" ||
                        (session.paymentStatus === "fully_paid" && session.fee > 0)
                          ? currency.format(session.fee)
                          : "Chưa tính"}
                      </strong>
                      {session.feeBreakdown && (
                        <span className="fee-meta">
                          {session.feeBreakdown.totalMinutes} phút · {session.feeBreakdown.billableHours}h tính phí
                        </span>
                      )}
                    </div>
                    <div className="session-card-actions">
                      <PayBadge paymentStatus={session.paymentStatus} />
                      <MatchBadge match={session.matchStatus} />
                      {isOverstayed && (
                        <span className="status-pill status-warn" title={`Quá hạn ${(session as any).overdueMinutes || 0} phút`}>
                          <ShieldAlert size={12} /> Quá hạn
                        </span>
                      )}
                      {session.status === "Đã hoàn thành" && (
                        <a
                          className="small-button"
                          href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/parking-sessions/${session.id}/receipt/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          title="Tải biên lai"
                        >
                          <Download size={14} />
                        </a>
                      )}
                    </div>
                  </footer>
                </article>
              );
            })}
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
              Trang <strong>{currentPage}</strong> / {totalPages} ({visible.length} phiên)
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