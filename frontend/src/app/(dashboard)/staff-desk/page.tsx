"use client";

import { useEffect, useState } from "react";
import { CalendarX, Loader2 } from "lucide-react";

import { RoleGuard } from "@/components/layout/role-guard";
import { StaffDeskView } from "@/features/staff-desk/staff-desk-view";
import { apiFetch } from "@/lib/client-api";

export default function StaffDeskPage() {
  const [status, setStatus] = useState<"loading" | "active" | "inactive">("loading");

  useEffect(() => {
    let cancelled = false;

    async function checkCurrentShift() {
      try {
        const response = await apiFetch("/shift-schedules/my/current");
        const data = await response.json();
        if (!cancelled) setStatus(response.ok && data.active ? "active" : "inactive");
      } catch {
        if (!cancelled) setStatus("inactive");
      }
    }

    void checkCurrentShift();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RoleGuard allowedRoles={["staff", "manager"]}>
      {status === "loading" ? (
        <div className="grid min-h-[55vh] place-content-center justify-items-center gap-3 p-8 text-center text-[var(--fg-muted)]" role="status">
          <Loader2 className="spin" size={28} />
          <p>Đang kiểm tra ca làm việc...</p>
        </div>
      ) : status === "active" ? (
        <StaffDeskView />
      ) : (
        <div
          className="mx-auto my-[8vh] grid min-h-[280px] max-w-[560px] place-content-center justify-items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-8 text-center text-[var(--fg-muted)] shadow-[var(--shadow-md)]"
          role="alert"
        >
          <CalendarX size={34} />
          <h1>Bạn không có ca làm việc hiện tại</h1>
          <p>Camera và các thao tác tại cổng sẽ khả dụng khi bạn đã check-in một ca đang diễn ra.</p>
        </div>
      )}
    </RoleGuard>
  );
}
