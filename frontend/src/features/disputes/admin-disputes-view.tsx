"use client";

import { useEffect, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/ui/data-table";
import { apiFetch } from "@/lib/client-api";
import type { DisputeItem } from "@/types";

function statusBadgeClass(status: string) {
  switch (status) {
    case "Đã xử lý":
      return "badge success";
    case "Đang xử lý":
      return "badge warning";
    case "Từ chối":
      return "badge danger";
    default:
      return "badge";
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminDisputesView() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    apiFetch("/disputes")
      .then((r) => r.json())
      .then((data) => setDisputes(data.disputes ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    statusFilter === "all"
      ? disputes
      : disputes.filter((d) => d.status === statusFilter);

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Hỗ trợ khách hàng</p>
            <h2>Danh sách khiếu nại</h2>
          </div>
          <MessageSquareWarning size={22} />
        </div>

        <div className="admin-disputes-toolbar">
          <label className="admin-disputes-filter">
            Trạng thái
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="Mới">Mới</option>
              <option value="Đang xử lý">Đang xử lý</option>
              <option value="Đã xử lý">Đã xử lý</option>
              <option value="Từ chối">Từ chối</option>
            </select>
          </label>
          <span className="admin-disputes-count">
            {filtered.length} khiếu nại
          </span>
        </div>

        {loading ? (
          <p style={{ padding: "1rem", opacity: 0.6 }}>Đang tải...</p>
        ) : (
          <DataTable
            headers={[
              "Mã",
              "Người gửi",
              "Lý do",
              "Biển số",
              "Trạng thái",
              "Tin nhắn",
              "Ngày gửi",
            ]}
            rows={filtered.map((d) => [
              <span key="code" className="monospace">
                {d.code}
              </span>,
              d.contactName,
              d.reason,
              d.plate || "—",
              <span key="status" className={statusBadgeClass(d.status)}>
                {d.status}
              </span>,
              <span key="msgs" className="admin-disputes-msg-count">
                {(d.messages ?? []).length > 0
                  ? (d.messages ?? []).length
                  : "—"}
              </span>,
              formatDate(d.createdAt),
            ])}
            onRowClick={(idx) => {
              if (filtered[idx]) {
                router.push(`/disputes/${filtered[idx].id}`);
              }
            }}
          />
        )}
      </div>
    </section>
  );
}
