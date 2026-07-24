"use client";

import { useCallback, useEffect, useState } from "react";
import type { RfidScanLog } from "@/types";
import { fetchRfidScanLogs } from "../rfid-api";

export function useRfidScanLogs() {
  const [logs, setLogs] = useState<RfidScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchRfidScanLogs({ page, limit });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } else {
        setError(data.message || "Lỗi tải lịch sử quét.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return { logs, loading, error, page, setPage, total, limit, load };
}
