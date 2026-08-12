"use client";

import { useState } from "react";
import { Bell, Check, CheckCheck, Clock, Search, X } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";

function parseNotificationDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function formatRelativeTime(value?: string): string {
  const date = parseNotificationDate(value);
  if (!date) return "—";
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return `Hôm qua ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type StatusFilter = "all" | "unread" | "read";

export function NotificationsView() {
  const { notificationList, markNotificationRead } = useParkingApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const unreadCount = notificationList.filter((item) => !item.read).length;
  const readCount = notificationList.length - unreadCount;

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

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  }

  async function handleMarkAllRead() {
    const unread = notificationList.filter((item) => !item.read);
    await Promise.all(unread.map((item) => markNotificationRead(item.id)));
  }

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "Tất cả", count: notificationList.length },
    { key: "unread", label: "Mới", count: unreadCount },
    { key: "read", label: "Đã đọc", count: readCount },
  ];

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading notif-header">
          <div className="notif-header-icon">
            <Bell size={20} />
          </div>
          <div>
            <p>Thông báo</p>
            <h2>Trung tâm thông báo</h2>
          </div>
          <div className="notif-header-right">
            {unreadCount > 0 ? (
              <span className="notif-unread-pill">{unreadCount} chưa đọc</span>
            ) : (
              <span className="notif-all-read-pill">Đã đọc hết</span>
            )}
          </div>
        </div>

        <div className="notif-stats">
          {statusTabs.map((tab) => (
            <button
              className={`notif-stat-tab ${statusFilter === tab.key ? "active" : ""}`}
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              type="button"
            >
              <span className="notif-stat-count">{tab.count}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="notif-toolbar">
          <div className="search-box notif-search">
            <Search size={16} />
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm theo tiêu đề hoặc nội dung…"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                className="search-clear"
                onClick={() => setSearchQuery("")}
                title="Xóa tìm kiếm"
                type="button"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <input
            aria-label="Từ ngày"
            className="filter-select"
            onChange={(event) => setFromDate(event.target.value)}
            title="Từ ngày"
            type="date"
            value={fromDate}
          />
          <input
            aria-label="Đến ngày"
            className="filter-select"
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
            title="Đến ngày"
            type="date"
            value={toDate}
          />
          {filtersActive && (
            <button className="notif-clear-btn" onClick={clearFilters} type="button">
              <X size={14} />
              Xóa lọc
            </button>
          )}
          <button
            className="notif-markall-btn"
            disabled={unreadCount === 0}
            onClick={handleMarkAllRead}
            type="button"
          >
            <CheckCheck size={15} />
            Đánh dấu tất cả đã đọc
          </button>
          <span className="filter-count notif-count">
            {filteredNotifications.length} / {notificationList.length} thông báo
          </span>
        </div>

        <div className="notif-list">
          {filteredNotifications.map((item) => (
            <div className={`notif-card ${item.read ? "read" : "unread"}`} key={item.id}>
              <div className="notif-card-icon">
                <Bell size={16} />
              </div>
              <div className="notif-card-body">
                <div className="notif-card-title-row">
                  <strong className="notif-card-title">{item.title}</strong>
                  {!item.read && <span className="notif-unread-dot" />}
                </div>
                <p className="notif-card-content">{item.content}</p>
                <span className="notif-card-time">
                  <Clock size={12} />
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>
              <div className="notif-card-actions">
                <span className={`badge ${item.read ? "" : "warning"}`}>
                  {item.read ? "Đã đọc" : "Mới"}
                </span>
                {!item.read && (
                  <button
                    className="notif-read-btn"
                    onClick={() => markNotificationRead(item.id)}
                    type="button"
                  >
                    <Check size={14} />
                    Đã đọc
                  </button>
                )}
              </div>
            </div>
          ))}
          {filteredNotifications.length === 0 && (
            <div className="notif-empty">
              <Bell size={38} strokeWidth={1.5} />
              <p>
                {notificationList.length === 0
                  ? "Không có thông báo nào."
                  : "Không có thông báo phù hợp bộ lọc."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}