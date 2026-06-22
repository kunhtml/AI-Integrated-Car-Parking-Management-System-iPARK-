"use client";

import type { ReactNode } from "react";
import { ParkingAppProvider } from "@/context/parking-app-context";

export function Providers({ children }: { children: ReactNode }) {
  return <ParkingAppProvider>{children}</ParkingAppProvider>;
}
