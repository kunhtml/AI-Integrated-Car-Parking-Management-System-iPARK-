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
    <RoleGuard allowedRoles={["staff"]}>
      {status === "loading" ? (
        <div className="staff-desk-access-state" role="status">
          <Loader2 className="spin" size={28} />
          <p>Đang kiểm tra ca làm việc...</p>
        </div>
      ) : status === "active" ? (
        <StaffDeskView />
      ) : (
        <div className="staff-desk-access-state staff-desk-access-denied" role="alert">
          <CalendarX size={34} />
          <h1>Bạn không có ca làm việc hiện tại</h1>
          <p>Camera và các thao tác tại cổng sẽ khả dụng khi bạn đã check-in một ca đang diễn ra.</p>
        </div>
      )}
    </RoleGuard>
  );
}
