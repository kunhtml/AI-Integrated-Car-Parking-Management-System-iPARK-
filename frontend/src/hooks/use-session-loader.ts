import { useEffect } from "react";

import { apiFetch } from "@/lib/client-api";
import type { DemoUser } from "@/types";

type SessionLoaderParams = {
  setCurrentUser: (user: DemoUser | null) => void;
  setActionLog: (log: string) => void;
  setSessionLoading: (loading: boolean) => void;
};

export function useSessionLoader({ setCurrentUser, setActionLog, setSessionLoading }: SessionLoaderParams) {
  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await apiFetch("/auth/me");
        const data = await response.json();
        if (!cancelled && data.user) {
          setCurrentUser(data.user);
        }
      } catch {
        if (!cancelled) {
          setActionLog("Chưa kết nối được phiên đăng nhập.");
        }
      } finally {
        if (!cancelled) {
          setSessionLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
    // Run once on mount; setters are stable via useCallback in provider.
  }, [setCurrentUser, setActionLog, setSessionLoading]);
}
