"use client";

import React from "react";

type Props = {
  allowedRoles?: string[];
  children: React.ReactNode;
};

// Minimal role guard for admin UI. In dev it always allows through.
export function RoleGuard({ children }: Props) {
  return <>{children}</>;
}

export default RoleGuard;
