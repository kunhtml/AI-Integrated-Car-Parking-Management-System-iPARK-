"use client";

import { useParkingApp } from "@/context/parking-app-context";
import { AdminProfileView } from "@/features/profile/admin-profile-view";
import { CustomerProfileView } from "@/features/profile/customer-profile-view";

export function ProfileView() {
  const { currentUser } = useParkingApp();

  if (!currentUser) {
    return null;
  }

  return currentUser.role === "admin" ? <AdminProfileView /> : <CustomerProfileView />;
}
