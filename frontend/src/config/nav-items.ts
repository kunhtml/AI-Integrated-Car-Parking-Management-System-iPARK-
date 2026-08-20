import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Briefcase,
  Car,
  CalendarDays,
  CircleAlert,
  CreditCard,
  LayoutDashboard,
  MapPin,
  MessageSquareWarning,
  ParkingSquare,
  Radio,
  ScanLine,
  Settings,
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
    roles: ["admin", "staff"],
  },
  {
    id: "staff-desk",
    path: "/staff-desk",
    label: "Bàn nhân viên",
    icon: ScanLine,
    roles: ["staff"],
  },
  {
    id: "sessions",
    path: "/sessions",
    label: "Phiên đỗ xe",
    icon: Car,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "vehicles",
    path: "/vehicles",
    label: "Phương tiện",
    icon: ScanLine,
    roles: ["admin", "customer"],
  },
  {
    id: "wallet",
    path: "/wallet",
    label: "Lịch sử giao dịch",
    icon: Wallet,
    roles: ["admin", "customer"],
  },
  {
    id: "notifications",
    path: "/notifications",
    label: "Thông báo",
    icon: Bell,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "shifts",
    path: "/shifts",
    label: "Ca làm việc",
    icon: CalendarDays,
    roles: ["admin", "staff"],
  },
  {
    id: "incidents",
    path: "/incidents",
    label: "Sự cố",
    icon: CircleAlert,
    roles: ["admin", "staff"],
  },
  {
    id: "disputes",
    path: "/disputes",
    label: "Khiếu nại",
    icon: MessageSquareWarning,
    roles: ["customer"],
  },
  {
    id: "rfid",
    path: "/rfid",
    label: "Thẻ RFID",
    icon: Radio,
    roles: ["admin"],
  },
  {
    id: "parking-slots",
    path: "/parking-slots",
    label: "Vị trí đỗ xe",
    icon: ParkingSquare,
    roles: ["admin", "staff"],
  },
  {
    id: "subscriptions",
    path: "/subscriptions",
    label: "Gói đăng ký",
    icon: CreditCard,
    roles: ["admin", "customer"],
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
    roles: ["admin"],
  },
  {
    id: "pricing",
    path: "/pricing",
    label: "Cấu hình",
    icon: Settings,
    roles: ["admin"],
  },
  {
    id: "reports",
    path: "/reports",
    label: "Báo cáo",
    icon: BarChart3,
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
    roles: ["admin", "staff", "customer"],
  },
];

export const adminOnlyPaths = ["/users", "/pricing", "/reports", "/staff-applications"];

export function getNavItemsForRole(role: Role, viewAs?: ViewAsMode) {
  // Nếu staff đang ở "member mode", show navigation của customer
  if (role === "staff" && viewAs === "customer") {
    return navItems.filter((item) => item.roles.includes("customer"));
  }
  return navItems.filter((item) => item.roles.includes(role));
}

export function getDefaultPathForRole(role: Role) {
  return role === "customer" ? "/profile" : "/overview";
}
