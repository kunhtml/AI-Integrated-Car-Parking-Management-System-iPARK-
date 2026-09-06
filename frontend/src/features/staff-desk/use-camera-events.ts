"use client";

import { useEffect, useRef, useState } from "react";

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
  entryImagePath?: string;
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

export type ExitSessionStateEvent = {
  sessionId: string;
  status: string;
  exitState?: string | null;
};

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
  const [latestExitState, setLatestExitState] =
    useState<ExitSessionStateEvent | null>(null);
  const [status, setStatus] = useState<CameraStreamStatus>("connecting");
  const retryRef = useRef(0);
  const closedRef = useRef(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    closedRef.current = false;

    const connect = () => {
      if (closedRef.current) return;
      // SSE đi qua Next.js rewrites → same-origin để browser tự gửi
      // cookie `parking_session` mà không cần CORS credentials. Backend
      // thật vẫn là http://localhost:4000 (xem next.config.ts rewrites).
      // Dùng URL tương đối để tự thích nghi với mọi host/proxy.
      const url = "/api/camera-logs/stream";
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

      es.addEventListener("exit.session-state", (e) => {
        try {
          setLatestExitState(
            JSON.parse((e as MessageEvent).data) as ExitSessionStateEvent,
          );
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

    // Ping AI runtime để bật chế độ inference (chỉ chạy khi staff-desk mở).
    const pingWatch = async () => {
      try {
        await fetch(`${bridgeBaseUrl}/api/staff-desk/watch`, {
          method: "POST",
          credentials: "omit",
        });
      } catch {
        // ignore: AI có thể chưa sẵn sàng, hook sẽ retry ở lần sau
      }
    };
    pingWatch();
    const watchInterval = window.setInterval(pingWatch, 10_000);

    return () => {
      closedRef.current = true;
      sourceRef.current?.close();
      sourceRef.current = null;
      window.clearInterval(watchInterval);
      // Báo AI ngưng inference khi rời trang.
      try {
        const body = new Blob([JSON.stringify({})], {
          type: "application/json",
        });
        navigator.sendBeacon?.(`${bridgeBaseUrl}/api/staff-desk/unwatch`, body);
      } catch {
        // ignore
      }
    };
  }, []);

  return { latest, latestExitState, status };
}

/** Resolve đường dẫn ảnh tương đối từ bridge (vd `/static/snapshots/x.jpg`) sang absolute URL. */
export function resolveBridgeImageUrl(
  imagePath?: string | null,
): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://"))
    return imagePath;

  // Backend có thể trả path ảnh của bridge hoặc path tương đối của API.
  // Ảnh OCR/snapshot được lưu và serve bởi Python bridge trên port 5050.
  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;
  return `${bridgeBaseUrl}${normalizedPath}`;
}
