"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { RoleGuard } from "@/components/layout/role-guard";
import { useParkingApp } from "@/context/parking-app-context";
import { demoUsers } from "@/lib/mock-data";
import { apiFetch } from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useParkingApp();
  const router = useRouter();
  const user = currentUser ?? demoUsers[0];

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  async function handleLogout() {
    localStorage.removeItem("ipark_current_user");
    void apiFetch("/auth/logout", { keepalive: true, method: "POST" }).catch(
      () => undefined,
    );
    router.push("/");
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[hsl(220_14%_96%)] dark:bg-[hsl(222_47%_6%)]">
        <Sidebar currentUser={user} onLogout={handleLogout} />

        <div className="flex flex-1 flex-col min-w-0">
          <AppHeader />

          {/* Main content area with subtle background and proper spacing */}
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
              <RoleGuard>{children}</RoleGuard>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
