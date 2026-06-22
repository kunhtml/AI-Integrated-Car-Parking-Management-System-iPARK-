"use client";

import { FormEvent, useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";

export function ChangePasswordView() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu mới không khớp.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(form.get("currentPassword") || ""),
          newPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || "Không đổi được mật khẩu.");
        return;
      }

      event.currentTarget.reset();
      setMessage(data.message || "Đã thay đổi mật khẩu.");
    } catch {
      setError("Không kết nối được API đổi mật khẩu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm text-slate-500">Tài khoản</p>
            <h1 className="text-2xl font-bold text-slate-900">Đổi mật khẩu</h1>
          </div>
          <KeyRound className="text-blue-600" size={24} />
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu hiện tại
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              name="currentPassword"
              required
              type="password"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu mới
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              minLength={6}
              name="newPassword"
              required
              type="password"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Nhập lại mật khẩu mới
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              minLength={6}
              name="confirmPassword"
              required
              type="password"
            />
          </label>

          {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={submitting}
            type="submit"
          >
            <Save size={16} />
            {submitting ? "Đang lưu..." : "Lưu mật khẩu mới"}
          </button>
        </form>
      </div>
    </section>
  );
}
