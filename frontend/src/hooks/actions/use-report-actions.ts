import { useEffect } from "react";

import { apiFetch } from "@/lib/client-api";
import type { DemoUser, ReportSummary } from "@/types";

type ReportActionsParams = {
  currentUser: DemoUser | null;
  reportFrom: string;
  reportTo: string;
  setReportSummary: (summary: ReportSummary | null) => void;
  setActionLog: (log: string) => void;
};

export function createReportActions({
  reportFrom,
  reportTo,
  setReportSummary,
  setActionLog,
}: Omit<ReportActionsParams, "currentUser">) {
  const loadReportSummary = async (from: string, to: string) => {
    try {
      const params = new URLSearchParams({ from, to });
      const response = await apiFetch(`/reports/summary?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setActionLog(data.message || "Không tải được báo cáo.");
        return;
      }

      setReportSummary(data.summary);
    } catch {
      setActionLog("Không kết nối được API báo cáo.");
    }
  };

  async function downloadReport(type: "sessions" | "revenue", format: "xlsx" | "pdf" = "xlsx") {
    try {
      const params = new URLSearchParams({ from: reportFrom, to: reportTo, type, format });
      const response = await apiFetch(`/reports/export?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json();
        setActionLog(data.message || "Không xuất được báo cáo.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ipark-${type}-${reportFrom}-${reportTo}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      setActionLog("Đã xuất file Excel từ dữ liệu MongoDB.");
    } catch {
      setActionLog("Không kết nối được API xuất báo cáo.");
    }
  }

  return {
    loadReportSummary,
    downloadReport,
  };
}

export function useReportSummaryLoader({
  currentUser,
  reportFrom,
  reportTo,
  setReportSummary,
  setActionLog,
}: ReportActionsParams) {
  useEffect(() => {
    if (currentUser?.role !== "admin") {
      return;
    }

    let ignore = false;

    async function loadCurrentReportSummary() {
      try {
        const params = new URLSearchParams({ from: reportFrom, to: reportTo });
        const response = await apiFetch(`/reports/summary?${params.toString()}`);
        const data = await response.json();
        if (!ignore && response.ok) {
          setReportSummary(data.summary);
        }
      } catch {
        if (!ignore) {
          setActionLog("Không kết nối được API báo cáo.");
        }
      }
    }

    loadCurrentReportSummary();
    return () => {
      ignore = true;
    };
  }, [currentUser?.role, reportFrom, reportTo, setReportSummary, setActionLog]);
}
