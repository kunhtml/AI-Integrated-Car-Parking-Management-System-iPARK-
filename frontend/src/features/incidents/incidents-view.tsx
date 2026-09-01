"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, RefreshCw } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import type { IncidentItem } from "@/types";

export function IncidentsView() {
  const router = useRouter();
  const { currentUser, incidentList, setIncidentList, resolveIncident } =
    useParkingApp();
  const [refreshing, setRefreshing] = useState(false);

  // Tải lại danh sách sự cố mỗi lần vào trang để tránh hiển thị trạng thái cũ
  // (ví dụ: khiếu nại liên quan vừa bị từ chối/xử lý ở trang khiếu nại).
  const refreshIncidents = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch("/incidents");
      if (res.ok) {
        const data = (await res.json()) as { incidents?: IncidentItem[] };
        setIncidentList(data.incidents ?? []);
      }
    } catch (error) {
      console.error("[incidents] refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [setIncidentList]);

  useEffect(() => {
    if (currentUser) {
      refreshIncidents();
    }
  }, [currentUser, refreshIncidents]);

  // Chỉ hiển thị sự cố vận hành (camera offline, xe blacklist, lỗi nhận dạng...).
  // Incident sinh tự động từ khiếu nại khách hàng đã được quản lý ở trang /disputes
  // nên bị loại để hai trang không trùng nội dung.
  const operationalIncidents = incidentList.filter(
    (item) => !item.disputeId && !item.note.startsWith("[Khiếu nại"),
  );

  if (!currentUser) {
    return null;
  }

  async function handleResolve(item: IncidentItem) {
    // Ưu tiên disputeId nếu có (incident mới)
    if (item.disputeId) {
      router.push(`/disputes/${item.disputeId}`);
      return;
    }
    // Fallback: parse dispute code từ note (incident cũ chưa có disputeId)
    const match = item.note.match(/\[Khiếu nại (KN-[^\]]+)\]/);
    if (match) {
      const res = await apiFetch(
        `/disputes/by-code/${encodeURIComponent(match[1])}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { dispute: { id: string } };
        router.push(`/disputes/${data.dispute.id}`);
        return;
      }
    }
    // Không liên quan đến khiếu nại → xử lý thẳng
    resolveIncident(item.id);
  }

  return (
    <section className="content-grid incidents-grid">
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Vận hành</p>
            <h2>Sự cố hệ thống</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              className="icon-button"
              type="button"
              aria-label="Làm mới danh sách"
              title="Làm mới danh sách"
              onClick={refreshIncidents}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            </button>
            <Ban size={22} />
          </div>
        </div>
        <DataTable
          headers={["Loại", "Biển số", "Ghi chú", "Trạng thái"]}
          rows={operationalIncidents.map((item) => [
            item.type,
            item.plate || "Không có",
            item.note,
            item.status,
          ])}
          onRowClick={(rowIndex) => handleResolve(operationalIncidents[rowIndex])}
          emptyMessage="Không có sự cố hệ thống cần xử lý."
        />
        <p
          style={{
            padding: "0.75rem 1rem 1rem",
            fontSize: "0.85rem",
            opacity: 0.65,
          }}
        >
          Khiếu nại từ khách hàng (KN-…) không hiển thị ở đây — xem tại trang{" "}
          <a href="/disputes">Khiếu nại</a>.
        </p>
      </div>
    </section>
  );
}
