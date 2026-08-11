"use client";

import {
  AlertCircle,
  Briefcase,
  CalendarClock,
  IdCard,
  Loader2,
  MapPin,
  Phone,
  Send,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { showError, showSuccess } from "@/lib/toast";
import {
  resubmitStaffApplication,
  saveStaffApplication,
  submitStaffApplication,
  type StaffApplicationFormPayload,
} from "@/lib/staff-application-api";
import type { StaffApplication, StaffApplicationShift } from "@/types";

const SHIFT_OPTIONS: { value: StaffApplicationShift; label: string }[] = [
  { value: "morning", label: "Ca sáng" },
  { value: "afternoon", label: "Ca chiều" },
  { value: "night", label: "Ca tối" },
  { value: "flexible", label: "Linh hoạt" },
];

type Props = {
  existing: StaffApplication | null;
  onClose: () => void;
  onSubmitted: (next: StaffApplication) => void;
};

type FormState = {
  phone: string;
  idCardNumber: string;
  address: string;
  experience: string;
  reason: string;
  preferredShift: StaffApplicationShift;
  confirmAccurate: boolean;
};

function validate(
  state: FormState,
): { field: keyof FormState; message: string } | null {
  const phone = state.phone.trim();
  if (!/^[0-9+\-\s()]{6,20}$/.test(phone)) {
    return {
      field: "phone",
      message: "Số điện thoại không hợp lệ (6-20 ký tự).",
    };
  }
  const idCard = state.idCardNumber.trim();
  if (!/^\d{9}$|^\d{12}$/.test(idCard)) {
    return {
      field: "idCardNumber",
      message: "CCCD/CMND phải gồm 9 hoặc 12 chữ số.",
    };
  }
  const address = state.address.trim();
  if (address.length < 5 || address.length > 255) {
    return { field: "address", message: "Địa chỉ từ 5 đến 255 ký tự." };
  }
  const reason = state.reason.trim();
  if (reason.length < 20 || reason.length > 1000) {
    return {
      field: "reason",
      message: "Lý do đăng ký từ 20 đến 1000 ký tự.",
    };
  }
  if (state.experience.trim().length > 1000) {
    return { field: "experience", message: "Kinh nghiệm tối đa 1000 ký tự." };
  }
  if (!state.confirmAccurate) {
    return {
      field: "confirmAccurate",
      message: "Vui lòng xác nhận thông tin chính xác.",
    };
  }
  return null;
}

export function StaffApplicationModal({
  existing,
  onClose,
  onSubmitted,
}: Props) {
  const [state, setState] = useState<FormState>({
    phone: "",
    idCardNumber: "",
    address: "",
    experience: "",
    reason: "",
    preferredShift: "flexible",
    confirmAccurate: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errField, setErrField] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setState({
      phone: existing.phone ?? "",
      idCardNumber: existing.idCardNumber ?? "",
      address: existing.address ?? "",
      experience: existing.experience ?? "",
      reason: existing.reason ?? "",
      preferredShift: existing.preferredShift ?? "flexible",
      confirmAccurate: false,
    });
  }, [existing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
    if (errField === key) {
      setErrField(null);
      setErrMsg(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const v = validate(state);
    if (v) {
      setErrField(v.field);
      setErrMsg(v.message);
      return;
    }
    setErrField(null);
    setErrMsg(null);
    setSubmitting(true);

    const payload: StaffApplicationFormPayload = {
      phone: state.phone.trim(),
      idCardNumber: state.idCardNumber.trim(),
      address: state.address.trim(),
      experience: state.experience.trim() || undefined,
      reason: state.reason.trim(),
      preferredShift: state.preferredShift,
    };

    try {
      let next: StaffApplication;
      if (existing) {
        await saveStaffApplication(existing.id, payload);
        next = await resubmitStaffApplication(existing.id);
        showSuccess("Đã cập nhật và gửi lại chính đơn đăng ký cũ.");
      } else {
        next = await submitStaffApplication(payload);
        showSuccess("Đã gửi đơn đăng ký làm nhân viên.");
      }
      onSubmitted(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lỗi máy chủ.";
      showError(`Không gửi được đơn: ${message}`);
      setErrMsg(message);
    } finally {
      setSubmitting(false);
    }
  }

  const title = existing
    ? "Đăng ký lại làm nhân viên"
    : "Đơn đăng ký làm nhân viên";

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
          maxWidth: 520,
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
            alignItems: "center",
            marginBottom: 16,
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(59,130,246,0.1)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Briefcase size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                {title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                }}
              >
                Vui lòng điền đầy đủ thông tin bên dưới.
              </p>
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
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <Field
            label="Số điện thoại"
            icon={<Phone size={14} />}
            error={errField === "phone" ? errMsg : null}
          >
            <input
              type="tel"
              value={state.phone}
              disabled={submitting}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="VD: 0901234567"
              style={inputStyle(errField === "phone")}
            />
          </Field>

          <Field
            label="Số CCCD/CMND"
            icon={<IdCard size={14} />}
            error={errField === "idCardNumber" ? errMsg : null}
          >
            <input
              type="text"
              inputMode="numeric"
              value={state.idCardNumber}
              disabled={submitting}
              onChange={(e) =>
                update(
                  "idCardNumber",
                  e.target.value.replace(/\D/g, "").slice(0, 12),
                )
              }
              placeholder="9 hoặc 12 chữ số"
              maxLength={12}
              style={inputStyle(errField === "idCardNumber")}
            />
          </Field>

          <Field
            label="Địa chỉ"
            icon={<MapPin size={14} />}
            error={errField === "address" ? errMsg : null}
          >
            <input
              type="text"
              value={state.address}
              disabled={submitting}
              onChange={(e) => update("address", e.target.value)}
              placeholder="VD: Quận 1, TP.HCM"
              style={inputStyle(errField === "address")}
            />
          </Field>

          <Field
            label="Kinh nghiệm làm việc (không bắt buộc)"
            icon={<CalendarClock size={14} />}
          >
            <textarea
              value={state.experience}
              disabled={submitting}
              onChange={(e) => update("experience", e.target.value)}
              placeholder="Mô tả ngắn gọn kinh nghiệm (nếu có)..."
              rows={3}
              style={{
                ...inputStyle(false),
                fontFamily: "inherit",
                resize: "vertical",
                minHeight: 64,
              }}
            />
          </Field>

          <Field
            label="Lý do đăng ký"
            icon={<Briefcase size={14} />}
            error={errField === "reason" ? errMsg : null}
          >
            <textarea
              value={state.reason}
              disabled={submitting}
              onChange={(e) => update("reason", e.target.value)}
              placeholder="Tối thiểu 20 ký tự. Vui lòng mô tả lý do bạn muốn trở thành nhân viên..."
              rows={4}
              style={{
                ...inputStyle(errField === "reason"),
                fontFamily: "inherit",
                resize: "vertical",
                minHeight: 80,
              }}
            />
            <div
              style={{
                fontSize: "0.72rem",
                color: state.reason.length > 1000 ? "#ef4444" : "var(--muted)",
                marginTop: 2,
                textAlign: "right",
              }}
            >
              {state.reason.length}/1000
            </div>
          </Field>

          <Field label="Ca làm mong muốn" icon={<CalendarClock size={14} />}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                gap: 8,
              }}
            >
              {SHIFT_OPTIONS.map((opt) => {
                const selected = state.preferredShift === opt.value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => update("preferredShift", opt.value)}
                    disabled={submitting}
                    style={{
                      padding: "10px 8px",
                      borderRadius: 8,
                      border: `1px solid ${selected ? "var(--primary)" : "var(--border, #e2e6ef)"}`,
                      background: selected
                        ? "rgba(59,130,246,0.08)"
                        : "var(--surface)",
                      color: selected
                        ? "var(--primary)"
                        : "var(--text, #0f172a)",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: submitting ? "not-allowed" : "pointer",
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: "0.85rem",
              color: "var(--text, #0f172a)",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${errField === "confirmAccurate" ? "rgba(239,68,68,0.4)" : "var(--border, #e2e6ef)"}`,
              background: state.confirmAccurate
                ? "rgba(34,197,94,0.05)"
                : "var(--surface)",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={state.confirmAccurate}
              disabled={submitting}
              onChange={(e) => update("confirmAccurate", e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              Tôi xác nhận các thông tin trên là chính xác và đồng ý để quản trị
              viên xét duyệt.
            </span>
          </label>

          {errMsg && !errField && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#ef4444",
                fontSize: "0.82rem",
              }}
            >
              <AlertCircle size={14} /> {errMsg}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="small-button"
              style={{ flex: 1 }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="full-button"
              style={{
                flex: 1,
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? "wait" : "pointer",
              }}
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {submitting ? "Đang gửi..." : "Gửi đơn đăng ký"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${hasError ? "rgba(239,68,68,0.5)" : "var(--border, #e2e6ef)"}`,
    borderRadius: 8,
    fontSize: "0.9rem",
    background: "var(--surface)",
    color: "var(--text, #0f172a)",
    boxSizing: "border-box",
    outline: "none",
  };
}

function Field({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
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
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon}
        {label}
      </span>
      {children}
      {error && (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.74rem",
            color: "#ef4444",
            fontWeight: 500,
            marginTop: 2,
          }}
        >
          <AlertCircle size={12} /> {error}
        </span>
      )}
    </label>
  );
}
