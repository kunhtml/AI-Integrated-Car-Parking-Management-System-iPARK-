"use client";

import { useState } from "react";
import { ClipboardPlus, Car, Loader2, CheckCircle, AlertCircle, X } from "lucide-react";

import { apiFetch } from "@/lib/client-api";

type SessionResult = {
  id: string;
  plate: string;
  slot: string;
  checkIn: string;
  vehicleType?: string;
  ownerName?: string;
};

type VehicleResult = {
  id: string;
  plate: string;
  owner: string;
  type: string;
  status: string;
};

export function AssistedRegistrationView() {
  const [activeTab, setActiveTab] = useState<"session" | "vehicle">("session");

  // --- Session form state ---
  const [sessionPlate, setSessionPlate] = useState("");
  const [sessionOwner, setSessionOwner] = useState("");
  const [sessionPhone, setSessionPhone] = useState("");
  const [sessionVehicleType, setSessionVehicleType] = useState("Ô tô");
  const [sessionNote, setSessionNote] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [sessionError, setSessionError] = useState("");

  // --- Vehicle form state ---
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleOwner, setVehicleOwner] = useState("");
  const [vehiclePhone, setVehiclePhone] = useState("");
  const [vehicleType, setVehicleType] = useState("Ô tô");
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleResult, setVehicleResult] = useState<VehicleResult | null>(null);
  const [vehicleError, setVehicleError] = useState("");

  // --- Submit: Create parking session ---
  async function handleSessionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSessionError("");
    setSessionResult(null);
    setSessionLoading(true);

    try {
      const res = await apiFetch("/assisted-registration/session", {
        method: "POST",
        body: JSON.stringify({
          plate: sessionPlate.trim(),
          ownerName: sessionOwner.trim(),
          phone: sessionPhone.trim() || undefined,
          vehicleType: sessionVehicleType,
          note: sessionNote.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setSessionError(data.message || "Biển số xe nằm trong danh sách đen. Không thể tạo phiên.");
        } else if (res.status === 409) {
          setSessionError(data.message || "Biển số xe đã có phiên đỗ xe đang hoạt động.");
        } else {
          setSessionError(data.message || "Đã xảy ra lỗi khi tạo phiên đỗ xe.");
        }
        return;
      }

      setSessionResult(data.session ?? data);
      setSessionPlate("");
      setSessionOwner("");
      setSessionPhone("");
      setSessionVehicleType("Ô tô");
      setSessionNote("");
    } catch {
      setSessionError("Không thể kết nối tới server. Vui lòng thử lại.");
    } finally {
      setSessionLoading(false);
    }
  }

  // --- Submit: Register vehicle ---
  async function handleVehicleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setVehicleError("");
    setVehicleResult(null);
    setVehicleLoading(true);

    try {
      const res = await apiFetch("/assisted-registration/vehicle", {
        method: "POST",
        body: JSON.stringify({
          plate: vehiclePlate.trim(),
          ownerName: vehicleOwner.trim(),
          phone: vehiclePhone.trim() || undefined,
          vehicleType: vehicleType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVehicleError(data.message || "Đã xảy ra lỗi khi đăng ký xe.");
        return;
      }

      setVehicleResult(data.vehicle ?? data);
      setVehiclePlate("");
      setVehicleOwner("");
      setVehiclePhone("");
      setVehicleType("Ô tô");
    } catch {
      setVehicleError("Không thể kết nối tới server. Vui lòng thử lại.");
    } finally {
      setVehicleLoading(false);
    }
  }

  function clearSessionResult() {
    setSessionResult(null);
  }

  function clearVehicleResult() {
    setVehicleResult(null);
  }

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Hỗ trợ khách hàng</p>
            <h2>Đăng ký hộ tại quầy</h2>
          </div>
          <ClipboardPlus size={22} />
        </div>

        <div className="tab-bar">
          <button
            className={`tab-item${activeTab === "session" ? " tab-active" : ""}`}
            onClick={() => setActiveTab("session")}
            type="button"
          >
            Tạo phiên đỗ xe
          </button>
          <button
            className={`tab-item${activeTab === "vehicle" ? " tab-active" : ""}`}
            onClick={() => setActiveTab("vehicle")}
            type="button"
          >
            Đăng ký xe
          </button>
        </div>

        {/* ── Tab 1: Create parking session ── */}
        {activeTab === "session" && (
          <>
            <form className="stack-form" onSubmit={handleSessionSubmit} style={{ marginTop: 16 }}>
              <label>
                Biển số xe *
                <input
                  name="plate"
                  placeholder="30A-123.45"
                  required
                  value={sessionPlate}
                  onChange={(e) => setSessionPlate(e.target.value)}
                />
              </label>

              <label>
                Tên chủ xe *
                <input
                  name="ownerName"
                  placeholder="Nguyễn Văn A"
                  required
                  value={sessionOwner}
                  onChange={(e) => setSessionOwner(e.target.value)}
                />
              </label>

              <label>
                Số điện thoại
                <input
                  name="phone"
                  placeholder="0901234567"
                  type="tel"
                  value={sessionPhone}
                  onChange={(e) => setSessionPhone(e.target.value)}
                />
              </label>

              <label>
                Loại xe
                <select
                  name="vehicleType"
                  value={sessionVehicleType}
                  onChange={(e) => setSessionVehicleType(e.target.value)}
                >
                  <option value="Ô tô">Ô tô</option>
                  
                  
                </select>
              </label>

              <label>
                Ghi chú
                <input
                  name="note"
                  placeholder="Ghi chú thêm (không bắt buộc)"
                  value={sessionNote}
                  onChange={(e) => setSessionNote(e.target.value)}
                />
              </label>

              <button className="full-button" disabled={sessionLoading} type="submit">
                {sessionLoading ? (
                  <Loader2 className="spin" size={18} />
                ) : (
                  <ClipboardPlus size={18} />
                )}
                {sessionLoading ? "Đang tạo..." : "Tạo phiên đỗ xe"}
              </button>
            </form>

            {/* Session error */}
            {sessionError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  marginTop: 16,
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                }}
              >
                <AlertCircle size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#ef4444", fontSize: 14, margin: 0 }}>{sessionError}</p>
                </div>
                <button
                  onClick={() => setSessionError("")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#ef4444" }}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Session success */}
            {sessionResult && (
              <div
                style={{
                  marginTop: 16,
                  padding: "16px",
                  borderRadius: 8,
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <CheckCircle size={18} style={{ color: "#22c55e" }} />
                  <strong style={{ color: "#22c55e", fontSize: 15 }}>Tạo phiên thành công!</strong>
                  <button
                    onClick={clearSessionResult}
                    style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#888" }}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", fontSize: 14 }}>
                  <div>
                    <span className="muted-cell">Biển số: </span>
                    <strong>{sessionResult.plate}</strong>
                  </div>
                  <div>
                    <span className="muted-cell">Chỗ đỗ: </span>
                    <strong>{sessionResult.slot}</strong>
                  </div>
                  <div>
                    <span className="muted-cell">Giờ vào: </span>
                    <strong>
                      {sessionResult.checkIn
                        ? new Date(sessionResult.checkIn).toLocaleString("vi-VN")
                        : "-"}
                    </strong>
                  </div>
                  {sessionResult.ownerName && (
                    <div>
                      <span className="muted-cell">Chủ xe: </span>
                      <strong>{sessionResult.ownerName}</strong>
                    </div>
                  )}
                  {sessionResult.vehicleType && (
                    <div>
                      <span className="muted-cell">Loại xe: </span>
                      <strong>{sessionResult.vehicleType}</strong>
                    </div>
                  )}
                  <div>
                    <span className="muted-cell">Mã phiên: </span>
                    <strong style={{ fontSize: 12 }}>{sessionResult.id}</strong>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Tab 2: Register vehicle ── */}
        {activeTab === "vehicle" && (
          <>
            <form className="stack-form" onSubmit={handleVehicleSubmit} style={{ marginTop: 16 }}>
              <label>
                Biển số xe *
                <input
                  name="plate"
                  placeholder="30A-123.45"
                  required
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                />
              </label>

              <label>
                Tên chủ xe *
                <input
                  name="ownerName"
                  placeholder="Nguyễn Văn A"
                  required
                  value={vehicleOwner}
                  onChange={(e) => setVehicleOwner(e.target.value)}
                />
              </label>

              <label>
                Số điện thoại
                <input
                  name="phone"
                  placeholder="0901234567"
                  type="tel"
                  value={vehiclePhone}
                  onChange={(e) => setVehiclePhone(e.target.value)}
                />
              </label>

              <label>
                Loại xe
                <select
                  name="vehicleType"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                >
                  <option value="Ô tô">Ô tô</option>
                  
                  
                </select>
              </label>

              <button className="full-button" disabled={vehicleLoading} type="submit">
                {vehicleLoading ? (
                  <Loader2 className="spin" size={18} />
                ) : (
                  <Car size={18} />
                )}
                {vehicleLoading ? "Đang đăng ký..." : "Đăng ký xe"}
              </button>
            </form>

            {/* Vehicle error */}
            {vehicleError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  marginTop: 16,
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                }}
              >
                <AlertCircle size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#ef4444", fontSize: 14, margin: 0 }}>{vehicleError}</p>
                </div>
                <button
                  onClick={() => setVehicleError("")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#ef4444" }}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Vehicle success */}
            {vehicleResult && (
              <div
                style={{
                  marginTop: 16,
                  padding: "16px",
                  borderRadius: 8,
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <CheckCircle size={18} style={{ color: "#22c55e" }} />
                  <strong style={{ color: "#22c55e", fontSize: 15 }}>Đăng ký xe thành công!</strong>
                  <button
                    onClick={clearVehicleResult}
                    style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#888" }}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", fontSize: 14 }}>
                  <div>
                    <span className="muted-cell">Biển số: </span>
                    <strong>{vehicleResult.plate}</strong>
                  </div>
                  <div>
                    <span className="muted-cell">Chủ xe: </span>
                    <strong>{vehicleResult.owner}</strong>
                  </div>
                  <div>
                    <span className="muted-cell">Loại xe: </span>
                    <strong>{vehicleResult.type}</strong>
                  </div>
                  <div>
                    <span className="muted-cell">Trạng thái: </span>
                    <span className="badge success">{vehicleResult.status}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
