"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart,
  Car,
  CreditCard,
  KeyRound,
  LogOut,
  ParkingCircle,
  ReceiptText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { parkingConfig } from "@/lib/parking-config";

const navItems = [
  { href: "/overview", label: "Tổng quan", icon: BarChart },
  { href: "/membership-packages", label: "Gói đăng ký", icon: ParkingCircle },
  { href: "/parking-fee-rules", label: "Cấu hình phí", icon: CreditCard },
  { href: "/users", label: "Người dùng", icon: UsersRound },
  { href: "/staff", label: "Nhân viên", icon: UsersRound },
  { href: "/revenue-reports", label: "Báo cáo", icon: ReceiptText },
  { href: "/change-password", label: "Bảo mật", icon: KeyRound },
];

const placeholderItems = [
  { label: "Phiên đỗ xe", icon: Car },
  { label: "Phương tiện", icon: Car },
  { label: "Ví & thanh toán", icon: CreditCard },
  { label: "Thông báo", icon: ReceiptText },
  { label: "AI biển số", icon: ShieldCheck },
  { label: "Camera & thiết bị", icon: ShieldCheck },
  { label: "Khu vực đỗ xe", icon: ParkingCircle },
  { label: "Đặt chỗ trước", icon: ReceiptText },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
    <div className="flex min-h-screen bg-slate-50">
      <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col bg-[#0f172a] px-4 py-6 text-slate-100">
        <a className="mb-8 flex items-center gap-3 px-2" href="/overview">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/80 text-sm font-black">
            P
          </div>
          <span className="text-lg font-extrabold tracking-tight">{parkingConfig.brandName}</span>
        </a>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <a
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-blue-600/20 text-blue-200" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon size={17} />
                {item.label}
              </a>
            );
          })}

          <div className="my-3 border-t border-white/10" />

          {placeholderItems.map((item) => {
            const Icon = item.icon;
            return (
              <span
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500"
                key={item.label}
                title="Chức năng sẽ được triển khai sau"
              >
                <Icon size={17} />
                {item.label}
              </span>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-4">
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={handleLogout}
            type="button"
          >
            <LogOut size={17} />
            Đăng xuất
          </button>
          <div className="mt-4 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-bold">A</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Admin</p>
              <p className="truncate text-xs text-slate-400">Hồ sơ</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {message && <div className="border-b border-blue-100 bg-blue-50 px-6 py-2 text-center text-sm text-blue-700">{message}</div>}
        {children}
      </main>
    </div>
  );
}
