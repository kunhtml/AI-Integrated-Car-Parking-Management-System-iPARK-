"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ScanLine, XCircle } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { apiFetch } from "@/lib/client-api";
import type { RecognitionLogItem } from "@/types";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<RecognitionLogItem["action"], string> = {
  entry: "Xe vào",
  exit: "Xe ra",
  "camera-entry": "Camera vào",
  "camera-exit": "Camera ra",
  manual: "Thủ công",
};

const SOURCE_LABELS: Record<RecognitionLogItem["source"], string> = {
  upload: "Upload ảnh",
  camera: "Camera",
};

const STATUS_LABELS: Record<RecognitionLogItem["status"], string> = {
  success: "Thành công",
  failed: "Không nhận diện",
  mismatch: "Không khớp",
  "pending-verification": "Chờ xác minh",
};

type Filters = {
  status: "" | RecognitionLogItem["status"];
  action: "" | RecognitionLogItem["action"];
  source: "" | RecognitionLogItem["source"];
};

const EMPTY_FILTERS: Filters = { status: "", action: "", source: "" };

type RecognitionLogsResponse = {
  logs: RecognitionLogItem[];
  nextCursor: string | null;
};

function buildLogsUrl(filters: Filters, cursor?: string | null) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.action) {
    params.set("action", filters.action);
  }
  if (filters.source) {
    params.set("source", filters.source);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  return `/recognition-logs?${params.toString()}`;
}

function statusIcon(status: RecognitionLogItem["status"]) {
  if (status === "success") {
    return <CheckCircle2 size={16} />;
  }
  if (status === "failed") {
    return <XCircle size={16} />;
  }
  if (status === "mismatch") {
    return <AlertTriangle size={16} />;
  }
  return <Clock3 size={16} />;
}

function statusClass(status: RecognitionLogItem["status"]) {
  return status === "success" ? "badge success" : "badge warning";
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function RecognitionLogsView() {
  const [logs, setLogs] = useState<RecognitionLogItem[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadLogs = useCallback(
    async (cursor?: string | null) => {
      setLoading(true);
      setError("");
      try {
        const response = await apiFetch(buildLogsUrl(filters, cursor));
        if (!response.ok) {
          setError("Không tải được lịch sử nhận diện. Vui lòng thử lại.");
          return;
        }
        const data = (await response.json()) as RecognitionLogsResponse;
        setLogs((items) => (cursor ? [...items, ...data.logs] : data.logs));
        setNextCursor(data.nextCursor);
      } catch {
        setError("Không kết nối được API lịch sử nhận diện.");
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const counters = useMemo(
    () => ({
      total: logs.length,
      success: logs.filter((log) => log.status === "success").length,
      failed: logs.filter((log) => log.status === "failed").length,
      mismatch: logs.filter((log) => log.status === "mismatch").length,
    }),
    [logs],
  );

  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Kiểm toán AI</p>
            <h2>Lịch sử nhận diện biển số</h2>
          </div>
          <ScanLine size={22} />
        </div>
        <p className="muted-text">
          Lưu lại toàn bộ lịch sử nhận diện biển số từ upload ảnh và camera, bao gồm thành công,
          lỗi OCR, trường hợp không khớp khi checkout và các yêu cầu chờ xác minh.
        </p>
        <div className="metric-grid compact">
          <div className="metric-card">
            <span>Tổng log đã tải</span>
            <strong>{counters.total}</strong>
          </div>
          <div className="metric-card">
            <span>Thành công</span>
            <strong>{counters.success}</strong>
          </div>
          <div className="metric-card">
            <span>Không nhận diện</span>
            <strong>{counters.failed}</strong>
          </div>
          <div className="metric-card">
            <span>Không khớp</span>
            <strong>{counters.mismatch}</strong>
          </div>
        </div>
      </div>

      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Lịch sử OCR</p>
            <h2>Log nhận diện gần nhất</h2>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => void loadLogs()}
            disabled={loading}
          >
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>

        <div className="filter-row">
          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value as Filters["status"])}
            aria-label="Lọc theo trạng thái"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={filters.action}
            onChange={(event) => updateFilter("action", event.target.value as Filters["action"])}
            aria-label="Lọc theo hành động"
          >
            <option value="">Tất cả hành động</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={filters.source}
            onChange={(event) => updateFilter("source", event.target.value as Filters["source"])}
            aria-label="Lọc theo nguồn"
          >
            <option value="">Tất cả nguồn</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="muted-text error">{error}</p> : null}

        {logs.length ? (
          <>
            <DataTable
              headers={[
                "Thời gian",
                "Nguồn",
                "Hành động",
                "Biển phiên",
                "Biển OCR",
                "Tin cậy",
                "Trạng thái",
                "Thiết bị",
                "Ghi chú",
              ]}
              rows={logs.map((log) => [
                formatDate(log.createdAt),
                SOURCE_LABELS[log.source] || log.source,
                ACTION_LABELS[log.action] || log.action,
                log.plate || "-",
                log.detectedPlate || "-",
                typeof log.confidence === "number" ? `${log.confidence}%` : "-",
                <span key={log.id} className={statusClass(log.status)}>
                  {statusIcon(log.status)} {STATUS_LABELS[log.status] || log.status}
                </span>,
                log.deviceName || log.deviceId || "-",
                log.message || log.rawText || "-",
              ])}
            />
            {nextCursor ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => void loadLogs(nextCursor)}
                disabled={loading}
              >
                {loading ? "Đang tải..." : "Tải thêm log cũ hơn"}
              </button>
            ) : null}
          </>
        ) : (
          <p className="muted-text">
            {loading
              ? "Đang tải log nhận diện..."
              : "Chưa có log nhận diện phù hợp. Hãy upload ảnh xe vào/ra hoặc chạy camera để hệ thống tự lưu log."}
          </p>
        )}
      </div>
    </section>
  );
}
