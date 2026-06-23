"use client";

import { useState } from "react";
import {
  Camera,
  RefreshCcw,
  Wrench,
  Trash2,
  Edit2,
  Play,
  Video,
  CircleAlert,
  Cpu,
  CheckCircle2,
} from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import { fallbackDevices } from "@/lib/mock-data";

function statusBadge(status: string) {
  if (status === "online") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
      offline
    </span>
  );
}

export function DevicesView() {
  const {
    deviceList,
    saveDevice,
    snapshotDevice,
    deleteDevice,
    cameraEntry,
    cameraExit,
  } = useParkingApp();
  const [activeTab, setActiveTab] = useState<"devices" | "maintenance">(
    "devices",
  );
  const [editingDevice, setEditingDevice] = useState<{
    id: string;
    name: string;
    gate: "entry" | "exit";
    rtspUrl: string;
    username?: string;
    password?: string;
    roiNote?: string;
  } | null>(null);

  const displayDevices = deviceList.length ? deviceList : fallbackDevices();

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

  return (
    <div className="space-y-6">
      {/* 1. Dashboard KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
            <Cpu size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">
              Tổng số thiết bị
            </p>
            <h3 className="text-2xl font-bold text-slate-900">{totalCount}</h3>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Đang hoạt động</p>
            <h3 className="text-2xl font-bold text-slate-900">{onlineCount}</h3>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="rounded-lg bg-slate-100 p-3 text-slate-600">
            <CircleAlert size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">
              Ngoại tuyến (Offline)
            </p>
            <h3 className="text-2xl font-bold text-slate-900">
              {offlineCount}
            </h3>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-500">
              Camera &amp; AI Engine
            </p>
            <h2 className="text-2xl font-bold text-slate-950">
              Quản lý hệ thống thiết bị
            </h2>
          </div>
          <Video className="text-slate-400 mt-1" size={26} />
        </div>

        {/* Tabs switcher */}
        <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            className={`min-h-0 rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "devices"
                ? "bg-blue-500 text-white shadow-sm"
                : "bg-transparent text-slate-500 hover:text-slate-900"
            }`}
            type="button"
            onClick={() => setActiveTab("devices")}
          >
            Thiết bị & Stream
          </button>
          <button
            className={`min-h-0 rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "maintenance"
                ? "bg-blue-500 text-white shadow-sm"
                : "bg-transparent text-slate-500 hover:text-slate-900"
            }`}
            type="button"
            onClick={() => setActiveTab("maintenance")}
          >
            Nhật ký Bảo trì
          </button>
        </div>

        {activeTab === "devices" ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Form Cấu hình (Bên trái/phải tùy màn hình, chiếm 1 cột trên 3) */}
            <div className="lg:col-span-1 rounded-xl border border-slate-100 bg-slate-50/50 p-5">
              <h3 className="mb-4 text-sm font-bold text-slate-800 uppercase tracking-wider">
                {editingDevice ? "Cập nhật thiết bị" : "Thêm thiết bị mới"}
              </h3>
              <form className="space-y-4" onSubmit={handleFormSubmit}>
                {editingDevice && (
                  <input type="hidden" name="id" value={editingDevice.id} />
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Tên Camera
                  </label>
                  <input
                    aria-label="Tên camera"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                    name="name"
                    placeholder="Ví dụ: Camera Cổng A - Làn vào"
                    required
                    defaultValue={editingDevice?.name || ""}
                    key={
                      editingDevice ? `name-${editingDevice.id}` : "name-new"
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Cổng Chỉ định
                  </label>
                  <select
                    aria-label="Cổng"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none"
                    name="gate"
                    defaultValue={editingDevice?.gate || "entry"}
                    key={
                      editingDevice ? `gate-${editingDevice.id}` : "gate-new"
                    }
                  >
                    <option value="entry">
                      Cổng vào (Nhận diện biển trước)
                    </option>
                    <option value="exit">Cổng ra (Nhận diện biển sau)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    RTSP Stream URL
                  </label>
                  <input
                    aria-label="RTSP URL"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                    name="rtspUrl"
                    placeholder="rtsp://admin:password@ip:port/stream"
                    required
                    defaultValue={editingDevice?.rtspUrl || ""}
                    key={
                      editingDevice ? `rtsp-${editingDevice.id}` : "rtsp-new"
                    }
                  />
                </div>

                <div className="grid gap-3 grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Username
                    </label>
                    <input
                      aria-label="Username"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                      name="username"
                      placeholder="Username"
                      defaultValue={editingDevice?.username || ""}
                      key={
                        editingDevice ? `user-${editingDevice.id}` : "user-new"
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Password
                    </label>
                    <input
                      aria-label="Password"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                      name="password"
                      placeholder="••••••••"
                      type="password"
                      defaultValue={editingDevice?.password || ""}
                      key={
                        editingDevice ? `pass-${editingDevice.id}` : "pass-new"
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Vùng Nhận diện (ROI)
                  </label>
                  <input
                    aria-label="ROI Note"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                    name="roiNote"
                    placeholder="Biển số trước / sau, góc nghiêng..."
                    defaultValue={editingDevice?.roiNote || "Biển số trước"}
                    key={editingDevice ? `roi-${editingDevice.id}` : "roi-new"}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                    type="submit"
                  >
                    <Wrench size={15} />
                    {editingDevice ? "Cập nhật" : "Lưu thiết bị"}
                  </button>
                  {editingDevice && (
                    <button
                      className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      type="button"
                      onClick={() => setEditingDevice(null)}
                    >
                      Hủy
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Danh sách camera dạng Card trực quan (Chiếm 2 cột trên 3) */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Trực quan luồng live streams
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                {displayDevices.map((item) => (
                  <div
                    key={item.id}
                    className="group overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md"
                  >
                    {/* Live Stream Viewfinder Placeholder */}
                    <div className="relative aspect-video bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-4">
                      {item.status === "online" && item.lastSnapshotUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.lastSnapshotUrl}
                          alt={item.name}
                          className="absolute inset-0 h-full w-full object-cover opacity-80"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950 flex flex-col items-center justify-center">
                          <Video
                            size={40}
                            className="text-slate-700 mb-2 group-hover:scale-110 transition"
                          />
                          <span className="text-xs font-mono text-slate-500">
                            RTSP Stream Offline
                          </span>
                        </div>
                      )}

                      {/* Top Overlay Badge */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                        <span className="rounded bg-black/60 px-2 py-0.5 text-xs font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                          {item.gate === "entry" ? "Cổng Vào" : "Cổng Ra"}
                        </span>
                        <div className="pointer-events-auto">
                          {statusBadge(item.status)}
                        </div>
                      </div>

                      {/* Bottom Overlay Name */}
                      <div className="absolute bottom-3 left-3 bg-black/60 px-2.5 py-1 rounded text-sm font-semibold text-white backdrop-blur-sm">
                        {item.name}
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-4 space-y-3">
                      <div className="text-xs text-slate-500 space-y-1">
                        <p className="truncate font-mono">
                          <strong className="text-slate-700">RTSP:</strong>{" "}
                          {item.rtspUrl || "rtsp://localhost:8554/live"}
                        </p>
                        <p>
                          <strong className="text-slate-700">
                            Vùng nhận diện:
                          </strong>{" "}
                          {item.roiNote || "Biển số trước"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-50 pt-3 gap-2">
                        {/* Nhóm chỉnh sửa */}
                        <div className="flex gap-1.5">
                          <button
                            aria-label={`Sửa ${item.name}`}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            onClick={() => handleEditClick(item)}
                            title="Sửa cấu hình"
                            type="button"
                          >
                            <Edit2 size={13} />
                          </button>
                          {deviceList.length > 0 && (
                            <button
                              aria-label={`Xóa ${item.name}`}
                              className="h-8 w-8 flex items-center justify-center rounded-lg border border-red-100 bg-white text-red-500 hover:bg-red-50"
                              onClick={() => deleteDevice(item.id)}
                              title="Xóa camera"
                              type="button"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        {/* Nhóm hành động camera */}
                        <div className="flex items-center gap-1.5">
                          <button
                            aria-label={`Chụp ảnh ${item.name}`}
                            className="h-8 px-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            disabled={!deviceList.length}
                            onClick={() => snapshotDevice(item.id)}
                            title="Chụp ảnh mới"
                            type="button"
                          >
                            <Camera size={13} />
                            Ping
                          </button>

                          {item.gate === "entry" ? (
                            <button
                              className="h-8 px-2.5 flex items-center gap-1 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800"
                              disabled={!deviceList.length}
                              onClick={() => cameraEntry(item.id)}
                              type="button"
                            >
                              <Play size={10} />
                              Xe vào
                            </button>
                          ) : (
                            <button
                              className="h-8 px-2.5 flex items-center gap-1 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800"
                              disabled={!deviceList.length}
                              onClick={() => cameraExit(item.id)}
                              type="button"
                            >
                              <Play size={10} />
                              Xe ra
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Tab Bảo trì - Hiển thị trạng thái kết nối & nhật ký hệ thống */
          <div className="rounded-xl border border-slate-100 bg-white p-5 space-y-4">
            <h3 className="text-md font-bold text-slate-800">
              Nhật ký trạng thái đường truyền & AI Model
            </h3>
            <div className="divide-y divide-slate-100 text-sm">
              <div className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-800">
                    Camera Cổng Vào - Làn vào
                  </p>
                  <p className="text-xs text-slate-500">
                    RTSP: rtsp://192.168.1.100:554/stream1
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">
                    Đã cập nhật: Vừa xong
                  </span>
                  <p className="text-emerald-600 font-medium">
                    Băng thông: ~1.2 Mbps (Đạt chuẩn)
                  </p>
                </div>
              </div>
              <div className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-800">
                    Camera Cổng Ra - Làn ra
                  </p>
                  <p className="text-xs text-slate-500">
                    RTSP: rtsp://192.168.1.101:554/stream1
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">
                    Đã cập nhật: 10 phút trước
                  </span>
                  <p className="text-slate-500 font-medium">
                    Đang ngắt kết nối (Chưa cấu hình)
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Ghi chú vận hành hệ thống
              </h4>
              <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                <li>
                  Băng thông tối thiểu được khuyến nghị cho mỗi luồng camera là
                  1.0 Mbps để đảm bảo độ trễ AI dưới 200ms.
                </li>
                <li>
                  Hệ thống tự động kích hoạt tính năng phát hiện chuyển động khi
                  có xe tiến gần cảm biến vòng từ.
                </li>
                <li>
                  Nếu camera báo offline liên tục, hãy kiểm tra lại cấu hình tài
                  khoản RTSP (username/password) hoặc cổng mạng 554.
                </li>
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
