"use client";

import { useEffect, useRef } from "react";
import { showAutoToast } from "@/lib/toast";

export function SystemLog({ message }: { message: string }) {
  const prevMessage = useRef(message);

  useEffect(() => {
    if (message && message !== prevMessage.current) {
      showAutoToast(message);
      prevMessage.current = message;
    }
  }, [message]);

  // No visible bar — all messages go to SweetAlert toast
  return null;
}
