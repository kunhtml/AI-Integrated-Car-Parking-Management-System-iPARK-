"use client";

import { Search, RefreshCw } from "lucide-react";
import type { RfidCardStatus } from "@/types";

const STATUS_LABELS: Record<RfidCardStatus, string> = {
  available: "Sẵn sàng",
  "in-use": "Đang sử dụng",
  lost: "Mất",
  blocked: "Đã khóa",
};

type Props = {
  searchValue: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  loading?: boolean;
  onRefresh?: () => void;
};

export function RfidCardFilterBar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusChange,
  loading,
  onRefresh,
}: Props) {
  return (
    <div className="filter-row">
      <div style={{ position: "relative" }}>
        <Search
          size={14}
          style={{
            position: "absolute",
            left: "0.5rem",
            top: "50%",
            transform: "translateY(-50%)",
            opacity: 0.5,
          }}
        />
        <input
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm mã thẻ…"
          style={{ paddingLeft: "2rem" }}
          type="text"
          value={searchValue}
        />
      </div>
      <select
        aria-label="Lọc theo trạng thái"
        onChange={(e) => onStatusChange(e.target.value)}
        value={statusFilter}
      >
        <option value="">Tất cả trạng thái</option>
        {Object.entries(STATUS_LABELS).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {onRefresh && (
        <button
          className="ghost-button"
          disabled={loading}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw className={loading ? "spin" : ""} size={14} /> Làm mới
        </button>
      )}
    </div>
  );
}
