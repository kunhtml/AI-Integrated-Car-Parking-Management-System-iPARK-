"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { useParkingApp } from "@/context/parking-app-context";
import type { DemoUser } from "@/types";

type AppShellProps = {
  currentUser: DemoUser;
  onLogout: () => void;
  children: React.ReactNode;
};

export function AppShell({
  currentUser,
  onLogout,
  children,
}: AppShellProps) {
  const { actionLog } = useParkingApp();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!actionLog) return;
    setMessage(actionLog);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [actionLog]);

  const isError = message.includes("không") || message.includes("thất bại") || message.includes("lỗi") || message.includes("đã tồn");

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[hsl(220_14%_96%)] dark:bg-[hsl(222_47%_6%)]">
        <Sidebar currentUser={currentUser} onLogout={onLogout} />

        <div className="flex flex-1 flex-col min-w-0">
          <AppHeader />

          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
              {visible && message && (
                <div
                  className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${
                    isError
                      ? "border-red-200/60 bg-red-50/80 text-red-700 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-400"
                      : "border-emerald-200/60 bg-emerald-50/80 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-400"
                  }`}
                  role="alert"
                >
                  {isError ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
                  <span className="flex-1">{message}</span>
                  <button
                    className="ml-auto opacity-50 hover:opacity-100 transition-opacity"
                    onClick={() => setVisible(false)}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              )}
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
