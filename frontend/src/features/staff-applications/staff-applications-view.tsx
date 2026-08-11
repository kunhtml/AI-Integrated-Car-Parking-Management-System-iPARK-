"use client";

import {
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock4,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { showError, showSuccess } from "@/lib/toast";
import {
  fetchAdminStaffApplications,
  maskIdCard,
  fetchStaffApplicationHistory,
  reviewStaffApplication,
} from "@/lib/staff-application-api";
import type { StaffApplication, StaffApplicationHistory } from "@/types";

const STATUS_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Đang chờ" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Đã từ chối" },
  { value: "cancelled", label: "Đã hủy" },
] as const;

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<
  StaffApplication["status"],
  { label: string; bg: string; color: string; icon: typeof Clock4 }
> = {
  draft: {
    label: "Bản nháp",
    bg: "rgba(148,163,184,0.18)",
    color: "#64748b",
    icon: Briefcase,
  },
  pending: {
    label: "Đang chờ",
    bg: "rgba(245,158,11,0.12)",
    color: "#f59e0b",
    icon: Clock4,
  },
  approved: {
    label: "Đã duyệt",
    bg: "rgba(34,197,94,0.12)",
    color: "#22c55e",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Đã từ chối",
    bg: "rgba(239,68,68,0.12)",
    color: "#ef4444",
    icon: XCircle,
  },
  cancelled: {
    label: "Đã hủy",
    bg: "rgba(148,163,184,0.18)",
    color: "#64748b",
    icon: XCircle,
  },
};

const SHIFT_LABELS: Record<StaffApplication["preferredShift"], string> = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  night: "Ca tối",
  flexible: "Linh hoạt",
};

function StatusBadge({ status }: { status: StaffApplication["status"] }) {
  const info = STATUS_STYLES[status];
  const Icon = info.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 999,
        background: info.bg,
        color: info.color,
        fontSize: "0.78rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={13} />
      {info.label}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StaffApplicationsView() {
  const [applications, setApplications] = useState<StaffApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<
    "all" | "pending" | "approved" | "rejected" | "cancelled"
  >("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<StaffApplication | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminStaffApplications({
        status: status === "all" ? undefined : status,
        search: search.trim() || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setApplications(data.applications ?? []);
      setTotal(data.total ?? data.applications?.length ?? 0);
    } catch (err) {
      showError(
        err instanceof Error
          ? `Không tải được danh sách: ${err.message}`
          : "Không tải được danh sách đơn.",
      );
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Reset về trang 1 khi filter thay đổi
  useEffect(() => {
    setPage(1);
  }, [status, search]);

  return (
    <section className="content-single" style={{ padding: "0 0 32px" }}>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Quản trị</p>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Briefcase size={20} style={{ color: "var(--primary)" }} />
              Đơn đăng ký làm nhân viên
            </h2>
          </div>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="small-button"
            title="Làm mới"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Làm mới
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {STATUS_OPTIONS.map((opt) => {
              const active = status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: `1px solid ${active ? "var(--primary)" : "var(--border, #e2e6ef)"}`,
                    background: active
                      ? "rgba(59,130,246,0.08)"
                      : "var(--surface)",
                    color: active ? "var(--primary)" : "var(--text, #0f172a)",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, email, SĐT..."
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                border: "1px solid var(--border, #e2e6ef)",
                borderRadius: 8,
                fontSize: "0.85rem",
                background: "var(--surface)",
                color: "var(--text, #0f172a)",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {loading ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: "0.88rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Loader2 size={14} className="animate-spin" /> Đang tải danh sách...
          </div>
        ) : applications.length === 0 ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            Không có đơn đăng ký nào phù hợp.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 12,
            }}
          >
            {applications.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onOpen={() => setSelected(app)}
              />
            ))}
          </div>
        )}

        {total > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 16,
              gap: 8,
              fontSize: "0.85rem",
              color: "var(--muted)",
              flexWrap: "wrap",
            }}
          >
            <span>
              Trang {page}/{totalPages} — Tổng {total} đơn
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="small-button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft size={12} /> Trước
              </button>
              <button
                type="button"
                className="small-button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                Sau <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <ApplicationReviewModal
          application={selected}
          onClose={() => setSelected(null)}
          onReviewed={(updated) => {
            setApplications((prev) =>
              prev.map((a) => (a.id === updated.id ? updated : a)),
            );
            setSelected(null);
            reload();
          }}
        />
      )}
    </section>
  );
}

