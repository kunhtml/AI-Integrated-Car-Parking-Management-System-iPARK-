"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Camera,
  Car,
  Check,
  CheckCircle2,
  CircleParking,
  Clock,
  CreditCard,
  DoorOpen,
  ExternalLink,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { apiBaseUrl } from "@/lib/constants";
import { parkingConfig } from "@/lib/parking-config";
import { showInfo } from "@/lib/toast";

const STEPS = [
  {
    icon: Camera,
    title: "Camera nhận diện biển số",
    desc: "AI tự động đọc biển số khi xe tới cổng, barie mở trong ~3 giây.",
  },
  {
    icon: QrCode,
    title: "Nhận vé điện tử QR",
    desc: "Mỗi xe có một mã phiên gửi xe duy nhất, thay cho vé giấy.",
  },
  {
    icon: CreditCard,
    title: "Thanh toán PayOS",
    desc: "Tra cứu phí theo biển số và quét mã QR PayOS để trả, không cần tiền mặt.",
  },
  {
    icon: DoorOpen,
    title: "Ra bãi tự động",
    desc: "Sau khi thanh toán, hệ thống đóng phiên và mở barie ra.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────
function formatDuration(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

function formatVND(value: number) {
  return value.toLocaleString("vi-VN") + "đ";
}

function getDefaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Parking Availability ────────────────────────────────────────
type ZoneData = {
  zone: string;
  description?: string;
  total: number;
  available: number;
  occupied: number;
  allowedVehicleTypes: string[];
};

type AvailabilityAPI = {
  capacity: number;
  available: number;
  occupied: number;
  zones: ZoneData[];
};

type ActiveZone = {
  zone: string;
  description?: string;
  total: number;
  available: number;
  occupied: number;
  allowedVehicleTypes: string[];
  fillRate: number;
  isFull: boolean;
};

function ParkingAvailability() {
  const [zones, setZones] = useState<ActiveZone[]>([]);
  const [stats, setStats] = useState({
    capacity: 0,
    available: 0,
    occupied: 0,
  });
  const [search, setSearch] = useState("");
  const [activeZone, setActiveZone] = useState<string>("Tất cả");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function load(silent = false) {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const r = await fetch(`${apiBaseUrl}/public/availability`);
      if (r.ok) {
        const d: AvailabilityAPI = await r.json();
        const mapped: ActiveZone[] = (d.zones || []).map((z: ZoneData) => ({
          ...z,
          fillRate:
            z.total > 0
              ? Math.round(((z.total - z.available) / z.total) * 100)
              : 0,
          isFull: z.available === 0,
        }));
        setZones(mapped);
        setStats({
          capacity: d.capacity,
          available: d.available,
          occupied: d.occupied,
        });
        setLastUpdated(new Date());
      }
    } catch {
      /* silent */
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const i = setInterval(() => load(true), 30000);
    return () => clearInterval(i);
  }, []);

  const filtered = zones.filter((z) => {
    const matchesSearch =
      search.trim() === "" ||
      z.zone.toLowerCase().includes(search.toLowerCase()) ||
      (z.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesZone = activeZone === "Tất cả" || z.zone === activeZone;
    return matchesSearch && matchesZone;
  });

  const totalAvailable =
    stats.capacity > 0
      ? stats.available
      : zones.reduce((s, z) => s + z.available, 0);
  const totalOccupied = zones.reduce((s, z) => s + z.occupied, 0);
  const totalCapacity = zones.reduce((s, z) => s + z.total, 0);
  const overallFill =
    totalCapacity > 0
      ? Math.round(((totalCapacity - totalAvailable) / totalCapacity) * 100)
      : 0;

  return (
    <div className="pkav">
      {/* ── Stats Row ── */}
      <div className="pkav-stats">
        <div className="pkav-stat">
          <div className="pkav-stat-icon green">
            <Car size={18} />
          </div>
          <div>
            <span className="pkav-stat-value">{totalAvailable}</span>
            <span className="pkav-stat-label">Chỗ trống</span>
          </div>
        </div>
        <div className="pkav-stat">
          <div className="pkav-stat-icon blue">
            <CircleParking size={18} />
          </div>
          <div>
            <span className="pkav-stat-value">{totalOccupied}</span>
            <span className="pkav-stat-label">Đang đỗ</span>
          </div>
        </div>
        <div className="pkav-stat">
          <div className="pkav-stat-icon orange">
            <Zap size={18} />
          </div>
          <div>
            <span className="pkav-stat-value">{overallFill}%</span>
            <span className="pkav-stat-label">Tỷ lệ lấp đầy</span>
          </div>
        </div>
        <div className="pkav-stat">
          <div className="pkav-stat-icon purple">
            <MapPin size={18} />
          </div>
          <div>
            <span className="pkav-stat-value">{totalCapacity}</span>
            <span className="pkav-stat-label">Tổng sức chứa</span>
          </div>
        </div>
      </div>

      {/* ── Controls Row ── */}
      <div className="pkav-controls">
        <div className="pkav-search">
          <Search size={16} className="pkav-search-icon" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm khu vực đỗ xe…"
          />
          {search && (
            <button
              className="pkav-search-clear"
              onClick={() => setSearch("")}
              type="button"
            >
              ✕
            </button>
          )}
        </div>
        <div className="pkav-filters">
          <button
            className={`pkav-filter-btn ${activeZone === "Tất cả" ? "active" : ""}`}
            onClick={() => setActiveZone("Tất cả")}
            type="button"
          >
            Tất cả
          </button>
          {zones.map((z) => (
            <button
              key={z.zone}
              className={`pkav-filter-btn ${activeZone === z.zone ? "active" : ""}`}
              onClick={() => setActiveZone(z.zone)}
              type="button"
            >
              Khu {z.zone}
            </button>
          ))}
        </div>
        <button
          className={`pkav-refresh-btn ${isRefreshing ? "refreshing" : ""}`}
          onClick={() => load(true)}
          disabled={isRefreshing}
          type="button"
          title="Làm mới"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* ── Live indicator ── */}
      {lastUpdated && (
        <div className="pkav-live">
          <span className="pkav-live-dot" />
          <span>
            Cập nhật lúc{" "}
            {lastUpdated.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
            {" · "}Tự động làm mới mỗi 30 giây
          </span>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="pkav-loading">
          <Loader2 size={28} className="animate-spin" />
          <span>Đang tải thông tin bãi đỗ…</span>
        </div>
      )}

      {/* ── Zone Cards ── */}
      {!isLoading && (
        <>
          {filtered.length > 0 ? (
            <div className="pkav-grid">
              {filtered.map((zone) => (
                <div
                  className={`pkav-card ${zone.isFull ? "pkav-card--full" : ""}`}
                  key={zone.zone}
                >
                  {/* Card Header */}
                  <div className="pkav-card-header">
                    <div className="pkav-card-title">
                      <div>
                        <h4>Khu {zone.zone}</h4>
                        {zone.description && (
                          <p className="pkav-card-desc">{zone.description}</p>
                        )}
                      </div>
                    </div>
                    <div
                      className={`pkav-card-badge ${zone.isFull ? "badge--full" : "badge--available"}`}
                    >
                      {zone.isFull ? "Đầy" : `${zone.available} trống`}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="pkav-card-progress">
                    <div
                      className="pkav-card-progress-fill"
                      style={{
                        width: `${zone.fillRate}%`,
                        background: zone.isFull
                          ? "var(--landing-danger)"
                          : zone.fillRate > 80
                            ? "var(--landing-warning)"
                            : "var(--landing-success)",
                      }}
                    />
                  </div>

                  {/* Card Meta */}
                  <div className="pkav-card-meta">
                    <span className="pkav-card-meta-left">
                      <span className="pkav-card-meta-value">
                        {zone.occupied}
                      </span>
                      <span className="pkav-card-meta-sep"> / </span>
                      <span className="pkav-card-meta-value">{zone.total}</span>
                      <span className="pkav-card-meta-label"> xe đang đỗ</span>
                    </span>
                    <span className="pkav-card-meta-right">
                      <span className="pkav-card-meta-value">
                        {zone.fillRate}%
                      </span>
                      <span className="pkav-card-meta-label"> lấp đầy</span>
                    </span>
                  </div>

                  {/* Quick CTA */}
                  {!zone.isFull && (
                    <div className="pkav-card-cta">
                      <span>Còn {zone.available} chỗ</span>
                    </div>
                  )}
                  {zone.isFull && (
                    <div className="pkav-card-cta pkav-card-cta--full">
                      <span>Bãi đã đầy — vui lòng chọn khu khác</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="pkav-empty">
              <CircleParking size={40} />
              <h4>Không tìm thấy khu vực phù hợp</h4>
              <p>Thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setActiveZone("Tất cả");
                }}
                type="button"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Summary footer ── */}
      {!isLoading && zones.length > 0 && (
        <div className="pkav-summary">
          <span>
            Hiển thị <strong>{filtered.length}</strong> /{" "}
            <strong>{zones.length}</strong> khu vực
            {search && ` · Tìm thấy "${search}"`}
          </span>
          <span>
            {zones.filter((z) => z.isFull).length} khu đầy ·{" "}
            {zones.filter((z) => !z.isFull).length} khu còn chỗ
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Auth Panel ──────────────────────────────────────────────────
export function AuthPanel() {
  const {
    mode,
    setMode,
    handleLogin,
    handleRegister,
    handleVerifyRegister,
    handleResendVerificationOtp,
    handleRequestForgotOtp,
    handleResetPassword,
    handleVerifyLoginTwoFactor,
  } = useParkingApp();
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [forgotEmail, setForgotEmail] = useState<string>("");
  const [forgotResendCooldown, setForgotResendCooldown] = useState<number>(0);
  const [pendingTwoFactorId, setPendingTwoFactorId] = useState<string>("");
  const [twoFactorResendCooldown, setTwoFactorResendCooldown] =
    useState<number>(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(
      () => setResendCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (forgotResendCooldown <= 0) return;
    const t = setTimeout(
      () => setForgotResendCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearTimeout(t);
  }, [forgotResendCooldown]);

  useEffect(() => {
    if (twoFactorResendCooldown <= 0) return;
    const t = setTimeout(
      () => setTwoFactorResendCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearTimeout(t);
  }, [twoFactorResendCooldown]);

  async function onResendOtp() {
    if (resendCooldown > 0 || !handleResendVerificationOtp) return;
    setResendCooldown(10);
    await handleResendVerificationOtp(pendingEmail);
  }

  async function onRequestForgotOtp(event: React.FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    await handleRequestForgotOtp(event);
    if (email) {
      setForgotEmail(email);
      setMode("verify-forgot");
      setForgotResendCooldown(10);
    }
  }

  async function onResendForgotOtp() {
    if (forgotResendCooldown > 0) return;
    setForgotResendCooldown(10);
    await apiFetch("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail }),
    });
    showInfo("Đã gửi lại mã OTP. Vui lòng kiểm tra email.");
  }

  async function onRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = await handleRegister(event);
    if (
      result &&
      (result as { requiresOtp?: boolean; email?: string }).requiresOtp
    ) {
      const email = (result as { email?: string }).email;
      if (email) setPendingEmail(email);
      setMode("verify-register");
    }
  }

  async function onLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = (await handleLogin(event)) as
      | { kind: "ok"; user: unknown }
      | { kind: "two-factor"; pendingTwoFactorId: string; email?: string }
      | { kind: "email-verification"; email?: string }
      | null
      | undefined;
    if (result?.kind === "email-verification") {
      if (result.email) setPendingEmail(result.email);
      setMode("verify-login");
      return;
    }
    if (result?.kind === "two-factor") {
      if (result.email) setPendingEmail(result.email);
      setPendingTwoFactorId(result.pendingTwoFactorId);
      setTwoFactorResendCooldown(10);
      setMode("verify-2fa");
    }
  }

  return (
    <div className="landing-auth">
      <div className="landing-auth-header">
        <CircleParking size={22} />
        <span>iPARK</span>
      </div>
      <div className="landing-auth-tabs">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
          type="button"
        >
          Đăng nhập
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => setMode("register")}
          type="button"
        >
          Đăng ký
        </button>
      </div>
      {mode === "login" && (
        <form onSubmit={onLoginSubmit}>
          <label>
            <span className="landing-auth-label">Email</span>
            <input
              name="email"
              defaultValue="admin@ipark.vn"
              type="email"
              placeholder="you@email.com"
            />
          </label>
          <label>
            <span className="landing-auth-label">Mật khẩu</span>
            <input
              name="password"
              defaultValue="admin"
              type="password"
              placeholder="••••••"
            />
          </label>
          <button className="landing-auth-btn-primary" type="submit">
            <LogIn size={16} />
            Đăng nhập
          </button>
          <div className="landing-auth-divider">
            <span>hoặc</span>
          </div>
          <button
            className="landing-auth-btn-google"
            onClick={() => {
              window.location.href = `${apiBaseUrl}/auth/google`;
            }}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Đăng nhập với Google
          </button>
          <button
            className="landing-auth-link"
            onClick={() => setMode("forgot")}
            type="button"
          >
            Quên mật khẩu?
          </button>
        </form>
      )}
      {mode === "register" && (
        <form className="register-form" onSubmit={onRegisterSubmit}>
          <label>
            <span className="landing-auth-label">
              Họ tên <span className="required">*</span>
            </span>
            <input name="name" placeholder="VD: Nguyễn Văn A" required />
          </label>
          <label>
            <span className="landing-auth-label">
              Email <span className="required">*</span>
            </span>
            <input
              name="email"
              placeholder="you@email.com"
              required
              type="email"
            />
          </label>
          <label>
            <span className="landing-auth-label">
              Mật khẩu <span className="required">*</span>
            </span>
            <input
              name="password"
              placeholder="Tối thiểu 6 ký tự"
              required
              type="password"
              minLength={6}
            />
          </label>
          <label>
            <span className="landing-auth-label">
              Nhập lại mật khẩu <span className="required">*</span>
            </span>
            <input
              name="confirmPassword"
              placeholder="Nhập lại mật khẩu"
              required
              type="password"
              minLength={6}
            />
          </label>
          <button className="landing-auth-btn-primary" type="submit">
            <Plus size={16} />
            Tạo tài khoản
          </button>
          <button
            className="landing-auth-link"
            onClick={() => setMode("login")}
            type="button"
          >
            Đã có tài khoản? Đăng nhập
          </button>
        </form>
      )}
      {mode === "verify-register" && (
        <form
          onSubmit={async (event) => {
            if (!handleVerifyRegister) return;
            const result = await handleVerifyRegister(event);
            if (result) setMode("login");
          }}
        >
          <p className="landing-auth-subtitle">
            Chúng tôi đã gửi mã OTP 6 số đến email{" "}
            <strong>{pendingEmail}</strong>. Vui lòng kiểm tra hộp thư (kể cả
            thư mục spam) và nhập mã để hoàn tất đăng ký.
          </p>
          <label>
            <span className="landing-auth-label">Email</span>
            <input name="email" value={pendingEmail} readOnly type="email" />
          </label>
          <label>
            <span className="landing-auth-label">Mã OTP</span>
            <input
              name="otp"
              placeholder="6 chữ số"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              required
              autoFocus
            />
          </label>
          <button className="landing-auth-btn-primary" type="submit">
            <Mail size={16} />
            Xác nhận &amp; tạo tài khoản
          </button>
          <button
            className="landing-auth-link"
            onClick={onResendOtp}
            type="button"
            disabled={resendCooldown > 0}
            style={
              resendCooldown > 0
                ? { opacity: 0.6, cursor: "not-allowed" }
                : undefined
            }
          >
            {resendCooldown > 0
              ? `Gửi lại mã OTP (${resendCooldown}s)`
              : "Gửi lại mã OTP"}
          </button>
          <button
            className="landing-auth-link"
            onClick={() => setMode("register")}
            type="button"
          >
            ← Sửa thông tin đăng ký
          </button>
        </form>
      )}
      {mode === "verify-login" && (
        <form
          onSubmit={async (event) => {
            // Tai khoan da ton tai nhung chua verify -> gui OTP de kich hoat.
            // Tuy nhien backend chi tao OtpToken khi user chua ton tai (register flow).
            // Truong hop nay, can dang ky lai: chuyen ve tab register voi email san.
            event.preventDefault();
            showInfo(
              "Tài khoản của bạn đã tồn tại nhưng chưa xác minh email. Vui lòng liên hệ quản trị viên hoặc đăng ký lại với email khác.",
            );
            setMode("login");
          }}
        >
          <p className="landing-auth-subtitle">
            Tài khoản <strong>{pendingEmail}</strong> chưa được xác minh email.
            Vui lòng hoàn tất bước xác minh để có thể đăng nhập.
          </p>
          <button className="landing-auth-btn-primary" type="submit">
            <Mail size={16} />
            Đăng ký lại với email khác
          </button>
          <button
            className="landing-auth-link"
            onClick={() => setMode("login")}
            type="button"
          >
            ← Quay lại đăng nhập
          </button>
        </form>
      )}
      {mode === "forgot" && (
        <form onSubmit={onRequestForgotOtp}>
          <p className="landing-auth-subtitle">
            Nhập email của bạn, hệ thống sẽ gửi mã OTP để đặt lại mật khẩu.
          </p>
          <label>
            <span className="landing-auth-label">
              Email <span className="required">*</span>
            </span>
            <input
              name="email"
              placeholder="you@email.com"
              required
              type="email"
              autoFocus
            />
          </label>
          <button className="landing-auth-btn-primary" type="submit">
            <Mail size={16} />
            Gửi mã OTP
          </button>
          <button
            className="landing-auth-link"
            onClick={() => setMode("login")}
            type="button"
          >
            ← Quay lại đăng nhập
          </button>
        </form>
      )}
      {mode === "verify-forgot" && (
        <form
          onSubmit={async (event) => {
            await handleResetPassword(event);
          }}
        >
          <p className="landing-auth-subtitle">
            Mã OTP đã được gửi đến <strong>{forgotEmail}</strong>. Vui lòng kiểm
            tra hộp thư (kể cả thư mục spam) rồi nhập mã cùng mật khẩu mới.
          </p>
          <label>
            <span className="landing-auth-label">Email</span>
            <input name="email" value={forgotEmail} readOnly type="email" />
          </label>
          <label>
            <span className="landing-auth-label">
              Mã OTP <span className="required">*</span>
            </span>
            <input
              name="otp"
              placeholder="6 chữ số"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              required
              autoFocus
            />
          </label>
          <label>
            <span className="landing-auth-label">
              Mật khẩu mới <span className="required">*</span>
            </span>
            <input
              name="password"
              placeholder="Tối thiểu 6 ký tự"
              required
              type="password"
              minLength={6}
            />
          </label>
          <button className="landing-auth-btn-primary" type="submit">
            <CheckCircle2 size={16} />
            Xác minh &amp; đặt lại
          </button>
          <button
            className="landing-auth-link"
            onClick={onResendForgotOtp}
            type="button"
            disabled={forgotResendCooldown > 0}
            style={
              forgotResendCooldown > 0
                ? { opacity: 0.6, cursor: "not-allowed" }
                : undefined
            }
          >
            {forgotResendCooldown > 0
              ? `Gửi lại mã OTP (${forgotResendCooldown}s)`
              : "Gửi lại mã OTP"}
          </button>
          <button
            className="landing-auth-link"
            onClick={() => setMode("forgot")}
            type="button"
          >
            ← Đổi email khác
          </button>
        </form>
      )}
      {mode === "verify-2fa" && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            // Inject hidden pendingTwoFactorId into the form before calling handler
            const formEl = event.currentTarget;
            const result = await handleVerifyLoginTwoFactor({
              preventDefault: () => undefined,
              currentTarget: formEl,
            } as unknown as React.FormEvent<HTMLFormElement>);
            if (result) {
              // AuthPanel stays mounted; parent PublicLanding listens to currentUser
              // and transitions to dashboard. Nothing else to do here.
            }
          }}
        >
          <input
            type="hidden"
            name="pendingTwoFactorId"
            value={pendingTwoFactorId}
          />
          <p className="landing-auth-subtitle">
            Mật khẩu đúng. Để bảo mật tài khoản, hệ thống đã gửi mã xác thực 6
            số đến email <strong>{pendingEmail}</strong>. Vui lòng kiểm tra hộp
            thư (kể cả thư mục spam) rồi nhập mã để hoàn tất đăng nhập.
          </p>
          <label>
            <span className="landing-auth-label">
              Mã 2FA <span className="required">*</span>
            </span>
            <input
              name="code"
              placeholder="6 chữ số"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              required
              autoFocus
            />
          </label>
          <button className="landing-auth-btn-primary" type="submit">
            <CheckCircle2 size={16} />
            Xác nhận &amp; đăng nhập
          </button>
          <button
            className="landing-auth-link"
            onClick={(e) => {
              e.preventDefault();
              // Show a small inline form to re-enter password for resend
              const pw = window.prompt("Nhập mật khẩu để gửi lại mã 2FA:");
              if (!pw) return;
              (async () => {
                try {
                  const r = await apiFetch("/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: pendingEmail, password: pw }),
                  });
                  const d = await r.json().catch(() => ({}));
                  if (
                    r.status === 202 &&
                    d.requiresTwoFactor &&
                    d.pendingTwoFactorId
                  ) {
                    setPendingTwoFactorId(d.pendingTwoFactorId);
                    setTwoFactorResendCooldown(10);
                    showInfo(d.message || "Đã gửi lại mã 2FA mới về email.");
                  } else {
                    showInfo(d.message || "Không gửi lại được mã 2FA.");
                  }
                } catch {
                  showInfo("Không kết nối được server.");
                }
              })();
            }}
            type="button"
            disabled={twoFactorResendCooldown > 0}
            style={
              twoFactorResendCooldown > 0
                ? { opacity: 0.6, cursor: "not-allowed" }
                : undefined
            }
          >
            {twoFactorResendCooldown > 0
              ? `Gửi lại mã 2FA (${twoFactorResendCooldown}s)`
              : "Gửi lại mã 2FA"}
          </button>
          <button
            className="landing-auth-link"
            onClick={() => {
              setMode("login");
              setPendingTwoFactorId("");
            }}
            type="button"
          >
            ← Quay lại đăng nhập
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Site Header ──────────────────────────────────────────────────
function SiteHeader({
  available = 153,
  onLoginClick,
}: {
  available?: number;
  onLoginClick?: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <header className="landing-header">
      <div className="landing-header-inner">
        <a href="#" className="landing-logo">
          <div className="landing-logo-icon">
            <CircleParking size={22} color="#0a0f1a" />
          </div>
          <div className="landing-logo-text">
            <span className="landing-logo-name">iPARK</span>
            <span className="landing-logo-tagline">Smart Parking</span>
          </div>
        </a>
        <nav className="landing-nav">
          <a href="#chỗ-trống">Chỗ trống</a>
          <a href="#liên-hệ">Liên hệ</a>
        </nav>
        <div className="landing-header-actions">
          <div className="landing-slots-badge">
            <span className="landing-slots-dot" />
            <Car size={14} color="var(--landing-accent)" />
            <span style={{ fontWeight: 600 }}>{available}</span>
            <span style={{ color: "var(--landing-fg-muted)" }}>chỗ trống</span>
            {now && (
              <span className="landing-time">
                {now.toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
          <button
            onClick={onLoginClick}
            className="landing-auth-btn-primary"
            style={{ padding: "8px 16px", fontSize: "13px" }}
            type="button"
          >
            <LogIn size={14} />
            Đăng nhập
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────
function HeroSection({
  liveStats,
  onLoginClick,
}: {
  liveStats: { active: number; available: number };
  onLoginClick?: () => void;
}) {
  return (
    <section className="landing-hero">
      <div className="landing-hero-bg" />
      <div className="landing-hero-inner">
        <div className="landing-hero-content">
          <span className="landing-badge">
            <Sparkles size={14} />
            Bãi xe không vé · Nhận diện biển số bằng AI
          </span>
          <h1>
            Gửi xe thông minh,{" "}
            <span className="highlight">thanh toán qua PayOS</span>
          </h1>
          <p>
            Dành cho khách vãng lai: không giữ vé giấy, không cài ứng dụng. Xe
            vào được camera nhận diện tự động — bạn chỉ cần tra cứu biển số và
            quét mã QR để trả phí khi ra bãi.
          </p>
          <div className="landing-hero-actions">
            <a href="#quy-trinh" className="landing-btn-secondary">
              Xem cách hoạt động
            </a>
          </div>
          <div className="landing-hero-meta">
            <span>
              <MapPin size={16} />
              iPARK – Bãi đỗ Vincom Center
            </span>
            <span>
              <ShieldCheck size={16} />
              Thanh toán mã hoá an toàn
            </span>
          </div>
        </div>
        <div className="landing-hero-image">
          <img
            src="/images/hero-parking.png"
            alt="Cổng bãi đỗ xe thông minh iPARK"
            width={900}
            height={600}
          />
          <div className="landing-hero-image-badge">
            <ScanLine size={14} />
            Đang nhận diện biển số…
          </div>
        </div>
      </div>
      <div className="landing-stats">
        <div className="landing-stats-grid">
          <div className="landing-stat">
            <div className="landing-stat-value">~3 giây</div>
            <div className="landing-stat-label">Mở barie / xe</div>
          </div>
          <div className="landing-stat">
            <div className="landing-stat-value">99,5%</div>
            <div className="landing-stat-label">Độ chính xác AI</div>
          </div>
          <div className="landing-stat">
            <div className="landing-stat-value">24/7</div>
            <div className="landing-stat-label">Tự phục vụ</div>
          </div>
          <div className="landing-stat">
            <div className="landing-stat-value">0đ</div>
            <div className="landing-stat-label">Phí ẩn</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="quy-trinh" className="landing-how">
      <div className="landing-section-header">
        <p className="landing-section-eyebrow">Cách hoạt động</p>
        <h2>Quy trình gửi xe không vé</h2>
        <p>Bốn bước, hoàn toàn tự phục vụ.</p>
      </div>
      <div className="landing-steps-grid">
        {STEPS.map((step) => (
          <div className="landing-step" key={step.title}>
            <div className="landing-step-icon">
              <step.icon size={22} />
            </div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Session Lookup ────────────────────────────────────────────────
type LookupStep =
  | "search"
  | "session"
  | "payos_waiting"
  | "paid"
  | "not_found"
  | "completed";

type DailyBreakdown = {
  dayIndex: number;
  date: string;
  rateType: string;
  fee: number;
  checkOutHour: number;
};

type FeeBreakdown = {
  totalMinutes: number;
  totalFee: number;
  dailyBreakdown: DailyBreakdown[];
};

type PenaltyInfo = {
  amount: number;
  reason: string | null;
  evidenceImageUrl?: string | null;
  violationType: string;
};

type SessionInfo = {
  id: string;
  plate: string;
  ownerName: string;
  ownerEmail?: string;
  slot: string;
  zone: string | null;
  checkInAt: string;
  checkInDate?: string;
  checkOutAt?: string;
  parkingMinutes?: number;
  duration?: string;
  currentFee: number;
  feeBreakdown?: FeeBreakdown;
  penalties?: PenaltyInfo[];
  penaltyTotal?: number;
  paidAmount?: number;
  expectedCheckOutAt?: string;
  paymentStatus: string;
  prepaidCheckoutAt?: string;
  isPrepaid: boolean;
  isCompleted?: boolean;
};

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

type PayOSData = {
  qrCode: string;
  checkoutUrl: string;
  orderCode: string;
  amount: number;
  accountNumber?: string;
  accountName?: string;
  bin?: string;
  description?: string;
};

const BANK_NAMES: Record<string, string> = {
  "970418": "BIDV",
  "970436": "Vietcombank",
  "970422": "MB Bank",
  "970407": "Techcombank",
  "970415": "VietinBank",
  "970416": "ACB",
  "970432": "VPBank",
  "970423": "TPBank",
  "970403": "Sacombank",
  "970405": "Agribank",
};

function SessionLookup() {
  const [plate, setPlate] = useState("");
  const [step, setStep] = useState<LookupStep>("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [payosData, setPayosData] = useState<PayOSData | null>(null);

  // Gia hạn thêm ngày cho xe đã trả đủ, còn trong bãi
  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState(getDefaultDate());
  const [extendAfter22h, setExtendAfter22h] = useState<boolean | null>(null);
  const [extendPayos, setExtendPayos] = useState<PayOSData | null>(null);
  const [extendResult, setExtendResult] = useState<{
    extensionFee: number;
    expectedCheckOutAt?: string;
  } | null>(null);
  const [extendDone, setExtendDone] = useState(false);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (step === "session" || step === "payos_waiting") {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }
  }, [step]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payosStatus = params.get("payos_status");
    if (payosStatus === "success") {
      setStep("paid");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payosStatus === "cancelled") {
      setStep("session");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (step !== "payos_waiting" || !sessionInfo) return;
    const poll = setInterval(async () => {
      try {
        const r = await fetch(
          `${apiBaseUrl}/public/session/${sessionInfo.id}/payment-status`,
        );
        const d = await r.json();
        if (
          d.paymentStatus === "fully_paid" ||
          d.paymentStatus === "partial_paid" ||
          d.isCompleted
        ) {
          setStep("paid");
          clearInterval(poll);
        }
      } catch {
        /* silent */
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [step, sessionInfo]);

  useEffect(() => {
    if (!extendPayos || !sessionInfo) return;
    const poll = setInterval(async () => {
      try {
        const r = await fetch(
          `${apiBaseUrl}/public/session/${sessionInfo.id}/payment-status`,
        );
        const d = await r.json();
        if (d.paymentStatus === "fully_paid") {
          setExtendDone(true);
          setExtendPayos(null);
          clearInterval(poll);
        }
      } catch {
        /* silent */
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [extendPayos, sessionInfo]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!plate.trim()) {
      setError("Vui lòng nhập biển số xe.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const r = await fetch(
        `${apiBaseUrl}/public/lookup?plate=${encodeURIComponent(plate.trim())}`,
      );
      const d = await r.json();
      if (d.found && d.session) {
        setSessionInfo(d.session);
        // Phiên đã hoàn thành gần đây → hiển thị màn hình đã thanh toán
        setStep(d.session.isCompleted ? "completed" : "session");
      } else {
        setError(d.message || "Không tìm thấy phiên gửi xe.");
        setStep("not_found");
      }
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  async function handleProceedToPayment() {
    if (!sessionInfo) return;
    setLoading(true);
    setError("");
    try {
      // Chốt phí theo thời điểm hiện tại (check-in → bây giờ) ngay trước khi thanh toán.
      const feeRes = await fetch(`${apiBaseUrl}/public/calculate-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: sessionInfo.plate }),
      });
      const feeData = await feeRes.json();
      if (!feeRes.ok || !feeData.sessionId) {
        setError(feeData.message || "Không thể tính phí.");
        return;
      }

      const r = await fetch(
        `${apiBaseUrl}/transactions/session/${sessionInfo.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const d = await r.json();
      if (d.sessionPaymentStatus === "fully_paid") {
        setStep("paid");
      } else if (d.payos?.qrCode) {
        setPayosData(d.payos);
        setStep("payos_waiting");
      } else {
        setError(d.message || "Không thể tạo mã thanh toán.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckPayOS() {
    if (!sessionInfo?.id) return;
    setLoading(true);
    try {
      const r = await fetch(
        `${apiBaseUrl}/public/session/${sessionInfo.id}/payment-status`,
      );
      const d = await r.json();
      if (
        d.paymentStatus === "fully_paid" ||
        d.paymentStatus === "partial_paid" ||
        d.isCompleted
      ) {
        setStep("paid");
      } else {
        setError("Chưa nhận được thanh toán.");
        setTimeout(() => setError(""), 3000);
      }
    } catch {
      setError("Không thể kiểm tra thanh toán.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("search");
    setPlate("");
    setError("");
    setSessionInfo(null);
    setPayosData(null);
    setShowExtend(false);
    setExtendPayos(null);
    setExtendResult(null);
    setExtendDone(false);
    setExtendDate(getDefaultDate());
    setExtendAfter22h(null);
  }

  async function handleExtend() {
    if (!sessionInfo || extendAfter22h === null) return;
    setLoading(true);
    setError("");
    try {
      // Giờ ra mới = ngày đã chọn, 22:00 nếu sau 22h, ngược lại 21:00 (giống luồng trả trước)
      const exitHour = extendAfter22h ? 22 : 21;
      const [y, mo, da] = extendDate.split("-").map(Number);
      const expectedExtendTime = new Date(
        y,
        mo - 1,
        da,
        exitHour,
        0,
        0,
        0,
      ).toISOString();
      const r = await fetch(`${apiBaseUrl}/public/extend-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: sessionInfo.plate, expectedExtendTime }),
      });
      const d = await r.json();
      if (d.success) {
        setExtendResult({
          extensionFee: d.extensionFee,
          expectedCheckOutAt: d.expectedCheckOutAt,
        });
        if (d.payos?.qrCode) {
          setExtendPayos(d.payos);
        } else if (d.extensionFee === 0) {
          setExtendDone(true);
        }
      } else {
        setError(d.message || "Không thể gia hạn.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckExtendPayment() {
    if (!sessionInfo?.id) return;
    setLoading(true);
    try {
      const r = await fetch(
        `${apiBaseUrl}/public/session/${sessionInfo.id}/payment-status`,
      );
      const d = await r.json();
      if (d.paymentStatus === "fully_paid") {
        setExtendDone(true);
        setExtendPayos(null);
      } else {
        setError("Chưa nhận được thanh toán gia hạn.");
        setTimeout(() => setError(""), 3000);
      }
    } catch {
      setError("Không thể kiểm tra thanh toán.");
    } finally {
      setLoading(false);
    }
  }

  const durationMs = sessionInfo
    ? now - new Date(sessionInfo.checkInAt).getTime()
    : 0;
  const amountToPay = sessionInfo
    ? Math.max(0, (sessionInfo.currentFee || 0) - (sessionInfo.paidAmount || 0))
    : 0;

  return (
    <section id="tra-cuu" className="landing-lookup">
      <div className="landing-section-header">
        <p className="landing-section-eyebrow">Khi ra bãi</p>
        <h2>Tra cứu &amp; thanh toán</h2>
        <p>
          Nhập biển số — hệ thống tự tính phí theo thời gian gửi thực tế và quy
          định bãi xe.
        </p>
      </div>

      <div className="landing-lookup-card">
        {/* ── Search ── */}
        {step === "search" && (
          <form className="landing-lookup-form" onSubmit={handleSearch}>
            <p>Nhập biển số xe để xem thông tin phiên gửi.</p>
            <label htmlFor="plate">Biển số xe</label>
            <div className="landing-lookup-input-row">
              <input
                id="plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="VD: 51K-238.79"
                autoComplete="off"
              />
              <button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Search size={18} />
                )}
                Tra cứu
              </button>
            </div>
            {error && (
              <p
                style={{
                  color: "var(--landing-danger)",
                  fontSize: "13px",
                  marginTop: "8px",
                }}
              >
                {error}
              </p>
            )}
          </form>
        )}

        {/* ── Not Found ── */}
        {step === "not_found" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
            <p
              style={{ color: "var(--landing-fg-muted)", marginBottom: "16px" }}
            >
              {error}
            </p>
            <button className="landing-btn-secondary" onClick={reset}>
              Tra cứu biển số khác
            </button>
          </div>
        )}

        {/* ── Completed (already paid recently) ── */}
        {step === "completed" && sessionInfo && (
          <div className="landing-session-details">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <span className="landing-plate-badge">{sessionInfo.plate}</span>
              <span className="landing-status-badge success">
                Đã thanh toán
              </span>
            </div>
            <div
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "20px",
                color: "#22c55e",
                fontSize: "13px",
              }}
            >
              <BadgeCheck
                size={16}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                  marginRight: "8px",
                }}
              />
              Xe đã thanh toán gần đây. Không cần thanh toán thêm.
            </div>
            <div className="landing-session-meta">
              {sessionInfo.checkInAt && (
                <div className="landing-session-meta-item">
                  <Clock size={14} />
                  <span>
                    Giờ vào:{" "}
                    <strong>
                      {new Date(sessionInfo.checkInAt).toLocaleTimeString(
                        "vi-VN",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </strong>
                  </span>
                </div>
              )}
              {sessionInfo.checkOutAt && (
                <div className="landing-session-meta-item">
                  <Clock size={14} />
                  <span>
                    Giờ ra:{" "}
                    <strong>
                      {new Date(sessionInfo.checkOutAt).toLocaleTimeString(
                        "vi-VN",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </strong>
                  </span>
                </div>
              )}
              {sessionInfo.slot && (
                <div className="landing-session-meta-item">
                  <MapPin size={14} />
                  <span>
                    Vị trí: <strong>{sessionInfo.slot}</strong>
                  </span>
                </div>
              )}
            </div>
            <div
              style={{
                background: "var(--landing-bg)",
                border: "1px solid var(--landing-border)",
                borderRadius: "10px",
                padding: "16px",
                marginTop: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: 600,
                  marginBottom: "12px",
                }}
              >
                <Receipt size={16} color="var(--landing-accent)" /> Biên nhận
                thanh toán
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                  fontSize: "13px",
                }}
              >
                <span style={{ color: "var(--landing-fg-muted)" }}>
                  Biển số
                </span>
                <span style={{ fontWeight: 600 }}>{sessionInfo.plate}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                  fontSize: "13px",
                }}
              >
                <span style={{ color: "var(--landing-fg-muted)" }}>Vị trí</span>
                <span>{sessionInfo.slot || "—"}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                  fontSize: "13px",
                }}
              >
                <span style={{ color: "var(--landing-fg-muted)" }}>
                  Phí gửi xe
                </span>
                <span style={{ fontWeight: 600 }}>
                  {formatVND(
                    sessionInfo.currentFee || sessionInfo.paidAmount || 0,
                  )}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                }}
              >
                <span style={{ color: "var(--landing-fg-muted)" }}>
                  Thanh toán
                </span>
                <span
                  style={{ fontWeight: 700, color: "var(--landing-primary)" }}
                >
                  {formatVND(
                    sessionInfo.paidAmount || sessionInfo.currentFee || 0,
                  )}
                </span>
              </div>
            </div>
            <button
              className="landing-btn-secondary"
              onClick={reset}
              style={{ width: "100%", marginTop: "20px" }}
              type="button"
            >
              Tra cứu phiên khác
            </button>
          </div>
        )}

        {/* ── Session ── */}
        {step === "session" && sessionInfo && (
          <div className="landing-session-details">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <span className="landing-plate-badge">{sessionInfo.plate}</span>
              <span
                className={`landing-status-badge ${sessionInfo.paymentStatus === "fully_paid" ? "success" : sessionInfo.paymentStatus === "partial_paid" ? "warning" : ""}`}
              >
                {sessionInfo.paymentStatus === "fully_paid"
                  ? "Đã thanh toán"
                  : sessionInfo.paymentStatus === "partial_paid"
                    ? "Thanh toán một phần"
                    : "Chưa thanh toán"}
              </span>
            </div>

            <div className="landing-session-meta">
              <div className="landing-session-meta-item">
                <Clock size={14} />
                <span>
                  Đã gửi: <strong>{formatDuration(durationMs)}</strong>
                </span>
              </div>
              <div className="landing-session-meta-item">
                <MapPin size={14} />
                <span>
                  Vị trí: <strong>{sessionInfo.slot}</strong>
                </span>
              </div>
              <div className="landing-session-meta-item">
                <span>
                  Giờ vào:{" "}
                  <strong>
                    {new Date(sessionInfo.checkInAt).toLocaleTimeString(
                      "vi-VN",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </strong>
                </span>
              </div>
              {sessionInfo.checkInDate && (
                <div className="landing-session-meta-item">
                  <span>
                    Ngày vào: <strong>{sessionInfo.checkInDate}</strong>
                  </span>
                  {sessionInfo.checkInDate &&
                    !isSameDay(new Date(sessionInfo.checkInAt), new Date()) && (
                      <span
                        style={{
                          marginLeft: "4px",
                          fontSize: "11px",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: "rgba(251,191,36,0.15)",
                          color: "#fbbf24",
                        }}
                      >
                        Khác ngày hôm nay
                      </span>
                    )}
                </div>
              )}
            </div>

            {/* Prepaid notice — only when fully paid */}
            {sessionInfo.paymentStatus === "fully_paid" &&
              !sessionInfo.prepaidCheckoutAt && (
                <div
                  style={{
                    background: "rgba(34,197,94,0.1)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    borderRadius: "8px",
                    padding: "12px",
                    marginTop: "16px",
                    color: "#22c55e",
                    fontSize: "13px",
                  }}
                >
                  <BadgeCheck
                    size={16}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: "8px",
                    }}
                  />
                  Xe đã thanh toán đủ. Ra bãi bất kỳ lúc nào!
                </div>
              )}

            {/* Gia hạn — cho xe đã trả đủ, còn trong bãi */}
            {sessionInfo.paymentStatus === "fully_paid" && (
              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--landing-border)",
                }}
              >
                {extendDone ? (
                  <div
                    style={{
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      borderRadius: "8px",
                      padding: "12px",
                      color: "#22c55e",
                      fontSize: "13px",
                    }}
                  >
                    <BadgeCheck
                      size={16}
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                        marginRight: "8px",
                      }}
                    />
                    Gia hạn thành công!{" "}
                    {extendResult?.expectedCheckOutAt &&
                      `Giờ ra mới: ${new Date(extendResult.expectedCheckOutAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}`}
                  </div>
                ) : extendPayos ? (
                  <div style={{ textAlign: "center" }}>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "var(--landing-fg-muted)",
                        marginBottom: "4px",
                      }}
                    >
                      Phí gia hạn cần thanh toán
                    </p>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: 800,
                        color: "var(--landing-primary)",
                        marginBottom: "12px",
                      }}
                    >
                      {formatVND(
                        extendResult?.extensionFee ?? extendPayos.amount,
                      )}
                    </div>
                    <div
                      style={{
                        background: "#fff",
                        padding: 12,
                        borderRadius: 12,
                        display: "inline-flex",
                        marginBottom: "12px",
                      }}
                    >
                      <QRCodeSVG
                        value={extendPayos.qrCode}
                        size={160}
                        level="M"
                        marginSize={0}
                      />
                    </div>
                    <div
                      className="landing-qr-account"
                      style={{ fontSize: "12px", marginBottom: "12px" }}
                    >
                      {extendPayos.accountNumber && (
                        <p>
                          {extendPayos.bin && BANK_NAMES[extendPayos.bin]
                            ? `${BANK_NAMES[extendPayos.bin]} · `
                            : ""}
                          {extendPayos.accountNumber}
                        </p>
                      )}
                      {extendPayos.accountName && (
                        <p>{extendPayos.accountName}</p>
                      )}
                      <p>Mã đơn: {extendPayos.orderCode}</p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {extendPayos.checkoutUrl && (
                        <button
                          className="landing-qr-btn"
                          style={{ background: "var(--landing-secondary)" }}
                          onClick={() =>
                            window.open(extendPayos.checkoutUrl, "_blank")
                          }
                          type="button"
                        >
                          <ExternalLink size={16} />
                          Mở PayOS
                        </button>
                      )}
                      <button
                        className="landing-qr-btn"
                        style={{ background: "var(--landing-accent)" }}
                        onClick={handleCheckExtendPayment}
                        disabled={loading}
                        type="button"
                      >
                        <RefreshCw
                          size={16}
                          className={loading ? "animate-spin" : ""}
                        />
                        Kiểm tra thanh toán
                      </button>
                    </div>
                  </div>
                ) : showExtend ? (
                  <div>
                    <h4 style={{ marginBottom: "12px", fontSize: "14px" }}>
                      Gia hạn thêm thời gian gửi xe
                    </h4>

                    {/* Chọn ngày ra mới */}
                    <div style={{ marginBottom: "12px" }}>
                      <label
                        style={{
                          fontSize: "12px",
                          color: "var(--landing-fg-muted)",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Ngày dự kiến lấy xe
                      </label>
                      <input
                        type="date"
                        value={extendDate}
                        min={(() => {
                          const d = new Date();
                          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                        })()}
                        onChange={(e) => {
                          setExtendDate(e.target.value);
                          setExtendAfter22h(null);
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid var(--landing-border)",
                          borderRadius: "6px",
                          background: "var(--landing-bg)",
                          color: "var(--landing-fg)",
                          fontSize: "14px",
                        }}
                      />
                    </div>

                    {/* Trước / sau 22h */}
                    <div style={{ marginBottom: "12px" }}>
                      <label
                        style={{
                          fontSize: "12px",
                          color: "var(--landing-fg-muted)",
                          display: "block",
                          marginBottom: "8px",
                        }}
                      >
                        Bạn dự kiến lấy xe
                      </label>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setExtendAfter22h(false)}
                          style={{
                            padding: "12px 8px",
                            border: `1.5px solid ${extendAfter22h === false ? "var(--landing-primary)" : "var(--landing-border)"}`,
                            borderRadius: "8px",
                            background:
                              extendAfter22h === false
                                ? "rgba(59,130,246,0.1)"
                                : "transparent",
                            color:
                              extendAfter22h === false
                                ? "#3b82f6"
                                : "var(--landing-fg)",
                            fontWeight: extendAfter22h === false ? 600 : 400,
                            cursor: "pointer",
                            fontSize: "13px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "15px",
                              fontWeight: 700,
                              marginBottom: "2px",
                            }}
                          >
                            ☀ Trước 22h
                          </div>
                          <div style={{ opacity: 0.7 }}>5.000đ/ngày</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExtendAfter22h(true)}
                          style={{
                            padding: "12px 8px",
                            border: `1.5px solid ${extendAfter22h === true ? "var(--landing-primary)" : "var(--landing-border)"}`,
                            borderRadius: "8px",
                            background:
                              extendAfter22h === true
                                ? "rgba(59,130,246,0.1)"
                                : "transparent",
                            color:
                              extendAfter22h === true
                                ? "#3b82f6"
                                : "var(--landing-fg)",
                            fontWeight: extendAfter22h === true ? 600 : 400,
                            cursor: "pointer",
                            fontSize: "13px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "15px",
                              fontWeight: 700,
                              marginBottom: "2px",
                            }}
                          >
                            🌙 Sau 22h
                          </div>
                          <div style={{ opacity: 0.7 }}>10.000đ/ngày</div>
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="landing-btn-secondary"
                        onClick={() => setShowExtend(false)}
                        type="button"
                        style={{ flex: 1 }}
                      >
                        Hủy
                      </button>
                      <button
                        className="landing-btn-primary"
                        onClick={handleExtend}
                        disabled={loading || extendAfter22h === null}
                        type="button"
                        style={{ flex: 2 }}
                      >
                        {loading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Clock size={16} />
                        )}
                        Gia hạn &amp; thanh toán
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="landing-btn-secondary"
                    onClick={() => setShowExtend(true)}
                    type="button"
                    style={{ width: "100%" }}
                  >
                    <Clock size={16} />
                    Gia hạn thêm giờ gửi xe
                  </button>
                )}
              </div>
            )}

            {/* Partial paid notice */}
            {sessionInfo.paymentStatus === "partial_paid" && (
              <div
                style={{
                  background: "rgba(251,191,36,0.1)",
                  border: "1px solid rgba(251,191,36,0.3)",
                  borderRadius: "8px",
                  padding: "12px",
                  marginTop: "16px",
                  color: "#fbbf24",
                  fontSize: "13px",
                }}
              >
                <BadgeCheck
                  size={16}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: "8px",
                  }}
                />
                Đã thanh toán {formatVND(sessionInfo.paidAmount ?? 0)}. Vui lòng
                thanh toán phần còn lại để ra bãi.
              </div>
            )}

            {/* Fee summary — only if not fully paid. Phí tính từ giờ vào đến hiện tại. */}
            {sessionInfo.paymentStatus !== "fully_paid" && (
              <div
                style={{
                  marginTop: "24px",
                  paddingTop: "20px",
                  borderTop: "1px solid var(--landing-border)",
                }}
              >
                <h4 style={{ marginBottom: "12px", fontSize: "14px" }}>
                  Phí gửi xe tạm tính
                </h4>

                <div
                  style={{
                    background: "var(--landing-bg)",
                    border: "1px solid var(--landing-border)",
                    borderRadius: "10px",
                    padding: "16px",
                  }}
                >
                  {/* Daily breakdown rows */}
                  {sessionInfo.feeBreakdown?.dailyBreakdown?.map((day) => (
                    <div
                      key={day.dayIndex}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 0",
                        borderBottom:
                          day.dayIndex <
                          (sessionInfo.feeBreakdown?.dailyBreakdown?.length ??
                            0) -
                            1
                            ? "1px solid rgba(255,255,255,0.05)"
                            : "none",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "13px" }}>
                          {day.date}
                          {day.dayIndex > 0 && ` (+${day.dayIndex} ngày)`}
                        </span>
                        <span
                          style={{
                            marginLeft: "6px",
                            fontSize: "11px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background:
                              day.rateType === "night"
                                ? "rgba(251,191,36,0.15)"
                                : "rgba(59,130,246,0.15)",
                            color:
                              day.rateType === "night" ? "#fbbf24" : "#60a5fa",
                          }}
                        >
                          {day.rateType === "night" ? "ban đêm" : "ban ngày"}
                        </span>
                      </div>
                      <span style={{ fontWeight: 600 }}>
                        {formatVND(day.fee)}
                      </span>
                    </div>
                  ))}

                  {/* Vi phạm & tiền phạt — đỗ lấn vạch */}
                  {sessionInfo.penalties &&
                    sessionInfo.penalties.length > 0 && (
                      <div
                        style={{
                          marginTop: "12px",
                          paddingTop: "12px",
                          borderTop: "1px dashed rgba(239,68,68,0.4)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            color: "#ef4444",
                            fontSize: "13px",
                            fontWeight: 600,
                            marginBottom: "8px",
                          }}
                        >
                          <ShieldCheck size={14} /> Vi phạm &amp; tiền phạt
                        </div>
                        {sessionInfo.penalties.map((pen, i) => (
                          <div key={i} style={{ marginBottom: "10px" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: "13px",
                              }}
                            >
                              <span>{pen.reason || "Đỗ lấn vạch"}</span>
                              <span
                                style={{ fontWeight: 600, color: "#ef4444" }}
                              >
                                {formatVND(pen.amount)}
                              </span>
                            </div>
                            {pen.evidenceImageUrl && (
                              <a
                                href={`${apiBaseUrl.replace(/\/api$/, "")}${pen.evidenceImageUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-block",
                                  marginTop: "6px",
                                }}
                              >
                                <img
                                  src={`${apiBaseUrl.replace(/\/api$/, "")}${pen.evidenceImageUrl}`}
                                  alt="Bằng chứng vi phạm"
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: "160px",
                                    borderRadius: "8px",
                                    border: "1px solid var(--landing-border)",
                                  }}
                                />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                  <hr
                    className="landing-fee-divider"
                    style={{ margin: "12px 0" }}
                  />

                  {sessionInfo.paymentStatus === "partial_paid" &&
                    (sessionInfo.paidAmount ?? 0) > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "13px",
                          color: "var(--landing-fg-muted)",
                          marginBottom: "8px",
                        }}
                      >
                        <span>Đã thanh toán</span>
                        <span>-{formatVND(sessionInfo.paidAmount ?? 0)}</span>
                      </div>
                    )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>
                      {amountToPay === 0
                        ? "Đã thanh toán đủ"
                        : sessionInfo.paymentStatus === "partial_paid"
                          ? "Còn phải thanh toán"
                          : "Cần thanh toán"}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "18px",
                        color: "var(--landing-primary)",
                      }}
                    >
                      {formatVND(amountToPay)}
                    </span>
                  </div>

                  <button
                    className="landing-btn-primary"
                    onClick={handleProceedToPayment}
                    disabled={loading}
                    style={{ width: "100%", padding: "14px" }}
                    type="button"
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CreditCard size={16} />
                    )}
                    {amountToPay === 0
                      ? "Xác nhận đã thanh toán"
                      : `Thanh toán ${formatVND(amountToPay)}`}
                  </button>
                </div>
              </div>
            )}

            {(sessionInfo.paymentStatus === "fully_paid" ||
              sessionInfo.paymentStatus === "partial_paid") && (
              <button
                className="landing-btn-secondary"
                onClick={reset}
                style={{ width: "100%", marginTop: "20px" }}
                type="button"
              >
                Tra cứu phiên khác
              </button>
            )}

            <button
              onClick={reset}
              style={{
                marginTop: "12px",
                background: "none",
                border: "none",
                color: "var(--landing-fg-muted)",
                cursor: "pointer",
                fontSize: "13px",
              }}
              type="button"
            >
              ← Tra cứu biển số khác
            </button>
          </div>
        )}

        {/* ── PayOS Waiting ── */}
        {step === "payos_waiting" && payosData && (
          <div className="landing-session-result">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              {sessionInfo && (
                <span className="landing-plate-badge">{sessionInfo.plate}</span>
              )}
              <span className="landing-status-badge warning">
                Đang chờ thanh toán
              </span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "14px",
                  color: "var(--landing-fg-muted)",
                  marginBottom: "8px",
                }}
              >
                Số tiền thanh toán
              </div>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: "var(--landing-primary)",
                  marginBottom: "24px",
                }}
              >
                {formatVND(amountToPay)}
              </div>
            </div>
            <div className="landing-qr-section">
              <p className="landing-qr-title">Quét mã QR để thanh toán</p>
              <div
                className="landing-qr-box"
                style={{
                  background: "#fff",
                  padding: 12,
                  borderRadius: 12,
                  display: "inline-flex",
                }}
              >
                <QRCodeSVG
                  value={payosData.qrCode}
                  size={180}
                  level="M"
                  marginSize={0}
                />
              </div>
              <div className="landing-qr-account">
                {payosData.accountName && (
                  <p>
                    {payosData.bin && BANK_NAMES[payosData.bin]
                      ? `${BANK_NAMES[payosData.bin]} · `
                      : ""}
                    {payosData.accountNumber}
                  </p>
                )}
                {payosData.accountName && <p>{payosData.accountName}</p>}
                <p>Mã đơn: {payosData.orderCode}</p>
                {payosData.description && (
                  <p>Nội dung: {payosData.description}</p>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  color: "var(--landing-fg-muted)",
                  fontSize: "14px",
                  marginTop: "16px",
                }}
              >
                <Loader2 size={16} className="animate-spin" />
                Đang chờ thanh toán...
              </div>
              {payosData.checkoutUrl && (
                <button
                  className="landing-qr-btn"
                  style={{
                    marginTop: "12px",
                    background: "var(--landing-secondary)",
                  }}
                  onClick={() => window.open(payosData.checkoutUrl, "_blank")}
                  type="button"
                >
                  <ExternalLink size={16} />
                  Mở trang thanh toán PayOS
                </button>
              )}
              <button
                className="landing-qr-btn"
                style={{
                  marginTop: "10px",
                  background: "var(--landing-accent)",
                }}
                onClick={handleCheckPayOS}
                disabled={loading}
                type="button"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Kiểm tra thanh toán
              </button>
            </div>
            <button
              onClick={() => setStep("session")}
              style={{
                marginTop: "12px",
                background: "none",
                border: "none",
                color: "var(--landing-fg-muted)",
                cursor: "pointer",
                fontSize: "13px",
                display: "block",
                width: "100%",
                textAlign: "center",
              }}
              type="button"
            >
              ← Quay lại
            </button>
          </div>
        )}

        {/* ── Paid ── */}
        {step === "paid" && (
          <div className="landing-success">
            <div className="landing-success-icon">
              <BadgeCheck size={36} />
            </div>
            <h3>Thanh toán thành công!</h3>
            <p>
              Phiên gửi xe đã được thanh toán. Bạn có thể ra bãi bất kỳ lúc nào.
            </p>
            <div
              style={{
                background: "var(--landing-bg)",
                border: "1px solid var(--landing-border)",
                borderRadius: "12px",
                padding: "16px",
                width: "100%",
                maxWidth: "320px",
                textAlign: "left",
                marginTop: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: 600,
                  marginBottom: "12px",
                }}
              >
                <Receipt size={16} color="var(--landing-accent)" /> Biên nhận
              </div>
              {sessionInfo && (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ color: "var(--landing-fg-muted)" }}>
                      Biển số
                    </span>
                    <span style={{ fontWeight: 600 }}>{sessionInfo.plate}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ color: "var(--landing-fg-muted)" }}>
                      Vị trí
                    </span>
                    <span>{sessionInfo.slot}</span>
                  </div>
                </>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                }}
              >
                <span style={{ color: "var(--landing-fg-muted)" }}>
                  Thanh toán
                </span>
                <span
                  style={{ fontWeight: 700, color: "var(--landing-primary)" }}
                >
                  {formatVND(amountToPay)}
                </span>
              </div>
            </div>
            <button
              className="landing-btn-secondary"
              onClick={reset}
              style={{ marginTop: "16px" }}
              type="button"
            >
              Tra cứu phiên khác
            </button>
          </div>
        )}

        {error && step !== "not_found" && (
          <p
            style={{
              color: "var(--landing-danger)",
              fontSize: "13px",
              marginTop: "12px",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Pricing Section ───────────────────────────────────────────────
type PricingConfig = {
  dayRate: number;
  nightRate: number;
  dayStartHour: number;
  nightStartHour: number;
  gracePeriod: number;
  maxMinutes: number;
};

type PlanData = {
  _id: string;
  name: string;
  description?: string;
  duration: string;
  durationDays: number;
  price: number;
  maxVehicles: number;
  isActive: boolean;
};

function PricingSection() {
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${apiBaseUrl}/public/pricing`)
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${apiBaseUrl}/public/subscription-plans`)
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([pricingData, plansData]) => {
      if (pricingData?.dayRate) setPricing(pricingData);
      if (plansData?.plans?.length) setPlans(plansData.plans);
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return (
      <section id="bang-gia" className="landing-pricing">
        <div className="landing-section-header">
          <p className="landing-section-eyebrow">Bảng giá</p>
          <h2>Bảng giá &amp; gói gửi xe</h2>
          <p>Khách vãng lai trả theo lượt — minh bạch, không phí ẩn.</p>
        </div>
        <div className="pkpricing-loading">
          <Loader2 size={24} className="animate-spin" />
          <span>Đang tải bảng giá…</span>
        </div>
      </section>
    );
  }

  const dayRate = pricing?.dayRate ?? 5000;
  const nightRate = pricing?.nightRate ?? 10000;
  const nightStartHour = pricing?.nightStartHour ?? 22;
  const dayStartHour = pricing?.dayStartHour ?? 6;

  const dayName = "Gửi theo lượt";
  const dayId = "guest";
  const dayFeatures = [
    "Không cần đăng ký",
    "Thanh toán PayOS",
    "Ra bãi tự động",
    "Camera AI nhận diện",
  ];

  return (
    <section id="bang-gia" className="landing-pricing">
      <div className="landing-section-header">
        <p className="landing-section-eyebrow">Bảng giá</p>
        <h2>Bảng giá &amp; gói gửi xe</h2>
        <p>Khách vãng lai trả theo lượt — minh bạch, không phí ẩn.</p>
      </div>

      {/* ── Guest rate cards ── */}
      {pricing && (
        <div className="pkpricing-guest-grid">
          <div className="pkpricing-guest-card">
            <div className="pkpricing-guest-card-icon">☀</div>
            <div className="pkpricing-guest-card-label">Gửi ban ngày</div>
            <div className="pkpricing-guest-card-rate">
              {formatVND(dayRate)}
            </div>
            <div className="pkpricing-guest-card-unit">/ ngày</div>
            <div className="pkpricing-guest-card-detail">
              Ra xe trước {nightStartHour}h — áp dụng từ {dayStartHour}h
            </div>
          </div>

          <div className="pkpricing-guest-card pkpricing-guest-card--night">
            <div className="pkpricing-guest-card-icon">🌙</div>
            <div className="pkpricing-guest-card-label">Gửi ban đêm</div>
            <div className="pkpricing-guest-card-rate">
              {formatVND(nightRate)}
            </div>
            <div className="pkpricing-guest-card-unit">/ ngày</div>
            <div className="pkpricing-guest-card-detail">
              Ra xe từ {nightStartHour}h trở đi
            </div>
          </div>

          {pricing.gracePeriod > 0 && (
            <div className="pkpricing-guest-card pkpricing-guest-card--grace">
              <div className="pkpricing-guest-card-icon">🕐</div>
              <div className="pkpricing-guest-card-label">Miễn phí</div>
              <div className="pkpricing-guest-card-rate">
                {pricing.gracePeriod}
              </div>
              <div className="pkpricing-guest-card-unit">phút đầu</div>
              <div className="pkpricing-guest-card-detail">
                Thời gian miễn phí khi vào bãi
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section: Gói thành viên ── */}
      {plans.length > 0 && (
        <div className="pkpricing-plans-section">
          <div className="pkpricing-plans-header">
            <h3>Gói thành viên</h3>
            <p>
              Đăng ký gói để gửi xe không giới hạn trong suốt thời gian hiệu
              lực.
            </p>
          </div>
          <div className="pkpricing-plans-grid">
            {plans.map((plan, idx) => {
              const isHighlight = plan.duration === "monthly";
              const durationLabel =
                plan.duration === "monthly"
                  ? "Tháng"
                  : plan.duration === "quarterly"
                    ? "Quý"
                    : "Năm";
              return (
                <div
                  className={`pkpricing-plan-card ${isHighlight ? "featured" : ""}`}
                  key={plan._id ?? `plan-${idx}`}
                >
                  {isHighlight && (
                    <span className="pkpricing-plan-badge">Phổ biến nhất</span>
                  )}
                  <div className="pkpricing-plan-name">
                    {plan.name || `Gói ${durationLabel}`}
                  </div>
                  <div className="pkpricing-plan-price">
                    <span className="pkpricing-plan-amount">
                      {formatVND(plan.price)}
                    </span>
                    <span className="pkpricing-plan-unit">
                      /
                      {plan.durationDays >= 365
                        ? "năm"
                        : plan.durationDays >= 90
                          ? "quý"
                          : "tháng"}
                    </span>
                  </div>
                  {plan.description && (
                    <p className="pkpricing-plan-desc">{plan.description}</p>
                  )}
                  <ul className="pkpricing-plan-features">
                    <li>
                      <Check size={13} />
                      {plan.durationDays} ngày sử dụng
                    </li>
                    <li>
                      <Check size={13} />
                      {plan.maxVehicles === -1
                        ? "Không giới hạn xe"
                        : `Tối đa ${plan.maxVehicles} biển số`}
                    </li>
                    <li>
                      <Check size={13} />
                      Ra vào không giới hạn
                    </li>
                    <li>
                      <Check size={13} />
                      Camera AI tự động
                    </li>
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Availability Section ─────────────────────────────────────────
function AvailabilitySection() {
  return (
    <section id="chỗ-trống" className="landing-availability">
      <div className="landing-section-header">
        <p className="landing-section-eyebrow">Chỗ trống realtime</p>
        <h2>Tình trạng bãi đỗ xe</h2>
        <p>Cập nhật tự động mỗi 30 giây — tìm chỗ đỗ gần nhất</p>
      </div>
      <ParkingAvailability />
    </section>
  );
}

// ─── Contact Section ───────────────────────────────────────────────
function ContactSection() {
  return (
    <section id="liên-hệ" className="landing-contact">
      <div className="landing-section-header">
        <p className="landing-section-eyebrow">Liên hệ</p>
        <h2>Ban quản lý bãi đỗ xe</h2>
      </div>
      <div className="landing-contact-grid">
        <div className="landing-contact-item">
          <MapPin size={20} />
          <div>
            <strong>Địa chỉ</strong>
            <p>{parkingConfig.address}</p>
          </div>
        </div>
        <div className="landing-contact-item">
          <Mail size={20} />
          <div>
            <strong>Email</strong>
            <p>{parkingConfig.contactEmail}</p>
          </div>
        </div>
        <div className="landing-contact-item">
          <Phone size={20} />
          <div>
            <strong>Hotline</strong>
            <p>{parkingConfig.hotline}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-left">
          <CircleParking size={18} />
          <span>© 2026 iPARK — Bãi đỗ xe thông minh tích hợp AI.</span>
        </div>
        <span>Hỗ trợ: 1900 1234 · Gặp bảo vệ tại quầy nếu cần trợ giúp.</span>
      </div>
    </footer>
  );
}

// ─── Main Public Landing ───────────────────────────────────────────
export function PublicLanding() {
  const [available, setAvailable] = useState(153);
  const [liveStats, setLiveStats] = useState({ active: 0, available: 0 });
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`${apiBaseUrl}/public/availability`);
        if (r.ok) {
          const d = await r.json();
          setAvailable(d.available || 0);
          setLiveStats({
            available: d.available,
            active: d.capacity - d.available,
          });
        }
      } catch {
        /* silent */
      }
    }
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="landing-shell">
      <SiteHeader
        available={available}
        onLoginClick={() => setShowAuth(true)}
      />
      <HeroSection
        liveStats={liveStats}
        onLoginClick={() => setShowAuth(true)}
      />
      <main className="landing-main">
        <HowItWorks />
        <PricingSection />
        <AvailabilitySection />
        <ContactSection />
      </main>
      <LandingFooter />
      {showAuth && (
        <div className="landing-auth-modal" onClick={() => setShowAuth(false)}>
          <div
            className="landing-auth-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="landing-auth-modal-close"
              onClick={() => setShowAuth(false)}
              type="button"
            >
              ✕
            </button>
            <AuthPanel />
          </div>
        </div>
      )}
    </div>
  );
}
