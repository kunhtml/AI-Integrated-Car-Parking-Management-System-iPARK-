"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { ShiftsView } from "@/features/shifts/shifts-view";
import { ShiftScheduleView } from "@/features/shifts/shift-schedule-view";

export default function ShiftsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff"]}>
      <ShiftScheduleView />
    </RoleGuard>
  );
}
