"use client";

import React from "react";
import ParkingProvider from "@/context/parking-app-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ParkingProvider>{children}</ParkingProvider>;
}
