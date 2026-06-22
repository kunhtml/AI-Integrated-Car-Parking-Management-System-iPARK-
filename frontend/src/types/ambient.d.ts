declare module "@/features/users/users-view" {
  export const UsersView: any;
}

declare module "@/lib/constants" {
  import type { Role } from "@/types";

  export const roleLabels: Record<Role, string>;
  export const currency: Intl.NumberFormat;
  export const apiBaseUrl: string;
  export function todayInputValue(): string;
}
