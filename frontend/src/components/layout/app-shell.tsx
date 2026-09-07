"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SystemLog } from "@/components/layout/system-log";
import { PageHeader } from "@/components/layout/page-header";
import type { DemoUser } from "@/types";

type AppShellProps = {
  currentUser: DemoUser;
  actionLog: string;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  onLogout: () => void;
  /** Tiêu đề trang (tuỳ chọn) — được truyền vào PageHeader dưới dạng <h1>. */
  pageTitle?: string;
  /** Mô tả trang (tuỳ chọn) — hiển thị bên dưới pageTitle. */
  pageDescription?: string;
  children: React.ReactNode;
};

export function AppShell({
  currentUser,
  actionLog,
  mobileNavOpen,
  setMobileNavOpen,
  onLogout,
  pageTitle,
  pageDescription,
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
        <SystemLog message={actionLog} />
          <div id="main-content">
            {pageTitle ? (
              <PageHeader title={pageTitle} description={pageDescription} />
            ) : null}
            {children}
          </div>
      </section>
    </main>
  );
}
