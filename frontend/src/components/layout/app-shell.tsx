"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Sidebar } from "@/components/layout/sidebar";
import type { DemoUser } from "@/types";

type AppShellProps = {
  currentUser: DemoUser;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

export function AppShell({
  currentUser,
  mobileNavOpen,
  setMobileNavOpen,
  onLogout,
  children,
}: AppShellProps) {
  return (
    <main className="app-shell">
      <Sidebar
        currentUser={currentUser}
        mobileNavOpen={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
      />
      <section className="workspace">
        <AppHeader
          currentUser={currentUser}
          onLogout={onLogout}
          onToggleNav={() => setMobileNavOpen(!mobileNavOpen)}
        />
        {children}
      </section>
    </main>
  );
}
