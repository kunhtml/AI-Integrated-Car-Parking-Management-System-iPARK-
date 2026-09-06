"use client";

import { ParkingAppProvider } from "@/context/parking-app-context";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { VietnameseValidationMessages } from "@/components/vietnamese-validation-messages";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ParkingAppProvider>
      <ServiceWorkerRegistration />
      <VietnameseValidationMessages />
      {children}
    </ParkingAppProvider>
  );
}
