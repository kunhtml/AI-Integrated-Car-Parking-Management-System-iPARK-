"use client";

import { useEffect, useRef, useState } from "react";

import { apiBaseUrl } from "@/lib/constants"
import { bridgeBaseUrl } from "@/lib/client-api";

export type CameraIngestEvent = {
  id: string;
  direction: "in" | "out";
  plate: string;
  detectedPlate: string;
  confidence?: number;
  rfidUid?: string;
  ownerName?: string;
  userType: "resident" | "guest" | "unknown";
  imagePath?: string;
  barrierOpened: boolean;
  sessionId?: string | null;
  checkInAt?: string | null;
  sessionStatus?: string | null;
  exitState?: string | null;
  sessionPaymentStatus?: string | null;
  fee?: number | null;
  action?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
  duplicateSession?: boolean;
};

export type CameraStreamStatus = "connecting" | "open" | "error" | "closed";

/**
 * Subscribe SSE từ backend `/api/camera-logs/stream`.
 * - Auto-reconnect khi lỗi (exponential backoff tối đa 15s).
 * - Tự cleanup khi component unmount.
 * - Trả về event mới nhất + trạng thái kết nối.
 *
 * Backend phát event `camera.ingest` cho mỗi lần bridge POST log direction=in.
 */
export function useCameraIngestEvents() {
  const [latest, setLatest] = useState<CameraIngestEvent | null>(null);
  const [status, setStatus] = useState<CameraStreamStatus>("connecting");
  const retryRef = useRef(0);
  const closedRef = useRef(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    closedRef.current = false;

    const connect = () => {
      if (closedRef.current) return;
      // EventSource gửi cookie cùng domain tự động; backend đã set credentials.
      const url = `${apiBaseUrl}/camera-logs/stream`;
      const es = new EventSource(url, { withCredentials: true });
      sourceRef.current = es;
      setStatus("connecting");

      es.addEventListener("open", () => {
        retryRef.current = 0;
        setStatus("open");
      });

      es.addEventListener("connected", () => {
        setStatus("open");
      });

      es.addEventListener("camera.ingest", (e) => {
        try {
          const data = JSON.parse(
            (e as MessageEvent).data,
          ) as CameraIngestEvent;
          setLatest(data);
        } catch {
          // ignore malformed
        }
      });

      es.onerror = () => {
        setStatus("error");
        es.close();
        sourceRef.current = null;
        if (closedRef.current) return;
        const backoff = Math.min(15_000, 1000 * 2 ** retryRef.current);
        retryRef.current += 1;
        window.setTimeout(connect, backoff);
      };
    };

    connect();
    return () => {
      closedRef.current = true;
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, []);

  return { latest, status };
}

/** Resolve đường dẫn ảnh tương đối từ bridge (vd `/static/snapshots/x.jpg`) sang absolute URL. */
export function resolveBridgeImageUrl(
  imagePath?: string | null,
): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://"))
    return imagePath;
  return `${bridgeBaseUrl}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
}
