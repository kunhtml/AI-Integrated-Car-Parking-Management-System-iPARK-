"use client";

import { FormEvent, useState } from "react";
import { LogIn, ParkingCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { parkingConfig } from "@/lib/parking-config";

export default function LoginPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") || ""),
          password: String(form.get("password") || ""),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.message || "Không đăng nhập được.");
        return;
      }

      window.localStorage.setItem("ipark_current_user", JSON.stringify(data.user));
      window.location.href = "/overview";
    } catch {
      setMessage("Không kết nối được API đăng nhập.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <form className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleLogin}>
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
            <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" name="email" required type="email" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu
            <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" name="password" required type="password" />
          </label>

          {message && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}

          <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400" disabled={submitting} type="submit">
            <LogIn size={16} />
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </div>
      </form>
    </main>
  );
}
