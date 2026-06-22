"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, CreditCard, LayoutDashboard, ParkingCircle, UserRound } from "lucide-react";

const navItems = [
  { href: "/dashboard/sessions", label: "Phiên gửi xe", icon: LayoutDashboard },
  { href: "/dashboard/vehicles", label: "Phương tiện", icon: Car },
  { href: "/dashboard/wallet", label: "Ví", icon: CreditCard },
  { href: "/dashboard/profile", label: "Hồ sơ", icon: UserRound },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand app-brand">
          <ParkingCircle size={28} />
          <span>iPARK</span>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link className={active ? "active" : ""} href={item.href} key={item.href}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <section className="workspace">{children}</section>
    </main>
  );
}
