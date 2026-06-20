"use client";

import React, { useState } from "react";
import { LogOut, ParkingCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { parkingConfig } from "@/lib/parking-config";

const navItems = [
  { href: "/overview", label: "Overview" },
  { href: "/users", label: "Customers & Roles" },
  { href: "/staff", label: "Staff Accounts" },
  { href: "/membership-packages", label: "Membership" },
  { href: "/parking-fee-rules", label: "Fee Rules" },
  { href: "/revenue-reports", label: "Reports" },
  { href: "/change-password", label: "Change Password" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleLogout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
      window.localStorage.removeItem("ipark_current_user");
      setMessage("Đã đăng xuất.");
      window.location.href = "/";
    } catch {
      setMessage("Không đăng xuất được. Vui lòng thử lại.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <a className="flex items-center gap-2.5" href="/overview">
            <div className="rounded-lg bg-blue-600 p-2 text-white">
              <ParkingCircle size={22} />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">{parkingConfig.brandName}</span>
          </a>

          <nav className="hidden items-center gap-4 lg:flex">
            {navItems.map((item) => (
              <a className="text-sm font-medium text-slate-600 transition hover:text-blue-600" href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <button
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            onClick={handleLogout}
            type="button"
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
        {message && <div className="border-t border-blue-100 bg-blue-50 px-6 py-2 text-center text-sm text-blue-700">{message}</div>}
      </header>
      {children}
    </div>
  );
}
