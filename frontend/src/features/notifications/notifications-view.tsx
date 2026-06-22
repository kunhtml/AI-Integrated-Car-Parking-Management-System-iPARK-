"use client";

import { Bell } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { notifications } from "@/lib/mock-data";

export function NotificationsView() {
  const { notificationList, markNotificationRead } = useParkingApp();

  const displayNotifications = notificationList.length
    ? notificationList
    : notifications.map((content, index) => ({
        id: String(index),
        title: "Demo",
        content,
        read: false,
        createdAt: "",
      }));

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p>Thông báo</p>
          <h2>Đăng ký, xe ra, thanh toán, OCR</h2>
        </div>
        <Bell size={22} />
      </div>
      <DataTable
        headers={["Tiêu đề", "Nội dung", "Trạng thái", "Thao tác"]}
        rows={displayNotifications.map((item) => [
          item.title,
          item.content,
          item.read ? "Đã đọc" : "Mới",
          item.read ? (
            "OK"
          ) : (
            <button className="small-button" key={item.id} onClick={() => markNotificationRead(item.id)} type="button">
              Đã đọc
            </button>
          ),
        ])}
      />
    </div>
  );
}
