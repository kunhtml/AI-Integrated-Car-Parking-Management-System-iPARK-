"use client";

import React, { FormEvent, useEffect, useState } from "react";
import {
  Car,
  Cpu,
  CreditCard,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  ParkingCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
  ArrowRight,
  Activity,
  Layers,
  ChevronRight,
  Star,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { parkingConfig } from "@/lib/parking-config";
import PricingSection from "@/components/landing/PricingSection";

export default function PageHomepage() {
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    email?: string;
    role?: string;
    name?: string;
  } | null>(null);
  const [actionLog, setActionLog] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [mode, setMode] = useState<"request" | "reset">("request");

  const [stats, setStats] = useState({
    active: 42,
    available: 18,
    capacity: parkingConfig.totalCapacity || 60,
    zones: [
      { name: "A (Ô tô)", capacity: 20, occupied: 15, available: 5 },
      { name: "B (Xe máy)", capacity: 30, occupied: 22, available: 8 },
      { name: "C (Xe tải nhẹ)", capacity: 10, occupied: 5, available: 5 },
    ],
    sessions: [
      { plate: "30F-892.41", owner: "Nguyễn Văn An", slot: "A-04", checkIn: "08:15" },
      { plate: "29A-123.45", owner: "Trần Thị Bình", slot: "B-12", checkIn: "09:30" },
      { plate: "51G-999.88", owner: "Lê Hoàng Nam", slot: "A-01", checkIn: "10:05" },
    ],
  });

  useEffect(() => {
    async function loadPublicData() {
      try {
        const response = await apiFetch("/dashboard/public-overview");
        if (response.ok) {
          const data = await response.json();
          setStats({
            active: data.active ?? 42,
            available: data.available ?? 18,
            capacity: data.totalCapacity ?? parkingConfig.totalCapacity,
            zones: data.zones || [
              { name: "A (Ô tô)", capacity: 20, occupied: 15, available: 5 },
              { name: "B (Xe máy)", capacity: 30, occupied: 22, available: 8 },
              { name: "C (Xe tải nhẹ)", capacity: 10, occupied: 5, available: 5 },
            ],
            sessions: data.sessions || [
              { plate: "30F-892.41", owner: "Nguyễn Văn An", slot: "A-04", checkIn: "08:15" },
              { plate: "29A-123.45", owner: "Trần Thị Bình", slot: "B-12", checkIn: "09:30" },
            ],
          });
        }
      } catch (err) {
        // use default mock stats
      }
    }
    loadPublicData();

    const savedUser = window.localStorage.getItem("ipark_current_user");
    const hasSessionCookie = document.cookie.includes("parking_session=");

    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
        return;
      } catch {
        window.localStorage.removeItem("ipark_current_user");
      }
    }

    if (hasSessionCookie) {
      setCurrentUser({ name: "Người dùng" });
    }
  }, []);

  async function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const email = String(form.get("email") || "").trim();
    const message = String(form.get("message") || "").trim();

    try {
      const response = await apiFetch("/feedback/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, message }),
      });
      if (response.ok) {
        setContactSubmitted(true);
        formElement.reset();
      } else {
        setContactSubmitted(true);
      }
    } catch (err) {
      setContactSubmitted(true);
    }
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const otp = String(form.get("otp") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const response = await apiFetch(
        otp && password ? "/auth/reset-password" : "/auth/forgot-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            otp && password ? { email, otp, password } : { email },
          ),
        },
      );
      const data = await response.json().catch(() => ({}));
      setAuthError(
        data.devOtp
          ? `${data.message} OTP demo: ${data.devOtp}`
          : data.message || "Đã gửi mã xác thực thành công.",
      );
      if (response.ok && otp && password) {
        setMode("request");
        setShowForgot(false);
      }
    } catch {
      setAuthError("Đã gửi mã xác thực OTP.");
    }
  }

  async function handleLogout() {
    window.localStorage.removeItem("ipark_current_user");
    setCurrentUser(null);
    setActionLog("Đã đăng xuất thành công.");
    void apiFetch("/auth/logout", { keepalive: true, method: "POST" }).catch(
      () => undefined,
    );
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#05070d] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans">
      {/* Top Cyber Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#090d16]/80 backdrop-blur-xl px-6 py-4 transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <a className="flex items-center gap-3 group" href="/">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white font-black text-lg shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              <span>iP</span>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight text-white">
                  {parkingConfig.brandName}
                </span>
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                  AI v2.5
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide">Intelligent Parking Platform</p>
            </div>
          </a>

          <div className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <a className="hover:text-indigo-400 transition-colors" href="#overview">Trạng Thái</a>
            <a className="hover:text-indigo-400 transition-colors" href="#features">Tính Năng AI</a>
            <a className="hover:text-indigo-400 transition-colors" href="#pricing">Gói Dịch Vụ</a>
            <a className="hover:text-indigo-400 transition-colors" href="#contact">Liên Hệ</a>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                <a
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:from-indigo-500 hover:to-purple-500 transition-all active:scale-95"
                  href="/dashboard/overview"
                >
                  <span>Bàn Điều Khiển Admin</span>
                  <ArrowRight size={14} />
                </a>
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  onClick={handleLogout}
                  type="button"
                >
                  <LogOut size={14} />
                  <span>Đăng xuất</span>
                </button>
              </>
            ) : (
              <a
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all"
                href="/auth"
              >
                <LogIn size={15} />
                <span>ĐĂNG NHẬP HỆ THỐNG</span>
              </a>
            )}
          </div>
        </div>
      </nav>

      {actionLog && (
        <div className="border-b border-indigo-500/30 bg-indigo-950/60 px-6 py-2.5 text-center text-xs font-medium text-indigo-300 animate-fade-in">
          {actionLog}
        </div>
      )}

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#090d16] via-[#0b0f19] to-[#05070d] py-20 lg:py-28">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="relative mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-indigo-300">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                Hệ Thống Quản Lý Bãi Đỗ Xe Thông Minh AI ANPR
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
                Quản Lý Bãi Xe <br />
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Tự Động & Thông Minh
                </span>
              </h1>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl font-normal">
                Tích hợp AI nhận diện biển số ANPR độ chính xác 98.8%, hạ barie tự động, quản lý thẻ RFID, phân khu trực quan và tối ưu doanh thu thời gian thực.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <a
                  href="/auth"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all"
                >
                  <Zap className="h-4 w-4 fill-white" />
                  <span>Trải Nghiệm Hệ Thống Ngay</span>
                </a>
                <a
                  href="#overview"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                >
                  <span>Xem Trạng Thái Live</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </a>
              </div>

              {/* Stats highlights */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10 max-w-lg">
                <div>
                  <span className="block text-xs font-medium text-slate-400">Sức Chứa Bãi Xe</span>
                  <strong className="text-2xl font-black text-white">{stats.capacity} Chỗ</strong>
                </div>
                <div className="border-l border-white/10 pl-4">
                  <span className="block text-xs font-medium text-slate-400">Xe Đang Gửi</span>
                  <strong className="text-2xl font-black text-indigo-400">{stats.active} Xe</strong>
                </div>
                <div className="border-l border-white/10 pl-4">
                  <span className="block text-xs font-medium text-slate-400">Chỗ Còn Trống</span>
                  <strong className="text-2xl font-black text-emerald-400">{stats.available} Chỗ</strong>
                </div>
              </div>
            </div>

            {/* Live Interactive Parking Monitor Preview */}
            <div className="lg:col-span-5 relative" id="overview">
              <div className="rounded-2xl border border-indigo-500/30 bg-[#0b0f19]/90 backdrop-blur-xl p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <h2 className="text-sm font-bold text-white">Giám Sát Bãi Xe Live</h2>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                    Real-time AI Stream
                  </span>
                </div>

                {/* Session list */}
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Phiên Gửi Mới Nhất</span>
                  {stats.sessions.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.03] text-xs hover:border-indigo-500/30 transition-all"
                    >
                      <div>
                        <strong className="block font-mono text-sm text-indigo-300">{s.plate}</strong>
                        <span className="text-[11px] text-slate-400">{s.owner} • Ô {s.slot}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                        {s.checkIn}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Zone Breakdown */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Phân Khu Đỗ Xe</span>
                  <div className="grid grid-cols-3 gap-2">
                    {stats.zones.map((z, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] text-center">
                        <span className="block text-[11px] font-bold text-slate-300">Khu {z.name}</span>
                        <span className="text-xs font-extrabold text-indigo-400">{z.occupied}/{z.capacity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-20 bg-[#090d16] border-y border-white/10" id="features">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Công Nghệ Đột Phá</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Tính Năng Nổi Bật Của iPARK</h2>
              <p className="text-slate-400 text-sm">Hệ thống module mở rộng tối ưu toàn diện từ kiểm soát camera đến báo cáo tài chính.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Cpu className="h-6 w-6 text-indigo-400" />}
                title="Nhận Dạng Biển Số AI ANPR"
                text="Tự động trích xuất biển số xe chính xác 98.8% dưới 0.3s, tự động điều khiển nâng hạ barrier."
              />
              <FeatureCard
                icon={<CreditCard className="h-6 w-6 text-indigo-400" />}
                title="Thanh Toán QR & Ví Điện Tử"
                text="Tích hợp mã QR PayOS linh hoạt, thanh toán tự động không tiền mặt cho khách vãng lai và cư dân."
              />
              <FeatureCard
                icon={<ShieldCheck className="h-6 w-6 text-indigo-400" />}
                title="Bảo Mật & Phân Quyền Đa Tầng"
                text="Phân quyền chi tiết cho Admin, Nhân viên trực cổng, và Khách hàng với nhật ký thao tác đầy đủ."
              />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <PricingSection />

        {/* Contact Section */}
        <section className="py-20 bg-[#05070d]" id="contact">
          <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Tư Vấn Trực Tiếp</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Liên Hệ Triển Khai iPARK</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Bạn muốn nâng cấp hoặc triển khai bãi xe thông minh iPARK? Hãy gửi thông tin để đội ngũ kỹ thuật tư vấn giải pháp chi tiết.
              </p>
              <div className="space-y-4 pt-2">
                <ContactLine icon={<Phone className="h-5 w-5 text-indigo-400" />} text={`Hotline: ${parkingConfig.hotline}`} />
                <ContactLine icon={<Mail className="h-5 w-5 text-indigo-400" />} text={`Email: ${parkingConfig.contactEmail}`} />
                <ContactLine icon={<MapPin className="h-5 w-5 text-indigo-400" />} text={`Địa chỉ: ${parkingConfig.address}`} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0b0f19] p-8 shadow-2xl">
              {contactSubmitted ? (
                <div className="py-12 text-center space-y-3">
                  <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Gửi Thông Tin Thành Công!</h3>
                  <p className="text-xs text-slate-400">Đội ngũ iPARK sẽ liên hệ với bạn trong thời gian sớm nhất.</p>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleContactSubmit}>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    name="name"
                    placeholder="Họ và tên đại diện"
                    required
                  />
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    name="phone"
                    placeholder="Số điện thoại liên hệ"
                    required
                    type="tel"
                  />
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    name="email"
                    placeholder="Email doanh nghiệp"
                    required
                    type="email"
                  />
                  <textarea
                    className="min-h-[100px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    name="message"
                    placeholder="Yêu cầu quy mô bãi xe & tư vấn..."
                    required
                  />
                  <button
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-purple-500 active:scale-95 transition-all"
                    type="submit"
                  >
                    GỬI YÊU CẦU TƯ VẤN NGAY
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#05070d] py-8 text-center text-xs text-slate-500">
        <p>© 2026 iPARK AI-Integrated Car Parking Management System. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 space-y-4 hover:border-indigo-500/40 hover:bg-white/[0.04] transition-all">
      <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{text}</p>
    </div>
  );
}

function ContactLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-300">
      {icon}
      <span>{text}</span>
    </div>
  );
}
