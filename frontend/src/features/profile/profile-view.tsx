"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Eye,
  EyeOff,
  HelpCircle,
  IdCard,
  Image,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Save,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { roleLabels } from "@/lib/constants";
import type { DemoUser } from "@/types";

import { StaffApplicationCard } from "./staff-application-card";

// ─── Helpers ───────────────────────────────────────────────────────
function AlertBanner({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        borderRadius: 10,
        background:
          type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
        border: `1px solid ${type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
        color: type === "success" ? "#22c55e" : "#ef4444",
        fontSize: "0.88rem",
        fontWeight: 500,
      }}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} />
      ) : (
        <AlertCircle size={16} />
      )}
      {message}
    </div>
  );
}

function FieldRow({
  label,
  value,
  icon: Icon,
  editable,
  onEdit,
  editing,
}: {
  label: string;
  value?: string | number;
  icon?: React.ElementType;
  editable?: boolean;
  onEdit?: () => void;
  editing?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: "1px solid var(--border, #e2e6ef)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flex: 1,
          minWidth: 0,
        }}
      >
        {Icon && (
          <Icon size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--muted)",
              marginBottom: 2,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: "0.92rem",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {value ?? "—"}
          </div>
        </div>
      </div>
      {editable && onEdit && (
        <button
          onClick={onEdit}
          type="button"
          title={`Chỉnh sửa ${label}`}
          aria-label={`Chỉnh sửa ${label}`}
          style={{
            background: editing ? "rgba(59,130,246,0.12)" : "transparent",
            border: "1px solid var(--border, #e2e6ef)",
            cursor: "pointer",
            color: editing ? "var(--primary)" : "var(--muted)",
            padding: "6px 12px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.78rem",
            fontWeight: 600,
            transition: "all 0.15s ease",
            marginLeft: 12,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!editing) {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = "var(--primary)";
              el.style.background = "rgba(59,130,246,0.08)";
              el.style.borderColor = "rgba(59,130,246,0.3)";
            }
          }}
          onMouseLeave={(e) => {
            if (!editing) {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = "var(--muted)";
              el.style.background = "transparent";
              el.style.borderColor = "var(--border, #e2e6ef)";
            }
          }}
        >
          <Edit2 size={12} />
          Sửa
        </button>
      )}
    </div>
  );
}

function EditFieldModal({
  label,
  value,
  field,
  type,
  onSave,
  onClose,
}: {
  label: string;
  value?: string;
  field: string;
  type?: string;
  onSave: (field: string, value: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(value ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const trimmed = val.trim();
    if (!trimmed) {
      setError("Vui lòng nhập giá trị.");
      return;
    }
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Email không hợp lệ.");
      return;
    }
    if (field === "phone" && !/^[0-9+\-\s()]{6,20}$/.test(trimmed)) {
      setError("Số điện thoại không hợp lệ.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSave(field, trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi lưu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(255,255,255,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={() => !loading && onClose()}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 400,
          border: "1px solid var(--border, #e2e6ef)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
            Chỉnh sửa {label}
          </h3>
          <button
            onClick={onClose}
            type="button"
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              color: "var(--muted)",
              padding: 4,
              opacity: loading ? 0.5 : 1,
            }}
          >
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={handleSave}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
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
            {label}
            <input
              type={type ?? "text"}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              disabled={loading}
              style={{
                padding: "10px 12px",
                border: "1px solid var(--border, #e2e6ef)",
                borderRadius: 8,
                fontSize: "0.9rem",
                background: "var(--surface)",
                color: "var(--text, #0f172a)",
                opacity: loading ? 0.6 : 1,
              }}
              autoFocus
            />
          </label>
          {error && (
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
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="small-button"
              style={{ flex: 1 }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="full-button"
              style={{
                flex: 1,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {loading ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Forgot Password Modal ───────────────────────────────────────
function ForgotPasswordModal({
  defaultEmail,
  onClose,
}: {
  defaultEmail?: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function reset() {
    setStep("email");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setMsg(null);
    setDevOtp(null);
    setResendCooldown(0);
  }

  function handleClose() {
    if (loading) return;
    onClose();
  }

  async function handleRequestOtp(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim()) {
      setMsg({ text: "Vui lòng nhập email.", type: "error" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMsg({ text: "Email không hợp lệ.", type: "error" });
      return;
    }
    setLoading(true);
    setMsg(null);
    setDevOtp(null);
    try {
      const r = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg({ text: d.message || "Không gửi được OTP.", type: "error" });
        return;
      }
      setMsg({
        text: d.message || "Nếu email tồn tại, OTP đã được gửi.",
        type: "success",
      });
      if (typeof d.devOtp === "string" && d.devOtp) {
        setDevOtp(d.devOtp);
        setOtp(d.devOtp);
      }
      setStep("reset");
      setResendCooldown(60);
    } catch {
      setMsg({ text: "Lỗi kết nối máy chủ.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    await handleRequestOtp();
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setMsg({ text: "Mã OTP gồm 6 chữ số.", type: "error" });
      return;
    }
    if (newPassword.length < 6) {
      setMsg({ text: "Mật khẩu mới tối thiểu 6 ký tự.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ text: "Xác nhận mật khẩu không khớp.", type: "error" });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const r = await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          otp,
          password: newPassword,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg({
          text: d.message || "Đặt lại mật khẩu thất bại.",
          type: "error",
        });
        return;
      }
      setMsg({
        text: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.",
        type: "success",
      });
      setTimeout(() => onClose(), 1500);
    } catch {
      setMsg({ text: "Lỗi kết nối máy chủ.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        background: "rgba(255,255,255,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 420,
          border: "1px solid var(--border, #e2e6ef)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
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
              <HelpCircle size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                {step === "email" ? "Quên mật khẩu" : "Đặt lại mật khẩu"}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                }}
              >
                {step === "email"
                  ? "Nhập email để nhận mã OTP xác minh."
                  : `Mã OTP đã gửi tới ${email}.`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            type="button"
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              color: "var(--muted)",
              padding: 4,
              opacity: loading ? 0.5 : 1,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {step === "email" ? (
          <form
            onSubmit={handleRequestOtp}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
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
              Email
              <div style={{ position: "relative" }}>
                <input
                  type="email"
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--border, #e2e6ef)",
                    borderRadius: 8,
                    fontSize: "0.9rem",
                    background: "var(--surface)",
                    color: "var(--text, #0f172a)",
                    boxSizing: "border-box",
                    opacity: loading ? 0.6 : 1,
                  }}
                  autoFocus
                />
              </div>
            </label>

            {msg && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background:
                    msg.type === "success"
                      ? "rgba(34,197,94,0.08)"
                      : "rgba(239,68,68,0.08)",
                  border: `1px solid ${msg.type === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                  color: msg.type === "success" ? "#22c55e" : "#ef4444",
                  fontSize: "0.82rem",
                }}
              >
                {msg.type === "success" ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <AlertCircle size={14} />
                )}
                {msg.text}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="small-button"
                style={{ flex: 1 }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="full-button"
                style={{
                  flex: 1,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {loading ? "Đang gửi..." : "Gửi mã OTP"}
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleReset}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
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
              Mã OTP (6 chữ số)
              <input
                type="text"
                value={otp}
                disabled={loading}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                maxLength={6}
                autoFocus
                style={{
                  padding: "12px",
                  border: "1px solid var(--border, #e2e6ef)",
                  borderRadius: 8,
                  fontSize: "1.2rem",
                  fontFamily: "var(--font-geist-mono, monospace)",
                  letterSpacing: "0.25em",
                  textAlign: "center",
                  background: "var(--surface)",
                  color: "var(--text, #0f172a)",
                  opacity: loading ? 0.6 : 1,
                }}
              />
              {devOtp && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#f59e0b",
                    fontWeight: 500,
                    marginTop: 4,
                  }}
                >
                  Dev mode: OTP ={" "}
                  <b style={{ fontFamily: "monospace" }}>{devOtp}</b>
                </span>
              )}
            </label>

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
              Mật khẩu mới
              <div style={{ position: "relative" }}>
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  disabled={loading}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 12px",
                    border: "1px solid var(--border, #e2e6ef)",
                    borderRadius: 8,
                    fontSize: "0.9rem",
                    background: "var(--surface)",
                    color: "var(--text, #0f172a)",
                    boxSizing: "border-box",
                    opacity: loading ? 0.6 : 1,
                  }}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowNew((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--muted)",
                    padding: 4,
                  }}
                >
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

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
              Xác nhận mật khẩu mới
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  disabled={loading}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 12px",
                    border: "1px solid var(--border, #e2e6ef)",
                    borderRadius: 8,
                    fontSize: "0.9rem",
                    background: "var(--surface)",
                    color: "var(--text, #0f172a)",
                    boxSizing: "border-box",
                    opacity: loading ? 0.6 : 1,
                  }}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowConfirm((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--muted)",
                    padding: 4,
                  }}
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

            {msg && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background:
                    msg.type === "success"
                      ? "rgba(34,197,94,0.08)"
                      : "rgba(239,68,68,0.08)",
                  border: `1px solid ${msg.type === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                  color: msg.type === "success" ? "#22c55e" : "#ef4444",
                  fontSize: "0.82rem",
                }}
              >
                {msg.type === "success" ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <AlertCircle size={14} />
                )}
                {msg.text}
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: resendCooldown > 0 ? "var(--muted)" : "var(--primary)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor:
                    resendCooldown > 0 || loading ? "not-allowed" : "pointer",
                  textDecoration: "underline",
                }}
              >
                {resendCooldown > 0
                  ? `Gửi lại OTP (${resendCooldown}s)`
                  : "Gửi lại OTP"}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={reset}
                  disabled={loading}
                  className="small-button"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="full-button"
                  style={{
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <KeyRound size={14} />
                  )}
                  {loading ? "Đang lưu..." : "Đặt lại"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Change Password Modal (user đang đăng nhập) ─────────────────
function ChangePasswordModal({
  onClose,
  onLogout,
}: {
  onClose: () => void;
  onLogout?: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  function strength(pw: string) {
    if (pw.length < 6) return { level: 0, label: "" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { level: 1, label: "Yếu" };
    if (score === 2) return { level: 2, label: "Trung bình" };
    if (score === 3) return { level: 3, label: "Mạnh" };
    return { level: 4, label: "Rất mạnh" };
  }
  const pw = strength(newPassword);
  const strengthColors = ["", "#ef4444", "#f59e0b", "#22c55e", "#16a34a"];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      setMsg({ text: "Vui lòng nhập mật khẩu hiện tại.", type: "error" });
      return;
    }
    if (newPassword.length < 6) {
      setMsg({ text: "Mật khẩu mới tối thiểu 6 ký tự.", type: "error" });
      return;
    }
    if (newPassword === currentPassword) {
      setMsg({
        text: "Mật khẩu mới phải khác mật khẩu hiện tại.",
        type: "error",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ text: "Xác nhận mật khẩu không khớp.", type: "error" });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const r = await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ text: d.message || "Lỗi khi đổi mật khẩu.", type: "error" });
        return;
      }
      setMsg({
        text: "Đổi mật khẩu thành công. Bạn sẽ được đăng xuất để đăng nhập lại.",
        type: "success",
      });
      setTimeout(() => {
        onClose();
        onLogout?.();
      }, 1200);
    } catch {
      setMsg({ text: "Lỗi kết nối máy chủ.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        background: "rgba(255,255,255,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={() => !loading && onClose()}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 420,
          border: "1px solid var(--border, #e2e6ef)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
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
              <Lock size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                Đổi mật khẩu
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                }}
              >
                Nhập mật khẩu hiện tại và mật khẩu mới.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              color: "var(--muted)",
              padding: 4,
              opacity: loading ? 0.5 : 1,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
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
            Mật khẩu hiện tại
            <div style={{ position: "relative" }}>
              <input
                value={currentPassword}
                disabled={loading}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type={show.current ? "text" : "password"}
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 40px 10px 12px",
                  border: "1px solid var(--border, #e2e6ef)",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  background: "var(--surface)",
                  color: "var(--text, #0f172a)",
                  boxSizing: "border-box",
                  opacity: loading ? 0.6 : 1,
                }}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  padding: 4,
                }}
              >
                {show.current ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

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
            Mật khẩu mới
            <div style={{ position: "relative" }}>
              <input
                value={newPassword}
                disabled={loading}
                onChange={(e) => setNewPassword(e.target.value)}
                type={show.next ? "text" : "password"}
                minLength={6}
                style={{
                  width: "100%",
                  padding: "10px 40px 10px 12px",
                  border: "1px solid var(--border, #e2e6ef)",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  background: "var(--surface)",
                  color: "var(--text, #0f172a)",
                  boxSizing: "border-box",
                  opacity: loading ? 0.6 : 1,
                }}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => setShow((s) => ({ ...s, next: !s.next }))}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  padding: 4,
                }}
              >
                {show.next ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {newPassword && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <div style={{ display: "flex", gap: 3, flex: 1 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        background:
                          i <= pw.level
                            ? strengthColors[pw.level]
                            : "var(--border, #e2e6ef)",
                        transition: "background 0.2s",
                      }}
                    />
                  ))}
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: strengthColors[pw.level],
                    minWidth: 60,
                    textAlign: "right",
                  }}
                >
                  {pw.label}
                </span>
              </div>
            )}
          </label>

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
            Xác nhận mật khẩu mới
            <div style={{ position: "relative" }}>
              <input
                value={confirmPassword}
                disabled={loading}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type={show.confirm ? "text" : "password"}
                style={{
                  width: "100%",
                  padding: "10px 40px 10px 12px",
                  border: "1px solid var(--border, #e2e6ef)",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  background: "var(--surface)",
                  color: "var(--text, #0f172a)",
                  boxSizing: "border-box",
                  opacity: loading ? 0.6 : 1,
                  borderColor:
                    confirmPassword && confirmPassword !== newPassword
                      ? "#ef4444"
                      : undefined,
                }}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  padding: 4,
                }}
              >
                {show.confirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "#ef4444",
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                Mật khẩu xác nhận chưa khớp.
              </span>
            )}
          </label>

          {msg && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                background:
                  msg.type === "success"
                    ? "rgba(34,197,94,0.08)"
                    : "rgba(239,68,68,0.08)",
                border: `1px solid ${msg.type === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                color: msg.type === "success" ? "#22c55e" : "#ef4444",
                fontSize: "0.82rem",
              }}
            >
              {msg.type === "success" ? (
                <CheckCircle2 size={14} />
              ) : (
                <AlertCircle size={14} />
              )}
              {msg.text}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="small-button"
              style={{ flex: 1 }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="full-button"
              style={{
                flex: 1,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <KeyRound size={14} />
              )}
              {loading ? "Đang đổi..." : "Đổi mật khẩu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Change Avatar ─────────────────────────────────────────────────
function AvatarSection({
  avatarUrl,
  name,
  onUpdate,
}: {
  avatarUrl?: string;
  name: string;
  onUpdate: (url: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg("Chỉ chấp nhận file ảnh.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMsg("Ảnh tối đa 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!preview) return;
    setLoading(true);
    setMsg("");
    try {
      const r = await apiFetch("/auth/avatar", {
        method: "POST",
        body: JSON.stringify({ avatarUrl: preview }),
      });
      const d = await r.json();
      if (r.ok) {
        onUpdate(preview);
        setPreview(null);
        setMsg("Đã cập nhật ảnh đại diện.");
      } else {
        setMsg(d.message || "Lỗi khi lưu.");
      }
    } catch {
      setMsg("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--primary), #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.6rem",
            fontWeight: 800,
            color: "#fff",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{name}</div>
          <div
            style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}
          >
            Ảnh đại diện
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            border: "1px solid var(--border, #e2e6ef)",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: "0.82rem",
            fontWeight: 500,
            background: "var(--surface-2, #f5f6fa)",
            transition: "border-color 0.15s",
          }}
        >
          <Image size={14} />
          Chọn ảnh
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: "none" }}
          />
        </label>
        {preview && (
          <button
            onClick={handleSave}
            disabled={loading}
            className="small-button"
            type="button"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Lưu
          </button>
        )}
      </div>

      {msg && (
        <AlertBanner
          message={msg}
          type={msg.includes("Lỗi") ? "error" : "success"}
        />
      )}
    </div>
  );
}

