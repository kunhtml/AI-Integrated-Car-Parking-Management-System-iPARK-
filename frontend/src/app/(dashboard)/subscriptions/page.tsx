import type { Metadata } from "next";
import { SubscriptionsView } from "@/features/subscriptions/subscriptions-view";

export const metadata: Metadata = {
  title: "Gói đăng ký | iPARK",
  description: "Quản lý gói gửi xe và đăng ký dịch vụ iPARK.",
};

export default function SubscriptionsPage() {
  return <SubscriptionsView />;
}
