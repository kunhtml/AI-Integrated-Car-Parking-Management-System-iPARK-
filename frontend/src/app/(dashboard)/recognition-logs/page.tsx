import type { Metadata } from "next";

import { RoleGuard } from "@/components/layout/role-guard";
import { RecognitionLogsView } from "@/features/recognition-logs/recognition-logs-view";

export const metadata: Metadata = {
  title: "Nhật ký nhận diện | iPARK",
  description: "Theo dõi lịch sử nhận diện phương tiện và biển số tại bãi xe.",
};

export default function RecognitionLogsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager"]}>
      <RecognitionLogsView />
    </RoleGuard>
  );
}
