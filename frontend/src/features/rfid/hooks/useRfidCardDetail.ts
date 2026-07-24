"use client";

import { useCallback, useEffect, useState } from "react";
import type { RfidCard, RfidScanLog } from "@/types";
import { fetchRfidCardDetail, fetchRfidCardHistory } from "../rfid-api";

export function useRfidCardDetail(cardId: string | null) {
  const [card, setCard] = useState<RfidCard | null>(null);
  const [activeSession, setActiveSession] = useState<Record<string, unknown> | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [history, setHistory] = useState<RfidScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!cardId) return;
    setLoading(true);
    setError("");
    try {
      const [detailRes, historyRes] = await Promise.all([
        fetchRfidCardDetail(cardId),
        fetchRfidCardHistory(cardId),
      ]);
      const detailData = await detailRes.json();
      const historyData = await historyRes.json();

      if (detailRes.ok) {
        setCard(detailData.card);
        setActiveSession(detailData.activeSession || null);
        setScanCount(detailData.scanCount || 0);
      } else {
        setError(detailData.message || "Lỗi tải chi tiết thẻ.");
      }

      if (historyRes.ok) {
        setHistory(historyData.scans || []);
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { card, activeSession, scanCount, history, loading, error, load };
}
