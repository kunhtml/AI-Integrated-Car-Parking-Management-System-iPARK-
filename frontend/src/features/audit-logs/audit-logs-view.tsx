"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Loader2, Search } from "lucide-react";

import { apiFetch } from "@/lib/client-api";

type GateCommandLog = {
  id: string;
  gate: "in" | "out";
  command: "open" | "close";
  source: string;
  success: boolean;
  message: string;
  createdAt: string;
};

const GATES = [
  { value: "", label: "Tất cả" },
  { value: "in", label: "Cổng vào (IN)" },
  { value: "out", label: "Cổng ra (OUT)" },
];

const COMMANDS = [
  { value: "", label: "Tất cả lệnh" },
  { value: "open", label: "Mở barie" },
  { value: "close", label: "Đóng barie" },
];

const LIMIT = 20;

export function AuditLogsView() {
  const [logs, setLogs] = useState<GateCommandLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [gate, setGate] = useState("");
  const [command, setCommand] = useState("");
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
      if (gate) params.set("gate", gate);
      if (command) params.set("command", command);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      params.set("limit", String(LIMIT));
      if (nextCursor) params.set("cursor", nextCursor);

      try {
        const response = await apiFetch(
          `/gate-command-logs?${params.toString()}`,
        );
        if (response.ok) {
          const data = await response.json();
          const newLogs: GateCommandLog[] = data.logs || [];
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
    [gate, command, fromDate, toDate],
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
            <p>Kiểm soát ra vào</p>
            <h2>Nhật ký barie</h2>
            <span className="muted-cell">
              Lịch sử lệnh mở/đóng và nguồn phát lệnh
            </span>
          </div>
          <ClipboardList size={22} />
        </div>

        {/* Filters */}
        <form
          className="filter-row"
          onSubmit={handleFilter}
          style={{ marginBottom: 16 }}
        >
          <select
            value={gate}
            onChange={(e) => setGate(e.target.value)}
            style={{ minWidth: 150 }}
            aria-label="Lọc theo cổng"
          >
            {GATES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            style={{ minWidth: 150 }}
            aria-label="Lọc theo lệnh"
          >
            {COMMANDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
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
          <p
            className="muted-cell"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <Loader2 className="spin" size={16} /> Đang tải...
          </p>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Cổng</th>
                    <th>Lệnh</th>
                    <th>Nguồn lệnh</th>
                    <th>Trạng thái</th>
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
                        <strong>
                          {log.gate === "in"
                            ? "Cổng vào (IN)"
                            : "Cổng ra (OUT)"}
                        </strong>
                      </td>
                      <td>
                        <span className="badge">
                          {log.command === "open" ? "Mở barie" : "Đóng barie"}
                        </span>
                      </td>
                      <td>{log.source || "---"}</td>
                      <td>{log.success ? "Thành công" : "Thất bại"}</td>
                      <td style={{ maxWidth: 320, wordBreak: "break-word" }}>
                        {log.message || "---"}
                      </td>
                    </tr>
                  ))}

                  {logs.length === 0 && (
                    <tr>
                      <td className="muted-cell" colSpan={6}>
                        Không có lệnh barie nào phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 16,
                }}
              >
                <button
                  className="small-button"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  type="button"
                >
                  {loadingMore ? <Loader2 className="spin" size={14} /> : null}
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
