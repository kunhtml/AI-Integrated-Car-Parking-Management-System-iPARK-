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
          setActionLog("Dùng tài khoản demo — chưa kết nối API đăng nhập.");
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
  }, [setCurrentUser, setActionLog, setSessionLoading]);
}
