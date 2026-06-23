import type { LucideIcon } from "lucide-react";
import {
  BarChart,
  Bell,
  Camera,
  Car,
  CalendarDays,
  CircleAlert,
  KeyRound,
  MapPin,
  ReceiptText,
  ScanLine,
  Settings,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";

import type { Role, View } from "@/types";

export type NavItem = {
  id: View;
  path: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
};

export const navItems: NavItem[] = [
  {
    id: "overview",
    path: "/dashboard/overview",
    label: "Tổng quan",
    icon: BarChart,
    roles: ["admin", "staff"],
  },
  {
    id: "sessions",
    path: "/dashboard/sessions",
    label: "Phiên đỗ xe",
    icon: Car,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "vehicles",
    path: "/dashboard/vehicles",
    label: "Phương tiện",
    icon: ScanLine,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "wallet",
    path: "/dashboard/wallet",
    label: "Ví & thanh toán",
    icon: Wallet,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "feedback",
    path: "/dashboard/feedback",
    label: "Phản hồi",
    icon: Bell,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "notifications",
    path: "/dashboard/notifications",
    label: "Thông báo",
    icon: Bell,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "shifts",
    path: "/dashboard/shifts",
    label: "Ca làm việc",
    icon: CalendarDays,
    roles: ["admin", "staff"],
  },
  {
    id: "incidents",
    path: "/dashboard/incidents",
    label: "Sự cố",
    icon: CircleAlert,
    roles: ["admin", "staff"],
  },
  {
    id: "ai",
    path: "/dashboard/ai",
    label: "AI biển số",
    icon: Camera,
    roles: ["admin", "staff"],
  },
  {
    id: "devices",
    path: "/dashboard/devices",
    label: "Camera & thiết bị",
    icon: Camera,
    roles: ["admin"],
  },
  {
    id: "pricing",
    path: "/dashboard/pricing",
    label: "Cấu hình",
    icon: Settings,
    roles: ["admin"],
  },
  {
    id: "zones",
    path: "/dashboard/zones",
    label: "Khu vực đỗ xe",
    icon: MapPin,
    roles: ["admin", "staff"],
  },
  {
    id: "users",
    path: "/dashboard/users",
    label: "Người dùng",
    icon: UsersRound,
    roles: ["admin"],
  },
  {
    id: "reports",
    path: "/dashboard/reports",
    label: "Báo cáo",
    icon: ReceiptText,
    roles: ["admin"],
  },
  {
    id: "security",
    path: "/dashboard/security",
    label: "Bảo mật",
    icon: KeyRound,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "profile",
    path: "/dashboard/profile",
    label: "Hồ sơ",
    icon: UserRound,
    roles: ["admin", "staff", "customer"],
  },
];

export const adminOnlyPaths: string[] = [
  "/dashboard/devices",
  "/dashboard/pricing",
  "/dashboard/users",
  "/dashboard/reports",
];

export function getNavItemsForRole(role: Role) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function getDefaultPathForRole(role: Role) {
  if (role === "admin" || role === "staff") {
    return "/dashboard/overview";
  }
  return "/dashboard/sessions";
}
