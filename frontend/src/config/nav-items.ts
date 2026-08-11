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
<<<<<<< Updated upstream
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
=======
  // ── Overview ──
  {
    id: "overview",
    path: "/dashboard/overview",
    label: "Bảng điều khiển",
    icon: BarChart,
    roles: ["admin", "staff"],
    group: "overview",
  },

  // ── Management ──
  {
    id: "vehicles",
    path: "/dashboard/vehicles",
    label: "Phương tiện",
    icon: Car,
    roles: ["admin", "staff", "customer"],
    group: "management",
  },
  {
    id: "sessions",
    path: "/dashboard/sessions",
    label: "Phiên gửi xe",
    icon: ParkingCircle,
    roles: ["admin", "staff", "customer"],
    group: "management",
  },
  {
    id: "membershipPackages",
    path: "/dashboard/membership-packages",
    label: "Gói đăng ký",
    icon: CreditCard,
    roles: ["admin", "staff", "customer"],
    group: "management",
  },
  {
    id: "wallet",
    path: "/dashboard/wallet",
    label: "Ví điện tử",
    icon: Wallet,
    roles: ["admin", "staff", "customer"],
    group: "management",
  },
  {
    id: "parkingFeeRules",
    path: "/dashboard/parking-fee-rules",
    label: "Cấu hình phí",
    icon: Settings,
    roles: ["admin"],
    group: "management",
  },
  {
    id: "zones",
    path: "/dashboard/zones",
    label: "Khu vực đỗ xe",
    icon: MapPin,
    roles: ["admin", "staff"],
    group: "management",
  },
  {
    id: "shifts",
    path: "/dashboard/shifts",
    label: "Ca làm việc",
    icon: CalendarDays,
    roles: ["admin", "staff"],
    group: "management",
  },
  {
    id: "invoices",
    path: "/dashboard/invoices",
    label: "Hóa đơn",
    icon: FileText,
    roles: ["admin"],
    group: "management",
  },

  // ── Users ──
  {
    id: "users",
    path: "/dashboard/users",
    label: "Người dùng",
    icon: UsersRound,
    roles: ["admin"],
    group: "users",
  },
  {
    id: "staffAccounts",
    path: "/dashboard/staff",
    label: "Nhân viên",
    icon: UsersRound,
    roles: ["admin"],
    group: "users",
  },
  {
    id: "rfidCards",
    path: "/dashboard/rfid-cards",
    label: "Thẻ RFID",
    icon: CreditCard,
    roles: ["admin"],
    group: "users",
  },
  {
    id: "assistedRegistration",
    path: "/dashboard/assisted-registration",
    label: "Đăng ký hộ",
    icon: Car,
    roles: ["admin", "staff"],
    group: "users",
  },
  {
    id: "profile",
    path: "/dashboard/profile",
    label: "Hồ sơ cá nhân",
    icon: UserRound,
    roles: ["admin", "staff", "customer"],
    group: "users",
  },

  // ── System ──
  {
    id: "ai",
    path: "/dashboard/ai",
    label: "AI biển số",
    icon: Camera,
    roles: ["admin", "staff"],
    group: "system",
  },
  {
    id: "recognitionLogs",
    path: "/dashboard/recognition-logs",
    label: "Lịch sử nhận diện",
    icon: ScanLine,
    roles: ["admin", "staff"],
    group: "system",
  },
  {
    id: "devices",
    path: "/dashboard/devices",
    label: "Camera & thiết bị",
    icon: Camera,
    roles: ["admin"],
    group: "system",
  },
  {
    id: "cameras",
    path: "/dashboard/cameras",
    label: "Camera trực tiếp",
    icon: Camera,
    roles: ["admin", "staff"],
    group: "system",
  },
  {
    id: "cameraLogs",
    path: "/dashboard/camera-logs",
    label: "Nhật ký camera",
    icon: ScanLine,
    roles: ["admin", "staff"],
    group: "system",
  },
  {
    id: "rfidOperations",
    path: "/dashboard/rfid-operations",
    label: "Vận hành RFID",
    icon: ScanLine,
    roles: ["admin"],
    group: "system",
  },
  {
    id: "revenueReports",
    path: "/dashboard/revenue-reports",
    label: "Báo cáo doanh thu",
    icon: ReceiptText,
    roles: ["admin"],
    group: "system",
  },
  {
    id: "rfidReports",
    path: "/dashboard/rfid-reports",
    label: "Báo cáo RFID",
    icon: ReceiptText,
    roles: ["admin"],
    group: "system",
  },
  {
    id: "incidents",
    path: "/dashboard/incidents",
    label: "Sự cố",
    icon: CircleAlert,
    roles: ["admin", "staff"],
    group: "system",
  },
  {
    id: "feedback",
    path: "/dashboard/feedback",
    label: "Phản hồi",
    icon: Bell,
    roles: ["admin", "staff", "customer"],
    group: "system",
  },
  {
    id: "notifications",
    path: "/dashboard/notifications",
    label: "Thông báo",
    icon: Bell,
    roles: ["admin", "staff", "customer"],
    group: "system",
  },
  {
    id: "security",
    path: "/dashboard/security",
    label: "Bảo mật / 2FA",
    icon: KeyRound,
    roles: ["admin", "staff", "customer"],
    group: "system",
  },
  {
    id: "auditLogs",
    path: "/dashboard/audit-logs",
    label: "Nhật ký hệ thống",
    icon: ClipboardList,
    roles: ["admin"],
    group: "system",
  },
  {
    id: "backups",
    path: "/dashboard/backups",
    label: "Sao lưu dữ liệu",
    icon: Database,
    roles: ["admin"],
    group: "system",
  },
  {
    id: "privacy",
    path: "/dashboard/privacy",
    label: "Quyền riêng tư",
    icon: Shield,
    roles: ["admin", "staff", "customer"],
    group: "system",
  },
  {
    id: "changePassword",
    path: "/dashboard/change-password",
    label: "Đổi mật khẩu",
    icon: KeyRound,
    roles: ["admin", "staff", "customer"],
    group: "system",
  },
>>>>>>> Stashed changes
];

export const adminOnlyPaths = ["/pricing", "/reports"];

export function getNavItemsForRole(role: Role) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function getDefaultPathForRole(role: Role) {
  return role === "customer" ? "/profile" : "/overview";
}
