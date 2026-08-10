"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { RfidCardsView } from "@/features/rfid/rfid-view";

export default function RfidPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff"]}>
      <RfidCardsView />
    </RoleGuard>
  );
}