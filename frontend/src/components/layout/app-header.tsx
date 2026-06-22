"use client";

import { LogOut, Menu } from "lucide-react";

import { roleLabels } from "@/lib/constants";
import type { DemoUser } from "@/types";

type AppHeaderProps = {
  currentUser: DemoUser;
  onToggleNav: () => void;
  onLogout: () => void;
};

export function AppHeader({ currentUser, onToggleNav, onLogout }: AppHeaderProps) {
  return (
    <header className="app-header">
      <button className="icon-button mobile-only" onClick={onToggleNav} type="button">
        <Menu size={20} />
      </button>
      <div>
        <p>{roleLabels[currentUser.role]}</p>
        <h1>{currentUser.name}</h1>
      </div>
      <button className="logout-button" onClick={onLogout} type="button">
        <LogOut size={18} />
        Đăng xuất
      </button>
    </header>
  );
}
