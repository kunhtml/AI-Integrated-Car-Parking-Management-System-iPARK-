"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { ShiftScheduleView } from "@/features/shifts/shift-schedule-view";

export default function ShiftsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager", "staff"]}>
      <ShiftScheduleView />
    </RoleGuard>
  );
}
