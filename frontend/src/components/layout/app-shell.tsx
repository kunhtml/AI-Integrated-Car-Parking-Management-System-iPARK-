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
    <main className="min-h-screen">
      <Sidebar
        currentUser={currentUser}
        mobileNavOpen={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
      />
      <section className="min-w-0 p-[28px_32px] max-[980px]:p-[20px_16px] max-[640px]:p-4 min-[981px]:ml-[260px]">
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
