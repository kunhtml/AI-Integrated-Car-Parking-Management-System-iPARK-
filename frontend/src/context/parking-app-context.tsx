"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

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
  setState: React.Dispatch<React.SetStateAction<State>>;
};

const ParkingContext = createContext<AppContext | null>(null);

export function ParkingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ sessions: [] });

  const stats = useMemo<Stats>(
    () => ({
      active: 0,
      available: 0,
      revenue: 0,
      completion: 0,
    }),
    [],
  );

  return (
    <ParkingContext.Provider value={{ state, stats, userList: [], setState }}>
      {children}
    </ParkingContext.Provider>
  );
}

export function useParkingApp() {
  const ctx = useContext(ParkingContext);
  if (!ctx) throw new Error("useParkingApp must be used inside ParkingProvider");
  return ctx;
}

export default ParkingProvider;
