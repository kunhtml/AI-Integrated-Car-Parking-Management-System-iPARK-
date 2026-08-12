"use client";

import {
  AlertCircle,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock4,
  IdCard,
  Loader2,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { showError, showSuccess } from "@/lib/toast";
import {
  cancelMyStaffApplication,
  fetchMyStaffApplication,
} from "@/lib/staff-application-api";
import type { StaffApplication } from "@/types";

import { StaffApplicationModal } from "./staff-application-modal";

const STATUS_LABELS: Record<
  StaffApplication["status"],
  { label: string; bg: string; color: string; icon: typeof Clock4 }
> = {
  pending: {
    label: "Đang chờ duyệt",
    bg: "rgba(245,158,11,0.1)",
    color: "#f59e0b",
    icon: Clock4,
  },
  approved: {
    label: "Đã được duyệt",
    bg: "rgba(34,197,94,0.1)",
    color: "#22c55e",
    icon: CheckCircle2,
  },
  draft: {
    label: "Bản nháp",
    bg: "rgba(148,163,184,0.15)",
    color: "#64748b",
    icon: Briefcase,
  },
  rejected: {
    label: "Đã từ chối",
    bg: "rgba(239,68,68,0.1)",
    color: "#ef4444",
    icon: XCircle,
  },
  cancelled: {
    label: "Đã hủy",
    bg: "rgba(148,163,184,0.15)",
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
  const info = STATUS_LABELS[status];
  const Icon = info.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: info.bg,
        color: info.color,
        fontSize: "0.78rem",
        fontWeight: 700,
      }}
    >
      <Icon size={14} />
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

export function StaffApplicationCard() {
  const [application, setApplication] = useState<StaffApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyStaffApplication();
      setApplication(data.application);
    } catch (err) {
      console.error(err);
      showError(
        err instanceof Error
          ? `Không tải được đơn: ${err.message}`
          : "Không tải được đơn đăng ký.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleCancel() {
    if (!application) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Bạn có chắc muốn hủy đơn đăng ký đang chờ duyệt?",
      );
      if (!ok) return;
    }
    setCancelling(true);
    try {
      const updated = await cancelMyStaffApplication();
      setApplication(updated);
      showSuccess("Đã hủy đơn đăng ký làm nhân viên.");
    } catch (err) {
      showError(
        err instanceof Error
          ? `Lỗi khi hủy đơn: ${err.message}`
          : "Lỗi khi hủy đơn, vui lòng thử lại.",
      );
    } finally {
      setCancelling(false);
    }
  }

  function handleSubmitted(next: StaffApplication) {
    setApplication(next);
    setModalOpen(false);
  }

  const canApply =
    !application ||
    application.status === "rejected" ||
    application.status === "cancelled";

  return (
    <section
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid var(--border, #e2e6ef)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--muted)",
              margin: "0 0 2px",
            }}
          >
            Cơ hội nghề nghiệp
          </p>
          <h2
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Briefcase size={18} style={{ color: "var(--primary)" }} />
            Đăng ký làm nhân viên
          </h2>
        </div>
        {application && <StatusBadge status={application.status} />}
      </div>

      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "16px 0",
            color: "var(--muted)",
            fontSize: "0.88rem",
          }}
        >
          <Loader2 size={14} className="animate-spin" /> Đang tải đơn đăng ký...
        </div>
      ) : !application ? (
        <NoApplication onApply={() => setModalOpen(true)} />
      ) : application.status === "pending" ? (
        <PendingView
          application={application}
          cancelling={cancelling}
          onCancel={handleCancel}
        />
      ) : application.status === "approved" ? (
        <ApprovedView application={application} />
      ) : (
        <RejectedView
          application={application}
          canReapply={canApply}
          onApply={() => setModalOpen(true)}
        />
      )}

      {modalOpen && (
        <StaffApplicationModal
          existing={application}
          onClose={() => setModalOpen(false)}
          onSubmitted={handleSubmitted}
        />
      )}
    </section>
  );
}

