"use client";

import { AppShell } from "@/components/layout/app-shell";
import { RoleGuard } from "@/components/layout/role-guard";
import { useParkingApp } from "@/context/parking-app-context";
import { demoUsers } from "@/lib/mock-data";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, mobileNavOpen, setMobileNavOpen, logout } = useParkingApp();
  const user = currentUser ?? demoUsers[0];

  if (!user) {
    return null;
  }

  return (
    <AppShell
      currentUser={user}
      mobileNavOpen={mobileNavOpen}
      onLogout={logout}
      setMobileNavOpen={setMobileNavOpen}
    >
      <RoleGuard>{children}</RoleGuard>
    </AppShell>
  );
}
