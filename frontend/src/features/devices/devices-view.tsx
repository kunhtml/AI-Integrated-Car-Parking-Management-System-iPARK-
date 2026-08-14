"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  Camera,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Loader2,
  Plus,
  RefreshCcw,
  RotateCw,
  Settings2,
  Signal,
  Video,
  WifiOff,
  X,
} from "lucide-react";

import { CalibrationWizard } from "@/features/devices/calibration-wizard";
import { CameraStreamViewer } from "@/features/devices/camera-stream-viewer";
import { apiFetch } from "@/lib/client-api";
import type { DeviceItem } from "@/types";

type GateFilter = "all" | "entry" | "exit";
type StatusFilter = "all" | DeviceItem["status"];

type DeviceForm = {
  name: string;
  gate: "entry" | "exit";
  rtspUrl: string;
  username: string;
  password: string;
  roiNote: string;
};

const EMPTY_FORM: DeviceForm = {
  name: "",
  gate: "entry",
  rtspUrl: "rtsp://",
  username: "",
  password: "",
  roiNote: "",
};

function statusLabel(status: DeviceItem["status"]) {
  if (status === "online") return "Đang online";
  if (status === "offline") return "Offline";
  return "Chưa xác định";
}

function statusClass(status: DeviceItem["status"]) {
  if (status === "online") return "success";
  if (status === "offline") return "warning";
  return "muted";
}

function gateLabel(gate: DeviceItem["gate"]) {
  return gate === "entry" ? "Cổng vào" : "Cổng ra";
}

function formatDate(value?: string) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa có" : date.toLocaleString("vi-VN");
}

async function responseMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return typeof data.message === "string" ? data.message : fallback;
  } catch {
    return fallback;
  }
}

