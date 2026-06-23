"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <aside className={mobileNavOpen ? "sidebar open" : "sidebar"}>
      <Link href="/" className="brand app-brand">
        <span className="brand-mark">P</span>
        <span>{parkingConfig.brandName}</span>
      </Link>
      <nav>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link
              className={isActive ? "active" : ""}
              href={item.path}
              key={item.id}
              onClick={onNavigate}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
