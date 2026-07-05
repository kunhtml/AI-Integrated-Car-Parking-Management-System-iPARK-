"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCcw, Video, Wrench } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";

type MaintenanceLog = {
  id: string;
  deviceName: string;
  type: string;
  description: string;
  performedAt: string;
  cost: number;
  status: string;
};

export function DevicesView() {
  const { currentUser, deviceList, saveDevice, snapshotDevice, cameraEntry, cameraExit } = useParkingApp();
  const [activeTab, setActiveTab] = useState<"devices" | "maintenance">("devices");
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [roiTarget, setRoiTarget] = useState<any>(null);
  const [roiValues, setRoiValues] = useState({ x: 0, y: 0, width: 200, height: 120, label: "" });
  const [streamDeviceId, setStreamDeviceId] = useState<string | null>(null);
  const streamRef = useRef<HTMLImageElement | null>(null);

  const displayDevices = deviceList;
  const isAdmin = currentUser?.role === "admin";

  async function restartDevice(id: string) {
    setMsg("Đang khởi động lại...");
    const response = await apiFetch(`/devices/${id}/restart`, { method: "POST" });
    const data = await response.json();
    setMsg(data.message || (response.ok ? "Đã khởi động lại." : "Lỗi."));
  }

  async function loadMaintenanceLogs() {
    const response = await apiFetch("/devices/health");
    if (response.ok) {
      const data = await response.json();
      // Load all maintenance logs
      const allLogs: MaintenanceLog[] = [];
      for (const device of displayDevices) {
        const logRes = await apiFetch(`/devices/${device.id}/maintenance`);
        if (logRes.ok) {
          const logData = await logRes.json();
          allLogs.push(...logData.logs);
        }
      }
      setLogs(allLogs);
      setLogsLoaded(true);
    }
  }

  async function createMaintenanceLog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const deviceId = String(form.get("deviceId") || "");
    const body = {
      type: String(form.get("type") || "scheduled"),
      description: String(form.get("description") || ""),
      cost: Number(form.get("cost") || 0),
      status: String(form.get("status") || "completed"),
    };
    const response = await apiFetch(`/devices/${deviceId}/maintenance`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (response.ok) {
      setLogs((prev) => [data.log, ...prev]);
      setMsg("Đã lưu nhật ký bảo trì.");
      event.currentTarget.reset();
    } else {
      setMsg(data.message || "Lỗi.");
    }
  }

  // Thống kê nhanh
  const totalCount = displayDevices.length;
  const onlineCount = displayDevices.filter(
    (d) => d.status === "online",
  ).length;
  const offlineCount = totalCount - onlineCount;

  const handleEditClick = (device: any) => {
    setEditingDevice({
      id: device.id,
      name: device.name,
      gate: device.gate,
      rtspUrl: device.rtspUrl || "",
      httpUrl: device.httpUrl || "",
      deviceType: device.deviceType || "rtsp",
      username: device.username || "",
      password: device.password || "",
      roiNote: device.roiNote || "Biển số trước",
    });
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await saveDevice(e);
    setEditingDevice(null);
  };

  async function connectDevice(id: string) {
    setMsg("Đang kết nối camera...");
    const response = await apiFetch(`/devices/${id}/connect`, { method: "POST" });
    const data = await response.json();
    setMsg(data.message || (response.ok ? "Đã kết nối camera." : "Không kết nối được camera."));
  }

  async function captureDeviceImage(id: string) {
    setMsg("Đang chụp ảnh camera...");
    const response = await apiFetch(`/devices/${id}/capture`, { method: "POST" });
    const data = await response.json();
    setMsg(data.message || (response.ok ? "Đã chụp ảnh camera." : "Không chụp được ảnh."));
  }

  function openRoiEditor(device: any) {
    setRoiTarget(device);
    setRoiValues({
      x: device.roi?.x ?? 0,
      y: device.roi?.y ?? 0,
      width: device.roi?.width ?? 200,
      height: device.roi?.height ?? 120,
      label: device.roi?.label || "",
    });
  }

  async function saveRoi(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roiTarget) {
      return;
    }
    const response = await apiFetch(`/devices/${roiTarget.id}/roi`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roiValues),
    });
    const data = await response.json();
    if (response.ok) {
      setMsg("Đã lưu cấu hình ROI.");
      setRoiTarget(null);
    } else {
      setMsg(data.message || "Không lưu được ROI.");
    }
  }

  function openStream(deviceId: string) {
    setStreamDeviceId(deviceId);
  }

  useEffect(() => {
    const element = streamRef.current;
    if (!element || !streamDeviceId) {
      return;
    }
    element.src = `/api/devices/${streamDeviceId}/stream`;
    return () => {
      element.src = "";
    };
  }, [streamDeviceId]);

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Camera & Thiết bị</p>
            <h2>Quản lý thiết bị</h2>
          </div>
          <Camera size={22} />
        </div>

        <div className="tab-bar">
          <button className={`tab-item${activeTab === "devices" ? " tab-active" : ""}`} onClick={() => setActiveTab("devices")} type="button">
            Thiết bị
          </button>
          <button className={`tab-item${activeTab === "maintenance" ? " tab-active" : ""}`} onClick={() => { setActiveTab("maintenance"); if (!logsLoaded) loadMaintenanceLogs(); }} type="button">
            Bảo trì
          </button>
        </div>

        {msg && <p className="muted-cell" style={{ marginBottom: 12 }}>{msg}</p>}

        {/* Devices Tab */}
        {activeTab === "devices" && (
          <>
            {isAdmin && (
              <form className="stack-form" onSubmit={saveDevice} style={{ marginBottom: 20 }}>
                <div className="panel-heading"><div><p>Kết nối</p><h2>Thêm camera thật</h2></div><Camera size={20} /></div>
                <div className="filter-row">
                  <input name="name" placeholder="Tên camera" required style={{ flex: 1 }} />
                  <select name="gate">
                    <option value="entry">Cổng vào</option>
                    <option value="exit">Cổng ra</option>
                  </select>
                  <select name="deviceType" style={{ width: 120 }}>
                    <option value="rtsp">RTSP</option>
                    <option value="http">HTTP</option>
                    <option value="onvif">ONVIF</option>
                    <option value="usb">USB</option>
                  </select>
                  <input name="rtspUrl" placeholder="rtsp://..." style={{ flex: 2 }} />
                  <input name="httpUrl" placeholder="http://..." style={{ flex: 2 }} />
                  <input name="username" placeholder="Username" style={{ width: 100 }} />
                  <input name="password" placeholder="Password" style={{ width: 100 }} type="password" />
                  <button className="small-button" type="submit"><Wrench size={14} /> Lưu</button>
                </div>
              </form>
            )}

            <DataTable
              headers={["Thiết bị", "Loại", "Cổng", "Trạng thái", "Stream", "ROI", "Thao tác"]}
              rows={displayDevices.map((item) => [
                item.name,
                (item.deviceType || "rtsp").toUpperCase(),
                item.gate === "entry" ? "Vào" : "Ra",
                <span className={item.status === "online" ? "badge success" : item.status === "offline" ? "badge warning" : "badge"} key={`${item.id}-st`}>
                  {item.status}
                </span>,
                <button className="small-button" key={`${item.id}-stream`} onClick={() => openStream(item.id)} type="button">
                  <Video size={13} /> Xem
                </button>,
                <button className="small-button" key={`${item.id}-roi`} onClick={() => openRoiEditor(item)} type="button">
                  {item.roi ? `${item.roi.width}x${item.roi.height}` : "Chưa có"}
                </button>,
                <div className="inline-actions" key={item.id}>
                  {deviceList.length > 0 && (
                    <>
                      <button className="small-button" onClick={() => connectDevice(item.id)} title="Kết nối" type="button">
                        <Camera size={13} />
                      </button>
                      <button className="small-button" onClick={() => captureDeviceImage(item.id)} title="Chụp ảnh" type="button">
                        <Camera size={13} />
                      </button>
                      <button className="small-button" onClick={() => snapshotDevice(item.id)} title="Snapshot cũ" type="button">
                        <RefreshCcw size={13} />
                      </button>
                      {isAdmin && (
                        <button className="small-button" onClick={() => restartDevice(item.id)} title="Restart" type="button">
                          <RefreshCcw size={13} />
                        </button>
                      )}
                      {item.gate === "entry" && (
                        <button className="small-button" onClick={() => cameraEntry(item.id)} type="button">Xe vào</button>
                      )}
                      {item.gate === "exit" && (
                        <button className="small-button" onClick={() => cameraExit(item.id)} type="button">Xe ra</button>
                      )}
                    </>
                  )}
                </div>,
              ])}
            />

            {streamDeviceId && (
              <div className="panel" style={{ marginTop: 16 }}>
                <div className="panel-heading">
                  <div>
                    <p>Phát trực tiếp</p>
                    <h2>Camera Stream</h2>
                  </div>
                  <button className="small-button" type="button" onClick={() => setStreamDeviceId(null)}>Đóng</button>
                </div>
                <p className="muted-cell">Nếu stream không hiển thị, hãy kiểm tra lại URL RTSP/HTTP, username/password và đảm bảo server đã cài ffmpeg.</p>
                <div style={{ background: "#000", borderRadius: 10, overflow: "hidden" }}>
                  <img ref={streamRef} alt="Camera stream" style={{ width: "100%", display: "block" }} />
                </div>
              </div>
            )}

            {roiTarget && (
              <form className="stack-form" onSubmit={saveRoi} style={{ marginTop: 16 }}>
                <div className="panel-heading"><div><p>Cấu hình</p><h2>ROI cho {roiTarget.name}</h2></div><Camera size={20} /></div>
                <div className="filter-row">
                  <label className="muted-cell" style={{ minWidth: 40 }}>X<input type="number" name="x" value={roiValues.x} onChange={(e) => setRoiValues((s) => ({ ...s, x: Number(e.target.value) }))} required style={{ width: 80, marginLeft: 8 }} /></label>
                  <label className="muted-cell" style={{ minWidth: 40 }}>Y<input type="number" name="y" value={roiValues.y} onChange={(e) => setRoiValues((s) => ({ ...s, y: Number(e.target.value) }))} required style={{ width: 80, marginLeft: 8 }} /></label>
                  <label className="muted-cell" style={{ minWidth: 60 }}>Width<input type="number" name="width" value={roiValues.width} onChange={(e) => setRoiValues((s) => ({ ...s, width: Number(e.target.value) }))} required style={{ width: 100, marginLeft: 8 }} /></label>
                  <label className="muted-cell" style={{ minWidth: 70 }}>Height<input type="number" name="height" value={roiValues.height} onChange={(e) => setRoiValues((s) => ({ ...s, height: Number(e.target.value) }))} required style={{ width: 100, marginLeft: 8 }} /></label>
                  <input name="label" placeholder="Ghi chú ROI" value={roiValues.label} onChange={(e) => setRoiValues((s) => ({ ...s, label: e.target.value }))} style={{ flex: 1 }} />
                  <button className="small-button" type="submit"><Wrench size={14} /> Lưu ROI</button>
                  <button className="small-button" type="button" onClick={() => setRoiTarget(null)}>Hủy</button>
                </div>
              </form>
            )}
          </>
        )}

        {/* Maintenance Tab */}
        {activeTab === "maintenance" && (
          <>
            {isAdmin && (
              <form className="stack-form" onSubmit={createMaintenanceLog} style={{ marginBottom: 20 }}>
                <div className="panel-heading"><div><p>Thêm</p><h2>Ghi nhật ký bảo trì</h2></div><Wrench size={20} /></div>
                <div className="filter-row">
                  <select name="deviceId" required>
                    <option value="">Chọn thiết bị</option>
                    {displayDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select name="type">
                    <option value="scheduled">Định kỳ</option>
                    <option value="repair">Sửa chữa</option>
                    <option value="inspection">Kiểm tra</option>
                    <option value="replacement">Thay thế</option>
                  </select>
                  <input name="description" placeholder="Mô tả công việc..." required style={{ flex: 2 }} />
                  <input name="cost" placeholder="Chi phí" style={{ width: 100 }} type="number" />
                  <select name="status">
                    <option value="completed">Hoàn thành</option>
                    <option value="planned">Lên kế hoạch</option>
                    <option value="in_progress">Đang thực hiện</option>
                  </select>
                  <button className="small-button" type="submit"><Wrench size={14} /> Lưu</button>
                </div>
              </form>
            )}

            <DataTable
              headers={["Thiết bị", "Loại", "Mô tả", "Chi phí", "Ngày", "Trạng thái"]}
              rows={logs.map((log) => [
                log.deviceName,
                log.type === "scheduled" ? "Định kỳ" : log.type === "repair" ? "Sửa chữa" : log.type === "inspection" ? "Kiểm tra" : "Thay thế",
                log.description,
                `${log.cost.toLocaleString("vi-VN")} đ`,
                new Date(log.performedAt).toLocaleDateString("vi-VN"),
                <span className={log.status === "completed" ? "badge success" : "badge warning"} key={log.id}>
                  {log.status === "completed" ? "Xong" : log.status === "planned" ? "Kế hoạch" : "Đang làm"}
                </span>,
              ])}
            />
            {logs.length === 0 && logsLoaded && <p className="muted-cell">Chưa có nhật ký bảo trì.</p>}
          </>
        )}
      </div>
    </section>
  );
}
