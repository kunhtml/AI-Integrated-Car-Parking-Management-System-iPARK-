"use client";

import { ParkingAppProvider } from "@/context/parking-app-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ParkingAppProvider>{children}</ParkingAppProvider>;
}
