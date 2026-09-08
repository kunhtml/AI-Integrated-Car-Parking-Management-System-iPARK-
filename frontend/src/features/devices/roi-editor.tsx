"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, Move, Save, X } from "lucide-react";

import { apiFetch } from "@/lib/client-api";

type Roi = {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

type RoiEditorProps = {
  deviceId: string;
  deviceName: string;
  snapshotUrl?: string;
  initialRoi?: Roi | null;
  onSaved: (roi: Roi) => void;
  onClose: () => void;
};

type DrawState = "idle" | "drawing" | "dragging" | "resizing";

export function RoiEditor({ deviceId, deviceName, snapshotUrl, initialRoi, onSaved, onClose }: RoiEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [roi, setRoi] = useState<Roi>(
    initialRoi || { x: 80, y: 60, width: 240, height: 100, label: "" },
  );
  const [label, setLabel] = useState(roi.label || "");
  const [drawState, setDrawState] = useState<DrawState>("idle");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const dragStart = useRef<{ mouseX: number; mouseY: number; roiX: number; roiY: number } | null>(null);
  const resizeHandle = useRef<string | null>(null);
  const resizeStart = useRef<{ mouseX: number; mouseY: number; roi: Roi } | null>(null);

  const IMAGE_WIDTH = 640;
  const IMAGE_HEIGHT = 360;

  // Load snapshot image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      setImageLoaded(false);
    };
    if (snapshotUrl) {
      img.src = snapshotUrl.startsWith("/") ? snapshotUrl : snapshotUrl;
    }
  }, [snapshotUrl]);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    canvas.width = IMAGE_WIDTH;
    canvas.height = IMAGE_HEIGHT;

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

    // Draw image if loaded
    if (imageRef.current && imageLoaded) {
      ctx.drawImage(imageRef.current, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
    } else {
      ctx.fillStyle = "#16213e";
      ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
      ctx.fillStyle = "#555";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(snapshotUrl ? "Đang tải ảnh camera..." : "Chưa có ảnh snapshot", IMAGE_WIDTH / 2, IMAGE_HEIGHT / 2);
      ctx.font = "12px sans-serif";
      ctx.fillText("Kéo chuột để vẽ vùng ROI", IMAGE_WIDTH / 2, IMAGE_HEIGHT / 2 + 24);
    }

    // Dim area outside ROI
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    // Top
    ctx.fillRect(0, 0, IMAGE_WIDTH, roi.y);
    // Bottom
    ctx.fillRect(0, roi.y + roi.height, IMAGE_WIDTH, IMAGE_HEIGHT - roi.y - roi.height);
    // Left
    ctx.fillRect(0, roi.y, roi.x, roi.height);
    // Right
    ctx.fillRect(roi.x + roi.width, roi.y, IMAGE_WIDTH - roi.x - roi.width, roi.height);

    // ROI rectangle
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
    ctx.setLineDash([]);

    // Corner handles
    const handleSize = 8;
    ctx.fillStyle = "#00ff88";
    const corners = [
      { x: roi.x, y: roi.y },
      { x: roi.x + roi.width, y: roi.y },
      { x: roi.x, y: roi.y + roi.height },
      { x: roi.x + roi.width, y: roi.y + roi.height },
    ];
    for (const c of corners) {
      ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
    }

    // ROI label
    ctx.fillStyle = "rgba(0, 255, 136, 0.85)";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    const text = `${roi.width}x${roi.height} @ (${roi.x}, ${roi.y})`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillRect(roi.x, roi.y - 22, textWidth + 12, 20);
    ctx.fillStyle = "#000";
    ctx.fillText(text, roi.x + 6, roi.y - 7);
  }, [roi, imageLoaded, snapshotUrl]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = IMAGE_WIDTH / rect.width;
    const scaleY = IMAGE_HEIGHT / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }

  function hitTestHandle(x: number, y: number): string | null {
    const threshold = 12;
    const handles = [
      { name: "tl", hx: roi.x, hy: roi.y },
      { name: "tr", hx: roi.x + roi.width, hy: roi.y },
      { name: "bl", hx: roi.x, hy: roi.y + roi.height },
      { name: "br", hx: roi.x + roi.width, hy: roi.y + roi.height },
    ];
    for (const h of handles) {
      if (Math.abs(x - h.hx) < threshold && Math.abs(y - h.hy) < threshold) {
        return h.name;
      }
    }
    return null;
  }

  function isInsideRoi(x: number, y: number): boolean {
    return x >= roi.x && x <= roi.x + roi.width && y >= roi.y && y <= roi.y + roi.height;
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = getCanvasCoords(e);

    const handle = hitTestHandle(x, y);
    if (handle) {
      setDrawState("resizing");
      resizeHandle.current = handle;
      resizeStart.current = { mouseX: x, mouseY: y, roi: { ...roi } };
      return;
    }

    if (isInsideRoi(x, y)) {
      setDrawState("dragging");
      dragStart.current = { mouseX: x, mouseY: y, roiX: roi.x, roiY: roi.y };
      return;
    }

    // Start drawing new ROI
    setDrawState("drawing");
    setRoi({ x, y, width: 0, height: 0, label });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = getCanvasCoords(e);

    if (drawState === "drawing") {
      setRoi((prev) => ({
        ...prev,
        width: Math.max(20, x - prev.x),
        height: Math.max(20, y - prev.y),
      }));
      return;
    }

    if (drawState === "dragging" && dragStart.current) {
      const dx = x - dragStart.current.mouseX;
      const dy = y - dragStart.current.mouseY;
      const newX = Math.max(0, Math.min(IMAGE_WIDTH - roi.width, dragStart.current.roiX + dx));
      const newY = Math.max(0, Math.min(IMAGE_HEIGHT - roi.height, dragStart.current.roiY + dy));
      setRoi((prev) => ({ ...prev, x: Math.round(newX), y: Math.round(newY) }));
      return;
    }

    if (drawState === "resizing" && resizeStart.current && resizeHandle.current) {
      const { roi: startRoi } = resizeStart.current;
      let newX = startRoi.x;
      let newY = startRoi.y;
      let newW = startRoi.width;
      let newH = startRoi.height;

      const handle = resizeHandle.current;
      if (handle.includes("r")) {
        newW = Math.max(30, x - startRoi.x);
      }
      if (handle.includes("l")) {
        newX = Math.min(x, startRoi.x + startRoi.width - 30);
        newW = startRoi.x + startRoi.width - newX;
      }
      if (handle.includes("b")) {
        newH = Math.max(20, y - startRoi.y);
      }
      if (handle.includes("t")) {
        newY = Math.min(y, startRoi.y + startRoi.height - 20);
        newH = startRoi.y + startRoi.height - newY;
      }

      setRoi({ x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH), label });
      return;
    }

    // Update cursor
    const canvas = canvasRef.current;
    if (canvas) {
      const handle = hitTestHandle(x, y);
      if (handle === "tl" || handle === "br") {
        canvas.style.cursor = "nwse-resize";
      } else if (handle === "tr" || handle === "bl") {
        canvas.style.cursor = "nesw-resize";
      } else if (isInsideRoi(x, y)) {
        canvas.style.cursor = "move";
      } else {
        canvas.style.cursor = "crosshair";
      }
    }
  }

  function handleMouseUp() {
    setDrawState("idle");
    dragStart.current = null;
    resizeStart.current = null;
    resizeHandle.current = null;
  }

  async function saveRoi() {
    setSaving(true);
    setMsg("");
    try {
      const response = await apiFetch(`/devices/${deviceId}/roi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...roi, label }),
      });
      const data = await response.json();
      if (response.ok) {
        setMsg("Đã lưu ROI thành công.");
        onSaved({ ...roi, label });
      } else {
        setMsg(data.message || "Không lưu được ROI.");
      }
    } catch {
      setMsg("Lỗi kết nối khi lưu ROI.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-heading">
        <div>
          <p>Chỉnh sửa</p>
          <h2>ROI cho "{deviceName}"</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="small-button" type="button" onClick={saveRoi} disabled={saving}>
            <Save size={14} /> {saving ? "Đang lưu..." : "Lưu ROI"}
          </button>
          <button className="small-button" type="button" onClick={onClose}>
            <X size={14} /> Đóng
          </button>
        </div>
      </div>

      <p className="muted-text">
        <Crosshair size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
        Kéo chuột trên ảnh để vẽ vùng biển số. Kéo bên trong ROI để di chuyển. Kéo góc để thay đổi kích thước.
      </p>

      {msg && (
        <p className="muted-cell" style={{ marginBottom: 8, color: msg.includes("thành công") ? "#00ff88" : "#ff6b6b" }}>
          {msg}
        </p>
      )}

      <div ref={containerRef} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #333" }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ width: "100%", display: "block", cursor: "crosshair" }}
        />
      </div>

      <div className="filter-row" style={{ marginTop: 12 }}>
        <label className="muted-cell" style={{ minWidth: 40 }}>
          X
          <input
            type="number"
            value={roi.x}
            onChange={(e) => setRoi((s) => ({ ...s, x: Math.max(0, Number(e.target.value)) }))}
            style={{ width: 80, marginLeft: 8 }}
          />
        </label>
        <label className="muted-cell" style={{ minWidth: 40 }}>
          Y
          <input
            type="number"
            value={roi.y}
            onChange={(e) => setRoi((s) => ({ ...s, y: Math.max(0, Number(e.target.value)) }))}
            style={{ width: 80, marginLeft: 8 }}
          />
        </label>
        <label className="muted-cell" style={{ minWidth: 60 }}>
          Width
          <input
            type="number"
            value={roi.width}
            onChange={(e) => setRoi((s) => ({ ...s, width: Math.max(20, Number(e.target.value)) }))}
            style={{ width: 100, marginLeft: 8 }}
          />
        </label>
        <label className="muted-cell" style={{ minWidth: 70 }}>
          Height
          <input
            type="number"
            value={roi.height}
            onChange={(e) => setRoi((s) => ({ ...s, height: Math.max(15, Number(e.target.value)) }))}
            style={{ width: 100, marginLeft: 8 }}
          />
        </label>
        <label className="muted-cell" style={{ flex: 1 }}>
          <Move size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Ghi chú
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="VD: Biển số trước xe"
            style={{ width: "100%", marginLeft: 8 }}
          />
        </label>
      </div>
    </div>
  );
}
