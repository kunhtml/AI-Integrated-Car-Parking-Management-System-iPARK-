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
import { apiBaseUrl } from "@/lib/constants";
import { parkingConfig } from "@/lib/parking-config";

// ─── Types ────────────────────────────────────────────────────────
type ZoneAvailability = {
  zone: string;
  description?: string;
  total: number;
  available: number;
  occupied: number;
  allowedVehicleTypes: string[];
};

// ─── Passes ────────────────────────────────────────────────────────
const PASSES = [
  {
    id: "luot",
    name: "Gửi theo lượt",
    price: "15.000đ",
    unit: "/2 giờ đầu",
    note: "+8.000đ mỗi giờ tiếp theo",
    highlight: false,
    features: ["Không cần đăng ký", "Thanh toán PayOS", "Ra bãi tự động"],
  },
  {
    id: "ngay",
    name: "Vé ngày",
    price: "80.000đ",
    unit: "/ngày",
    note: "Trần phí tối đa trong ngày",
    highlight: true,
    features: ["Ra vào trong ngày", "Tiết kiệm cho gửi lâu", "Thanh toán PayOS"],
  },
  {
    id: "thang",
    name: "Gói tháng",
    price: "990.000đ",
    unit: "/tháng",
    note: "Dành cho thành viên VIP",
    highlight: false,
    features: ["Ra vào không giới hạn", "Ưu tiên chỗ trống", "Cần tài khoản"],
  },
];

