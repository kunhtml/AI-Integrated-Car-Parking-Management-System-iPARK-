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
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { parkingConfig } from "@/lib/parking-config";

export default function PageHomepage() {
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email?: string; role?: string } | null>(null);
  const [actionLog, setActionLog] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [mode, setMode] = useState<"request" | "reset">("request");

  const stats = {
    active: 0,
    available: 0,
    capacity: parkingConfig.totalCapacity,
  };

  useEffect(() => {
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
      setCurrentUser({});
    }
  }, []);

  function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactSubmitted(true);
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const otp = String(form.get("otp") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const response = await apiFetch(otp && password ? "/auth/reset-password" : "/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(otp && password ? { email, otp, password } : { email }),
      });
      const data = await response.json().catch(() => ({}));
      setAuthError(data.devOtp ? `${data.message} OTP demo: ${data.devOtp}` : data.message || "Đã xử lý OTP.");
      if (response.ok && otp && password) {
        setMode("request");
        setShowForgot(false);
      }
    } catch {
      setAuthError("Không kết nối được API OTP.");
    }
  }

  async function handleLogout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
      window.localStorage.removeItem("ipark_current_user");
      setCurrentUser(null);
      setActionLog("Đã đăng xuất.");
    } catch {
      setActionLog("Lỗi khi đăng xuất.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <a className="flex items-center gap-2.5" href="/">
          <div className="rounded-lg bg-blue-600 p-2 text-white">
            <ParkingCircle size={24} />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900">{parkingConfig.brandName}</span>
        </a>

        <div className="flex items-center gap-4">
          <a className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 sm:inline" href="#features">
            Tính năng
          </a>
          <a className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 sm:inline" href="#contact">
            Liên hệ
          </a>
          {currentUser ? (
            <>
              <a className="text-sm font-semibold text-slate-700 hover:text-blue-600" href="/change-password">
                Đổi mật khẩu
              </a>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                onClick={handleLogout}
                type="button"
              >
                <LogOut size={16} />
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <a
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                href="/overview"
              >
                <LogIn size={16} />
                Vào hệ thống
              </a>
              <button className="text-sm text-slate-600 hover:text-blue-600" onClick={() => setShowForgot(true)} type="button">
                Quên mật khẩu
              </button>
            </>
          )}
        </div>
      </nav>

      {actionLog && <div className="border-b border-blue-100 bg-blue-50 px-6 py-2 text-center text-sm text-blue-700">{actionLog}</div>}

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 py-16 lg:grid-cols-12 lg:py-24">
          <div className="space-y-8 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              Hệ thống quản lý bãi đỗ xe thông minh
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Giải pháp đỗ xe <span className="text-blue-600">iPARK</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-600">
              Theo dõi {stats.capacity} chỗ đỗ ô tô khu A/B/C, ghi nhận xe vào/ra bằng ảnh, tính phí tự động và phân quyền vận hành.
            </p>

            <div className="grid max-w-lg grid-cols-3 gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <span className="block text-xs font-medium text-slate-500">Đang gửi</span>
                <strong className="text-2xl font-bold text-slate-900">{stats.active} xe</strong>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="block text-xs font-medium text-slate-500">Còn trống</span>
                <strong className="text-2xl font-bold text-emerald-600">{stats.available} chỗ</strong>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="block text-xs font-medium text-slate-500">Camera AI</span>
                <strong className="text-2xl font-bold text-blue-600">0 cổng</strong>
              </div>
            </div>
          </div>

          <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-8 shadow-xl lg:col-span-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="font-bold text-slate-900">Trạng thái bãi xe</h2>
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              Chưa có dữ liệu phiên gửi xe từ cơ sở dữ liệu.
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-20" id="features">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="mx-auto mb-16 max-w-2xl space-y-4 text-center">
              <h2 className="text-3xl font-black text-slate-900">Tính năng nổi bật của iPARK</h2>
              <p className="text-slate-600">Các module vận hành bãi đỗ xe được tách riêng để dễ mở rộng từ backend đến frontend.</p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <FeatureCard icon={<Cpu size={24} />} title="Nhận dạng biển số AI" text="Tự động ghi nhận biển số xe vào/ra khi module camera được kết nối." />
              <FeatureCard icon={<CreditCard size={24} />} title="Thanh toán minh bạch" text="Theo dõi phí, trạng thái thanh toán và doanh thu theo phiên gửi xe." />
              <FeatureCard icon={<ShieldCheck size={24} />} title="Phân quyền vận hành" text="Quản lý người dùng theo vai trò admin, nhân viên và khách hàng." />
            </div>
          </div>
        </section>

        <section className="bg-slate-900 py-20 text-white" id="contact">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-6 lg:grid-cols-2">
            <div className="space-y-8">
              <h2 className="text-3xl font-black">Liên hệ với chúng tôi</h2>
              <p className="leading-relaxed text-slate-400">Bạn muốn triển khai hệ thống iPARK cho bãi xe của mình? Hãy để lại thông tin để đội kỹ thuật liên hệ tư vấn.</p>
              <div className="space-y-4">
                <ContactLine icon={<Phone size={20} />} text={`Hotline: ${parkingConfig.hotline}`} />
                <ContactLine icon={<Mail size={20} />} text={`Email: ${parkingConfig.contactEmail}`} />
                <ContactLine icon={<MapPin size={20} />} text={`Địa chỉ: ${parkingConfig.address}`} />
              </div>
            </div>

            <div className="rounded-lg bg-white p-8 text-slate-800 shadow-xl">
              {contactSubmitted ? (
                <div className="space-y-4 py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <ShieldCheck size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Gửi thông tin thành công!</h3>
                  <p className="text-sm text-slate-600">Cảm ơn bạn đã quan tâm. Chúng tôi sẽ liên hệ lại sớm nhất.</p>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleContactSubmit}>
                  <input className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Họ và tên" required />
                  <input className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Số điện thoại" required type="tel" />
                  <input className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Email liên hệ" required type="email" />
                  <textarea className="min-h-[100px] w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Nhu cầu triển khai" required />
                  <button className="w-full rounded-md bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700" type="submit">
                    Gửi yêu cầu tư vấn
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <p>© 2026 iPARK. All rights reserved.</p>
      </footer>

      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Quên mật khẩu</h3>
              <button className="text-slate-500" onClick={() => setShowForgot(false)} type="button">
                Đóng
              </button>
            </div>
            <form className="mt-4 space-y-3" onSubmit={handleForgotPassword}>
              <label className="block text-sm">
                Email
                <input className="mt-1 w-full rounded border px-3 py-2" name="email" required type="email" />
              </label>
              {mode === "reset" && (
                <>
                  <label className="block text-sm">
                    OTP
                    <input className="mt-1 w-full rounded border px-3 py-2" name="otp" required />
                  </label>
                  <label className="block text-sm">
                    Mật khẩu mới
                    <input className="mt-1 w-full rounded border px-3 py-2" minLength={6} name="password" required type="password" />
                  </label>
                </>
              )}
              <div className="flex items-center gap-2">
                <button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit">
                  Gửi
                </button>
                <button className="text-sm text-slate-600" onClick={() => setMode(mode === "request" ? "reset" : "request")} type="button">
                  {mode === "request" ? "Nhập OTP" : "Quay lại"}
                </button>
              </div>
              {authError && <div className="text-sm text-red-600">{authError}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 text-blue-600">{icon}</div>
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-600">{text}</p>
    </div>
  );
}

function ContactLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-blue-500">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
