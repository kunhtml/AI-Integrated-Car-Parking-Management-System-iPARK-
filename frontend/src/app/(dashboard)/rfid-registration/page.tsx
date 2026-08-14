"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { CustomerRfidRegistrationView } from "@/features/rfid/customer-rfid-registration-view";

export default function RfidRegistrationPage() {
  return (
    <RoleGuard allowedRoles={["customer"]}>
      <CustomerRfidRegistrationView />
    </RoleGuard>
  );
}
