"use client";

import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { parkingConfig } from "@/lib/parking-config";

type Session = { id: string; status: string; fee: number };

type State = {
  sessions: Session[];
};

type User = { id: string; name: string; email: string; role: string; status: string };

type Stats = {
  active: number;
  available: number;
  revenue: number;
  completion: number;
};

type AppContext = {
  state: State;
  stats: Stats;
  userList: User[];
};

const ParkingContext = createContext<AppContext | null>(null);

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

  // demo user list for admin view (in real app this would come from API)
  const userList: User[] = [
    { id: "u1", name: "Nguyễn Văn A", email: "a@example.com", role: "admin", status: "Đang hoạt động" },
    { id: "u2", name: "Trần Thị B", email: "b@example.com", role: "staff", status: "Đang hoạt động" },
    { id: "u3", name: "Lê C", email: "c@example.com", role: "customer", status: "Đã khóa" },
  ];

  return <ParkingContext.Provider value={{ state, stats, userList }}>{children}</ParkingContext.Provider>;
}

export function useParkingApp() {
  const ctx = useContext(ParkingContext);
  if (!ctx) throw new Error("useParkingApp must be used inside ParkingProvider");
  return ctx as AppContext;
}

export default ParkingProvider;