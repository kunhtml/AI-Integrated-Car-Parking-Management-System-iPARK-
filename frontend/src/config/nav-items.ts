import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Briefcase,
  Car,
  CalendarDays,
  Camera,
  CreditCard,
  LayoutDashboard,
  MessageSquareWarning,
  ParkingSquare,
  Radio,
  ScanLine,
  ClipboardList,
  Settings,
  ShieldAlert,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";

import type { Role, View, ViewAsMode } from "@/types";

export type NavItem = {
  id: View;
  path: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  // Chi an nut tren sidebar cua cac role nay (van truy cap duoc bang link truc tiep).
  hiddenFromSidebar?: Role[];
};

export const navItems: NavItem[] = [
  {
    id: "overview",
    path: "/overview",
    label: "Tổng quan",
    icon: LayoutDashboard,
    roles: ["admin", "manager", "staff"],
  },
  {
    id: "staff-desk",
    path: "/staff-desk",
    label: "Bàn nhân viên",
    icon: ScanLine,
    roles: ["staff", "manager"],
  },
  {
    id: "sessions",
    path: "/sessions",
    label: "Phiên đỗ xe",
    icon: Car,
    roles: ["admin", "manager", "staff", "customer"],
  },
  {
    id: "parking-sessions",
    path: "/parking-sessions",
    label: "Phiên active & ngoại lệ",
    icon: ShieldAlert,
    roles: ["admin", "manager"],
  },
  {
    id: "vehicles",
    path: "/vehicles",
    label: "Phương tiện",
    icon: ScanLine,
    roles: ["admin", "manager", "staff", "customer"],
  },
  {
    id: "wallet",
    path: "/transactions",
    label: "Lịch sử giao dịch",
    icon: Wallet,
    roles: ["admin", "manager", "customer"],
  },
  {
    id: "notifications",
    path: "/notifications",
    label: "Thông báo",
    icon: Bell,
    roles: ["admin", "manager", "staff", "customer"],
  },
  {
    id: "shifts",
    path: "/shifts",
    label: "Ca làm việc",
    icon: CalendarDays,
    roles: ["admin", "manager", "staff"],
  },
  {
    id: "disputes",
    path: "/disputes",
    label: "Khiếu nại",
    icon: MessageSquareWarning,
    roles: ["admin", "manager", "staff", "customer"],
  },
  {
    id: "rfid-cards",
    path: "/rfid-cards",
    label: "Thẻ RFID",
    icon: Radio,
    roles: ["admin", "manager", "staff"],
  },
  {
    id: "rfid",
    path: "/rfid",
    label: "Thẻ RFID (Cũ)",
    icon: Radio,
    roles: ["admin", "manager", "staff"],
    hiddenFromSidebar: ["admin", "manager", "staff"],
  },
  {
    id: "devices",
    path: "/devices",
    label: "Camera & thiết bị",
    icon: Camera,
    roles: ["admin", "manager"],
  },
  {
    id: "parking-slots",
    path: "/parking-slots",
    label: "Vị trí đỗ xe",
    icon: ParkingSquare,
    roles: ["admin", "manager", "staff"],
  },
  {
    id: "subscriptions",
    path: "/subscriptions",
    label: "Gói đăng ký",
    icon: CreditCard,
    roles: ["admin", "manager", "customer"],
  },
  {
    id: "rfid-registration",
    path: "/rfid-registration",
    label: "Đăng ký RFID",
    icon: Radio,
    roles: ["customer"],
  },
  {
    id: "users",
    path: "/users",
    label: "Người dùng",
    icon: UsersRound,
    roles: ["admin", "manager", "staff"],
  },
  {
    id: "pricing",
    path: "/pricing",
    label: "Cấu hình",
    icon: Settings,
    roles: ["admin", "manager"],
  },
  {
    id: "reports",
    path: "/reports",
    label: "Báo cáo",
    icon: BarChart3,
    roles: ["admin", "manager"],
  },
  {
    id: "audit-logs",
    path: "/audit-logs",
    label: "Nhật ký barie",
    icon: ClipboardList,
    roles: ["admin"],
  },
  {
    id: "staff-applications",
    path: "/staff-applications",
    label: "Đơn ứng tuyển",
    icon: Briefcase,
    roles: ["admin"],
  },
  {
    id: "profile",
    path: "/profile",
    label: "Hồ sơ",
    icon: UserRound,
    roles: ["admin", "manager", "staff", "customer"],
  },
];

export const adminOnlyPaths = [
  "/pricing",
  "/reports",
  "/staff-applications",
  "/devices",
];

export function getNavItemsForRole(role: Role, viewAs?: ViewAsMode) {
  void viewAs;
  // Nếu staff đang ở "member mode", show navigation của customer
  return navItems.filter((item) => item.roles.includes(role));
}

export function getDefaultPathForRole(role: Role) {
  return role === "customer" ? "/profile" : "/overview";
}
