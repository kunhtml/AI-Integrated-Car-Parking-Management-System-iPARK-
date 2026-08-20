"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  adminOnlyPaths,
  getDefaultPathForRole,
  getNavItemsForRole,
} from "@/config/nav-items";
import { useParkingApp } from "@/context/parking-app-context";
import type { Role } from "@/types";

type RoleGuardProps = {
  allowedRoles?: Role[];
  children: React.ReactNode;
};

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, viewAs } = useParkingApp();
  const lastRedirectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let targetPath: string | null = null;

    // Xác định role hiệu dụng dựa trên viewAs
    const effectiveRole = currentUser.role === "staff" && viewAs === "customer"
      ? "customer"
      : currentUser.role;

    if (allowedRoles) {
      if (!allowedRoles.includes(effectiveRole)) {
        targetPath = getDefaultPathForRole(currentUser.role);
      }
    } else if (
      adminOnlyPaths.includes(pathname) &&
      currentUser.role !== "admin"
    ) {
      targetPath = getDefaultPathForRole(currentUser.role);
    } else {
      const allowedPaths = getNavItemsForRole(currentUser.role, viewAs).map(
        (item) => item.path,
      );
      if (
        !allowedPaths.some(
          (p) => pathname === p || pathname.startsWith(p + "/"),
        )
      ) {
        targetPath = getDefaultPathForRole(currentUser.role);
      }
    }

    if (
      targetPath &&
      targetPath !== pathname &&
      lastRedirectRef.current !== targetPath
    ) {
      lastRedirectRef.current = targetPath;
      router.replace(targetPath);
    }
  }, [currentUser?.id, currentUser?.role, viewAs, pathname, allowedRoles, router]);

  if (!currentUser) {
    return null;
  }

  // Xác định role hiệu dụng dựa trên viewAs
  const effectiveRole = currentUser.role === "staff" && viewAs === "customer"
    ? "customer"
    : currentUser.role;

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return null;
  }

  return children;
}
