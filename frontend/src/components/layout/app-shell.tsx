"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SystemLog } from "@/components/layout/system-log";
import type { DemoUser } from "@/types";

type AppShellProps = {
  currentUser: DemoUser;
  actionLog: string;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

export function AppShell({
  currentUser,
  actionLog,
  mobileNavOpen,
  setMobileNavOpen,
  onLogout,
  children,
}: AppShellProps) {
  return (
    <main className="app-shell">
      {mobileNavOpen && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
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
        <SystemLog message={actionLog} />
        <div id="main-content">{children}</div>
      </section>
    </main>
  );
}
