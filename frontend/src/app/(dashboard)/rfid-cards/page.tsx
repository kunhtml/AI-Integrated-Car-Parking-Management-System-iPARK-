"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { RfidCardsView } from "@/features/rfid/rfid-cards-view";

export default function RfidCardsPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <RfidCardsView />
    </RoleGuard>
  );
}
