"use client";

import type { DeviceItem, RecognitionLogItem } from "@/types";

type DetectionOverlayProps = {
  device?: Pick<DeviceItem, "roi"> | null;
  detection?: RecognitionLogItem | null;
  showRoi?: boolean;
};

/**
 * Overlay SVG trên MJPEG stream:
 * - ROI box (cấu hình camera)
 * - Plate label + confidence từ recognition log gần nhất
 * (AI hiện crop ROI server-side nên không có bbox pixel-level; dùng ROI + label.)
 */
export function DetectionOverlay({
  device,
  detection,
  showRoi = true,
}: DetectionOverlayProps) {
  const roi = device?.roi;
  const hasRoi =
    showRoi &&
    roi &&
    typeof roi.x === "number" &&
    typeof roi.y === "number" &&
    typeof roi.width === "number" &&
    typeof roi.height === "number" &&
    roi.width > 0 &&
    roi.height > 0;

  const plate = detection?.detectedPlate || detection?.plate || "";
  const confidence =
    typeof detection?.confidence === "number" ? detection.confidence : null;
  const status = detection?.status;

  return (
    <div className="detection-overlay" aria-hidden={!hasRoi && !plate}>
      <svg
        className="detection-overlay-svg"
        viewBox="0 0 640 360"
        preserveAspectRatio="none"
      >
        {hasRoi ? (
          <g>
            <rect
              x={roi!.x}
              y={roi!.y}
              width={roi!.width}
              height={roi!.height}
              className="detection-roi-box"
            />
            <text
              x={(roi!.x || 0) + 6}
              y={(roi!.y || 0) - 8}
              className="detection-roi-label"
            >
              ROI {roi!.width}×{roi!.height}
            </text>
          </g>
        ) : null}

        {plate ? (
          <g>
            <rect
              x={hasRoi ? roi!.x || 0 : 12}
              y={hasRoi ? (roi!.y || 0) + (roi!.height || 0) + 8 : 12}
              width={Math.min(280, 24 + plate.length * 14)}
              height={28}
              rx={4}
              className={`detection-plate-bg status-${status || "success"}`}
            />
            <text
              x={(hasRoi ? roi!.x || 0 : 12) + 10}
              y={(hasRoi ? (roi!.y || 0) + (roi!.height || 0) + 8 : 12) + 19}
              className="detection-plate-text"
            >
              {plate}
              {confidence != null ? ` · ${confidence}%` : ""}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
