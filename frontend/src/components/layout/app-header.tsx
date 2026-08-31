import { LogOut, Menu } from "lucide-react";

import { roleLabels } from "@/lib/constants";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { DemoUser } from "@/types";

type AppHeaderProps = {
  currentUser: DemoUser;
  onToggleNav: () => void;
  onLogout: () => void;
};

export function AppHeader({
  currentUser,
  onToggleNav,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <button
        className="icon-button mobile-only"
        onClick={onToggleNav}
        type="button"
        aria-label="Toggle navigation menu"
      >
        <Menu size={20} />
      </button>
      <div style={{ flex: 1 }} />
      <ThemeToggle />
      <button
        className="logout-button"
        onClick={onLogout}
        type="button"
        aria-label="Đăng xuất khỏi hệ thống"
      >
        <LogOut size={18} />
        Đăng xuất
      </button>
    </header>
  );
}
