"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { adminOnlyPaths, getDefaultPathForRole, getNavItemsForRole } from "@/config/nav-items";
import { useParkingApp } from "@/context/parking-app-context";
import type { Role } from "@/types";

type RoleGuardProps = {
  allowedRoles?: Role[];
  children: React.ReactNode;
};

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser } = useParkingApp();
  const lastRedirectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let targetPath: string | null = null;

    if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
      targetPath = getDefaultPathForRole(currentUser.role);
    } else if (adminOnlyPaths.includes(pathname) && currentUser.role !== "admin") {
      targetPath = getDefaultPathForRole(currentUser.role);
    } else {
      const allowedPaths = getNavItemsForRole(currentUser.role).map((item) => item.path);
      if (!allowedPaths.includes(pathname)) {
        targetPath = getDefaultPathForRole(currentUser.role);
      }
    }

    if (targetPath && targetPath !== pathname && lastRedirectRef.current !== targetPath) {
      lastRedirectRef.current = targetPath;
      router.replace(targetPath);
    }
  }, [currentUser?.id, currentUser?.role, pathname, allowedRoles, router]);

  if (!currentUser) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return null;
  }

  return children;
}
