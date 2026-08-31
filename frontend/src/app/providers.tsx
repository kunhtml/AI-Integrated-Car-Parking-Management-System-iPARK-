"use client";

import { ParkingAppProvider } from "@/context/parking-app-context";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ParkingAppProvider>
      <ServiceWorkerRegistration />
      {children}
    </ParkingAppProvider>
  );
}
