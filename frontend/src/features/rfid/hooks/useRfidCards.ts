"use client";

import { useCallback, useEffect, useState } from "react";
import type { RfidCard } from "@/types";
import {
  fetchRfidCards,
  registerRfidCard,
  updateRfidCardStatus,
  reportLostCard,
  unblockCard,
} from "../rfid-api";

export function useRfidCards() {
  const [cards, setCards] = useState<RfidCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await fetchRfidCards(params.toString() as any);
      const data = await res.json();
      if (res.ok) {
        setCards(data.cards);
        setTotal(data.total);
      } else {
        setError(data.message || "Lỗi tải danh sách thẻ.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const register = useCallback(
    async (body: { cardId: string; notes?: string }) => {
      const res = await registerRfidCard(body);
      if (res.ok) {
        await load();
      }
      return res;
    },
    [load],
  );

  const block = useCallback(
    async (id: string, reason?: string) => {
      const res = await (updateRfidCardStatus as any)(id, "blocked", reason);
      if (res.ok) await load();
      return res;
    },
    [load],
  );

  const reportLost = useCallback(
    async (id: string) => {
      const res = await reportLostCard(id);
      if (res.ok) await load();
      return res;
    },
    [load],
  );

  const unblock = useCallback(
    async (id: string) => {
      const res = await unblockCard(id);
      if (res.ok) await load();
      return res;
    },
    [load],
  );

  return {
    cards,
    loading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    total,
    limit,
    load,
    register,
    block,
    reportLost,
    unblock,
  };
}
