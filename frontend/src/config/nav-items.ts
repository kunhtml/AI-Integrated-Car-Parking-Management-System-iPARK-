import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Camera,
  Car,
  CalendarDays,
  CircleAlert,
  CreditCard,
  LayoutDashboard,
  MapPin,
  ParkingSquare,
  Radio,
  ScanLine,
  Settings,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";

import type { Role, View } from "@/types";

export type NavGroup = "overview" | "management" | "users" | "system";

export const navGroupLabels: Record<NavGroup, string> = {
  overview: "Tổng quan",
  management: "Quản lý",
  users: "Người dùng",
  system: "Hệ thống",
};

export type NavItem = {
  id: View;
  path: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  group: NavGroup;
};

export const navItems: NavItem[] = [
  { id: "overview", path: "/overview", label: "Tổng quan", icon: LayoutDashboard, roles: ["admin", "staff"] },
  { id: "sessions", path: "/sessions", label: "Phiên đỗ xe", icon: Car, roles: ["admin", "staff", "customer"] },
  { id: "vehicles", path: "/vehicles", label: "Phương tiện", icon: ScanLine, roles: ["admin", "staff", "customer"] },
  { id: "wallet", path: "/wallet", label: "Lịch sử giao dịch", icon: Wallet, roles: ["admin", "customer"] },
  { id: "notifications", path: "/notifications", label: "Thông báo", icon: Bell, roles: ["admin", "staff", "customer"] },
  { id: "shifts", path: "/shifts", label: "Ca làm việc", icon: CalendarDays, roles: ["admin", "staff"] },
  { id: "incidents", path: "/incidents", label: "Sự cố", icon: CircleAlert, roles: ["admin", "staff"] },
  { id: "cameras", path: "/cameras", label: "Live monitor & Logs", icon: Camera, roles: ["admin", "staff"] },
  { id: "rfid", path: "/rfid", label: "Thẻ RFID", icon: Radio, roles: ["admin", "staff"] },
  { id: "zones", path: "/zones", label: "Khu vực đỗ xe", icon: MapPin, roles: ["admin", "staff"] },
  { id: "parking-slots", path: "/parking-slots", label: "Vị trí đỗ xe", icon: ParkingSquare, roles: ["admin", "staff"] },
  { id: "subscriptions", path: "/subscriptions", label: "Gói đăng ký", icon: CreditCard, roles: ["admin", "customer"] },
  { id: "users", path: "/users", label: "Người dùng", icon: UsersRound, roles: ["admin", "staff"] },
  { id: "pricing", path: "/pricing", label: "Cấu hình", icon: Settings, roles: ["admin"] },
  { id: "reports", path: "/reports", label: "Báo cáo", icon: BarChart3, roles: ["admin"] },
  { id: "profile", path: "/profile", label: "Hồ sơ", icon: UserRound, roles: ["admin", "staff", "customer"] },
];

export const adminOnlyPaths = ["/pricing", "/reports"];

export function getNavItemsForRole(role: Role) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function getDefaultPathForRole(role: Role) {
  return role === "customer" ? "/profile" : "/overview";
}
