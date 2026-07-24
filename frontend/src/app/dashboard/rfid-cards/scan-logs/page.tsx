"use client";

import { History, Loader2, RefreshCw } from "lucide-react";
import { RoleGuard } from "@/components/layout/role-guard";
import { RfidScanLogTable } from "@/features/rfid/components/RfidScanLogTable";
import { useRfidScanLogs } from "@/features/rfid/hooks/useRfidScanLogs";

function ScanLogsContent() {
  const { logs, loading, error, page, setPage, total, limit, load } =
    useRfidScanLogs();
  const totalPages = Math.ceil(total / limit);

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Quản lý RFID</p>
            <h2>
              <History size={28} /> Lịch sử quét thẻ
            </h2>
          </div>
          <button
            className="ghost-button"
            onClick={() => void load()}
            type="button"
          >
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>

        {error && <p className="muted-text error">{error}</p>}

        <RfidScanLogTable loading={loading} logs={logs} />

        {totalPages > 1 && (
          <div className="filter-row" style={{ justifyContent: "center" }}>
            <button
              className="ghost-button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              type="button"
            >
              ← Trước
            </button>
            <span>
              Trang {page} / {totalPages}
            </span>
            <button
              className="ghost-button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              type="button"
            >
              Tiếp →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function ScanLogsPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <ScanLogsContent />
    </RoleGuard>
  );
}
