"use client";

import { useEffect, useRef } from "react";
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
  const sidebarRef = useRef<HTMLElement>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  const navItems = getNavItemsForRole(currentUser.role).filter(
    (item) => !item.hiddenFromSidebar?.includes(currentUser.role),
  );

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

  return (
    <aside ref={sidebarRef} className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
      <div className="brand app-brand">
        <div className="brand-icon">
          <ParkingCircle size={26} />
        </div>
        <span>{parkingConfig.brandName}</span>
      </div>
        <nav aria-label="Main navigation">
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
