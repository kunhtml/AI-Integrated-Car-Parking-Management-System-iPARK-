"use client";

import {createContext, useContext, useState} from "react";
import type {
    AuthMode,
    DemoUser,
    DeviceItem,
    FeedbackItem,
    IncidentItem,
    NotificationItem,
    ParkingSession,
    PricingConfig,
    RegisteredVehicle,
    ReportSummary,
    ShiftItem,
    TransactionItem,
 } from "@/types";

type ParkingAppContextValue = {
    mode: AuthMode;
    setMode: (mode: AuthMode) => void;
    currentUser: DemoUser | null;
    setCurrentUser: (user: DemoUser | null) => void;
    session: ParkingSession[];

};

const ParkingAppContext = createContext<ParkingAppContextValue | null>(null);
export function useParkingApp() {
    const context = useContext(ParkingAppContext);
    if (!context) {
        throw new Error("useParkingApp must be used within a ParkingAppProvider");
    }
    return context;
}