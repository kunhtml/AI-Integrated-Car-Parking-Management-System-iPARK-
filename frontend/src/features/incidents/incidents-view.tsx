"use client";

import { useRouter } from "next/navigation";
import { Ban, CircleAlert } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import type { IncidentItem } from "@/types";

export function IncidentsView() {
  const router = useRouter();
  const { currentUser, incidentList, createIncident, resolveIncident } =
    useParkingApp();

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
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Sự cố</p>
            <h2>Tạo báo cáo</h2>
          </div>
          <CircleAlert size={22} />
        </div>
        <form className="stack-form" onSubmit={createIncident}>
          <label>
            Loại sự cố
            <select name="type">
              <option>Xe blacklist</option>
              <option>Lỗi nhận dạng</option>
              <option>Yêu cầu miễn phạt</option>
              <option>Camera offline</option>
              <option>Khác</option>
            </select>
          </label>
          <label>
            Biển số
            <input name="plate" placeholder="Nếu có" />
          </label>
          <label>
            Ghi chú
            <input name="note" placeholder="Nhập ghi chú xử lý" required />
          </label>
          <button className="full-button" type="submit">
            Lưu sự cố
          </button>
        </form>
      </div>
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Xử lý</p>
            <h2>Hàng đợi sự cố</h2>
          </div>
          <Ban size={22} />
        </div>
        <DataTable
          headers={["Loại", "Biển số", "Ghi chú", "Trạng thái"]}
          rows={incidentList.map((item) => [
            item.type,
            item.plate || "Không có",
            item.note,
            item.status,
          ])}
          onRowClick={(rowIndex) => handleResolve(incidentList[rowIndex])}
        />
      </div>
    </section>
  );
}
