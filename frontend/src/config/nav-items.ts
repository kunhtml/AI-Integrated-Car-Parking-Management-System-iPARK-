import type { LucideIcon } from "lucide-react";
import {
  BarChart,
  Bell,
  Camera,
  Car,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  CreditCard,
  Database,
  FileText,
  KeyRound,
  MapPin,
  ParkingCircle,
  ReceiptText,
  ScanLine,
  Settings,
  Shield,
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
    label: "Tổng Quan",
    icon: BarChart,
    roles: ["admin", "staff"],
  },
  {
    id: "vehicles",
    path: "/dashboard/vehicles",
    label: "Đăng ký xe & Phương tiện",
    icon: Car,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "sessions",
    path: "/dashboard/sessions",
    label: "Lịch sử & Trạng thái gửi xe",
    icon: ParkingCircle,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "membershipPackages",
    path: "/dashboard/membership-packages",
    label: "Đăng ký gói cước",
    icon: CreditCard,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "wallet",
    path: "/dashboard/wallet",
    label: "Ví điện tử & Nạp tiền",
    icon: Wallet,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "users",
    path: "/dashboard/users",
    label: "Người dùng",
    icon: UsersRound,
    roles: ["admin"],
  },
  {
    id: "parkingFeeRules",
    path: "/dashboard/parking-fee-rules",
    label: "Cấu hình",
    icon: Settings,
    roles: ["admin"],
  },
  {
    id: "staffAccounts",
    path: "/dashboard/staff",
    label: "Quản lý nhân viên",
    icon: UsersRound,
    roles: ["admin"],
  },
  {
    id: "revenueReports",
    path: "/dashboard/revenue-reports",
    label: "Báo cáo doanh thu",
    icon: ReceiptText,
    roles: ["admin"],
  },
  {
    id: "changePassword",
    path: "/dashboard/change-password",
    label: "Đổi mật khẩu",
    icon: KeyRound,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "feedback",
    path: "/dashboard/feedback",
    label: "Phản hồi & Khiếu nại",
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
    id: "recognitionLogs",
    path: "/dashboard/recognition-logs",
    label: "Lịch sử nhận diện",
    icon: ScanLine,
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
    id: "rfidCards",
    path: "/dashboard/rfid-cards",
    label: "Thẻ RFID",
    icon: CreditCard,
    roles: ["admin"],
  },
  {
    id: "rfidOperations",
    path: "/dashboard/rfid-operations",
    label: "Vận hành RFID",
    icon: ScanLine,
    roles: ["admin", "staff"],
  },
  {
    id: "zones",
    path: "/dashboard/zones",
    label: "Khu vực đỗ xe",
    icon: MapPin,
    roles: ["admin", "staff"],
  },
  {
    id: "security",
    path: "/dashboard/security",
    label: "Bảo mật / 2FA",
    icon: KeyRound,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "auditLogs",
    path: "/dashboard/audit-logs",
    label: "Nhật ký hệ thống",
    icon: ClipboardList,
    roles: ["admin"],
  },
  {
    id: "invoices",
    path: "/dashboard/invoices",
    label: "Hóa đơn",
    icon: FileText,
    roles: ["admin", "staff"],
  },
  {
    id: "backups",
    path: "/dashboard/backups",
    label: "Sao lưu dữ liệu",
    icon: Database,
    roles: ["admin"],
  },
  {
    id: "privacy",
    path: "/dashboard/privacy",
    label: "Quyền riêng tư",
    icon: Shield,
    roles: ["admin", "staff", "customer"],
  },
  {
    id: "rfidReports",
    path: "/dashboard/rfid-reports",
    label: "Báo cáo RFID",
    icon: ReceiptText,
    roles: ["admin", "staff"],
  },
  {
    id: "assistedRegistration",
    path: "/dashboard/assisted-registration",
    label: "Đăng ký hộ",
    icon: Car,
    roles: ["admin", "staff"],
  },
  {
    id: "profile",
    path: "/dashboard/profile",
    label: "Hồ sơ cá nhân",
    icon: UserRound,
    roles: ["admin", "staff", "customer"],
  },
];

export const adminOnlyPaths: string[] = [
  "/dashboard/devices",
  "/dashboard/pricing",
  "/dashboard/parking-fee-rules",
  "/dashboard/users",
  "/dashboard/staff",
  "/dashboard/reports",
  "/dashboard/revenue-reports",
  "/dashboard/rfid-cards",
];

export function getNavItemsForRole(role: Role) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function getDefaultPathForRole(role: Role) {
  if (role === "admin" || role === "staff") {
    return "/dashboard/overview";
  }
  return "/dashboard/vehicles";
}
