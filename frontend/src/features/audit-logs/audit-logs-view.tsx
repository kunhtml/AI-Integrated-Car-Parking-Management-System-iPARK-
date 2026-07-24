"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Loader2, Search } from "lucide-react";

import { apiFetch } from "@/lib/client-api";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  details: string;
  createdAt: string;
};

const ENTITY_TYPES = [
  { value: "", label: "Tất cả" },
  { value: "User", label: "User" },
  { value: "ParkingSession", label: "ParkingSession" },
  { value: "Device", label: "Device" },
  { value: "Zone", label: "Zone" },
  { value: "PricingConfig", label: "PricingConfig" },
  { value: "RfidCard", label: "RfidCard" },
];

const LIMIT = 20;

export function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [entityType, setEntityType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchLogs = useCallback(
    async (nextCursor?: string | null) => {
      const isLoadMore = !!nextCursor;
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      params.set("limit", String(LIMIT));
      if (nextCursor) params.set("cursor", nextCursor);

      try {
        const response = await apiFetch(`/audit-logs?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          const newLogs: AuditLog[] = data.logs || data.data || [];
          if (isLoadMore) {
            setLogs((prev) => [...prev, ...newLogs]);
          } else {
            setLogs(newLogs);
          }
          setCursor(data.nextCursor || null);
          setHasMore(!!data.nextCursor && newLogs.length === LIMIT);
        } else {
          if (!isLoadMore) setLogs([]);
          setHasMore(false);
        }
      } catch {
        if (!isLoadMore) setLogs([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [entityType, fromDate, toDate],
  );

  useEffect(() => {
    setCursor(null);
    setHasMore(false);
    fetchLogs(null);
  }, [fetchLogs]);

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    setCursor(null);
    setHasMore(false);
    fetchLogs(null);
  }

  function handleLoadMore() {
    if (cursor) {
      fetchLogs(cursor);
    }
  }

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Hệ thống</p>
            <h2>Nhật ký hệ thống</h2>
          </div>
          <ClipboardList size={22} />
        </div>

        {/* Filters */}
        <form className="filter-row" onSubmit={handleFilter} style={{ marginBottom: 16 }}>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            style={{ minWidth: 150 }}
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="Từ ngày"
            title="Từ ngày"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="Đến ngày"
            title="Đến ngày"
          />

          <button className="small-button" type="submit">
            <Search size={14} /> Lọc
          </button>
        </form>

        {/* Table */}
        {loading ? (
          <p className="muted-cell" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 className="spin" size={16} /> Đang tải...
          </p>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Hành động</th>
                    <th>Loại</th>
                    <th>Người thực hiện</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        {new Date(log.createdAt).toLocaleString("vi-VN", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td>
                        <span className="badge">{log.action}</span>
                      </td>
                      <td>{log.entityType}</td>
                      <td>{log.userName || log.userId || "---"}</td>
                      <td style={{ maxWidth: 320, wordBreak: "break-word" }}>
                        {log.details || "---"}
                      </td>
                    </tr>
                  ))}

                  {logs.length === 0 && (
                    <tr>
                      <td className="muted-cell" colSpan={5}>
                        Không có nhật ký nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                <button
                  className="small-button"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  type="button"
                >
                  {loadingMore ? (
                    <Loader2 className="spin" size={14} />
                  ) : null}
                  {loadingMore ? "Đang tải..." : "Tải thêm"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
