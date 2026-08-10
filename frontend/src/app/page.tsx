"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getDefaultPathForRole } from "@/config/nav-items";
import { useParkingApp } from "@/context/parking-app-context";
import { PublicLanding } from "@/features/auth/public-landing";

export default function Home() {
  const router = useRouter();
  const { currentUser, sessionLoading } = useParkingApp();

  useEffect(() => {
    if (!sessionLoading && currentUser) {
      router.replace(getDefaultPathForRole(currentUser.role));
    }
  }, [sessionLoading, currentUser, router]);

  if (sessionLoading) {
    return (
      <main className="public-shell">
        <section className="public-section">
          <p>Đang tải...</p>
        </section>
      </main>
    );
  }

  if (currentUser) {
    return null;
  }

  return <PublicLanding />;
}
