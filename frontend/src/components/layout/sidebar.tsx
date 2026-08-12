"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ParkingCircle, ArrowRightLeft } from "lucide-react";

import { getNavItemsForRole, getDefaultPathForRole } from "@/config/nav-items";
import { useParkingApp } from "@/context/parking-app-context";
import { parkingConfig } from "@/lib/parking-config";
import type { DemoUser, ViewAsMode } from "@/types";

type SidebarProps = {
  currentUser: DemoUser;
  mobileNavOpen: boolean;
  onNavigate: () => void;
};

export function Sidebar({ currentUser, mobileNavOpen, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { viewAs, setViewAs } = useParkingApp();
  const navItems = getNavItemsForRole(
    currentUser.role,
    currentUser.role === "staff" ? viewAs : undefined,
  ).filter((item) => !item.hiddenFromSidebar?.includes(currentUser.role));

  const toggleViewAs = () => {
    const newMode: ViewAsMode = viewAs === "staff" ? "customer" : "staff";
    setViewAs(newMode);

    // Xác định role hiệu dụng để lấy default path
    const effectiveRole = newMode === "customer" ? "customer" : currentUser.role;
    const targetPath = getDefaultPathForRole(effectiveRole);

    // Navigate về trang mặc định của chế độ mới
    if (pathname !== targetPath) {
      router.push(targetPath);
    }
  };

  // Hiển thị tên chế độ ĐỂ CHUYỂN SANG (không phải chế độ hiện tại)
  const viewAsLabel = viewAs === "staff" ? "Khu vực Người dùng" : "Khu vực Nhân viên";

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
      {currentUser.role === "staff" && (
        <div className="sidebar-mode-toggle">
          <button
            className="mode-switch-btn"
            onClick={toggleViewAs}
            type="button"
          >
            <span className="mode-switch-icon">
              <ArrowRightLeft size={14} />
            </span>
            <span>{viewAsLabel}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
