"use client";

import { useState, type FormEvent } from "react";
import { Car, Plus, ScanLine, CheckCircle2, Clock } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import type { RegisteredVehicle } from "@/types";

export function VehiclesView() {
  const { registeredVehicles, setRegisteredVehicles, sessions, approveVehicle, currentUser } = useParkingApp() as any;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [plate, setPlate] = useState("");
  const [owner, setOwner] = useState(currentUser?.name || "");
  const [vehicleType] = useState<"Ô tô">("Ô tô");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function getRealtimeStatus(plateNumber: string) {
    const activeSession = sessions.find((session: any) => session.plate === plateNumber && session.status === "Đang gửi");
    if (activeSession) {
      return `Đang gửi tại ${activeSession.slot} (vào lúc ${activeSession.checkInAt || activeSession.checkIn || "—"})`;
    }
    const lastSession = sessions.find((session: any) => session.plate === plateNumber);
    if (lastSession?.status === "Đã hoàn thành") {
      return `Đã ra bãi lúc ${lastSession.checkOutAt || lastSession.checkOut || "—"}`;
    }
    return "Không trong bãi";
  }

  async function handleRegisterVehicle(e: FormEvent) {
    e.preventDefault();
    if (!plate.trim()) {
      setErrorMsg("Vui lòng nhập biển số xe.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const response = await apiFetch("/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate: plate.trim().toUpperCase(),
          owner: owner.trim() || currentUser?.name || "Khách hàng",
          vehicleType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.message || "Không thể đăng ký xe. Vui lòng thử lại.");
        setLoading(false);
        return;
      }

      // Format response vehicle into state
      const newVehicle: RegisteredVehicle = data.vehicle || {
        id: data._id || String(Date.now()),
        plate: plate.trim().toUpperCase(),
        owner: owner.trim() || currentUser?.name || "Khách hàng",
        type: vehicleType,
        status: currentUser?.role === "customer" ? "Cần duyệt" : "Đã đăng ký",
      };

      setRegisteredVehicles((prev: any) => [newVehicle, ...prev]);
      setSuccessMsg(
        currentUser?.role === "customer"
          ? "Đã gửi yêu cầu đăng ký xe thành công! Chờ quản trị viên phê duyệt."
          : "Đã thêm phương tiện mới thành công!"
      );
      setPlate("");
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMsg("");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p>Phương tiện giao thông</p>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Car size={24} /> Danh sách & Đăng ký phương tiện
          </h2>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() => {
            setOwner(currentUser?.name || "");
            setErrorMsg("");
            setSuccessMsg("");
            setIsModalOpen(true);
          }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", cursor: "pointer" }}
        >
          <Plus size={18} /> Đăng ký xe mới
        </button>
      </div>

      <DataTable
        headers={["Biển số", "Chủ xe", "Loại xe", "Trạng thái xác minh", "Trạng thái đỗ xe", "Thao tác"]}
        rows={registeredVehicles.map((vehicle: any) => [
          <strong key={vehicle.plate} style={{ fontFamily: "monospace", fontSize: "1.05em", color: "#3b82f6" }}>
            {vehicle.plate}
          </strong>,
          vehicle.owner || "—",
          vehicle.type || "Ô tô",
          <span
            key={`status-${vehicle.plate}`}
            className={`badge ${vehicle.status === "Đã đăng ký" ? "success" : "warning"}`}
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "0.85em",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {vehicle.status === "Đã đăng ký" ? <CheckCircle2 size={13} /> : <Clock size={13} />}
            {vehicle.status || "Cần duyệt"}
          </span>,
          getRealtimeStatus(vehicle.plate),
          vehicle.status === "Cần duyệt" && currentUser?.role === "admin" ? (
            <button className="small-button" key={vehicle.plate} onClick={() => approveVehicle(vehicle)} type="button">
              Duyệt ngay
            </button>
          ) : (
            <span style={{ color: "#888", fontSize: "0.9em" }}>—</span>
          ),
        ])}
      />

      {/* Modal đăng ký xe mới */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card-bg, #ffffff)",
              color: "var(--foreground, #1e293b)",
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              border: "1px solid var(--border-color, #e2e8f0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <Car size={20} color="#3b82f6" /> Đăng Ký Xe Mới
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#ef4444", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: "0.9em" }}>
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: "0.9em" }}>
                {successMsg}
              </div>
            )}

            <form onSubmit={handleRegisterVehicle} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: "0.9em" }}>
                  Biển Số Xe <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: 30F-123.45 hoặc 29A-999.99"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontFamily: "monospace",
                    fontSize: "1.05em",
                    textTransform: "uppercase",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: "0.9em" }}>
                  Chủ Sở Hữu / Họ Tên
                </label>
                <input
                  type="text"
                  placeholder="Nhập tên chủ xe"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: "0.9em" }}>
                  Loại Phương Tiện
                </label>
                <input type="text" value="Ô tô" readOnly style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", color: "#64748b" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={loading}
                  style={{ padding: "8px 16px" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={loading}
                  style={{ padding: "8px 20px" }}
                >
                  {loading ? "Đang xử lý..." : "Xác nhận đăng ký"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
