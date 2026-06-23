"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Sidebar } from "@/components/layout/sidebar";
import { useParkingApp } from "@/context/parking-app-context";
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

        {visible && message && (
          <div className={`toast-banner ${message.includes("không") || message.includes("thất bại") || message.includes("lỗi") || message.includes("đã tồn") ? "toast-error" : ""}`} role="alert">
            {message.includes("không") || message.includes("thất bại") || message.includes("lỗi") || message.includes("đã tồn") ? (
              <XCircle size={16} />
            ) : (
              <CheckCircle size={16} />
            )}
            {message}
            <button
              className="toast-close"
              onClick={() => setVisible(false)}
              type="button"
            >
              ✕
            </button>
          </div>
        )}

        {children}
      </section>
    </main>
  );
}
