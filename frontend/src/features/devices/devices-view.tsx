"use client";

import { Camera, RefreshCcw, Wrench } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { fallbackDevices } from "@/lib/mock-data";

export function DevicesView() {
  const { deviceList, saveDevice, snapshotDevice, cameraEntry, cameraExit } = useParkingApp();

  const displayDevices = deviceList.length ? deviceList : fallbackDevices();

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Thiết bị</p>
            <h2>Cấu hình camera RTSP</h2>
          </div>
          <Camera size={22} />
        </div>
        <form className="stack-form" onSubmit={saveDevice}>
          <label>
            Tên camera
            <input name="name" placeholder="Camera cổng vào" required />
          </label>
          <label>
            Cổng
            <select name="gate">
              <option value="entry">Cổng vào</option>
              <option value="exit">Cổng ra</option>
            </select>
          </label>
          <label>
            RTSP/HTTP URL
            <input name="rtspUrl" placeholder="rtsp://..." required />
          </label>
          <label>
            Username
            <input name="username" />
          </label>
          <label>
            Password
            <input name="password" type="password" />
          </label>
          <label>
            ROI
            <input name="roiNote" placeholder="Biển số trước/sau" />
          </label>
          <button className="full-button" type="submit">
            <Wrench size={18} />
            Lưu camera
          </button>
        </form>
      </div>
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>RTSP</p>
            <h2>Trạng thái và snapshot</h2>
          </div>
          <RefreshCcw size={22} />
        </div>
        <DataTable
          headers={["Thiết bị", "Cổng", "Trạng thái", "Ảnh gần nhất", "ROI", "Thao tác"]}
          rows={displayDevices.map((item) => [
            item.name,
            item.gate === "entry" ? "Vào" : "Ra",
            item.status,
            item.lastSnapshotUrl ? (
              <a href={item.lastSnapshotUrl} key={`${item.id}-shot`} rel="noreferrer" target="_blank">
                Xem ảnh
              </a>
            ) : (
              "Chưa có"
            ),
            item.roiNote || "Chưa có",
            <div className="inline-actions" key={item.id}>
              {deviceList.length ? (
                <button className="small-button" onClick={() => snapshotDevice(item.id)} type="button">
                  Snapshot
                </button>
              ) : null}
              {item.gate === "entry" && deviceList.length ? (
                <button className="small-button" onClick={() => cameraEntry(item.id)} type="button">
                  Xe vào
                </button>
              ) : null}
              {item.gate === "exit" && deviceList.length ? (
                <button className="small-button" onClick={() => cameraExit(item.id)} type="button">
                  Xe ra
                </button>
              ) : null}
            </div>,
          ])}
        />
      </div>
    </section>
  );
}
