"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ParkingCircle } from "lucide-react";

import { getNavItemsForRole } from "@/config/nav-items";
import { parkingConfig } from "@/lib/parking-config";
import type { DemoUser } from "@/types";

type SidebarProps = {
  currentUser: DemoUser;
  mobileNavOpen: boolean;
  onNavigate: () => void;
};

export function Sidebar({ currentUser, mobileNavOpen, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItemsForRole(currentUser.role);

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