const STEPS = [
  { icon: Camera, title: "Camera nhận diện biển số", desc: "AI tự động đọc biển số khi xe tới cổng, barie mở trong ~3 giây." },
  { icon: QrCode, title: "Nhận vé điện tử QR", desc: "Mỗi xe có một mã phiên gửi xe duy nhất, thay cho vé giấy." },
  { icon: CreditCard, title: "Thanh toán PayOS", desc: "Tra cứu phí theo biển số và quét mã QR PayOS để trả, không cần tiền mặt." },
  { icon: DoorOpen, title: "Ra bãi tự động", desc: "Sau khi thanh toán, hệ thống đóng phiên và mở barie ra." },
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
function ParkingAvailability() {
  const [zones, setZones] = useState<ZoneAvailability[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ zone: string; description?: string; available: number; total: number }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`${apiBaseUrl}/public/availability`);
        if (r.ok) { const d = await r.json(); setZones(d.zones); setTotalAvailable(d.available); setTotalCapacity(d.capacity); setLoaded(true); }
      } catch { /* silent */ }
    }
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    try {
      const r = await fetch(`${apiBaseUrl}/public/search?q=${encodeURIComponent(searchQuery)}`);
      if (r.ok) { const d = await r.json(); setSearchResults(d.results); }
    } catch { /* silent */ }
  }

  const fillRate = totalCapacity > 0 ? Math.round(((totalCapacity - totalAvailable) / totalCapacity) * 100) : 0;

  return (
    <div className="landing-avail">
      {loaded && (
        <div className="landing-avail-stats">
          <div className="landing-avail-stat">
            <div className="landing-avail-stat-icon green"><Car size={20} /></div>
            <div><span className="landing-avail-stat-value">{totalAvailable}</span><span className="landing-avail-stat-label">Chỗ trống</span></div>
          </div>
          <div className="landing-avail-stat">
            <div className="landing-avail-stat-icon blue"><CheckCircle2 size={20} /></div>
            <div><span className="landing-avail-stat-value">{totalCapacity}</span><span className="landing-avail-stat-label">Tổng sức chứa</span></div>
          </div>
          <div className="landing-avail-stat">
            <div className="landing-avail-stat-icon orange"><Zap size={20} /></div>
            <div><span className="landing-avail-stat-value">{fillRate}%</span><span className="landing-avail-stat-label">Tỷ lệ lấp đầy</span></div>
          </div>
        </div>
      )}
      <div className="landing-avail-search">
        <Search size={18} className="landing-avail-search-icon" />
        <input onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Tìm khu vực đỗ xe, loại xe..." value={searchQuery} />
        <button onClick={handleSearch} type="button">Tìm kiếm</button>
      </div>
      {searchResults.length > 0 && (
        <div className="landing-avail-zones">
          {searchResults.map((r) => (
            <div className="landing-avail-zone" key={r.zone}>
              <div className="landing-avail-zone-header"><h4>Khu {r.zone}</h4><span className="badge success">{r.available} trống</span></div>
              {r.description && <p className="landing-avail-zone-desc">{r.description}</p>}
              <div className="landing-avail-zone-bar"><div style={{ width: `${r.total > 0 ? ((r.total - r.available) / r.total) * 100 : 0}%` }} /></div>
            </div>
          ))}
        </div>
      )}
      {loaded && (
        <div className="landing-avail-zones">
          {zones.map((zone) => (
            <div className="landing-avail-zone" key={zone.zone}>
              <div className="landing-avail-zone-header">
                <h4>Khu {zone.zone}</h4>
                <span className={`badge ${zone.available > 0 ? "success" : "warning"}`}>{zone.available > 0 ? `${zone.available} trống` : "Đầy"}</span>
              </div>
              <p className="landing-avail-zone-desc">{zone.description || "Khu đỗ xe"}</p>
              <div className="landing-avail-zone-meta"><span>{zone.allowedVehicleTypes.join(", ")}</span><span>{zone.occupied}/{zone.total} đang đỗ</span></div>
              <div className="landing-avail-zone-bar">
                <div style={{ width: `${zone.total > 0 ? ((zone.total - zone.available) / zone.total) * 100 : 0}%`, background: zone.available > 0 ? "var(--landing-success)" : "var(--landing-danger)" }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {!loaded && <p style={{ textAlign: "center", padding: 40, color: "var(--landing-fg-muted)" }}>Đang tải thông tin bãi xe...</p>}
    </div>
  );
}

// ─── Auth Panel ──────────────────────────────────────────────────
export function AuthPanel() {
  const { mode, setMode, handleLogin, handleRegister, handleForgotPassword } = useParkingApp();
  return (
    <div className="landing-auth">
      <div className="landing-auth-header"><CircleParking size={22} /><span>iPARK</span></div>
      <div className="landing-auth-tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">Đăng nhập</button>
        <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">Đăng ký</button>
      </div>
      {mode === "login" && (
        <form onSubmit={handleLogin}>
          <label><span className="landing-auth-label">Email</span><input name="email" defaultValue="admin@ipark.vn" type="email" placeholder="you@email.com" /></label>
          <label><span className="landing-auth-label">Mật khẩu</span><input name="password" defaultValue="admin" type="password" placeholder="••••••" /></label>
          <button className="landing-auth-btn-primary" type="submit"><LogIn size={16} />Đăng nhập</button>
          <div className="landing-auth-divider"><span>hoặc</span></div>
          <button className="landing-auth-btn-google" onClick={() => { window.location.href = `${apiBaseUrl}/auth/google`; }} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Đăng nhập với Google
          </button>
          <button className="landing-auth-link" onClick={() => setMode("forgot")} type="button">Quên mật khẩu?</button>
        </form>
      )}
      {mode === "register" && (
        <form className="register-form" onSubmit={handleRegister}>
          <label><span className="landing-auth-label">Họ tên <span className="required">*</span></span><input name="name" placeholder="VD: Nguyễn Văn A" required /></label>
          <label><span className="landing-auth-label">Email <span className="required">*</span></span><input name="email" placeholder="you@email.com" required type="email" /></label>
          <label><span className="landing-auth-label">Số điện thoại</span><input name="phone" placeholder="0xxx xxx xxx" type="tel" /></label>
          <div className="form-row">
            <label><span className="landing-auth-label">Giới tính</span><select name="gender"><option value="">Chọn giới tính</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></label>
            <label><span className="landing-auth-label">Ngày sinh</span><input name="birthDate" type="date" /></label>
          </div>
          <label><span className="landing-auth-label">Địa chỉ</span><input name="address" placeholder="Số nhà, đường" /></label>
          <div className="form-row">
            <label><span className="landing-auth-label">Tỉnh/Thành phố</span><input name="city" placeholder="VD: TP.HCM" /></label>
            <label><span className="landing-auth-label">Quận/Huyện</span><input name="district" placeholder="VD: Quận 1" /></label>
          </div>
          <label><span className="landing-auth-label">Công ty (nếu có)</span><input name="company" placeholder="Tên công ty" /></label>
          <label><span className="landing-auth-label">Mật khẩu <span className="required">*</span></span><input name="password" placeholder="Tối thiểu 6 ký tự" required type="password" /></label>
          <label className="checkbox-label"><input name="acceptTerms" type="checkbox" required /><span>Tôi đồng ý với <a href="#">Điều khoản</a> và <a href="#">Chính sách bảo mật</a></span></label>
          <button className="landing-auth-btn-primary" type="submit"><Plus size={16} />Tạo tài khoản</button>
          <button className="landing-auth-link" onClick={() => setMode("login")} type="button">Đã có tài khoản? Đăng nhập</button>
        </form>
      )}
      {mode === "forgot" && (
        <form onSubmit={handleForgotPassword}>
          <p className="landing-auth-subtitle">Nhập email để nhận mã OTP.</p>
          <label><span className="landing-auth-label">Email</span><input name="email" placeholder="you@email.com" required type="email" /></label>
          <label><span className="landing-auth-label">Mã OTP</span><input name="otp" placeholder="6 chữ số từ email" /></label>
          <label><span className="landing-auth-label">Mật khẩu mới</span><input name="password" placeholder="Tối thiểu 6 ký tự" type="password" /></label>
          <button className="landing-auth-btn-primary" type="submit"><Mail size={16} />Xác minh &amp; đặt lại</button>
          <button className="landing-auth-link" onClick={() => setMode("login")} type="button">← Quay lại đăng nhập</button>
        </form>
      )}
    </div>
  );
}

// ─── Site Header ──────────────────────────────────────────────────
function SiteHeader({ available = 153, onLoginClick }: { available?: number; onLoginClick?: () => void }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <header className="landing-header">
      <div className="landing-header-inner">
        <a href="#" className="landing-logo">
          <div className="landing-logo-icon"><CircleParking size={22} color="#0a0f1a" /></div>
          <div className="landing-logo-text"><span className="landing-logo-name">iPARK</span><span className="landing-logo-tagline">Smart Parking</span></div>
        </a>
        <nav className="landing-nav"><a href="#tra-cuu">Tra cứu</a><a href="#chỗ-trống">Chỗ trống</a><a href="#liên-hệ">Liên hệ</a></nav>
        <div className="landing-header-actions">
          <div className="landing-slots-badge">
            <span className="landing-slots-dot" /><Car size={14} color="var(--landing-accent)" />
            <span style={{ fontWeight: 600 }}>{available}</span>
            <span style={{ color: "var(--landing-fg-muted)" }}>chỗ trống</span>
            {now && <span className="landing-time">{now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
          <button onClick={onLoginClick} className="landing-auth-btn-primary" style={{ padding: "8px 16px", fontSize: "13px" }} type="button"><LogIn size={14} />Đăng nhập</button>
        </div>
      </div>
    </header>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────
function HeroSection({ liveStats, onLoginClick }: { liveStats: { active: number; available: number }; onLoginClick?: () => void }) {
  return (
    <section className="landing-hero">
      <div className="landing-hero-bg" />
      <div className="landing-hero-inner">
        <div className="landing-hero-content">
          <span className="landing-badge"><Sparkles size={14} />Bãi xe không vé · Nhận diện biển số bằng AI</span>
          <h1>Gửi xe thông minh, <span className="highlight">thanh toán qua PayOS</span></h1>
          <p>Dành cho khách vãng lai: không giữ vé giấy, không cài ứng dụng. Xe vào được camera nhận diện tự động — bạn chỉ cần tra cứu biển số và quét mã QR để trả phí khi ra bãi.</p>
          <div className="landing-hero-actions">
            <a href="#tra-cuu" className="landing-btn-primary"><Search size={18} />Tra cứu &amp; thanh toán</a>
            <a href="#quy-trinh" className="landing-btn-secondary">Xem cách hoạt động</a>
          </div>
          <div className="landing-hero-meta">
            <span><MapPin size={16} />iPARK – Bãi đỗ Vincom Center</span>
            <span><ShieldCheck size={16} />Thanh toán mã hoá an toàn</span>
          </div>
        </div>
        <div className="landing-hero-image">
          <img src="/images/hero-parking.png" alt="Cổng bãi đỗ xe thông minh iPARK" width={900} height={600} />
          <div className="landing-hero-image-badge"><ScanLine size={14} />Đang nhận diện biển số…</div>
        </div>
      </div>
      <div className="landing-stats">
        <div className="landing-stats-grid">
          <div className="landing-stat"><div className="landing-stat-value">~3 giây</div><div className="landing-stat-label">Mở barie / xe</div></div>
          <div className="landing-stat"><div className="landing-stat-value">99,5%</div><div className="landing-stat-label">Độ chính xác AI</div></div>
          <div className="landing-stat"><div className="landing-stat-value">24/7</div><div className="landing-stat-label">Tự phục vụ</div></div>
          <div className="landing-stat"><div className="landing-stat-value">0đ</div><div className="landing-stat-label">Phí ẩn</div></div>
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
            <div className="landing-step-icon"><step.icon size={22} /></div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Session Lookup ────────────────────────────────────────────────
type LookupStep = "search" | "session" | "payos_waiting" | "paid" | "not_found" | "completed";

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
  currentFee: number;
  paidAmount?: number;
  expectedCheckOutAt?: string;
  paymentStatus: string;
  prepaidCheckoutAt?: string;
  isPrepaid: boolean;
  isCompleted?: boolean;
};

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

type FeeQuickResult = {
  plate: string;
  sessionId: string;
  checkInAt: string;
  exitTime: string;
  exitHour: number;
  feeBreakdown: {
    totalMinutes: number;
    totalFee: number;
    dailyBreakdown: { dayIndex: number; date: string; rateType: string; fee: number; checkOutHour: number }[];
  };
  dayRate: number;
  nightRate: number;
  totalFee: number;
  additionalFee: number;
  paymentStatus: string;
  paidAmount: number;
  isPrepaid: boolean;
};

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
  "970418": "BIDV", "970436": "Vietcombank", "970422": "MB Bank",
  "970407": "Techcombank", "970415": "VietinBank", "970416": "ACB",
  "970432": "VPBank", "970423": "TPBank", "970403": "Sacombank",
  "970405": "Agribank",
};

function SessionLookup() {
  const [plate, setPlate] = useState("");
  const [step, setStep] = useState<LookupStep>("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [feeResult, setFeeResult] = useState<FeeQuickResult | null>(null);
  const [payosData, setPayosData] = useState<PayOSData | null>(null);

  const [selectedDate, setSelectedDate] = useState(getDefaultDate());
  const [exitAfter22h, setExitAfter22h] = useState<boolean | null>(null);

  // Gia hạn thêm ngày cho xe đã trả đủ, còn trong bãi
  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState(getDefaultDate());
  const [extendAfter22h, setExtendAfter22h] = useState<boolean | null>(null);
  const [extendPayos, setExtendPayos] = useState<PayOSData | null>(null);
  const [extendResult, setExtendResult] = useState<{ extensionFee: number; expectedCheckOutAt?: string } | null>(null);
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
    if (payosStatus === "success") { setStep("paid"); window.history.replaceState({}, "", window.location.pathname); }
    else if (payosStatus === "cancelled") { setStep("session"); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  useEffect(() => {
    if (step !== "payos_waiting" || !sessionInfo) return;
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`${apiBaseUrl}/public/session/${sessionInfo.id}/payment-status`);
        const d = await r.json();
        if (d.paymentStatus === "fully_paid" || d.paymentStatus === "partial_paid" || d.isCompleted) {
          setStep("paid");
          clearInterval(poll);
        }
      } catch { /* silent */ }
    }, 3000);
    return () => clearInterval(poll);
  }, [step, sessionInfo]);

  useEffect(() => {
    if (!extendPayos || !sessionInfo) return;
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`${apiBaseUrl}/public/session/${sessionInfo.id}/payment-status`);
        const d = await r.json();
        if (d.paymentStatus === "fully_paid") {
          setExtendDone(true);
          setExtendPayos(null);
          clearInterval(poll);
        }
      } catch { /* silent */ }
    }, 3000);
    return () => clearInterval(poll);
  }, [extendPayos, sessionInfo]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!plate.trim()) { setError("Vui lòng nhập biển số xe."); return; }
    setError(""); setLoading(true);
    try {
      const r = await fetch(`${apiBaseUrl}/public/lookup?plate=${encodeURIComponent(plate.trim())}`);
      const d = await r.json();
      if (d.found && d.session) {
        setSessionInfo(d.session);
        setFeeResult(null); setExitAfter22h(null);
        // Phiên đã hoàn thành gần đây → hiển thị màn hình đã thanh toán
        if (d.session.isCompleted) {
          setStep("completed");
        } else {
          const ci = new Date(d.session.checkInAt);
          const defaultExit = new Date(ci);
          defaultExit.setDate(defaultExit.getDate() + 1);
          setSelectedDate(
            `${defaultExit.getFullYear()}-${String(defaultExit.getMonth() + 1).padStart(2, "0")}-${String(defaultExit.getDate()).padStart(2, "0")}`,
          );
          setStep("session");
        }
      } else {
        setError(d.message || "Không tìm thấy phiên gửi xe."); setStep("not_found");
      }
    } catch { setError("Không thể kết nối máy chủ."); }
    finally { setLoading(false); }
  }

  async function handleCalculateFee() {
    if (!sessionInfo || exitAfter22h === null) return;
    setLoading(true); setError("");
    try {
      const r = await fetch(`${apiBaseUrl}/public/calculate-fee-quick`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: sessionInfo.plate, exitDate: selectedDate, exitAfter22h }),
      });
      const d = await r.json();
      if (d.sessionId) {
        setFeeResult(d);
        setSessionInfo({ ...sessionInfo, paymentStatus: d.paymentStatus, isPrepaid: d.isPrepaid });
      } else { setError(d.message || "Không thể tính phí."); }
    } catch { setError("Lỗi kết nối."); }
    finally { setLoading(false); }
  }

  async function handleProceedToPayment() {
    if (!sessionInfo || !feeResult) return;
    setLoading(true);
    try {
      const exitTime = new Date(feeResult.exitTime).toISOString();
      const r = await fetch(`${apiBaseUrl}/transactions/session/${sessionInfo.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedExitTime: exitTime }),
      });
      const d = await r.json();
      if (d.sessionPaymentStatus === "fully_paid") { setStep("paid"); }
      else if (d.payos?.qrCode) { setPayosData(d.payos); setStep("payos_waiting"); }
      else { setError(d.message || "Không thể tạo mã thanh toán."); }
    } catch { setError("Lỗi kết nối."); }
    finally { setLoading(false); }
  }

  async function handleCheckPayOS() {
    if (!sessionInfo?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`${apiBaseUrl}/public/session/${sessionInfo.id}/payment-status`);
      const d = await r.json();
      if (d.paymentStatus === "fully_paid" || d.paymentStatus === "partial_paid" || d.isCompleted) {
        setStep("paid");
      } else {
        setError("Chưa nhận được thanh toán.");
        setTimeout(() => setError(""), 3000);
      }
    } catch { setError("Không thể kiểm tra thanh toán."); }
    finally { setLoading(false); }
  }

  function reset() {
    setStep("search"); setPlate(""); setError("");
    setSessionInfo(null); setFeeResult(null); setPayosData(null);
    setSelectedDate(getDefaultDate()); setExitAfter22h(null);
    setShowExtend(false); setExtendPayos(null); setExtendResult(null); setExtendDone(false);
    setExtendDate(getDefaultDate()); setExtendAfter22h(null);
  }

  async function handleExtend() {
    if (!sessionInfo || extendAfter22h === null) return;
    setLoading(true); setError("");
    try {
      // Giờ ra mới = ngày đã chọn, 22:00 nếu sau 22h, ngược lại 21:00 (giống luồng trả trước)
      const exitHour = extendAfter22h ? 22 : 21;
      const [y, mo, da] = extendDate.split("-").map(Number);
      const expectedExtendTime = new Date(y, mo - 1, da, exitHour, 0, 0, 0).toISOString();
      const r = await fetch(`${apiBaseUrl}/public/extend-session`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: sessionInfo.plate, expectedExtendTime }),
      });
      const d = await r.json();
      if (d.success) {
        setExtendResult({ extensionFee: d.extensionFee, expectedCheckOutAt: d.expectedCheckOutAt });
        if (d.payos?.qrCode) {
          setExtendPayos(d.payos);
        } else if (d.extensionFee === 0) {
          setExtendDone(true);
        }
      } else {
        setError(d.message || "Không thể gia hạn.");
      }
    } catch { setError("Lỗi kết nối."); }
    finally { setLoading(false); }
  }

  async function handleCheckExtendPayment() {
    if (!sessionInfo?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`${apiBaseUrl}/public/session/${sessionInfo.id}/payment-status`);
      const d = await r.json();
      if (d.paymentStatus === "fully_paid") {
        setExtendDone(true);
        setExtendPayos(null);
      } else {
        setError("Chưa nhận được thanh toán gia hạn.");
        setTimeout(() => setError(""), 3000);
      }
    } catch { setError("Không thể kiểm tra thanh toán."); }
    finally { setLoading(false); }
  }

  const durationMs = sessionInfo ? now - new Date(sessionInfo.checkInAt).getTime() : 0;
  const amountToPay = feeResult
    ? feeResult.paymentStatus === "fully_paid"
      ? feeResult.additionalFee
      : feeResult.paymentStatus === "partial_paid"
        ? Math.max(0, feeResult.totalFee - feeResult.paidAmount)
        : feeResult.totalFee
    : 0;

  return (
    <section id="tra-cuu" className="landing-lookup">
      <div className="landing-section-header">
        <p className="landing-section-eyebrow">Khi ra bãi</p>
        <h2>Tra cứu &amp; thanh toán trước</h2>
        <p>Chọn ngày và giờ ra dự kiến — hệ thống tự tính phí theo quy định bãi xe.</p>
      </div>

      <div className="landing-lookup-card">
        {/* ── Search ── */}
        {step === "search" && (
          <form className="landing-lookup-form" onSubmit={handleSearch}>
            <p>Nhập biển số xe để xem thông tin phiên gửi.</p>
            <label htmlFor="plate">Biển số xe</label>
            <div className="landing-lookup-input-row">
              <input id="plate" value={plate} onChange={(e) => setPlate(e.target.value)}
                placeholder="VD: 51K-238.79" autoComplete="off" />
              <button type="submit" disabled={loading}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}Tra cứu
              </button>
            </div>
            {error && <p style={{ color: "var(--landing-danger)", fontSize: "13px", marginTop: "8px" }}>{error}</p>}
          </form>
        )}

        {/* ── Not Found ── */}
        {step === "not_found" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
            <p style={{ color: "var(--landing-fg-muted)", marginBottom: "16px" }}>{error}</p>
            <button className="landing-btn-secondary" onClick={reset}>Tra cứu biển số khác</button>
          </div>
        )}

        {/* ── Completed (already paid recently) ── */}
        {step === "completed" && sessionInfo && (
          <div className="landing-session-details">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <span className="landing-plate-badge">{sessionInfo.plate}</span>
              <span className="landing-status-badge success">Đã thanh toán</span>
            </div>
            <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px", padding: "12px", marginBottom: "20px", color: "#22c55e", fontSize: "13px" }}>
              <BadgeCheck size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "8px" }} />
              Xe đã thanh toán gần đây. Không cần thanh toán thêm.
            </div>
            <div className="landing-session-meta">
              {sessionInfo.checkInAt && (
                <div className="landing-session-meta-item">
                  <Clock size={14} />
                  <span>Giờ vào: <strong>{new Date(sessionInfo.checkInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</strong></span>
                </div>
              )}
              {sessionInfo.checkOutAt && (
                <div className="landing-session-meta-item">
                  <Clock size={14} />
                  <span>Giờ ra: <strong>{new Date(sessionInfo.checkOutAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</strong></span>
                </div>
              )}
              {sessionInfo.slot && (
                <div className="landing-session-meta-item">
                  <MapPin size={14} />
                  <span>Vị trí: <strong>{sessionInfo.slot}</strong></span>
                </div>
              )}
            </div>
            <div style={{ background: "var(--landing-bg)", border: "1px solid var(--landing-border)", borderRadius: "10px", padding: "16px", marginTop: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, marginBottom: "12px" }}>
                <Receipt size={16} color="var(--landing-accent)" /> Biên nhận thanh toán
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                <span style={{ color: "var(--landing-fg-muted)" }}>Biển số</span>
                <span style={{ fontWeight: 600 }}>{sessionInfo.plate}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                <span style={{ color: "var(--landing-fg-muted)" }}>Vị trí</span>
                <span>{sessionInfo.slot || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                <span style={{ color: "var(--landing-fg-muted)" }}>Phí gửi xe</span>
                <span style={{ fontWeight: 600 }}>{formatVND(sessionInfo.currentFee || sessionInfo.paidAmount || 0)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ color: "var(--landing-fg-muted)" }}>Thanh toán</span>
                <span style={{ fontWeight: 700, color: "var(--landing-primary)" }}>
                  {formatVND(sessionInfo.paidAmount || sessionInfo.currentFee || 0)}
                </span>
              </div>
            </div>
            <button className="landing-btn-secondary" onClick={reset} style={{ width: "100%", marginTop: "20px" }} type="button">Tra cứu phiên khác</button>
          </div>
        )}

        {/* ── Session ── */}
        {step === "session" && sessionInfo && (
          <div className="landing-session-details">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <span className="landing-plate-badge">{sessionInfo.plate}</span>
              <span className={`landing-status-badge ${sessionInfo.paymentStatus === "fully_paid" ? "success" : sessionInfo.paymentStatus === "partial_paid" ? "warning" : ""}`}>
                {sessionInfo.paymentStatus === "fully_paid" ? "Đã thanh toán" : sessionInfo.paymentStatus === "partial_paid" ? "Thanh toán một phần" : "Chưa thanh toán"}
              </span>
            </div>

            <div className="landing-session-meta">
              <div className="landing-session-meta-item"><Clock size={14} /><span>Đã gửi: <strong>{formatDuration(durationMs)}</strong></span></div>
              <div className="landing-session-meta-item"><MapPin size={14} /><span>Vị trí: <strong>{sessionInfo.slot}</strong></span></div>
              <div className="landing-session-meta-item">
                <span>Giờ vào: <strong>{new Date(sessionInfo.checkInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</strong></span>
              </div>
              {sessionInfo.checkInDate && (
                <div className="landing-session-meta-item">
                  <span>Ngày vào: <strong>{sessionInfo.checkInDate}</strong></span>
              {sessionInfo.checkInDate && !isSameDay(new Date(sessionInfo.checkInAt), new Date()) && (
                <span style={{ marginLeft: "4px", fontSize: "11px", padding: "1px 6px", borderRadius: "4px", background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                  Khác ngày hôm nay
                </span>
              )}
                </div>
              )}
            </div>

            {/* Prepaid notice — only when fully paid */}
            {sessionInfo.paymentStatus === "fully_paid" && !sessionInfo.prepaidCheckoutAt && (
              <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px", padding: "12px", marginTop: "16px", color: "#22c55e", fontSize: "13px" }}>
                <BadgeCheck size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "8px" }} />
                Xe đã thanh toán đủ. Ra bãi bất kỳ lúc nào!
              </div>
            )}

            {/* Gia hạn — cho xe đã trả đủ, còn trong bãi */}
            {sessionInfo.paymentStatus === "fully_paid" && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--landing-border)" }}>
                {extendDone ? (
                  <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px", padding: "12px", color: "#22c55e", fontSize: "13px" }}>
                    <BadgeCheck size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "8px" }} />
                    Gia hạn thành công! {extendResult?.expectedCheckOutAt && `Giờ ra mới: ${new Date(extendResult.expectedCheckOutAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}`}
                  </div>
                ) : extendPayos ? (
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "13px", color: "var(--landing-fg-muted)", marginBottom: "4px" }}>Phí gia hạn cần thanh toán</p>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--landing-primary)", marginBottom: "12px" }}>{formatVND(extendResult?.extensionFee ?? extendPayos.amount)}</div>
                    <div style={{ background: "#fff", padding: 12, borderRadius: 12, display: "inline-flex", marginBottom: "12px" }}>
                      <QRCodeSVG value={extendPayos.qrCode} size={160} level="M" marginSize={0} />
                    </div>
                    <div className="landing-qr-account" style={{ fontSize: "12px", marginBottom: "12px" }}>
                      {extendPayos.accountNumber && <p>{extendPayos.bin && BANK_NAMES[extendPayos.bin] ? `${BANK_NAMES[extendPayos.bin]} · ` : ""}{extendPayos.accountNumber}</p>}
                      {extendPayos.accountName && <p>{extendPayos.accountName}</p>}
                      <p>Mã đơn: {extendPayos.orderCode}</p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                      {extendPayos.checkoutUrl && (
                        <button className="landing-qr-btn" style={{ background: "var(--landing-secondary)" }} onClick={() => window.open(extendPayos.checkoutUrl, "_blank")} type="button">
                          <ExternalLink size={16} />Mở PayOS
                        </button>
                      )}
                      <button className="landing-qr-btn" style={{ background: "var(--landing-accent)" }} onClick={handleCheckExtendPayment} disabled={loading} type="button">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />Kiểm tra thanh toán
                      </button>
                    </div>
                  </div>
                ) : showExtend ? (
                  <div>
                    <h4 style={{ marginBottom: "12px", fontSize: "14px" }}>Gia hạn thêm thời gian gửi xe</h4>

                    {/* Chọn ngày ra mới */}
                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ fontSize: "12px", color: "var(--landing-fg-muted)", display: "block", marginBottom: "4px" }}>Ngày dự kiến lấy xe</label>
                      <input type="date" value={extendDate}
                        min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })()}
                        onChange={(e) => { setExtendDate(e.target.value); setExtendAfter22h(null); }}
                        style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--landing-border)", borderRadius: "6px", background: "var(--landing-bg)", color: "var(--landing-fg)", fontSize: "14px" }} />
                    </div>

                    {/* Trước / sau 22h */}
                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ fontSize: "12px", color: "var(--landing-fg-muted)", display: "block", marginBottom: "8px" }}>Bạn dự kiến lấy xe</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <button type="button" onClick={() => setExtendAfter22h(false)}
                          style={{ padding: "12px 8px", border: `1.5px solid ${extendAfter22h === false ? "var(--landing-primary)" : "var(--landing-border)"}`, borderRadius: "8px", background: extendAfter22h === false ? "rgba(59,130,246,0.1)" : "transparent", color: extendAfter22h === false ? "#3b82f6" : "var(--landing-fg)", fontWeight: extendAfter22h === false ? 600 : 400, cursor: "pointer", fontSize: "13px" }}>
                          <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "2px" }}>☀ Trước 22h</div>
                          <div style={{ opacity: 0.7 }}>5.000đ/ngày</div>
                        </button>
                        <button type="button" onClick={() => setExtendAfter22h(true)}
                          style={{ padding: "12px 8px", border: `1.5px solid ${extendAfter22h === true ? "var(--landing-primary)" : "var(--landing-border)"}`, borderRadius: "8px", background: extendAfter22h === true ? "rgba(59,130,246,0.1)" : "transparent", color: extendAfter22h === true ? "#3b82f6" : "var(--landing-fg)", fontWeight: extendAfter22h === true ? 600 : 400, cursor: "pointer", fontSize: "13px" }}>
                          <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "2px" }}>🌙 Sau 22h</div>
                          <div style={{ opacity: 0.7 }}>10.000đ/ngày</div>
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="landing-btn-secondary" onClick={() => setShowExtend(false)} type="button" style={{ flex: 1 }}>Hủy</button>
                      <button className="landing-btn-primary" onClick={handleExtend} disabled={loading || extendAfter22h === null} type="button" style={{ flex: 2 }}>
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}Gia hạn &amp; thanh toán
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="landing-btn-secondary" onClick={() => setShowExtend(true)} type="button" style={{ width: "100%" }}>
                    <Clock size={16} />Gia hạn thêm giờ gửi xe
                  </button>
                )}
              </div>
            )}

            {/* Partial paid notice */}
            {sessionInfo.paymentStatus === "partial_paid" && (
              <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: "8px", padding: "12px", marginTop: "16px", color: "#fbbf24", fontSize: "13px" }}>
                <BadgeCheck size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "8px" }} />
                Đã thanh toán {formatVND(sessionInfo.paidAmount ?? 0)}. Vui lòng thanh toán phần còn lại để ra bãi.
              </div>
            )}

            {/* Day/Night selector — only if not fully paid */}
            {sessionInfo.paymentStatus !== "fully_paid" && (
              <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--landing-border)" }}>
                <h4 style={{ marginBottom: "12px", fontSize: "14px" }}>Chọn thời gian ra dự kiến</h4>

                {/* Date picker */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "12px", color: "var(--landing-fg-muted)", display: "block", marginBottom: "4px" }}>Ngày dự kiến lấy xe</label>
                  <input type="date" value={selectedDate}
                    min={(() => {
                      const d = sessionInfo.checkInAt ? new Date(sessionInfo.checkInAt) : new Date();
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    })()}
                    onChange={(e) => { setSelectedDate(e.target.value); setFeeResult(null); setExitAfter22h(null); }}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--landing-border)", borderRadius: "6px", background: "var(--landing-bg)", color: "var(--landing-fg)", fontSize: "14px" }} />
                </div>

                {/* Day / Night toggle */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "12px", color: "var(--landing-fg-muted)", display: "block", marginBottom: "8px" }}>Bạn dự kiến lấy xe</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button type="button" onClick={() => { setExitAfter22h(false); setFeeResult(null); }}
                      style={{ padding: "12px 8px", border: `1.5px solid ${exitAfter22h === false ? "var(--landing-primary)" : "var(--landing-border)"}`, borderRadius: "8px", background: exitAfter22h === false ? "rgba(59,130,246,0.1)" : "transparent", color: exitAfter22h === false ? "#3b82f6" : "var(--landing-fg)", fontWeight: exitAfter22h === false ? 600 : 400, cursor: "pointer", fontSize: "13px" }}>
                      <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "2px" }}>☀ Trước 22h</div>
                      <div style={{ opacity: 0.7 }}>Phí: {formatVND(feeResult?.dayRate ?? 5000)}/ngày</div>
                    </button>
                    <button type="button" onClick={() => { setExitAfter22h(true); setFeeResult(null); }}
                      style={{ padding: "12px 8px", border: `1.5px solid ${exitAfter22h === true ? "var(--landing-primary)" : "var(--landing-border)"}`, borderRadius: "8px", background: exitAfter22h === true ? "rgba(59,130,246,0.1)" : "transparent", color: exitAfter22h === true ? "#3b82f6" : "var(--landing-fg)", fontWeight: exitAfter22h === true ? 600 : 400, cursor: "pointer", fontSize: "13px" }}>
                      <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "2px" }}>🌙 Sau 22h</div>
                      <div style={{ opacity: 0.7 }}>Phí: {formatVND(feeResult?.nightRate ?? 10000)}/ngày</div>
                    </button>
                  </div>
                </div>

                {/* Calculate button */}
                {exitAfter22h !== null && !feeResult && (
                  <button className="landing-btn-primary" onClick={handleCalculateFee} disabled={loading}
                    style={{ width: "100%", padding: "12px" }} type="button">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}Xem phí phải trả
                  </button>
                )}

                {/* Fee result */}
                {feeResult && (
                  <div style={{ background: "var(--landing-bg)", border: "1px solid var(--landing-border)", borderRadius: "10px", padding: "16px", marginTop: "12px" }}>
                    {/* Daily breakdown rows */}
                    {feeResult.feeBreakdown?.dailyBreakdown?.map((day) => (
                      <div key={day.dayIndex} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: day.dayIndex < (feeResult.feeBreakdown?.dailyBreakdown?.length ?? 0) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                        <div>
                          <span style={{ fontSize: "13px" }}>{day.date}{day.dayIndex > 0 && ` (+${day.dayIndex} ngày)`}</span>
                          <span style={{ marginLeft: "6px", fontSize: "11px", padding: "1px 6px", borderRadius: "4px", background: day.rateType === "night" ? "rgba(251,191,36,0.15)" : "rgba(59,130,246,0.15)", color: day.rateType === "night" ? "#fbbf24" : "#60a5fa" }}>
                            {day.rateType === "night" ? "sau 22h" : "trước 22h"}
                          </span>
                        </div>
                        <span style={{ fontWeight: 600 }}>{formatVND(day.fee)}</span>
                      </div>
                    ))}

                    <hr className="landing-fee-divider" style={{ margin: "12px 0" }} />

                    {feeResult.isPrepaid && feeResult.paidAmount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--landing-fg-muted)", marginBottom: "8px" }}>
                        <span>Đã thanh toán</span><span>-{formatVND(feeResult.paidAmount)}</span>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>{amountToPay === 0 ? "Đã thanh toán đủ" : feeResult.paymentStatus === "partial_paid" ? "Phải thanh toán" : "Cần thanh toán thêm"}</span>
                      <span style={{ fontWeight: 700, fontSize: "18px", color: "var(--landing-primary)" }}>{formatVND(amountToPay)}</span>
                    </div>

                    <button type="button" onClick={() => setFeeResult(null)}
                      style={{ width: "100%", padding: "10px", marginBottom: "10px", background: "transparent", border: "1px solid var(--landing-border)", borderRadius: "6px", color: "var(--landing-fg-muted)", cursor: "pointer", fontSize: "13px" }}>
                      Thay đổi tùy chọn
                    </button>

                    <button className="landing-btn-primary" onClick={handleProceedToPayment} disabled={loading}
                      style={{ width: "100%", padding: "14px" }} type="button">
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                      {amountToPay === 0 ? "Xác nhận đã thanh toán" : `Thanh toán ${formatVND(amountToPay)}`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {(sessionInfo.paymentStatus === "fully_paid" || sessionInfo.paymentStatus === "partial_paid") && (
              <button className="landing-btn-secondary" onClick={reset} style={{ width: "100%", marginTop: "20px" }} type="button">Tra cứu phiên khác</button>
            )}

            <button onClick={reset} style={{ marginTop: "12px", background: "none", border: "none", color: "var(--landing-fg-muted)", cursor: "pointer", fontSize: "13px" }} type="button">
              ← Tra cứu biển số khác
            </button>
          </div>
        )}

        {/* ── PayOS Waiting ── */}
        {step === "payos_waiting" && payosData && (
          <div className="landing-session-result">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              {sessionInfo && <span className="landing-plate-badge">{sessionInfo.plate}</span>}
              <span className="landing-status-badge warning">Đang chờ thanh toán</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "14px", color: "var(--landing-fg-muted)", marginBottom: "8px" }}>Số tiền thanh toán</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--landing-primary)", marginBottom: "24px" }}>{formatVND(amountToPay)}</div>
            </div>
            <div className="landing-qr-section">
              <p className="landing-qr-title">Quét mã QR để thanh toán</p>
              <div className="landing-qr-box" style={{ background: "#fff", padding: 12, borderRadius: 12, display: "inline-flex" }}>
                <QRCodeSVG value={payosData.qrCode} size={180} level="M" marginSize={0} />
              </div>
              <div className="landing-qr-account">
                {payosData.accountName && <p>{payosData.bin && BANK_NAMES[payosData.bin] ? `${BANK_NAMES[payosData.bin]} · ` : ""}{payosData.accountNumber}</p>}
                {payosData.accountName && <p>{payosData.accountName}</p>}
                <p>Mã đơn: {payosData.orderCode}</p>
                {payosData.description && <p>Nội dung: {payosData.description}</p>}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "var(--landing-fg-muted)", fontSize: "14px", marginTop: "16px" }}>
                <Loader2 size={16} className="animate-spin" />Đang chờ thanh toán...
              </div>
              {payosData.checkoutUrl && (
                <button className="landing-qr-btn" style={{ marginTop: "12px", background: "var(--landing-secondary)" }}
                  onClick={() => window.open(payosData.checkoutUrl, "_blank")} type="button">
                  <ExternalLink size={16} />Mở trang thanh toán PayOS
                </button>
              )}
              <button className="landing-qr-btn" style={{ marginTop: "10px", background: "var(--landing-accent)" }}
                onClick={handleCheckPayOS} disabled={loading} type="button">
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />Kiểm tra thanh toán
              </button>
            </div>
            <button onClick={() => setStep("session")} style={{ marginTop: "12px", background: "none", border: "none", color: "var(--landing-fg-muted)", cursor: "pointer", fontSize: "13px", display: "block", width: "100%", textAlign: "center" }} type="button">
              ← Quay lại
            </button>
          </div>
        )}

        {/* ── Paid ── */}
        {step === "paid" && (
          <div className="landing-success">
            <div className="landing-success-icon"><BadgeCheck size={36} /></div>
            <h3>Thanh toán thành công!</h3>
            <p>Phiên gửi xe đã được thanh toán. Bạn có thể ra bãi bất kỳ lúc nào.</p>
            <div style={{ background: "var(--landing-bg)", border: "1px solid var(--landing-border)", borderRadius: "12px", padding: "16px", width: "100%", maxWidth: "320px", textAlign: "left", marginTop: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, marginBottom: "12px" }}>
                <Receipt size={16} color="var(--landing-accent)" /> Biên nhận
              </div>
              {sessionInfo && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                    <span style={{ color: "var(--landing-fg-muted)" }}>Biển số</span><span style={{ fontWeight: 600 }}>{sessionInfo.plate}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                    <span style={{ color: "var(--landing-fg-muted)" }}>Vị trí</span><span>{sessionInfo.slot}</span>
                  </div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ color: "var(--landing-fg-muted)" }}>Thanh toán</span>
                <span style={{ fontWeight: 700, color: "var(--landing-primary)" }}>{formatVND(amountToPay)}</span>
              </div>
            </div>
            <button className="landing-btn-secondary" onClick={reset} style={{ marginTop: "16px" }} type="button">Tra cứu phiên khác</button>
          </div>
        )}

        {error && step !== "not_found" && (
          <p style={{ color: "var(--landing-danger)", fontSize: "13px", marginTop: "12px", textAlign: "center" }}>{error}</p>
        )}
      </div>
    </section>
  );
}

// ─── Pricing Section ───────────────────────────────────────────────
function PricingSection() {
  return (
    <section id="bang-gia" className="landing-pricing">
      <div className="landing-section-header">
        <p className="landing-section-eyebrow">Bảng giá</p>
        <h2>Bảng giá &amp; gói gửi xe</h2>
        <p>Khách vãng lai trả theo lượt — minh bạch, không phí ẩn.</p>
      </div>
      <div className="landing-pricing-grid">
        {PASSES.map((p) => (
          <div className={`landing-price-card ${p.highlight ? "featured" : ""}`} key={p.id}>
            {p.highlight && <span className="landing-price-badge">Tiết kiệm nhất</span>}
            <div className="landing-price-name">{p.name}</div>
            <div className="landing-price-value"><span className="landing-price-amount">{p.price}</span><span className="landing-price-unit">{p.unit}</span></div>
            <p className="landing-price-note">{p.note}</p>
            <ul className="landing-price-features">{p.features.map((f) => (<li key={f}><Check size={14} />{f}</li>))}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Availability Section ─────────────────────────────────────────
function AvailabilitySection() {
  return (
    <section id="chỗ-trống" className="landing-availability">
      <div className="landing-section-header">
        <p className="landing-section-eyebrow">Chỗ trống realtime</p>
        <h2>Tìm chỗ đỗ ngay</h2>
        <p>Cập nhật tự động mỗi 30 giây</p>
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
        <div className="landing-contact-item"><MapPin size={20} /><div><strong>Địa chỉ</strong><p>{parkingConfig.address}</p></div></div>
        <div className="landing-contact-item"><Mail size={20} /><div><strong>Email</strong><p>{parkingConfig.contactEmail}</p></div></div>
        <div className="landing-contact-item"><Phone size={20} /><div><strong>Hotline</strong><p>{parkingConfig.hotline}</p></div></div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-left"><CircleParking size={18} /><span>© 2026 iPARK — Bãi đỗ xe thông minh tích hợp AI.</span></div>
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
        if (r.ok) { const d = await r.json(); setAvailable(d.available || 0); setLiveStats({ available: d.available, active: d.capacity - d.available }); }
      } catch { /* silent */ }
    }
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="landing-shell">
      <SiteHeader available={available} onLoginClick={() => setShowAuth(true)} />
      <HeroSection liveStats={liveStats} onLoginClick={() => setShowAuth(true)} />
      <main className="landing-main">
        <HowItWorks />
        <SessionLookup />
        <PricingSection />
        <AvailabilitySection />
        <ContactSection />
      </main>
      <LandingFooter />
      {showAuth && (
        <div className="landing-auth-modal" onClick={() => setShowAuth(false)}>
          <div className="landing-auth-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="landing-auth-modal-close" onClick={() => setShowAuth(false)} type="button">✕</button>
            <AuthPanel />
          </div>
        </div>
      )}
    </div>
  );
}