// ─── Two-Factor (OTP qua email) Modal ────────────────────────────
function TwoFactorModal({
  enabled,
  email,
  onClose,
  onUserUpdate,
}: {
  enabled: boolean;
  email: string;
  onClose: () => void;
  onUserUpdate: (user: DemoUser) => void;
}) {
  const { setupTwoFactor, resendTwoFactorOtp, requestDisableTwoFactor } =
    useParkingApp();

  const [mode, setMode] = useState<"setup" | "disable">(
    enabled ? "disable" : "setup",
  );
  const [setupId, setSetupId] = useState<string>("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [step, setStep] = useState<"request" | "verify">(
    enabled ? "request" : "request",
  );

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    // Reset state when modal opens/closes
    setCode("");
    setMsg(null);
    setDevOtp(null);
    setStep("request");
    setSetupId("");
    setResendCooldown(0);
    setMode(enabled ? "disable" : "setup");
  }, [enabled]);

  function handleClose() {
    if (loading) return;
    onClose();
  }

  async function handleStartSetup() {
    setLoading(true);
    setMsg(null);
    setDevOtp(null);
    try {
      const data = await setupTwoFactor();
      if (data?.setupTwoFactorId) {
        setSetupId(data.setupTwoFactorId);
        setStep("verify");
        setMsg({
          text:
            data.message || `Đã gửi mã OTP 6 số về email ${maskEmail(email)}.`,
          type: "info",
        });
        setResendCooldown(60);
      } else {
        setMsg({
          text: data?.message || "Không gửi được mã OTP.",
          type: "error",
        });
      }
    } catch {
      setMsg({ text: "Lỗi kết nối máy chủ.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleStartDisable() {
    setLoading(true);
    setMsg(null);
    try {
      const data = (await requestDisableTwoFactor()) as {
        message?: string;
      } | null;
      if (data) {
        setStep("verify");
        setMsg({
          text:
            data.message ||
            `Đã gửi mã xác nhận tắt 2FA về email ${maskEmail(email)}.`,
          type: "info",
        });
        setResendCooldown(60);
      } else {
        setMsg({
          text: "Không gửi được mã xác nhận.",
          type: "error",
        });
      }
    } catch {
      setMsg({ text: "Lỗi kết nối máy chủ.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    try {
      const data = (await resendTwoFactorOtp(
        mode === "setup" ? setupId || undefined : undefined,
      )) as { message?: string } | null;
      if (data) {
        setMsg({
          text: data.message || "Đã gửi lại mã OTP mới.",
          type: "info",
        });
        setResendCooldown(60);
      }
    } catch {
      setMsg({ text: "Lỗi kết nối máy chủ.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setMsg({ text: "Mã OTP gồm 6 chữ số.", type: "error" });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      if (mode === "setup") {
        const response = await apiFetch("/auth/2fa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setupTwoFactorId: setupId, code }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMsg({
            text: data.message || "Mã OTP không đúng hoặc đã hết hạn.",
            type: "error",
          });
          return;
        }
        if (data.user) onUserUpdate(data.user);
        setMsg({
          text: "Đã bật xác thực 2 lớp.",
          type: "success",
        });
        setTimeout(() => onClose(), 1200);
      } else {
        const response = await apiFetch("/auth/2fa/disable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMsg({
            text: data.message || "Mã OTP không đúng hoặc đã hết hạn.",
            type: "error",
          });
          return;
        }
        if (data.user) onUserUpdate(data.user);
        setMsg({
          text: "Đã tắt xác thực 2 lớp.",
          type: "success",
        });
        setTimeout(() => onClose(), 1200);
      }
    } catch {
      setMsg({ text: "Lỗi kết nối máy chủ.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  const heading =
    mode === "setup" ? "Bật xác thực 2 lớp" : "Tắt xác thực 2 lớp";
  const subheading =
    mode === "setup"
      ? "Mỗi lần đăng nhập, hệ thống sẽ gửi mã OTP 6 số về email của bạn."
      : "Nhập mã OTP đã gửi về email để xác nhận tắt 2FA.";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        background: "rgba(255,255,255,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 420,
          border: "1px solid var(--border, #e2e6ef)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(16,185,129,0.1)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                {heading}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                }}
              >
                {step === "request"
                  ? subheading
                  : `Mã OTP đã gửi tới ${maskEmail(email)}.`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            type="button"
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              color: "var(--muted)",
              padding: 4,
              opacity: loading ? 0.5 : 1,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {step === "request" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(59,130,246,0.06)",
                border: "1px solid rgba(59,130,246,0.18)",
                borderRadius: 10,
                fontSize: "0.82rem",
                color: "var(--text, #0f172a)",
                lineHeight: 1.5,
              }}
            >
              {mode === "setup" ? (
                <>
                  <b style={{ color: "#10b981" }}>Bảo vệ tài khoản của bạn.</b>{" "}
                  Khi bật, mỗi lần đăng nhập hệ thống sẽ gửi mã OTP 6 số về
                  email <b>{maskEmail(email)}</b>. Bạn cần nhập đúng mã để hoàn
                  tất đăng nhập.
                </>
              ) : (
                <>
                  Sau khi tắt, bạn sẽ không cần nhập OTP khi đăng nhập. Hệ thống
                  sẽ gửi mã xác nhận về email <b>{maskEmail(email)}</b> để đảm
                  bảo chính chủ.
                </>
              )}
            </div>

            {msg && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background:
                    msg.type === "success"
                      ? "rgba(34,197,94,0.08)"
                      : msg.type === "error"
                        ? "rgba(239,68,68,0.08)"
                        : "rgba(59,130,246,0.08)",
                  border: `1px solid ${
                    msg.type === "success"
                      ? "rgba(34,197,94,0.2)"
                      : msg.type === "error"
                        ? "rgba(239,68,68,0.2)"
                        : "rgba(59,130,246,0.2)"
                  }`,
                  color:
                    msg.type === "success"
                      ? "#22c55e"
                      : msg.type === "error"
                        ? "#ef4444"
                        : "var(--primary)",
                  fontSize: "0.82rem",
                }}
              >
                {msg.type === "success" ? (
                  <CheckCircle2 size={14} />
                ) : msg.type === "error" ? (
                  <AlertCircle size={14} />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {msg.text}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="small-button"
                style={{ flex: 1 }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={
                  mode === "setup" ? handleStartSetup : handleStartDisable
                }
                disabled={loading}
                className="full-button"
                style={{
                  flex: 1,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {loading ? "Đang gửi..." : "Gửi mã OTP"}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleVerify}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
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
              Mã OTP (6 chữ số)
              <input
                type="text"
                value={code}
                disabled={loading}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                maxLength={6}
                autoFocus
                style={{
                  padding: "12px",
                  border: "1px solid var(--border, #e2e6ef)",
                  borderRadius: 8,
                  fontSize: "1.2rem",
                  fontFamily: "var(--font-geist-mono, monospace)",
                  letterSpacing: "0.25em",
                  textAlign: "center",
                  background: "var(--surface)",
                  color: "var(--text, #0f172a)",
                  opacity: loading ? 0.6 : 1,
                }}
              />
              {devOtp && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#f59e0b",
                    fontWeight: 500,
                    marginTop: 4,
                  }}
                >
                  Dev mode: OTP ={" "}
                  <b style={{ fontFamily: "monospace" }}>{devOtp}</b>
                </span>
              )}
            </label>

            {msg && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background:
                    msg.type === "success"
                      ? "rgba(34,197,94,0.08)"
                      : msg.type === "error"
                        ? "rgba(239,68,68,0.08)"
                        : "rgba(59,130,246,0.08)",
                  border: `1px solid ${
                    msg.type === "success"
                      ? "rgba(34,197,94,0.2)"
                      : msg.type === "error"
                        ? "rgba(239,68,68,0.2)"
                        : "rgba(59,130,246,0.2)"
                  }`,
                  color:
                    msg.type === "success"
                      ? "#22c55e"
                      : msg.type === "error"
                        ? "#ef4444"
                        : "var(--primary)",
                  fontSize: "0.82rem",
                }}
              >
                {msg.type === "success" ? (
                  <CheckCircle2 size={14} />
                ) : msg.type === "error" ? (
                  <AlertCircle size={14} />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {msg.text}
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: resendCooldown > 0 ? "var(--muted)" : "var(--primary)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor:
                    resendCooldown > 0 || loading ? "not-allowed" : "pointer",
                  textDecoration: "underline",
                }}
              >
                {resendCooldown > 0
                  ? `Gửi lại OTP (${resendCooldown}s)`
                  : "Gửi lại OTP"}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="small-button"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="full-button"
                  style={{
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={14} />
                  )}
                  {loading
                    ? "Đang xác minh..."
                    : mode === "setup"
                      ? "Bật 2FA"
                      : "Tắt 2FA"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Mask email helper: a***@gmail.com
function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] || ""}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

// ─── Main Component ────────────────────────────────────────────────
export function ProfileView() {
  const { currentUser, viewAs, setCurrentUser, logout } = useParkingApp();

  // Dùng viewAs để xác định chế độ hiển thị
  const isCustomer = currentUser?.role === "staff" ? viewAs === "customer" : currentUser?.role === "customer";

  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldMsg, setFieldMsg] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);

  if (!currentUser) return null;

  async function handleFieldSave(field: string, value: string): Promise<void> {
    const r = await apiFetch("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({ [field]: value }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(
        d.message || `Lỗi ${r.status}: không thể cập nhật ${field}.`,
      );
    }
    if (d.user) {
      setCurrentUser(d.user);
      setFieldMsg({ text: "Cập nhật thành công.", type: "success" });
      setTimeout(() => setFieldMsg(null), 3000);
    } else {
      throw new Error("Phản hồi không hợp lệ từ máy chủ.");
    }
  }

  const sectionStyle: React.CSSProperties = {
    background: "var(--surface)",
    borderRadius: 16,
    padding: "24px 28px",
    border: "1px solid var(--border, #e2e6ef)",
  };

  const headingStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 8,
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--muted)",
    margin: "0 0 2px",
  };

  return (
    <div className="content-grid" style={{ gap: 24, padding: "0 0 40px" }}>
      {/* ── Avatar + Info ──────────────────────────────────────────── */}
      <div>
        <section style={sectionStyle}>
        <div style={headingStyle}>
          <div>
            <p style={sectionLabelStyle}>Hồ sơ cá nhân</p>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
              Thông tin tài khoản
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              className={`badge ${currentUser.status === "Đang hoạt động" ? "success" : "warning"}`}
            >
              {currentUser.status}
            </span>
          </div>
        </div>

        <AvatarSection
          avatarUrl={currentUser.avatarUrl ?? undefined}
          name={currentUser.name}
          onUpdate={(url) => setCurrentUser({ ...currentUser, avatarUrl: url })}
        />

        <div
          style={{ marginTop: 20, display: "flex", flexDirection: "column" }}
        >
          {fieldMsg && (
            <div style={{ marginBottom: 12 }}>
              <AlertBanner message={fieldMsg.text} type={fieldMsg.type} />
            </div>
          )}
          <FieldRow
            label="Họ tên"
            value={currentUser.name}
            icon={UserRound}
            editable
            editing={editingField === "name"}
            onEdit={() =>
              setEditingField(editingField === "name" ? null : "name")
            }
          />
          <FieldRow
            label="Email"
            value={currentUser.email}
            icon={Mail}
            editable
            editing={editingField === "email"}
            onEdit={() =>
              setEditingField(editingField === "email" ? null : "email")
            }
          />
          <FieldRow
            label="Số điện thoại"
            value={currentUser.phone ?? "Chưa cập nhật"}
            icon={Phone}
            editable
            editing={editingField === "phone"}
            onEdit={() =>
              setEditingField(editingField === "phone" ? null : "phone")
            }
          />
          <FieldRow
            label="Địa chỉ"
            value={currentUser.address ?? "Chưa cập nhật"}
            icon={MapPin}
            editable
            editing={editingField === "address"}
            onEdit={() =>
              setEditingField(editingField === "address" ? null : "address")
            }
          />
          <FieldRow
            label="Vai trò"
            value={roleLabels[currentUser.role]}
            icon={IdCard}
          />
          <FieldRow
            label="Ngày tham gia"
            value={
              currentUser.createdAt
                ? new Date(currentUser.createdAt).toLocaleDateString("vi-VN")
                : "—"
            }
            icon={ShieldCheck}
          />
        </div>
      </section>
      </div>

      {/* ── Bảo mật ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section style={sectionStyle}>
        <div style={headingStyle}>
          <div>
            <p style={sectionLabelStyle}>Bảo mật</p>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
              Mật khẩu
            </h2>
          </div>
          <ShieldCheck size={20} style={{ color: "var(--muted)" }} />
        </div>

        <p
          style={{
            margin: "0 0 16px",
            fontSize: "0.85rem",
            color: "var(--muted)",
          }}
        >
          Quản lý mật khẩu đăng nhập của bạn. Bạn có thể đổi mật khẩu khi đang
          đăng nhập, hoặc dùng "Quên mật khẩu" nếu muốn nhận mã OTP qua email để
          đặt lại.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {/* Đổi mật khẩu */}
          <button
            type="button"
            onClick={() => setChangePwOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              border: "1px solid var(--border, #e2e6ef)",
              borderRadius: 12,
              background: "var(--surface)",
              cursor: "pointer",
              textAlign: "left",
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
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(59,130,246,0.1)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <KeyRound size={20} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "var(--fg)",
                }}
              >
                Đổi mật khẩu
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  marginTop: 2,
                }}
              >
                Cập nhật mật khẩu đang dùng.
              </div>
            </div>
          </button>

          {/* Quên mật khẩu */}
          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              border: "1px solid var(--border, #e2e6ef)",
              borderRadius: 12,
              background: "var(--surface)",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#f59e0b";
              e.currentTarget.style.background = "rgba(245,158,11,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border, #e2e6ef)";
              e.currentTarget.style.background = "var(--surface)";
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(245,158,11,0.1)",
                color: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <HelpCircle size={20} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "var(--fg)",
                }}
              >
                Quên mật khẩu
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  marginTop: 2,
                }}
              >
                Đặt lại qua email + OTP.
              </div>
            </div>
          </button>

          {/* Xác thực 2 lớp (OTP qua email) */}
          <button
            type="button"
            onClick={() => setTwoFactorOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              border: `1px solid ${currentUser.twoFactorEnabled ? "rgba(16,185,129,0.4)" : "var(--border, #e2e6ef)"}`,
              borderRadius: 12,
              background: currentUser.twoFactorEnabled
                ? "rgba(16,185,129,0.04)"
                : "var(--surface)",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#10b981";
              e.currentTarget.style.background = "rgba(16,185,129,0.06)";
            }}
            onMouseLeave={(e) => {
              if (currentUser.twoFactorEnabled) {
                e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)";
                e.currentTarget.style.background = "rgba(16,185,129,0.04)";
              } else {
                e.currentTarget.style.borderColor = "var(--border, #e2e6ef)";
                e.currentTarget.style.background = "var(--surface)";
              }
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(16,185,129,0.12)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                position: "relative",
              }}
            >
              <ShieldCheck size={20} />
              {currentUser.twoFactorEnabled && (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "#10b981",
                    border: "2px solid var(--surface)",
                  }}
                  aria-label="Đang bật"
                />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "var(--fg)",
                }}
              >
                Xác thực 2 lớp (OTP email)
                {currentUser.twoFactorEnabled ? (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(16,185,129,0.15)",
                      color: "#10b981",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Đang bật
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "var(--surface-2, #f5f6fa)",
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Chưa bật
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  marginTop: 2,
                }}
              >
                {currentUser.twoFactorEnabled
                  ? "Mã OTP 6 số gửi về email khi đăng nhập."
                  : "Bảo vệ tài khoản với mã OTP 6 số qua email."}
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* ── Đăng ký làm nhân viên ────────────────────────────────── */}
      {isCustomer && <StaffApplicationCard />}
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      {changePwOpen && (
        <ChangePasswordModal
          onClose={() => setChangePwOpen(false)}
          onLogout={logout}
        />
      )}

      {forgotOpen && (
        <ForgotPasswordModal
          defaultEmail={currentUser.email}
          onClose={() => setForgotOpen(false)}
        />
      )}

      {twoFactorOpen && (
        <TwoFactorModal
          enabled={Boolean(currentUser.twoFactorEnabled)}
          email={currentUser.email}
          onClose={() => setTwoFactorOpen(false)}
          onUserUpdate={(u) => setCurrentUser(u)}
        />
      )}

      {/* ── Edit Field Modal ───────────────────────────────────────── */}
      {editingField &&
        (() => {
          const labels: Record<string, string> = {
            name: "Họ tên",
            email: "Email",
            phone: "Số điện thoại",
            address: "Địa chỉ",
          };
          const types: Record<string, string> = {
            email: "email",
            phone: "tel",
          };
          const rawVal = currentUser[editingField as keyof DemoUser];
          return (
            <EditFieldModal
              label={labels[editingField] ?? "Giá trị"}
              value={
                typeof rawVal === "string"
                  ? rawVal
                  : rawVal == null
                    ? ""
                    : String(rawVal)
              }
              field={editingField}
              type={types[editingField]}
              onSave={handleFieldSave}
              onClose={() => setEditingField(null)}
            />
          );
        })()}
    </div>
  );
}