function ApplicationCard({
  application,
  onOpen,
}: {
  application: StaffApplication;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        textAlign: "left",
        padding: 16,
        borderRadius: 12,
        border: "1px solid var(--border, #e2e6ef)",
        background: "var(--surface)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--primary)";
        e.currentTarget.style.background = "rgba(59,130,246,0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border, #e2e6ef)";
        e.currentTarget.style.background = "var(--surface)";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary), #6366f1)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {application.user?.name?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.92rem",
                color: "var(--text, #0f172a)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {application.user?.name ?? "Người dùng"}
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {application.user?.email ?? "—"}
            </div>
          </div>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          fontSize: "0.82rem",
          color: "var(--text, #0f172a)",
        }}
      >
        <InfoLine icon={<Phone size={12} />} text={application.phone} />
        <InfoLine
          icon={<IdCard size={12} />}
          text={maskIdCard(application.idCardNumber)}
        />
        <InfoLine
          icon={<Briefcase size={12} />}
          text={SHIFT_LABELS[application.preferredShift]}
        />
        <InfoLine
          icon={<Clock4 size={12} />}
          text={formatDate(application.createdAt)}
        />
      </div>

      <div
        style={{
          fontSize: "0.82rem",
          color: "var(--muted)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        <b style={{ color: "var(--text, #0f172a)" }}>Lý do:</b>{" "}
        {application.reason}
      </div>
    </button>
  );
}

function InfoLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {text}
      </span>
    </span>
  );
}

