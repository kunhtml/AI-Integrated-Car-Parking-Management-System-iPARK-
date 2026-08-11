"use client";

import { useParams } from "next/navigation";

import { RoleGuard } from "@/components/layout/role-guard";
import { DisputeDetailView } from "@/features/disputes/dispute-detail-view";

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <RoleGuard allowedRoles={["customer", "admin", "staff"]}>
      <DisputeDetailView id={params.id} />
    </RoleGuard>
  );
}