export function DevicesView() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [gateFilter, setGateFilter] = useState<GateFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [wizardDevice, setWizardDevice] = useState<DeviceItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DeviceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadDevices = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/devices");
      if (!response.ok) {
        throw new Error(await responseMessage(response, "Không tải được danh sách thiết bị."));
      }
      const data = await response.json();
      const nextDevices = Array.isArray(data.devices) ? (data.devices as DeviceItem[]) : [];
      setDevices(nextDevices);
      setSelectedDevice((current) =>
        current ? nextDevices.find((item) => item.id === current.id) ?? null : null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách thiết bị.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const filteredDevices = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return devices.filter((device) => {
      const matchesGate = gateFilter === "all" || device.gate === gateFilter;
      const matchesStatus = statusFilter === "all" || device.status === statusFilter;
      const matchesSearch =
        !keyword ||
        device.name.toLowerCase().includes(keyword) ||
        device.rtspUrl.toLowerCase().includes(keyword);
      return matchesGate && matchesStatus && matchesSearch;
    });
  }, [devices, gateFilter, search, statusFilter]);

  const onlineCount = devices.filter((device) => device.status === "online").length;
  const offlineCount = devices.filter((device) => device.status === "offline").length;

  async function runDeviceAction(
    device: DeviceItem,
    action: "snapshot" | "restart",
  ) {
    setActionId(`${action}:${device.id}`);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`/devices/${device.id}/${action}`, { method: "POST" });
      const message = await responseMessage(
        response,
        action === "restart" ? "Không khởi động lại được thiết bị." : "Không chụp được snapshot.",
      );
      if (!response.ok) throw new Error(message);
      setNotice(message);
      await loadDevices(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Thao tác với thiết bị thất bại.");
    } finally {
      setActionId(null);
    }
  }

  async function createDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          gate: form.gate,
          rtspUrl: form.rtspUrl.trim(),
          username: form.username.trim() || undefined,
          password: form.password || undefined,
          roiNote: form.roiNote.trim() || undefined,
        }),
      });
      const message = await responseMessage(response, "Không tạo được thiết bị.");
      if (!response.ok) throw new Error(message);
      setNotice("Đã thêm thiết bị camera.");
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await loadDevices(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được thiết bị.");
    } finally {
      setSaving(false);
    }
  }

  function updateForm<K extends keyof DeviceForm>(key: K, value: DeviceForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="content-single animate-fade-in">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Quản trị hạ tầng camera</p>
            <h2>Thiết bị & hiệu chỉnh ANPR</h2>
          </div>
          <div className="panel-heading-right">
            <span className="badge success">
              <Signal size={13} /> {onlineCount} online
            </span>
            <span className={`badge ${offlineCount > 0 ? "warning" : "muted"}`}>
              {offlineCount > 0 ? <WifiOff size={13} /> : <CheckCircle2 size={13} />} {offlineCount} offline
            </span>
            <button
              type="button"
              className="small-button"
              onClick={() => void loadDevices(true)}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 size={14} className="spin" /> : <RefreshCcw size={14} />} Làm mới
            </button>
          </div>
        </div>

        <div className="devices-toolbar">
          <input
            className="text-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên hoặc RTSP URL"
            aria-label="Tìm thiết bị"
          />
          <label className="select-field">
            <span>Cổng</span>
            <select value={gateFilter} onChange={(event) => setGateFilter(event.target.value as GateFilter)}>
              <option value="all">Tất cả</option>
              <option value="entry">Cổng vào</option>
              <option value="exit">Cổng ra</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="select-field">
            <span>Trạng thái</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tất cả</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="unknown">Chưa xác định</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <button type="button" className="small-button primary" onClick={() => setFormOpen((open) => !open)}>
            {formOpen ? <X size={14} /> : <Plus size={14} />} {formOpen ? "Đóng form" : "Thêm thiết bị"}
          </button>
        </div>

        {error ? (
          <div className="toast-banner toast-error">
            <CircleAlert size={16} /> <span>{error}</span>
          </div>
        ) : null}
        {notice ? (
          <div className="toast-banner">
            <CheckCircle2 size={16} /> <span>{notice}</span>
          </div>
        ) : null}

        {formOpen ? (
          <form className="device-create-form" onSubmit={createDevice}>
            <div className="device-form-heading">
              <div>
                <p className="muted-text">Đăng ký camera mới</p>
                <strong>Thông tin kết nối</strong>
              </div>
              <button type="button" className="ghost-button" onClick={() => setFormOpen(false)} aria-label="Đóng form">
                <X size={16} />
              </button>
            </div>
            <div className="device-form-grid">
              <label>Tên thiết bị<input required minLength={2} value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Camera cổng vào" /></label>
              <label>Cổng<select value={form.gate} onChange={(event) => updateForm("gate", event.target.value as DeviceForm["gate"])}><option value="entry">Cổng vào</option><option value="exit">Cổng ra</option></select></label>
              <label className="device-form-wide">RTSP URL<input required minLength={4} value={form.rtspUrl} onChange={(event) => updateForm("rtspUrl", event.target.value)} placeholder="rtsp://192.168.1.10/stream" /></label>
              <label>Tài khoản<input value={form.username} onChange={(event) => updateForm("username", event.target.value)} /></label>
              <label>Mật khẩu<input type="password" value={form.password} onChange={(event) => updateForm("password", event.target.value)} /></label>
              <label className="device-form-wide">Ghi chú ROI<input value={form.roiNote} onChange={(event) => updateForm("roiNote", event.target.value)} placeholder="Ví dụ: ROI khu vực biển số" /></label>
            </div>
            <div className="device-form-actions">
              <button type="button" className="ghost-button" onClick={() => setForm(EMPTY_FORM)}>Xóa form</button>
              <button type="submit" className="small-button primary" disabled={saving}>
                {saving ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Tạo thiết bị
              </button>
            </div>
          </form>
        ) : null}

        {loading ? (
          <div className="devices-empty-state"><Loader2 size={22} className="spin" /><p>Đang tải danh sách thiết bị...</p></div>
        ) : filteredDevices.length === 0 ? (
          <div className="devices-empty-state"><Camera size={26} /><p>{devices.length === 0 ? "Chưa có thiết bị camera." : "Không có thiết bị phù hợp bộ lọc."}</p></div>
        ) : (
          <div className="devices-grid">
            {filteredDevices.map((device) => {
              const isActionBusy = actionId?.endsWith(`:${device.id}`) ?? false;
              return (
                <article key={device.id} className="device-card">
                  <div className="device-card-heading">
                    <div className="device-card-title"><Camera size={17} /><div><strong>{device.name}</strong><span>{gateLabel(device.gate)}</span></div></div>
                    <span className={`badge ${statusClass(device.status)}`}>{device.status === "online" ? <Activity size={12} /> : <WifiOff size={12} />} {statusLabel(device.status)}</span>
                  </div>
                  <div className="device-card-meta">
                    <span>RTSP: <strong title={device.rtspUrl}>{device.rtspUrl || "—"}</strong></span>
                    <span>Snapshot cuối: {formatDate(device.lastSnapshotUrl ? undefined : undefined)}</span>
                  </div>
                  <div className="device-card-actions">
                    <button type="button" className="small-button primary" onClick={() => setSelectedDevice(device)}><Video size={14} /> Xem live</button>
                    <button type="button" className="small-button" disabled={isActionBusy} onClick={() => void runDeviceAction(device, "snapshot")}>
                      {actionId === `snapshot:${device.id}` ? <Loader2 size={14} className="spin" /> : <Camera size={14} />} Snapshot
                    </button>
                    <button type="button" className="small-button" disabled={isActionBusy} onClick={() => void runDeviceAction(device, "restart")}>
                      {actionId === `restart:${device.id}` ? <Loader2 size={14} className="spin" /> : <RotateCw size={14} />} Restart
                    </button>
                    <button type="button" className="small-button" onClick={() => setWizardDevice(device)}><Settings2 size={14} /> Hiệu chỉnh</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selectedDevice ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`Live ${selectedDevice.name}`}>
          <div className="modal devices-live-modal">
            <div className="modal-header"><div><p className="muted-text">Giám sát realtime</p><h3>{selectedDevice.name}</h3></div><button type="button" className="ghost-button" onClick={() => setSelectedDevice(null)} aria-label="Đóng live"><X size={16} /></button></div>
            <CameraStreamViewer device={selectedDevice} showLiveLogs />
          </div>
        </div>
      ) : null}

      {wizardDevice ? (
        <CalibrationWizard
          device={wizardDevice}
          onClose={() => setWizardDevice(null)}
          onCompleted={() => {
            setWizardDevice(null);
            void loadDevices(true);
          }}
        />
      ) : null}
    </section>
  );
}
