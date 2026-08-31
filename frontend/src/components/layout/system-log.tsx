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

    // Hidden aria-live region for screen reader announcements
    return (
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
      >
        {message}
      </div>
    );
}
