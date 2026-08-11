"use client";

import { useState } from "react";
import { Bell, Check, Search, X } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";

function parseNotificationDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatNotificationDate(value?: string) {
  const date = parseNotificationDate(value);
  return date ? date.toLocaleString("vi-VN") : "—";
}

export function NotificationsView() {
  const { notificationList, markNotificationRead } = useParkingApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
  const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
  const filteredNotifications = notificationList.filter((item) => {
    const createdAt = parseNotificationDate(item.createdAt);
    const matchesQuery =
      !normalizedQuery ||
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.content.toLowerCase().includes(normalizedQuery);

    if (!matchesQuery) return false;
    if (statusFilter === "unread" && item.read) return false;
    if (statusFilter === "read" && !item.read) return false;
    if (from && (!createdAt || createdAt < from)) return false;
    if (to && (!createdAt || createdAt > to)) return false;
    return true;
  });

  const filtersActive =
    searchQuery !== "" || statusFilter !== "all" || fromDate !== "" || toDate !== "";

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Thông báo</p>
            <h2>Tất cả thông báo</h2>
          </div>
          <Bell size={22} />
        </div>
        <div className="filter-bar">
          <div className="search-box">
            <Search size={16} />
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm theo tiêu đề hoặc nội dung…"
              value={searchQuery}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery("")} title="Xóa tìm kiếm" type="button">
                <X size={14} />
              </button>
            )}
          </div>
          <select className="filter-select" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="all">Tất cả trạng thái</option>
            <option value="unread">Mới</option>
            <option value="read">Đã đọc</option>
          </select>
          <input aria-label="Từ ngày" className="filter-select" onChange={(event) => setFromDate(event.target.value)} title="Từ ngày" type="date" value={fromDate} />
          <input aria-label="Đến ngày" className="filter-select" min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} title="Đến ngày" type="date" value={toDate} />
          {filtersActive && (
            <button
              className="small-button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setFromDate("");
                setToDate("");
              }}
              type="button"
            >
              <X size={14} /> Xóa lọc
            </button>
          )}
          <span className="filter-count">
            {filteredNotifications.length} / {notificationList.length} thông báo
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Nội dung</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredNotifications.map((item) => (
                <tr key={item.id} style={{ opacity: item.read ? 0.6 : 1 }}>
                  <td><strong>{item.title}</strong></td>
                  <td>{item.content}</td>
                  <td className="muted-cell">{formatNotificationDate(item.createdAt)}</td>
                  <td>
                    <span className={item.read ? "badge" : "badge warning"}>
                      {item.read ? "Đã đọc" : "Mới"}
                    </span>
                  </td>
                  <td>
                    {!item.read && (
                      <button className="small-button" onClick={() => markNotificationRead(item.id)} type="button">
                        <Check size={14} /> Đã đọc
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredNotifications.length === 0 && (
                <tr>
                  <td className="muted-cell" colSpan={5}>
                    {notificationList.length === 0
                      ? "Không có thông báo nào."
                      : "Không có thông báo phù hợp bộ lọc."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

