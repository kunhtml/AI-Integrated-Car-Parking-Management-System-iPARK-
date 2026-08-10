"use client";

import { Bell, Check } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";

export function NotificationsView() {
  const { notificationList, markNotificationRead } = useParkingApp();

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
              {notificationList.map((item) => (
                <tr key={item.id} style={{ opacity: item.read ? 0.6 : 1 }}>
                  <td><strong>{item.title}</strong></td>
                  <td>{item.content}</td>
                  <td className="muted-cell">{item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : "—"}</td>
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
              {notificationList.length === 0 && (
                <tr><td className="muted-cell" colSpan={5}>Không có thông báo nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