function ApplicationReviewModal({
  application,
  onClose,
  onReviewed,
}: {
  application: StaffApplication;
  onClose: () => void;
  onReviewed: (next: StaffApplication) => void;
}) {
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(
    application.status === "pending"
      ? null
      : application.status === "approved"
        ? "approved"
        : "rejected",
  );
  const [note, setNote] = useState(application.reviewNote ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<StaffApplicationHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    setHistory([]);
    setHistoryLoading(true);
    fetchStaffApplicationHistory(application.id, true)
      .then(setHistory)
      .catch((err) => showError(err instanceof Error ? err.message : "Không tải được lịch sử đơn."))
      .finally(() => setHistoryLoading(false));
  }, [application.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const isReadOnly = application.status !== "pending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || isReadOnly) return;
    if (!decision) {
      showError("Vui lòng chọn duyệt hoặc từ chối.");
      return;
    }
    const trimmedNote = note.trim();
    if (decision === "rejected" && trimmedNote.length === 0) {
      showError("Vui lòng nhập lý do từ chối.");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await reviewStaffApplication(application.id, {
        decision,
        note: trimmedNote || undefined,
      });
      showSuccess(
        decision === "approved"
          ? "Đã duyệt đơn, tài khoản đã được nâng quyền nhân viên."
          : "Đã từ chối đơn.",
      );
      onReviewed(updated);
    } catch (err) {
      showError(
        err instanceof Error
          ? `Lỗi khi xét duyệt: ${err.message}`
          : "Lỗi khi xét duyệt đơn.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflowY: "auto",
      }}
      onClick={() => !submitting && onClose()}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 560,
          border: "1px solid var(--border, #e2e6ef)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          margin: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--primary), #6366f1)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "1.1rem",
                flexShrink: 0,
              }}
            >
              {application.user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
                Đơn đăng ký của {application.user?.name ?? "người dùng"}
              </h3>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "var(--muted)",
                  marginTop: 2,
                }}
              >
                <StatusBadge status={application.status} />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Đóng"
            style={{
              background: "none",
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              color: "var(--muted)",
              padding: 4,
              opacity: submitting ? 0.5 : 1,
            }}
          >
            <XCircle size={18} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            padding: 14,
            borderRadius: 10,
            background: "var(--surface-2, #f5f6fa)",
            marginBottom: 14,
            fontSize: "0.85rem",
          }}
        >
          <Field
            icon={<UserRound size={13} />}
            label="Họ tên"
            value={application.user?.name ?? "—"}
          />
          <Field
            icon={<Mail size={13} />}
            label="Email"
            value={application.user?.email ?? "—"}
          />
          <Field
            icon={<Phone size={13} />}
            label="Số điện thoại"
            value={application.phone}
          />
          <Field
            icon={<IdCard size={13} />}
            label="CCCD/CMND"
            value={maskIdCard(application.idCardNumber)}
          />
          <Field
            icon={<Briefcase size={13} />}
            label="Ca làm"
            value={SHIFT_LABELS[application.preferredShift]}
          />
          <Field
            icon={<Clock4 size={13} />}
            label="Ngày gửi"
            value={formatDate(application.createdAt)}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <Field
              icon={<MapPin size={13} />}
              label="Địa chỉ"
              value={application.address}
            />
          </div>
          {application.experience && (
            <div style={{ gridColumn: "1 / -1" }}>
              <Field
                icon={<Briefcase size={13} />}
                label="Kinh nghiệm"
                value={application.experience}
              />
            </div>
          )}
          <div style={{ gridColumn: "1 / -1" }}>
            <Field
              icon={<Briefcase size={13} />}
              label="Lý do đăng ký"
              value={application.reason}
            />
          </div>
          {application.reviewNote && (
            <div style={{ gridColumn: "1 / -1" }}>
              <Field
                icon={<ShieldCheck size={13} />}
                label="Ghi chú của quản trị viên"
                value={application.reviewNote}
              />
            </div>
          )}
          {application.reviewedAt && application.reviewedByName && (
            <div style={{ gridColumn: "1 / -1" }}>
              <Field
                icon={<ShieldCheck size={13} />}
                label="Người duyệt"
                value={`${application.reviewedByName} • ${formatDate(application.reviewedAt)}`}
              />
            </div>
          )}
        </div>

        <div
          style={{
            marginBottom: 14,
            padding: 14,
            borderRadius: 10,
            border: "1px solid var(--border, #e2e6ef)",
            background: "var(--surface)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 8 }}>
            Lịch sử xử lý đơn
          </div>
          {historyLoading ? (
            <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Đang tải lịch sử...</div>
          ) : history.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Chưa có lịch sử.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((entry) => (
                <div key={entry.id} style={{ fontSize: "0.8rem", borderLeft: "2px solid var(--primary)", paddingLeft: 10 }}>
                  <b>{entry.action}</b> · {entry.oldStatus ?? "—"} → {entry.newStatus}
                  <div style={{ color: "var(--muted)", marginTop: 2 }}>
                    {formatDate(entry.createdAt)}{entry.note ? ` · ${entry.note}` : ""}
                  </div>
                  {entry.changedFields.length > 0 && (
                    <div style={{ color: "var(--muted)", marginTop: 2 }}>
                      Thay đổi: {entry.changedFields.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!isReadOnly && (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text, #0f172a)",
              }}
            >
              Quyết định xét duyệt
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <ChoiceButton
                active={decision === "approved"}
                disabled={submitting}
                onClick={() => setDecision("approved")}
                color="#22c55e"
                icon={<CheckCircle2 size={16} />}
                label="Duyệt đơn"
              />
              <ChoiceButton
                active={decision === "rejected"}
                disabled={submitting}
                onClick={() => setDecision("rejected")}
                color="#ef4444"
                icon={<XCircle size={16} />}
                label="Từ chối"
              />
            </div>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--muted)",
              }}
            >
              Ghi chú{" "}
              {decision === "rejected" ? "(bắt buộc)" : "(không bắt buộc)"}
              <textarea
                value={note}
                disabled={submitting}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={
                  decision === "rejected"
                    ? "Nhập lý do từ chối..."
                    : "Ghi chú cho người đăng ký (nếu có)..."
                }
                style={{
                  padding: "10px 12px",
                  border: "1px solid var(--border, #e2e6ef)",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  background: "var(--surface)",
                  color: "var(--text, #0f172a)",
                  fontFamily: "inherit",
                  resize: "vertical",
                  minHeight: 72,
                }}
              />
            </label>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="small-button"
                style={{ flex: 1 }}
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={submitting || !decision}
                className="full-button"
                style={{
                  flex: 1,
                  opacity: submitting || !decision ? 0.7 : 1,
                  cursor: submitting || !decision ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {submitting ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </form>
        )}

        {isReadOnly && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button type="button" onClick={onClose} className="small-button">
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.7rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--muted)",
          marginBottom: 2,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: "0.85rem",
          color: "var(--text, #0f172a)",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ChoiceButton({
  active,
  disabled,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  color: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${active ? color : "var(--border, #e2e6ef)"}`,
        background: active ? `${color}1A` : "var(--surface)",
        color: active ? color : "var(--text, #0f172a)",
        fontWeight: 700,
        fontSize: "0.88rem",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
