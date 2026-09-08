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
    <header className="mb-6 flex items-center justify-between max-[640px]:gap-2.5">
      <button
        className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] transition-colors hover:bg-[var(--bg-hover)] max-[980px]:inline-flex"
        onClick={onToggleNav}
        type="button"
        aria-label="Toggle navigation menu"
      >
        <Menu size={20} />
      </button>
      <div style={{ flex: 1 }} />
      <ThemeToggle />
      <button
        className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--fg)] transition-colors hover:border-[var(--danger)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] max-[640px]:min-w-[40px] max-[640px]:p-0 max-[640px]:text-[0px]"
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
