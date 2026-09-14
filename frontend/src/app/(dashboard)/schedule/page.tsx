"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { MyScheduleView } from "@/features/shifts/my-schedule-view";

export default function SchedulePage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager", "staff"]}>
      <MyScheduleView />
    </RoleGuard>
  );
}
