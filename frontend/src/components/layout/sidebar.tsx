"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeft, ShieldAlert, Cpu, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavItemsForRole, navGroupLabels, type NavGroup } from "@/config/nav-items";
import { parkingConfig } from "@/lib/parking-config";
import { useSidebar } from "./sidebar-provider";
import type { DemoUser } from "@/types";

type SidebarProps = {
  currentUser: DemoUser;
  onLogout: () => void;
};

const groupOrder: NavGroup[] = ["overview", "management", "users", "system"];

export function Sidebar({ currentUser, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();
  const navItems = getNavItemsForRole(currentUser.role);

  const grouped = groupOrder
    .map((group) => ({
      group,
      label: navGroupLabels[group],
      items: navItems.filter((item) => item.group === group),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
      <div className="brand app-brand">
        <div className="brand-icon">
          <ParkingCircle size={26} />
        </div>
        <span>{parkingConfig.brandName}</span>
      </div>
      <nav>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link
              className={`nav-item ${isActive ? "active" : ""}`}
              href={item.path}
              key={item.id}
              onClick={onNavigate}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {isActive && <div className="active-indicator" />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
