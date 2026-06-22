"use client";

import { Camera, RefreshCcw, Wrench } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { fallbackDevices } from "@/lib/mock-data";

function statusLabel(status: string) {
  return status === "online" ? "online" : status === "offline" ? "offline" : "offline";
}

export function DevicesView() {
  const { deviceList, saveDevice, snapshotDevice, cameraEntry, cameraExit } = useParkingApp();

  const displayDevices = deviceList.length ? deviceList : fallbackDevices();

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-500">Camera &amp; Thiết bị</p>
          <h2 className="text-xl font-bold text-slate-950">Quản lý thiết bị</h2>
        </div>
        <Camera className="mt-4 text-slate-400" size={22} />
      </div>

      <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button className="min-h-0 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm" type="button">
          Thiết bị
        </button>
        <button className="min-h-0 rounded-md bg-transparent px-4 py-2 text-sm font-semibold text-slate-500" type="button">
          Bảo trì
        </button>
      </div>

      <form className="mb-9 grid gap-3" onSubmit={saveDevice}>
        <input
          aria-label="Tên camera"
          className="h-10 rounded-lg border-slate-200 text-sm placeholder:text-slate-400"
          name="name"
          placeholder="Tên camera"
          required
        />
        <select aria-label="Cổng" className="h-10 rounded-lg border-slate-200 text-sm" name="gate">
          <option value="entry">Cổng vào</option>
          <option value="exit">Cổng ra</option>
        </select>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_100px_100px_80px]">
          <input
            aria-label="RTSP URL"
            className="h-10 rounded-lg border-slate-200 text-sm placeholder:text-slate-400"
            name="rtspUrl"
            placeholder="rtsp://..."
            required
          />
          <input
            aria-label="Username"
            className="h-10 rounded-lg border-slate-200 text-sm placeholder:text-slate-400"
            name="username"
            placeholder="Username"
          />
          <input
            aria-label="Password"
            className="h-10 rounded-lg border-slate-200 text-sm placeholder:text-slate-400"
            name="password"
            placeholder="Password"
            type="password"
          />
          <button
            className="h-10 min-h-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 hover:bg-slate-50"
            type="submit"
          >
            <Wrench size={15} />
            Lưu
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-[860px]">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3 py-4 text-xs font-bold uppercase text-slate-500">Thiết bị</th>
              <th className="px-3 py-4 text-xs font-bold uppercase text-slate-500">Cổng</th>
              <th className="px-3 py-4 text-xs font-bold uppercase text-slate-500">Trạng thái</th>
              <th className="px-3 py-4 text-xs font-bold uppercase text-slate-500">Ảnh</th>
              <th className="px-3 py-4 text-xs font-bold uppercase text-slate-500">ROI</th>
              <th className="px-3 py-4 text-xs font-bold uppercase text-slate-500">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {displayDevices.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-3 text-sm text-slate-950">{item.name}</td>
                <td className="px-3 py-3 text-sm text-slate-950">{item.gate === "entry" ? "Vào" : "Ra"}</td>
                <td className="px-3 py-3 text-sm">
                  <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-500">
                    {statusLabel(item.status)}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm text-slate-600">
                  {item.lastSnapshotUrl ? (
                    <a className="font-semibold text-blue-600" href={item.lastSnapshotUrl} rel="noreferrer" target="_blank">
                      Xem ảnh
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-3 text-sm text-slate-950">{item.roiNote || "Biển số trước"}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      aria-label={`Chụp ảnh ${item.name}`}
                      className="h-9 min-h-0 w-10 rounded-lg border border-slate-200 bg-white p-0 text-slate-700 hover:bg-slate-50"
                      disabled={!deviceList.length}
                      onClick={() => snapshotDevice(item.id)}
                      title="Snapshot"
                      type="button"
                    >
                      <Camera size={15} />
                    </button>
                    <button
                      aria-label={`Bật tắt ${item.name}`}
                      className="h-9 min-h-0 w-10 rounded-lg border border-slate-200 bg-white p-0 text-slate-700 hover:bg-slate-50"
                      disabled={!deviceList.length}
                      title="Bật/tắt camera"
                      type="button"
                    >
                      <RefreshCcw size={15} />
                    </button>
                    {item.gate === "entry" ? (
                      <button
                        className="h-9 min-h-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 hover:bg-slate-50"
                        disabled={!deviceList.length}
                        onClick={() => cameraEntry(item.id)}
                        type="button"
                      >
                        Xe vào
                      </button>
                    ) : (
                      <button
                        className="h-9 min-h-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 hover:bg-slate-50"
                        disabled={!deviceList.length}
                        onClick={() => cameraExit(item.id)}
                        type="button"
                      >
                        Xe ra
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
