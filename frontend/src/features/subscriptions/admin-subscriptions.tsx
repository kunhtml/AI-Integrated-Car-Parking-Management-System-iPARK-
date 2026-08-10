"use client";

import { useState, useMemo } from "react";
import { Loader2, Trash2, XCircle, Search, Filter, ChevronLeft, ChevronRight, CreditCard, Users, CheckCircle, Clock, AlertTriangle, Package, RefreshCcw, X } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import type { Subscription } from "@/types";
import { daysRemaining, formatDate } from "./styles";
import { StatusBadge } from "./status-badge";

type Props = {
  subscriptions: Subscription[];
  deletingId: string | null;
  cancellingId: string | null;
  onDelete: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onAfterAction: () => Promise<void>;
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="sub-modal-overlay" onClick={onClose}>
      <div className="sub-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sub-modal-header">
          <h3>{title}</h3>
          <button className="sub-modal-close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        <div className="sub-modal-content">{children}</div>
      </div>
    </div>
  );
}

export function AdminSubscriptions({
  subscriptions,
  deletingId,
  cancellingId,
  onDelete,
  onCancel,
  onAfterAction,
}: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewingSub, setViewingSub] = useState<Subscription | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const stats = useMemo(() => ({
    total: subscriptions.length,
    active: subscriptions.filter((s) => s.status === "active").length,
    pending: subscriptions.filter((s) => s.status === "pending_payment").length,
    expired: subscriptions.filter((s) => s.status === "expired").length,
  }), [subscriptions]);

  const filteredSubs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return subscriptions.filter((s) => {
      if (q && ![s.user?.name ?? "", s.user?.email ?? "", s.planName ?? "", s.primaryVehicle?.plate ?? "", s.memberCode ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
      if (filterStatus && s.status !== filterStatus) return false;
      return true;
    });
  }, [subscriptions, searchQuery, filterStatus]);

  const totalPages = Math.ceil(filteredSubs.length / ITEMS_PER_PAGE);
  const paginatedSubs = filteredSubs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  async function handleConfirmDelete(id: string) {
    await onDelete(id);
    setConfirmDeleteId(null);
  }

  async function handleCancel(id: string) {
    await onCancel(id);
    await onAfterAction();
  }

  return (
    <section className="admin-subs-page">
      {/* Header */}
      <div className="admin-subs-header">
        <div className="header-left">
          <div className="header-icon">
            <Package size={24} />
          </div>
          <div className="header-text">
            <h1>Danh sách đăng ký</h1>
            <p>Quản lý tất cả các gói đăng ký</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="admin-subs-stats">
        <div className="sub-stat-card">
          <div className="sub-stat-icon total"><Package size={20} /></div>
          <div className="sub-stat-content">
            <span className="sub-stat-value">{stats.total}</span>
            <span className="sub-stat-label">Tổng đăng ký</span>
          </div>
        </div>
        <div className="sub-stat-card">
          <div className="sub-stat-icon active"><CheckCircle size={20} /></div>
          <div className="sub-stat-content">
            <span className="sub-stat-value">{stats.active}</span>
            <span className="sub-stat-label">Đang hoạt động</span>
          </div>
        </div>
        <div className="sub-stat-card">
          <div className="sub-stat-icon pending"><Clock size={20} /></div>
          <div className="sub-stat-content">
            <span className="sub-stat-value">{stats.pending}</span>
            <span className="sub-stat-label">Chờ thanh toán</span>
          </div>
        </div>
        <div className="sub-stat-card">
          <div className="sub-stat-icon expired"><AlertTriangle size={20} /></div>
          <div className="sub-stat-content">
            <span className="sub-stat-value">{stats.expired}</span>
            <span className="sub-stat-label">Hết hạn</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-subs-filter">
        <div className="sub-search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Tìm tên, email, biển số, mã TV..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="sub-filter-group">
          <Filter size={16} />
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="pending_payment">Chờ thanh toán</option>
            <option value="expired">Hết hạn</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
        <span className="sub-filter-count">{filteredSubs.length} đăng ký</span>
      </div>

      {/* Subscriptions Grid */}
      <div className="admin-subs-grid">
        {paginatedSubs.length === 0 ? (
          <div className="admin-subs-empty">
            <Package size={48} strokeWidth={1} />
            <p>Không có đăng ký nào</p>
          </div>
        ) : (
          paginatedSubs.map((s) => {
            const days = daysRemaining(s.endDate);
            const isActive = s.status === "active" && days > 0;
            const isExpiring = isActive && days <= 7;
            const daysColor = s.status === "expired" || days === 0 ? "#ef4444" : isExpiring ? "#f59e0b" : "#10b981";

            return (
              <div key={s.id} className="sub-card">
                <div className="sub-card-header">
                  <div className="sub-card-plan">
                    <CreditCard size={16} />
                    <span>{s.planName}</span>
                  </div>
                  <StatusBadge status={s.status} />
                </div>

                <div className="sub-card-user">
                  <div className="sub-user-avatar">
                    {(s.user?.name ?? "U").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="sub-user-info">
                    <span className="sub-user-name">{s.user?.name ?? "—"}</span>
                    <span className="sub-user-email">{s.user?.email ?? ""}</span>
                  </div>
                </div>

                <div className="sub-card-vehicle">
                  <span className="sub-plate">{s.primaryVehicle?.plate ?? "—"}</span>
                  <span className="sub-member-code">{s.memberCode ?? "—"}</span>
                </div>

                <div className="sub-card-stats">
                  <div className="sub-stat">
                    <span className="sub-stat-label">Hết hạn</span>
                    <span className="sub-stat-value">{formatDate(s.endDate)}</span>
                  </div>
                  <div className="sub-stat">
                    <span className="sub-stat-label">Còn lại</span>
                    <span className="sub-stat-value" style={{ color: daysColor }}>
                      {days > 0 ? `${days} ngày` : "Hết hạn"}
                    </span>
                  </div>
                </div>

                <div className="sub-card-actions">
                  <button className="sub-action-btn view" onClick={() => setViewingSub(s)} type="button">
                    Chi tiết
                  </button>
                  {s.status === "active" && (
                    <button
                      className="sub-action-btn cancel"
                      onClick={() => handleCancel(s.id)}
                      disabled={cancellingId === s.id}
                      type="button"
                    >
                      {cancellingId === s.id ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />}
                      Hủy
                    </button>
                  )}
                  <button
                    className="sub-action-btn delete"
                    onClick={() => {
                      if (confirmDeleteId === s.id) {
                        handleConfirmDelete(s.id);
                      } else {
                        setConfirmDeleteId(s.id);
                        setTimeout(() => setConfirmDeleteId((cur) => (cur === s.id ? null : cur)), 4000);
                      }
                    }}
                    disabled={deletingId === s.id}
                    type="button"
                  >
                    {deletingId === s.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                    {confirmDeleteId === s.id ? "Xác nhận?" : "Xóa"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="sub-pagination">
          <button
            className="sub-page-btn"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="sub-page-info">
            Trang {currentPage} / {totalPages}
          </div>
          <button
            className="sub-page-btn"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            type="button"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!viewingSub} onClose={() => setViewingSub(null)} title="Chi tiết đăng ký">
        {viewingSub && (
          <div className="sub-detail-modal">
            <div className="sub-detail-header">
              <div className="sub-detail-plan">
                <CreditCard size={20} />
                <span>{viewingSub.planName}</span>
              </div>
              <StatusBadge status={viewingSub.status} />
            </div>

            <div className="sub-detail-section">
              <h4>Khách hàng</h4>
              <div className="sub-detail-row">
                <span>Tên</span>
                <span>{viewingSub.user?.name ?? "—"}</span>
              </div>
              <div className="sub-detail-row">
                <span>Email</span>
                <span>{viewingSub.user?.email ?? "—"}</span>
              </div>
            </div>

            <div className="sub-detail-section">
              <h4>Thông tin gói</h4>
              <div className="sub-detail-row">
                <span>Mã thành viên</span>
                <span className="mono">{viewingSub.memberCode ?? "—"}</span>
              </div>
              <div className="sub-detail-row">
                <span>Ngày bắt đầu</span>
                <span>{formatDate(viewingSub.startDate)}</span>
              </div>
              <div className="sub-detail-row">
                <span>Ngày hết hạn</span>
                <span>{formatDate(viewingSub.endDate)}</span>
              </div>
              <div className="sub-detail-row">
                <span>Còn lại</span>
                <span style={{ color: daysRemaining(viewingSub.endDate) > 0 ? "#10b981" : "#ef4444" }}>
                  {daysRemaining(viewingSub.endDate)} ngày
                </span>
              </div>
            </div>

            <div className="sub-detail-section">
              <h4>Xe đăng ký</h4>
              <div className="sub-detail-row">
                <span>Biển số</span>
                <span className="mono">{viewingSub.primaryVehicle?.plate ?? "—"}</span>
              </div>
            </div>

            <div className="sub-detail-actions">
              <button className="sub-cancel-btn" type="button" onClick={() => setViewingSub(null)}>
                Đóng
              </button>
              {viewingSub.status === "active" && (
                <button
                  className="sub-danger-btn"
                  type="button"
                  onClick={() => { handleCancel(viewingSub.id); setViewingSub(null); }}
                >
                  <XCircle size={16} />
                  Hủy gói
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
