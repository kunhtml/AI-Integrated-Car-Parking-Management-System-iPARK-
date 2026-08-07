"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import type { DemoUser } from "@/types";

function getStoredUser(): DemoUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ipark_current_user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(getStoredUser);

  React.useEffect(() => {
    if (!currentUser) {
      const user = getStoredUser();
      if (user) setCurrentUser(user);
      else router.push("/login");
    }
  }, [currentUser, router]);

  async function handleLogout() {
    localStorage.removeItem("ipark_current_user");
    void apiFetch("/auth/logout", { keepalive: true, method: "POST" }).catch(
      () => undefined,
    );
    router.push("/");
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[hsl(220_14%_96%)] dark:bg-[hsl(222_47%_6%)]">
        <Sidebar currentUser={currentUser} onLogout={handleLogout} />

        <div className="flex flex-1 flex-col min-w-0">
          <AppHeader />

          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
