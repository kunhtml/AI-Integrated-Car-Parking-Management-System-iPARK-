"use client";

import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { parkingConfig } from "@/lib/parking-config";

type Session = { id: string; status: string; fee: number };

type State = {
  sessions: Session[];
};

const ParkingContext = createContext<any>(null);

export function ParkingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ sessions: [] });

  useEffect(() => {
    // try fetch live overview from backend
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "";
        const url = base ? `${base.replace(/\/$/, "")}/parking-sessions/overview` : "/api/parking-sessions/overview";
        const res = await fetch(url, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          // expected shape: { ok: true, data: { total, active, checkedOut, recent: [] } }
          const recent = (data.data?.recent || []).map((s: any) => ({ id: s.id, status: s.status || "Đang gửi", fee: s.fee || 0 }));
          setState({ sessions: recent });
          return;
        }
      } catch (err) {
        // ignore and fall back to demo
      }

      // fallback demo data
      setState({
        sessions: [
          { id: "1", status: "Đang gửi", fee: 0 },
          { id: "2", status: "Đã hoàn thành", fee: 12000 },
          { id: "3", status: "Đã hoàn thành", fee: 8000 },
        ],
      });
    })();
  }, []);

  const stats = useMemo(() => {
    const active = state.sessions.filter((item) => item.status === "Đang gửi").length;
    const revenue = state.sessions.reduce((sum, item) => sum + (item.fee || 0), 0);

    return {
      active,
      available: parkingConfig.totalCapacity - active,
      revenue,
      completion: state.sessions.filter((item) => item.status === "Đã hoàn thành").length,
    };
  }, [state.sessions]);

  return <ParkingContext.Provider value={{ state, stats }}>{children}</ParkingContext.Provider>;
}

export function useParkingApp() {
  const ctx = useContext(ParkingContext);
  if (!ctx) throw new Error("useParkingApp must be used inside ParkingProvider");
  return ctx;
}

export default ParkingProvider;