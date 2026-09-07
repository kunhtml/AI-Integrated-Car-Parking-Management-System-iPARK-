"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LogIn, ParkingCircle } from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import { parkingConfig } from "@/lib/parking-config";
import { PasswordInput } from "@/features/auth/password-input";

/**
 * Trang đăng nhập độc lập.
 *
 * SEC: mọi request đăng nhập đi qua use-auth-actions handleLogin — handler
 * chung đã xử lý đúng 202 (2FA đang chờ) và 403 (email chưa xác minh) thay
 * vì coi mọi 2xx là đăng nhập thành công.
 */
export default function LoginPage() {
  const { handleLogin, handleVerifyLoginTwoFactor } = useParkingApp();
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingTwoFactorId, setPendingTwoFactorId] = useState<string | null>(
    null,
  );

  async function onLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      // Context khai báo handleLogin: Promise<unknown> — thu hẹp về union
      // kết quả thực của use-auth-actions (ok | two-factor | email-verification | null).
      const result = (await handleLogin(event)) as
        | { kind: "ok"; user: unknown }
        | { kind: "two-factor"; pendingTwoFactorId: string; email?: string }
        | { kind: "email-verification"; email?: string }
        | null;
      if (result?.kind === "two-factor") {
        setPendingTwoFactorId(result.pendingTwoFactorId);
        setMessage("Vui lòng nhập mã 2FA đã được gửi tới email của bạn.");
      } else if (result?.kind === "email-verification") {
        // Email chưa xác minh: chuyển sang luồng xác minh trên trang chủ.
        window.location.href = "/";
      } else if (result?.kind === "ok") {
        window.location.href = "/overview";
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onTwoFactorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const user = await handleVerifyLoginTwoFactor(event);
      if (user) {
        window.location.href = "/overview";
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingTwoFactorId) {
    return (
      <main
        id="main-content"
        className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12"
      >
        <form
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={onTwoFactorSubmit}
        >
          <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="rounded-lg bg-blue-600 p-2 text-white">
              <KeyRound size={22} />
            </div>
            <div>
              <p className="text-sm text-slate-500">{parkingConfig.brandName}</p>
              <h1 className="text-2xl font-bold text-slate-900">
                Xác minh hai yếu tố
              </h1>
            </div>
          </div>

          <input
            name="pendingTwoFactorId"
            type="hidden"
            value={pendingTwoFactorId}
          />

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Mã xác minh (OTP)
              <input
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                inputMode="numeric"
                name="code"
                pattern="[0-9]{6}"
                required
                autoComplete="one-time-code"
                maxLength={6}
              />
            </label>

            {message && (
              <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {message}
              </p>
            )}

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={submitting}
              type="submit"
            >
              <LogIn size={16} />
              {submitting ? "Đang xác minh..." : "Xác minh"}
            </button>

          </div>
        </form>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12"
    >
      <form
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={onLoginSubmit}
      >
        <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="rounded-lg bg-blue-600 p-2 text-white">
            <ParkingCircle size={22} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{parkingConfig.brandName}</p>
            <h1 className="text-2xl font-bold text-slate-900">Đăng nhập</h1>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              name="email"
              required
              type="email"
              autoComplete="email"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu
            <PasswordInput
              autoComplete="current-password"
              name="password"
              required
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {message && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {message}
            </p>
          )}

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={submitting}
            type="submit"
          >
            <LogIn size={16} />
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </div>
      </form>
    </main>
  );
}
