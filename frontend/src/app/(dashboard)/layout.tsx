"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { RoleGuard } from "@/components/layout/role-guard";
import { useParkingApp } from "@/context/parking-app-context";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser, sessionLoading, actionLog, mobileNavOpen, setMobileNavOpen, logout } = useParkingApp();

  useEffect(() => {
    if (!sessionLoading && !currentUser) {
      router.replace("/");
    }
  }, [sessionLoading, currentUser, router]);

  if (sessionLoading) {
    return (
      <main className="public-shell">
        <section className="public-section">
          <p>Đang tải phiên đăng nhập...</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <AppShell
      actionLog={actionLog}
      currentUser={currentUser}
      mobileNavOpen={mobileNavOpen}
      onLogout={async () => {
        await logout();
        router.push("/");
      }}
      setMobileNavOpen={setMobileNavOpen}
    >
      <RoleGuard>{children}</RoleGuard>
    </AppShell>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}
