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
  Nfc,
  Signal,
  Video,
  X,
} from "lucide-react";

import { apiFetch, bridgeBaseUrl, bridgeFetch } from "@/lib/client-api";
import { useParkingApp } from "@/context/parking-app-context";
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

function gateLabel(gate: DeviceItem["gate"]) {
  return gate === "entry" ? "Cổng vào" : "Cổng ra";
}

function formatDate(value?: string) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa có" : date.toLocaleString("vi-VN");
}

function CameraLaneTest({ device, onClose }: { device: DeviceItem; onClose: () => void }) {
  const lane = device.lane || (device.gate === "entry" ? "in" : "out");
  const streamUrl = `${bridgeBaseUrl}/video_feed/${lane}`;
  const [rfidStatus, setRfidStatus] = useState("Chưa bắt đầu quét RFID.");
  const [plateStatus, setPlateStatus] = useState("Đưa xe vào khung hình để kiểm tra OCR.");
  const [plateCropUrl, setPlateCropUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [gateStatus, setGateStatus] = useState("");
  const [startedAt] = useState(() => Date.now());

  async function testRfid() {
    setTesting(true);
    setRfidStatus("Đang chờ quét thẻ tại đầu đọc của lane này...");
    try {
      const start = await bridgeFetch("/api/rfid/scan/start", { method: "POST", body: JSON.stringify({ direction: lane, mode: "inventory" }) });
      if (!start.ok) throw new Error("Không bật được đầu đọc RFID.");
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        const response = await bridgeFetch(`/api/rfid/scan/poll?direction=${lane}`);
        const data = await response.json().catch(() => ({}));
        if (data.status === "success" && data.uid) { setRfidStatus(`Đọc thành công UID: ${data.uid}`); return; }
        if (["error", "timeout"].includes(data.status)) throw new Error(data.message || "Không đọc được thẻ RFID.");
      }
      setRfidStatus("Hết thời gian chờ RFID. Kiểm tra đầu đọc và thẻ.");
    } catch (error) {
      setRfidStatus(error instanceof Error ? error.message : "Lỗi kiểm tra RFID.");
    } finally {
      setTesting(false);
      void bridgeFetch("/api/rfid/scan/cancel", { method: "POST", body: JSON.stringify({ direction: lane }) });
    }
  }

  async function testGate() {
    if (!window.confirm(`Mở barie lane ${lane.toUpperCase()} để kiểm tra?`)) return;
    setGateStatus("Đang gửi lệnh mở barie...");
    try {
      const response = await bridgeFetch(`/gate/${lane}/open`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Không mở được barie.");
      setGateStatus(`Đã gửi lệnh mở barie lane ${lane.toUpperCase()}.`);
    } catch (error) {
      setGateStatus(error instanceof Error ? error.message : "Lỗi kiểm tra barie.");
    }
  }

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const response = await apiFetch("/camera-logs/logs?limit=10");
      const data = await response.json().catch(() => ({}));
      const direction = device.gate === "entry" ? "in" : "out";
      const log = Array.isArray(data.logs) ? data.logs.find((item: { direction?: string; detectedPlate?: string; imagePath?: string; createdAt?: string }) => item.direction === direction && item.detectedPlate && item.createdAt && new Date(item.createdAt).getTime() >= startedAt) : null;
      if (log?.detectedPlate) {
        setPlateStatus(`Nhận diện gần nhất: ${log.detectedPlate}`);
        const imagePath = typeof log.imagePath === "string" ? log.imagePath : "";
        setPlateCropUrl(imagePath ? (imagePath.startsWith("http") ? imagePath : `${bridgeBaseUrl}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`) : "");
      }
    }, 1500);
    return () => window.clearInterval(interval);
  }, [device.gate, startedAt]);

  return <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`Test ${device.name}`}>
    <div className="modal devices-test-modal">
      <div className="modal-header"><div><p className="muted-text">Kiểm tra lane {lane.toUpperCase()}</p><h3>Test {device.name}</h3></div><button type="button" className="ghost-button" onClick={onClose} aria-label="Đóng"><X size={16} /></button></div>
      <div className="device-test-stream"><img src={streamUrl} alt={`Camera ${device.name}`} /></div>
      <div className="device-test-results"><p><strong>Camera / OCR:</strong> {plateStatus}</p><p><strong>RFID:</strong> {rfidStatus}</p></div>
      <div className="device-test-crop"><strong>Ảnh crop biển số</strong>{plateCropUrl ? <img src={plateCropUrl} alt="Ảnh crop biển số nhận diện" /> : <span>Chưa nhận được ảnh crop từ lần OCR gần nhất.</span>}</div>
      <div className="device-test-actions"><button type="button" className="small-button primary" disabled={testing} onClick={() => void testRfid()}><Nfc size={14} /> {testing ? "Đang quét RFID..." : "Test đầu đọc RFID"}</button><button type="button" className="small-button" onClick={() => void testGate()}>Test mở barie</button></div>
      {gateStatus ? <p className="device-test-gate-status">{gateStatus}</p> : null}
    </div>
  </div>;
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
  const { currentUser } = useParkingApp();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [gateFilter, setGateFilter] = useState<GateFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DeviceForm>(EMPTY_FORM);
  const [editingDevice, setEditingDevice] = useState<DeviceItem | null>(null);
  const [testDevice, setTestDevice] = useState<DeviceItem | null>(null);
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách thiết bị.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function swapCameraRoles() {
    if (actionId) return;
    if (!window.confirm("Hoán đổi vai trò hai camera? Sự kiện nhận diện mới sẽ dùng vai trò mới.")) return;
    setActionId("swap-roles");
    setError("");
    try {
      const response = await apiFetch("/devices/swap-roles", { method: "POST" });
      const message = await responseMessage(response, "Không thể hoán đổi vai trò camera.");
      if (!response.ok) {
        setError(message);
        return;
      }
      setNotice(message);
      await loadDevices(true);
    } finally {
      setActionId(null);
    }
  }

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

  async function deleteDevice(device: DeviceItem) {
    if (!window.confirm(`Xóa camera "${device.name}"? Thao tác này không thể hoàn tác.`)) return;
    setActionId(`delete:${device.id}`);
    setError("");
    try {
      const response = await apiFetch(`/devices/${device.id}`, { method: "DELETE" });
      const message = await responseMessage(response, "Không thể xóa thiết bị.");
      if (!response.ok) throw new Error(message);
      setNotice(message);
      await loadDevices(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa thiết bị.");
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
      const response = await apiFetch(editingDevice ? `/devices/${editingDevice.id}` : "/devices", {
        method: editingDevice ? "PATCH" : "POST",
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
      const message = await responseMessage(response, editingDevice ? "Không cập nhật được thiết bị." : "Không tạo được thiết bị.");
      if (!response.ok) throw new Error(message);
      setNotice(editingDevice ? "Đã cập nhật thiết bị camera." : "Đã thêm thiết bị camera.");
      setForm(EMPTY_FORM);
      setEditingDevice(null);
      setFormOpen(false);
      await loadDevices(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được thiết bị.");
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
              <Signal size={13} /> Luồng camera từ bridge
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
          <button type="button" className="small-button primary" onClick={() => { setEditingDevice(null); setForm(EMPTY_FORM); setFormOpen((open) => !open); }}>
            {formOpen ? <X size={14} /> : <Plus size={14} />} {formOpen ? "Đóng form" : "Thêm thiết bị"}
          </button>
          {currentUser?.role === "admin" && devices.length === 2 ? (
            <button
              type="button"
              className="small-button"
              onClick={() => void swapCameraRoles()}
              disabled={Boolean(actionId)}
              title="Hoán đổi vai trò Cổng vào và Cổng ra"
            >
              {actionId === "swap-roles" ? <Loader2 size={14} className="spin" /> : <RotateCw size={14} />} Hoán đổi vai trò
            </button>
          ) : null}
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
                <strong>{editingDevice ? `Chỉnh sửa ${editingDevice.name}` : "Thông tin kết nối"}</strong>
              </div>
              <button type="button" className="ghost-button" onClick={() => { setFormOpen(false); setEditingDevice(null); }} aria-label="Đóng form">
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
                {saving ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} {editingDevice ? "Lưu thay đổi" : "Tạo thiết bị"}
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
              const direction = device.lane || (device.gate === "entry" ? "in" : "out");
              const bridgeStreamUrl = `${bridgeBaseUrl}/video_feed/${direction}`;
              return (
                <article key={device.id} className="device-card">
                  <div className="device-card-heading">
                    <div className="device-card-title"><Camera size={17} /><div><strong>{device.name}</strong><span>{gateLabel(device.gate)}</span></div></div>
                    <span className="badge success"><Activity size={12} /> Live từ bridge</span>
                  </div>
                  <div className="device-bridge-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bridgeStreamUrl} alt={`Luồng ${gateLabel(device.gate)}`} />
                  </div>
                  <div className="device-card-meta">
                    <span>Luồng đang dùng: <strong>{bridgeStreamUrl}</strong></span>
                    <span>Vai trò hiện tại: <strong>{gateLabel(device.gate)}</strong></span>
                  </div>
                  <div className="device-card-actions">
                    <button type="button" className="small-button primary" onClick={() => setTestDevice(device)}><Video size={14} /> Test</button>
                    <button type="button" className="small-button" onClick={() => { setEditingDevice(device); setForm({ name: device.name, gate: device.gate, rtspUrl: device.rtspUrl || "rtsp://", username: device.username || "", password: "", roiNote: device.roiNote || "" }); setFormOpen(true); }}>Chỉnh sửa</button>
                    <button type="button" className="small-button" disabled={isActionBusy} onClick={() => void deleteDevice(device)} style={{ color: "#dc2626" }}>Xóa</button>
                    <button type="button" className="small-button" disabled={isActionBusy} onClick={() => void runDeviceAction(device, "restart")}>
                      {actionId === `restart:${device.id}` ? <Loader2 size={14} className="spin" /> : <RotateCw size={14} />} Restart
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {testDevice ? <CameraLaneTest device={testDevice} onClose={() => setTestDevice(null)} /> : null}

    </section>
  );
}
