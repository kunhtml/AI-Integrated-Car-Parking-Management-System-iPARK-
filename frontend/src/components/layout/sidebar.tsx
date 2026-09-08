"use client";

import { useEffect, useRef } from "react";
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
  const sidebarRef = useRef<HTMLElement>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  const navItems = getNavItemsForRole(
    currentUser.role,
    currentUser.role === "staff" ? viewAs : undefined,
  ).filter((item) => !item.hiddenFromSidebar?.includes(currentUser.role));

  // Focus trap for mobile sidebar
  useEffect(() => {
    if (mobileNavOpen) {
      // Save currently focused element
      lastFocusedElement.current = document.activeElement as HTMLElement;

      // Focus first focusable element in sidebar
      const sidebar = sidebarRef.current;
      if (sidebar) {
        const focusableElements = sidebar.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }

        // Trap focus within sidebar
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key !== "Tab") return;

          const focusableElements = Array.from(
            sidebar.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          );

          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
          document.removeEventListener("keydown", handleKeyDown);
        };
      }
    } else {
      // Restore focus when sidebar closes
      if (lastFocusedElement.current) {
        lastFocusedElement.current.focus();
      }
    }
  }, [mobileNavOpen]);

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
    <aside
      ref={sidebarRef}
      className={`fixed top-0 bottom-0 z-10 flex w-[260px] flex-col overflow-y-auto bg-[#1e293b] p-[24px_16px] text-[var(--sidebar-fg)] shadow-[4px_0_20px_rgba(0,0,0,0.2)] transition-[left] duration-200 ease-in-out max-[980px]:z-20 ${
        mobileNavOpen ? "left-0" : "max-[980px]:-left-[280px] left-0"
      }`}
    >
      <div className="mb-7 flex items-center gap-3 rounded-[var(--radius)] border border-[rgba(59,130,246,0.25)] bg-gradient-to-br from-[rgba(59,130,246,0.2)] to-[rgba(59,130,246,0.1)] p-[14px_12px] text-lg font-bold text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white shadow-[0_4px_12px_rgba(59,130,246,0.35)]">
          <ParkingCircle size={26} />
        </div>
        <span>{parkingConfig.brandName}</span>
      </div>
        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link
              className={`relative flex w-full items-center gap-3 overflow-hidden rounded-[var(--radius)] p-[12px_14px] text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-[var(--sidebar-active)] font-semibold text-[var(--sidebar-active-fg)] shadow-[0_2px_8px_rgba(59,130,246,0.3)] [&>svg]:text-white"
                  : "bg-transparent text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)] hover:text-white"
              }`}
              href={item.path}
              key={item.id}
              onClick={onNavigate}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {isActive && (
                <div className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-[4px] bg-[#93c5fd]" />
              )}
            </Link>
          );
        })}
      </nav>
      {currentUser.role === "staff" && (
        <div className="mt-auto p-[0px_12px_8px]">
          <button
            className="flex h-8 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border-none bg-gradient-to-br from-[rgb(123,104,238)] to-[rgb(147,112,219)] px-4 font-mono text-[11px] font-semibold tracking-[0.5px] text-white uppercase shadow-[rgba(123,104,238,0.45)_0px_4px_12px,rgba(255,255,255,0.15)_0px_1px_0px_inset] transition-all duration-200 hover:-translate-y-px hover:shadow-[rgba(123,104,238,0.55)_0px_6px_16px,rgba(255,255,255,0.2)_0px_1px_0px_inset] active:translate-y-0 active:shadow-[rgba(123,104,238,0.35)_0px_2px_8px,rgba(255,255,255,0.1)_0px_1px_0px_inset]"
            onClick={toggleViewAs}
            type="button"
          >
            <span className="flex items-center justify-center">
              <ArrowRightLeft size={14} />
            </span>
            <span>{viewAsLabel}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
