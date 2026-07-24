"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Save,
  X,
} from "lucide-react";

import { RoiEditor } from "@/features/devices/roi-editor";
import { apiFetch } from "@/lib/client-api";
import { resolveMediaUrl } from "@/lib/media";
import type { DeviceItem } from "@/types";

type Step = 0 | 1 | 2 | 3 | 4;

type CalibrationWizardProps = {
  device: DeviceItem;
  onClose: () => void;
  onCompleted?: (device: Partial<DeviceItem>) => void;
};

const STEPS = [
  "Kết nối",
  "Snapshot",
  "Vùng ROI",
  "Test nhận diện",
  "Hoàn tất",
] as const;

export function CalibrationWizard({
  device,
  onClose,
  onCompleted,
}: CalibrationWizardProps) {
  const [step, setStep] = useState<Step>(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState(
    resolveMediaUrl(device.lastSnapshotUrl),
  );
  const [roi, setRoi] = useState(device.roi || null);
  const [testResult, setTestResult] = useState<{
    plate?: string;
    confidence?: number;
    message?: string;
    ok: boolean;
  } | null>(null);
  const [showRoiEditor, setShowRoiEditor] = useState(false);

  const canNext = useMemo(() => {
    if (step === 1) {
      return Boolean(snapshotUrl);
    }
    if (step === 2) {
      return Boolean(roi && roi.width && roi.height);
    }
    return true;
  }, [step, snapshotUrl, roi]);

  async function connectCamera() {
    setBusy(true);
    setMsg("Đang kết nối camera...");
    try {
      const res = await apiFetch(`/devices/${device.id}/connect`, {
        method: "POST",
      });
      const data = await res.json();
      setMsg(data.message || (res.ok ? "Đã kết nối." : "Kết nối thất bại."));
      if (res.ok) {
        setStep(1);
      }
    } catch {
      setMsg("Không gọi được API kết nối.");
    } finally {
      setBusy(false);
    }
  }

  async function captureSnapshot() {
    setBusy(true);
    setMsg("Đang chụp snapshot...");
    try {
      let res = await apiFetch(`/devices/${device.id}/capture`, {
        method: "POST",
      });
      let data = await res.json();
      if (!res.ok) {
        res = await apiFetch(`/devices/${device.id}/snapshot`, {
          method: "POST",
        });
        data = await res.json();
      }
      const url = resolveMediaUrl(
        data.snapshotUrl || data.lastSnapshotUrl || data.url || "",
      );
      if (res.ok && url) {
        setSnapshotUrl(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`);
        setMsg(data.message || "Đã chụp snapshot.");
      } else if (res.ok) {
        setMsg(data.message || "Đã chụp nhưng không có URL ảnh.");
      } else {
        setMsg(data.message || "Chụp snapshot thất bại.");
      }
    } catch {
      setMsg("Không gọi được API snapshot.");
    } finally {
      setBusy(false);
    }
  }

  async function testDetect() {
    setBusy(true);
    setMsg("Đang test nhận diện (camera entry/exit)...");
    setTestResult(null);
    try {
      const path =
        device.gate === "exit"
          ? `/cameras/${device.id}/exit`
          : `/cameras/${device.id}/entry`;
      // fallback: public camera actions via parking context endpoints if mounted under devices flow
      let res = await apiFetch(path, { method: "POST" });
      if (res.status === 404) {
        res = await apiFetch(`/devices/${device.id}/capture`, {
          method: "POST",
        });
      }
      const data = await res.json();
      const plate =
        data.detection?.plate || data.plate || data.detectedPlate || "";
      const confidence = data.detection?.confidence ?? data.confidence;
      const ok = res.ok && Boolean(plate);
      setTestResult({
        ok,
        plate,
        confidence,
        message:
          data.message ||
          (ok ? "Nhận diện thành công." : "Không đọc được biển số."),
      });
      setMsg(
        data.message ||
          (ok ? "Test OK." : "Test chưa ra biển số — kiểm tra ROI/ánh sáng."),
      );
    } catch {
      setTestResult({ ok: false, message: "Lỗi gọi API test." });
      setMsg("Không gọi được API test nhận diện.");
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    onCompleted?.({
      id: device.id,
      lastSnapshotUrl: snapshotUrl,
      roi: roi || undefined,
    });
    onClose();
  }

  return (
    <div className="modal-overlay calibration-wizard-overlay">
      <div className="modal calibration-wizard-modal">
        <div className="modal-header">
          <div>
            <p className="muted-text">Hiệu chỉnh camera</p>
            <h3>{device.name}</h3>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <ol className="calibration-steps">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={index === step ? "active" : index < step ? "done" : ""}
            >
              <span>{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <div className="calibration-body">
          {step === 0 && (
            <div className="stack-form">
              <p>Bước 1: Kiểm tra kết nối tới camera (RTSP/HTTP/ONVIF).</p>
              <p className="muted-text">
                URL: {device.rtspUrl || device.httpUrl || "—"} · Loại:{" "}
                {(device.deviceType || "rtsp").toUpperCase()}
              </p>
              <button
                type="button"
                className="small-button"
                disabled={busy}
                onClick={() => void connectCamera()}
              >
                Kết nối camera
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="stack-form">
              <p>Bước 2: Chụp snapshot làm nền cho ROI editor.</p>
              <button
                type="button"
                className="small-button"
                disabled={busy}
                onClick={() => void captureSnapshot()}
              >
                Chụp snapshot
              </button>
              {snapshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={snapshotUrl}
                  alt="Snapshot"
                  className="calibration-snapshot"
                />
              ) : (
                <p className="muted-text">Chưa có ảnh snapshot.</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="stack-form">
              <p>Bước 3: Vẽ vùng ROI (biển số) trên ảnh snapshot.</p>
              {roi ? (
                <p className="muted-text">
                  ROI hiện tại: {roi.width}×{roi.height} @ ({roi.x}, {roi.y})
                </p>
              ) : (
                <p className="muted-text">Chưa cấu hình ROI.</p>
              )}
              <button
                type="button"
                className="small-button"
                onClick={() => setShowRoiEditor(true)}
              >
                <Crosshair size={14} /> Mở ROI editor
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="stack-form">
              <p>Bước 4: Chạy một lần nhận diện thử với ROI đã lưu.</p>
              <button
                type="button"
                className="small-button"
                disabled={busy}
                onClick={() => void testDetect()}
              >
                Test nhận diện
              </button>
              {testResult ? (
                <div
                  className={`toast-banner ${testResult.ok ? "" : "toast-error"}`}
                >
                  {testResult.ok ? <CheckCircle2 size={16} /> : null}
                  <span>
                    {testResult.message}
                    {testResult.plate ? ` — ${testResult.plate}` : ""}
                    {typeof testResult.confidence === "number"
                      ? ` (${testResult.confidence}%)`
                      : ""}
                  </span>
                </div>
              ) : null}
            </div>
          )}

          {step === 4 && (
            <div className="stack-form">
              <p>Bước 5: Hoàn tất hiệu chỉnh.</p>
              <ul className="muted-text">
                <li>Snapshot: {snapshotUrl ? "Có" : "Chưa"}</li>
                <li>
                  ROI: {roi?.width ? `${roi.width}×${roi.height}` : "Chưa"}
                </li>
                <li>
                  Test:{" "}
                  {testResult?.ok
                    ? "OK"
                    : testResult
                      ? "Chưa đạt"
                      : "Chưa chạy"}
                </li>
              </ul>
              <button type="button" className="small-button" onClick={finish}>
                <Save size={14} /> Lưu & đóng
              </button>
            </div>
          )}

          {msg ? <p className="muted-cell">{msg}</p> : null}
        </div>

        <div className="modal-footer calibration-footer">
          <button
            type="button"
            className="ghost-button"
            disabled={step === 0 || busy}
            onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
          >
            <ChevronLeft size={14} /> Trước
          </button>
          {step < 4 ? (
            <button
              type="button"
              className="small-button"
              disabled={!canNext || busy}
              onClick={() => setStep((s) => Math.min(4, s + 1) as Step)}
            >
              Tiếp <ChevronRight size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {showRoiEditor ? (
        <RoiEditor
          deviceId={device.id}
          deviceName={device.name}
          snapshotUrl={snapshotUrl || resolveMediaUrl(device.lastSnapshotUrl)}
          initialRoi={roi as any}
          onSaved={(next) => {
            setRoi(next);
            setShowRoiEditor(false);
            setMsg("Đã lưu ROI.");
          }}
          onClose={() => setShowRoiEditor(false)}
        />
      ) : null}
    </div>
  );
}
