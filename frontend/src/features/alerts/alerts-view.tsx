"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCcw, Loader2, CheckCircle } from "lucide-react";

import { apiFetch } from "@/lib/client-api";

type CapacityData = {
  totalCapacity: number;
  currentOccupied: number;
  available: number;
  occupancyPercent: number;
};

export function AlertsView() {
  const [capacity, setCapacity] = useState<CapacityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState("");

  // Load capacity on mount
  useEffect(() => {
    loadCapacity();
  }, []);

  async function loadCapacity() {
    setLoading(true);
    try {
      const res = await apiFetch("/alerts/capacity");
      if (res.ok) {
        const data = await res.json();
        setCapacity(data);
      } else {
        setMsg("Không thể tải dữ liệu cảnh báo.");
      }
    } catch {
      setMsg("Lỗi kết nối khi tải dữ liệu cảnh báo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckAlerts() {
    setChecking(true);
    setMsg("");
    try {
      const res = await apiFetch("/alerts/check", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMsg(data.message || "Đã kiểm tra cảnh báo xong.");
        // Refresh capacity after check
        await loadCapacity();
      } else {
        setMsg(data.message || "Lỗi khi kiểm tra cảnh báo.");
      }
    } catch {
      setMsg("Lỗi kết nối khi kiểm tra cảnh báo.");
    } finally {
      setChecking(false);
    }
  }

  function getOccupancyColor(percent: number): string {
    if (percent >= 90) return "#ef4444";
    if (percent >= 80) return "#eab308";
    return "#22c55e";
  }

  function getOccupancyBgColor(percent: number): string {
    if (percent >= 90) return "rgba(239, 68, 68, 0.15)";
    if (percent >= 80) return "rgba(234, 179, 8, 0.15)";
    return "rgba(34, 197, 94, 0.15)";
  }

  function getStatusLabel(percent: number): string {
    if (percent >= 90) return "CẢNH BÁO: Bãi xe gần đầy";
    if (percent >= 80) return "CHU Ý: Bãi xe đang đầy";
    return "Bãi xe hoạt động bình thường";
  }

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Hệ thống</p>
            <h2>Cảnh báo hệ thống</h2>
          </div>
          <AlertTriangle size={22} />
        </div>

        {msg && <p className="muted-cell" style={{ marginBottom: 12 }}>{msg}</p>}

        {loading ? (
          <p className="muted-cell" style={{ textAlign: "center", padding: 24 }}>
            <Loader2 className="spin" size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Đang tải dữ liệu...
          </p>
        ) : capacity ? (
          <>
            {/* Status label */}
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                marginBottom: 20,
                backgroundColor: getOccupancyBgColor(capacity.occupancyPercent),
                border: `1px solid ${getOccupancyColor(capacity.occupancyPercent)}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {capacity.occupancyPercent >= 90 ? (
                <AlertTriangle size={18} color={getOccupancyColor(capacity.occupancyPercent)} />
              ) : (
                <CheckCircle size={18} color={getOccupancyColor(capacity.occupancyPercent)} />
              )}
              <span style={{ fontWeight: 600, color: getOccupancyColor(capacity.occupancyPercent) }}>
                {getStatusLabel(capacity.occupancyPercent)}
              </span>
            </div>

            {/* Capacity card */}
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-heading">
                <div>
                  <p>Sức chứa</p>
                  <h2>Tình trạng chỗ đỗ xe</h2>
                </div>
              </div>

              {/* Numbers row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    border: "1px solid #333",
                    textAlign: "center",
                  }}
                >
                  <p className="muted-cell" style={{ marginBottom: 4 }}>Xe đang gửi</p>
                  <span style={{ fontSize: 28, fontWeight: 700 }}>
                    {capacity.currentOccupied}
                  </span>
                </div>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    border: "1px solid #333",
                    textAlign: "center",
                  }}
                >
                  <p className="muted-cell" style={{ marginBottom: 4 }}>Tổng sức chứa</p>
                  <span style={{ fontSize: 28, fontWeight: 700 }}>
                    {capacity.totalCapacity}
                  </span>
                </div>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    border: "1px solid #333",
                    textAlign: "center",
                  }}
                >
                  <p className="muted-cell" style={{ marginBottom: 4 }}>Còn trống</p>
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: capacity.available === 0 ? "#ef4444" : undefined,
                    }}
                  >
                    {capacity.available}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span className="muted-cell">Mức sử dụng</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: getOccupancyColor(capacity.occupancyPercent),
                    }}
                  >
                    {capacity.occupancyPercent.toFixed(1)}%
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 24,
                    backgroundColor: "#1a1a2e",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(capacity.occupancyPercent, 100)}%`,
                      height: "100%",
                      backgroundColor: getOccupancyColor(capacity.occupancyPercent),
                      borderRadius: 12,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Check button */}
            <button
              className="full-button"
              disabled={checking}
              onClick={handleCheckAlerts}
              type="button"
            >
              {checking ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <AlertTriangle size={18} />
              )}
              {checking ? "Đang kiểm tra..." : "Kiểm tra cảnh báo"}
            </button>
          </>
        ) : (
          <p className="muted-cell" style={{ textAlign: "center", padding: 24 }}>
            Không có dữ liệu cảnh báo.
          </p>
        )}
      </div>
    </section>
  );
}
