"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
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
        {children}
      </section>
    </main>
  );
}