function NoApplication({ onApply }: { onApply: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p
        style={{
          margin: 0,
          fontSize: "0.88rem",
          color: "var(--muted)",
          lineHeight: 1.55,
        }}
      >
        Trở thành nhân viên vận hành của hệ thống bãi đỗ xe. Bạn sẽ được hỗ trợ
        đào tạo nghiệp vụ, làm việc theo ca linh hoạt và nhận thưởng theo hiệu
        suất. Đơn đăng ký sẽ được quản trị viên xét duyệt.
      </p>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: "0.85rem",
          color: "var(--muted)",
          lineHeight: 1.7,
        }}
      >
        <li>Hỗ trợ khách hàng và xử lý phiên đỗ xe.</li>
        <li>Theo dõi camera, cảnh báo sự cố.</li>
        <li>Ca làm linh hoạt: sáng, chiều, tối hoặc tùy chọn.</li>
      </ul>
      <div>
        <button
          type="button"
          onClick={onApply}
          className="full-button"
          style={{ minWidth: 200 }}
        >
          <Send size={14} />
          Đăng ký làm nhân viên
        </button>
      </div>
    </div>
  );
}

function PendingView({
  application,
  cancelling,
  onCancel,
}: {
  application: StaffApplication;
  cancelling: boolean;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.2)",
          color: "#92400e",
          fontSize: "0.85rem",
        }}
      >
        <CalendarClock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          Đơn của bạn đang được quản trị viên xét duyệt. Vui lòng chờ phản hồi
          qua email hoặc thông báo trong hệ thống.
        </div>
      </div>

      <ApplicationSummary application={application} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="small-button danger"
          style={{ opacity: cancelling ? 0.6 : 1 }}
        >
          {cancelling ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <XCircle size={12} />
          )}
          {cancelling ? "Đang hủy..." : "Hủy đơn"}
        </button>
      </div>
    </div>
  );
}

function ApprovedView({ application }: { application: StaffApplication }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.2)",
          color: "#166534",
          fontSize: "0.85rem",
        }}
      >
        <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          Đơn của bạn đã được phê duyệt. Bạn đang làm <b>Nhân viên</b>
        </div>
      </div>

      <ApplicationSummary application={application} />

      {application.reviewNote && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--surface-2, #f5f6fa)",
            fontSize: "0.82rem",
            color: "var(--text, #0f172a)",
          }}
        >
          <b>Ghi chú của quản trị viên:</b> {application.reviewNote}
        </div>
      )}
    </div>
  );
}

function RejectedView({
  application,
  canReapply,
  onApply,
}: {
  application: StaffApplication;
  canReapply: boolean;
  onApply: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "#991b1b",
          fontSize: "0.85rem",
        }}
      >
        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          Đơn của bạn chưa được duyệt. Vui lòng kiểm tra ghi chú và gửi lại nếu
          muốn.
        </div>
      </div>

      <ApplicationSummary application={application} />

      {application.reviewNote && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--surface-2, #f5f6fa)",
            fontSize: "0.82rem",
            color: "var(--text, #0f172a)",
          }}
        >
          <b>Lý do từ chối:</b> {application.reviewNote}
          <div style={{ marginTop: 6, fontSize: "0.76rem" }}>
            Bạn có thể chỉnh sửa và gửi lại chính đơn này. Lần gửi lại: {application.resubmitCount ?? 0}.
          </div>
        </div>
      )}

      {canReapply && (
        <div>
          <button
            type="button"
            onClick={onApply}
            className="full-button"
            style={{ minWidth: 200 }}
          >
            <Send size={14} />
            Chỉnh sửa / Bổ sung và gửi lại
          </button>
        </div>
      )}
    </div>
  );
}

function ApplicationSummary({
  application,
}: {
  application: StaffApplication;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 10,
        background: "var(--surface-2, #f5f6fa)",
        border: "1px solid var(--border, #e2e6ef)",
      }}
    >
      <SummaryItem
        icon={<Phone size={14} />}
        label="Số điện thoại"
        value={application.phone}
      />
      <SummaryItem
        icon={<IdCard size={14} />}
        label="CCCD/CMND"
        value={application.idCardNumber}
      />
      <SummaryItem
        icon={<MapPin size={14} />}
        label="Địa chỉ"
        value={application.address}
      />
      <SummaryItem
        icon={<Briefcase size={14} />}
        label="Ca làm"
        value={SHIFT_LABELS[application.preferredShift]}
      />
      <SummaryItem
        icon={<CalendarClock size={14} />}
        label="Ngày gửi"
        value={formatDate(application.createdAt)}
      />
      {application.reviewedAt && (
        <SummaryItem
          icon={<ShieldCheck size={14} />}
          label="Ngày duyệt"
          value={formatDate(application.reviewedAt)}
        />
      )}
    </div>
  );
}

function SummaryItem({
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
          fontWeight: 600,
          color: "var(--text, #0f172a)",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}
