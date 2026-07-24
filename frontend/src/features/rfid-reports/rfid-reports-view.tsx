"use client";

import { useEffect, useState } from "react";
import { Radio, Download, Loader2, Filter } from "lucide-react";

import { apiFetch } from "@/lib/client-api";

type RfidStatusSummary = {
  available: number;
  inUse: number;
  lost: number;
  blocked: number;
  total: number;
};

type DailyScanRow = {
  date: string;
  totalScans: number;
  successScans: number;
  failedScans: number;
  entryScans: number;
  exitScans: number;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export function RfidReportsView() {
  const [status, setStatus] = useState<RfidStatusSummary | null>(null);
  const [usage, setUsage] = useState<DailyScanRow[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState("");

  const [dateFrom, setDateFrom] = useState(weekAgoStr());
  const [dateTo, setDateTo] = useState(todayStr());

  // Load status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  // Load usage when filters change
  useEffect(() => {
    loadUsage();
  }, [dateFrom, dateTo]);

  async function loadStatus() {
    setStatusLoading(true);
    try {
      const res = await apiFetch("/rfid-reports/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setMsg("Không thể tải trạng thái RFID.");
      }
    } catch {
      setMsg("Lỗi kết nối khi tải trạng thái RFID.");
    } finally {
      setStatusLoading(false);
    }
  }

  async function loadUsage() {
    setUsageLoading(true);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const res = await apiFetch(`/rfid-reports/usage?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsage(Array.isArray(data) ? data : data.rows || []);
      } else {
        setMsg("Không thể tải báo cáo sử dụng.");
      }
    } catch {
      setMsg("Lỗi kết nối khi tải báo cáo sử dụng.");
    } finally {
      setUsageLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setMsg("");
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const res = await apiFetch(`/rfid-reports/export?${params.toString()}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rfid-report-${dateFrom}-to-${dateTo}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMsg("Đã xuất báo cáo thành công.");
      } else {
        const data = await res.json();
        setMsg(data.message || "Lỗi khi xuất báo cáo.");
      }
    } catch {
      setMsg("Lỗi kết nối khi xuất báo cáo.");
    } finally {
      setExporting(false);
    }
  }

  function formatPercent(value: number, total: number): string {
    if (total === 0) return "0%";
    return ((value / total) * 100).toFixed(1) + "%";
  }

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>RFID</p>
            <h2>Báo cáo RFID</h2>
          </div>
          <Radio size={22} />
        </div>

        {msg && <p className="muted-cell" style={{ marginBottom: 12 }}>{msg}</p>}

        {/* Section 1: Status Summary */}
        <div className="panel-heading" style={{ marginTop: 8 }}>
          <div>
            <p>Thẻ RFID</p>
            <h2>Tổng quan trạng thái</h2>
          </div>
        </div>

        {statusLoading ? (
          <p className="muted-cell" style={{ textAlign: "center", padding: 24 }}>
            <Loader2 className="spin" size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Đang tải trạng thái...
          </p>
        ) : status ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {/* Available */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  border: "1px solid #333",
                  textAlign: "center",
                }}
              >
                <span
                  className="badge success"
                  style={{ display: "inline-block", marginBottom: 6 }}
                >
                  Sẵn sàng
                </span>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{status.available}</div>
                <p className="muted-cell" style={{ fontSize: 12 }}>
                  {formatPercent(status.available, status.total)} tổng
                </p>
              </div>

              {/* In-use */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  border: "1px solid #333",
                  textAlign: "center",
                }}
              >
                <span
                  className="badge"
                  style={{ display: "inline-block", marginBottom: 6 }}
                >
                  Đang sử dụng
                </span>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{status.inUse}</div>
                <p className="muted-cell" style={{ fontSize: 12 }}>
                  {formatPercent(status.inUse, status.total)} tổng
                </p>
              </div>

              {/* Lost */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  border: "1px solid #333",
                  textAlign: "center",
                }}
              >
                <span
                  className="badge warning"
                  style={{ display: "inline-block", marginBottom: 6 }}
                >
                  Mất
                </span>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{status.lost}</div>
                <p className="muted-cell" style={{ fontSize: 12 }}>
                  {formatPercent(status.lost, status.total)} tổng
                </p>
              </div>

              {/* Blocked */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  border: "1px solid #333",
                  textAlign: "center",
                }}
              >
                <span
                  className="badge danger"
                  style={{ display: "inline-block", marginBottom: 6 }}
                >
                  Khóa
                </span>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{status.blocked}</div>
                <p className="muted-cell" style={{ fontSize: 12 }}>
                  {formatPercent(status.blocked, status.total)} tổng
                </p>
              </div>
            </div>

            {/* Distribution bar */}
            {status.total > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p className="muted-cell" style={{ marginBottom: 6 }}>
                  Phân bố: {status.total} thẻ tổng
                </p>
                <div
                  style={{
                    width: "100%",
                    height: 16,
                    borderRadius: 8,
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: `${(status.available / status.total) * 100}%`,
                      backgroundColor: "#22c55e",
                    }}
                    title={`Sẵn sàng: ${status.available}`}
                  />
                  <div
                    style={{
                      width: `${(status.inUse / status.total) * 100}%`,
                      backgroundColor: "#3b82f6",
                    }}
                    title={`Đang sử dụng: ${status.inUse}`}
                  />
                  <div
                    style={{
                      width: `${(status.lost / status.total) * 100}%`,
                      backgroundColor: "#eab308",
                    }}
                    title={`Mất: ${status.lost}`}
                  />
                  <div
                    style={{
                      width: `${(status.blocked / status.total) * 100}%`,
                      backgroundColor: "#ef4444",
                    }}
                    title={`Khóa: ${status.blocked}`}
                  />
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11 }}>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, backgroundColor: "#22c55e", marginRight: 4 }} />Sẵn sàng</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, backgroundColor: "#3b82f6", marginRight: 4 }} />Đang dùng</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, backgroundColor: "#eab308", marginRight: 4 }} />Mất</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, backgroundColor: "#ef4444", marginRight: 4 }} />Khóa</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="muted-cell" style={{ textAlign: "center", padding: 24 }}>
            Không có dữ liệu trạng thái.
          </p>
        )}

        {/* Section 2: Usage Report */}
        <div className="panel-heading" style={{ marginTop: 8 }}>
          <div>
            <p>Báo cáo</p>
            <h2>Sử dụng RFID theo ngày</h2>
          </div>
          <Filter size={18} />
        </div>

        {/* Date range filters */}
        <div className="filter-row" style={{ marginBottom: 16 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Từ
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#fff" }}
            />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Đến
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#fff" }}
            />
          </label>
          <button
            className="small-button"
            onClick={() => { setDateFrom(weekAgoStr()); setDateTo(todayStr()); }}
            type="button"
          >
            7 ngày gần đây
          </button>
        </div>

        {/* Usage table */}
        {usageLoading ? (
          <p className="muted-cell" style={{ textAlign: "center", padding: 24 }}>
            <Loader2 className="spin" size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Đang tải dữ liệu...
          </p>
        ) : usage.length > 0 ? (
          <div className="table-wrap" style={{ marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Tổng quét</th>
                  <th>Thành công</th>
                  <th>Thất bại</th>
                  <th>Vào</th>
                  <th>Ra</th>
                  <th>Tỷ lệ thành công</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((row) => (
                  <tr key={row.date}>
                    <td>{new Date(row.date).toLocaleDateString("vi-VN")}</td>
                    <td>{row.totalScans}</td>
                    <td>
                      <span className="badge success">{row.successScans}</span>
                    </td>
                    <td>
                      <span className={row.failedScans > 0 ? "badge warning" : "badge"}>
                        {row.failedScans}
                      </span>
                    </td>
                    <td>{row.entryScans}</td>
                    <td>{row.exitScans}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 8,
                            backgroundColor: "#1a1a2e",
                            borderRadius: 4,
                            overflow: "hidden",
                            maxWidth: 100,
                          }}
                        >
                          <div
                            style={{
                              width: row.totalScans === 0 ? "0%" : `${(row.successScans / row.totalScans) * 100}%`,
                              height: "100%",
                              backgroundColor: row.successScans === row.totalScans ? "#22c55e" : "#3b82f6",
                              borderRadius: 4,
                            }}
                          />
                        </div>
                        <span className="muted-cell" style={{ fontSize: 12 }}>
                          {formatPercent(row.successScans, row.totalScans)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted-cell" style={{ textAlign: "center", padding: 24 }}>
            Không có dữ liệu sử dụng trong khoảng thời gian đã chọn.
          </p>
        )}

        {/* Export button */}
        <button
          className="full-button"
          disabled={exporting}
          onClick={handleExport}
          type="button"
        >
          {exporting ? (
            <Loader2 className="spin" size={18} />
          ) : (
            <Download size={18} />
          )}
          {exporting ? "Đang xuất..." : "Xuất báo cáo"}
        </button>
      </div>
    </section>
  );
}
