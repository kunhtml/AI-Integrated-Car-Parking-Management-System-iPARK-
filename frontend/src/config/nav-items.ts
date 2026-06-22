import type { LucideIcon } from "lucide-react";
import { Car, ScanLine, UserRound, Wallet } from "lucide-react";

import type { Role, View } from "@/types";

export type NavItem = {
  id: View;
  path: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
};

export const navItems: NavItem[] = [
  { id: "sessions", path: "/dashboard/sessions", label: "Phiên gửi xe", icon: Car, roles: ["admin", "staff", "customer"] },
  { id: "vehicles", path: "/dashboard/vehicles", label: "Phương tiện", icon: ScanLine, roles: ["admin", "staff", "customer"] },
  { id: "wallet", path: "/dashboard/wallet", label: "Ví & thanh toán", icon: Wallet, roles: ["admin", "staff", "customer"] },
  { id: "profile", path: "/dashboard/profile", label: "Hồ sơ", icon: UserRound, roles: ["admin", "staff", "customer"] },
];

export const adminOnlyPaths: string[] = [];

export function getNavItemsForRole(role: Role) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function getDefaultPathForRole(role: Role) {
  return role === "customer" ? "/dashboard/profile" : "/dashboard/sessions";
}
