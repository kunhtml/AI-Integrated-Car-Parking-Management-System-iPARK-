"use client";

import { ScanLine } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";

export function VehiclesView() {
  const { registeredVehicles, sessions, approveVehicle, currentUser } = useParkingApp();

  function getRealtimeStatus(plate: string) {
    const activeSession = sessions.find((session) => session.plate === plate && session.status === "Đang gửi");
    if (activeSession) {
      return `Đang gửi tại ${activeSession.slot} (vào lúc ${activeSession.checkIn})`;
    }
    const lastSession = sessions.find((session) => session.plate === plate);
    if (lastSession?.status === "Đã hoàn thành") {
      return `Đã ra bãi lúc ${lastSession.checkOut || "—"}`;
    }
    return "Không trong bãi";
  }

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p>Phương tiện</p>
          <h2>Trạng thái xe realtime</h2>
        </div>
        <ScanLine size={22} />
      </div>
      <DataTable
        headers={["Biển số", "Chủ xe", "Loại xe", "Đăng ký", "Trạng thái realtime", "Thao tác"]}
        rows={registeredVehicles.map((vehicle) => [
          vehicle.plate,
          vehicle.owner,
          vehicle.type,
          vehicle.status,
          getRealtimeStatus(vehicle.plate),
          vehicle.status === "Cần duyệt" && currentUser?.role === "admin" ? (
            <button className="small-button" key={vehicle.plate} onClick={() => approveVehicle(vehicle)} type="button">
              Duyệt
            </button>
          ) : (
            "OK"
          ),
        ])}
      />
    </div>
  );
}
