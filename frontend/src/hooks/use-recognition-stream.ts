"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { recognitionStreamUrl } from "@/lib/media";
import type { RecognitionLogItem } from "@/types";

type RealtimeEnvelope = {
  type: "recognition-log" | "device-status" | "ping";
  data: unknown;
  at: string;
};

type UseRecognitionStreamOptions = {
  enabled?: boolean;
  deviceId?: string | null;
  onLog?: (log: RecognitionLogItem) => void;
};

export function useRecognitionStream(
  options: UseRecognitionStreamOptions = {},
) {
  const { enabled = true, deviceId = null, onLog } = options;
  const [connected, setConnected] = useState(false);
  const [lastLog, setLastLog] = useState<RecognitionLogItem | null>(null);
  const [error, setError] = useState("");
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      disconnect();
      return;
    }

    let cancelled = false;
    let attempt = 0;

    function connect() {
      if (cancelled) {
        return;
      }
      disconnect();

      const source = new EventSource(recognitionStreamUrl(), {
        withCredentials: true,
      });
      sourceRef.current = source;

      source.addEventListener("open", () => {
        attempt = 0;
        setConnected(true);
        setError("");
      });

      const handleEnvelope = (raw: MessageEvent) => {
        try {
          const envelope = JSON.parse(String(raw.data)) as RealtimeEnvelope;
          if (envelope.type !== "recognition-log") {
            return;
          }
          const log = envelope.data as RecognitionLogItem;
          if (deviceId && log.deviceId && log.deviceId !== deviceId) {
            return;
          }
          setLastLog(log);
          onLogRef.current?.(log);
        } catch {
          // ignore malformed events
        }
      };

      source.addEventListener("recognition-log", handleEnvelope);
      source.onmessage = handleEnvelope;

      source.onerror = () => {
        setConnected(false);
        source.close();
        sourceRef.current = null;
        if (cancelled) {
          return;
        }
        setError("Mất kết nối realtime. Đang thử lại...");
        const delay = Math.min(15000, 1000 * 2 ** attempt);
        attempt += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      disconnect();
    };
  }, [enabled, deviceId, disconnect]);

  return { connected, lastLog, error, disconnect };
}
