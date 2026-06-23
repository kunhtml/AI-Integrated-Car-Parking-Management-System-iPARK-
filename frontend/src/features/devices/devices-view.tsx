"use client";

import { useState } from "react";
import { Camera, ClipboardList, Power, RefreshCcw, Wrench } from "lucide-react";

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
                <div className="filter-row">
                  <input name="name" placeholder="Tên camera" required style={{ flex: 1 }} />
                  <select name="gate">
                    <option value="entry">Cổng vào</option>
                    <option value="exit">Cổng ra</option>
                  </select>
                  <input name="rtspUrl" placeholder="rtsp://..." required style={{ flex: 2 }} />
                  <input name="username" placeholder="Username" style={{ width: 100 }} />
                  <input name="password" placeholder="Password" style={{ width: 100 }} type="password" />
                  <button className="small-button" type="submit"><Wrench size={14} /> Lưu</button>
                </div>
              </form>
            )}

            <DataTable
              headers={["Thiết bị", "Cổng", "Trạng thái", "Ảnh", "ROI", "Thao tác"]}
              rows={displayDevices.map((item) => [
                item.name,
                item.gate === "entry" ? "Vào" : "Ra",
                <span className={item.status === "online" ? "badge success" : item.status === "offline" ? "badge warning" : "badge"} key={`${item.id}-st`}>
                  {item.status}
                </span>,
                item.lastSnapshotUrl ? (
                  <a href={item.lastSnapshotUrl} key={`${item.id}-shot`} rel="noreferrer" target="_blank">Xem</a>
                ) : "—",
                item.roiNote || "—",
                <div className="inline-actions" key={item.id}>
                  {deviceList.length > 0 && (
                    <>
                      <button className="small-button" onClick={() => snapshotDevice(item.id)} title="Snapshot" type="button">
                        <Camera size={13} />
                      </button>
                      {isAdmin && (
                        <button className="small-button" onClick={() => restartDevice(item.id)} title="Restart" type="button">
                          <Power size={13} />
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
          </>
        )}

        {/* Maintenance Tab */}
        {activeTab === "maintenance" && (
          <>
            {isAdmin && (
              <form className="stack-form" onSubmit={createMaintenanceLog} style={{ marginBottom: 20 }}>
                <div className="panel-heading"><div><p>Thêm</p><h2>Ghi nhật ký bảo trì</h2></div><ClipboardList size={20} /></div>
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
