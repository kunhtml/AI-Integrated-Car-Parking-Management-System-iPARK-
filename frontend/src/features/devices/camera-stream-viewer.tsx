"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, VideoOff, X } from "lucide-react";

import { DetectionOverlay } from "@/features/devices/detection-overlay";
import { useRecognitionStream } from "@/hooks/use-recognition-stream";
import { deviceStreamUrl } from "@/lib/media";
import type { DeviceItem, RecognitionLogItem } from "@/types";

type CameraStreamViewerProps = {
  device: DeviceItem;
  onClose?: () => void;
  showLiveLogs?: boolean;
  className?: string;
};

export function CameraStreamViewer({
  device,
  onClose,
  showLiveLogs = true,
  className = "",
}: CameraStreamViewerProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [streamError, setStreamError] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [recentLogs, setRecentLogs] = useState<RecognitionLogItem[]>([]);

  const {
    connected,
    lastLog,
    error: sseError,
  } = useRecognitionStream({
    enabled: true,
    deviceId: device.id,
    onLog: (log) => {
      setRecentLogs((prev) => [log, ...prev].slice(0, 8));
    },
  });

  useEffect(() => {
    const el = imgRef.current;
    if (!el) {
      return;
    }
    setStreamError(false);
    el.src = `${deviceStreamUrl(device.id)}?t=${Date.now()}`;
    return () => {
      el.src = "";
    };
  }, [device.id, streamKey]);

  return (
    <div className={`camera-stream-viewer ${className}`.trim()}>
      <div className="camera-stream-toolbar">
        <div className="camera-stream-meta">
          <strong>{device.name}</strong>
          <span className="muted-text">
            {device.gate === "entry" ? "Cổng vào" : "Cổng ra"} ·{" "}
            {(device.deviceType || "rtsp").toUpperCase()}
          </span>
        </div>
        <div className="camera-stream-badges">
          <span className={`live-badge ${streamError ? "offline" : "online"}`}>
            <Radio size={12} /> {streamError ? "Stream lỗi" : "LIVE"}
          </span>
          <span className={`live-badge ${connected ? "online" : "offline"}`}>
            SSE {connected ? "ON" : "OFF"}
          </span>
          {onClose ? (
            <button
              type="button"
              className="small-button"
              onClick={onClose}
              aria-label="Đóng stream"
            >
              <X size={14} /> Đóng
            </button>
          ) : null}
        </div>
      </div>

      <div className="camera-stream-frame">
        {streamError ? (
          <div className="camera-stream-fallback">
            <VideoOff size={28} />
            <p>Không nhận được MJPEG stream.</p>
            <p className="muted-text">
              Kiểm tra RTSP/HTTP, ffmpeg và trạng thái camera.
            </p>
            <button
              type="button"
              className="small-button"
              onClick={() => setStreamKey((k) => k + 1)}
            >
              Thử lại
            </button>
          </div>
        ) : (
          <img
            ref={imgRef}
            alt={`Stream ${device.name}`}
            className="camera-stream-img"
            onError={() => setStreamError(true)}
          />
        )}
        <DetectionOverlay device={device} detection={lastLog} showRoi />
      </div>

      {(sseError || lastLog) && (
        <div className="camera-stream-status">
          {sseError ? (
            <span className="muted-text error">{sseError}</span>
          ) : null}
          {lastLog ? (
            <span className="muted-text">
              OCR gần nhất:{" "}
              <strong>{lastLog.detectedPlate || lastLog.plate || "—"}</strong>
              {typeof lastLog.confidence === "number"
                ? ` (${lastLog.confidence}%)`
                : ""}{" "}
              · {lastLog.status}
            </span>
          ) : null}
        </div>
      )}

      {showLiveLogs && recentLogs.length > 0 ? (
        <div className="camera-live-logs">
          <p className="muted-text">Log nhận diện realtime (thiết bị này)</p>
          <ul>
            {recentLogs.map((log) => (
              <li key={log.id}>
                <span
                  className={`badge ${log.status === "success" ? "success" : "warning"}`}
                >
                  {log.status}
                </span>{" "}
                <strong>{log.detectedPlate || log.plate || "—"}</strong>
                <span className="muted-text">
                  {" "}
                  · {new Date(log.createdAt).toLocaleTimeString("vi-VN")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
