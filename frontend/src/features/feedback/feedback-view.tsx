"use client";

import { Bell, ReceiptText } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";

export function FeedbackView() {
  const { currentUser, feedbackList, createFeedback, updateFeedbackStatus } = useParkingApp();

  if (!currentUser) {
    return null;
  }

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Phản hồi</p>
            <h2>Gửi phản hồi</h2>
          </div>
          <Bell size={22} />
        </div>
        <form className="stack-form" onSubmit={createFeedback}>
          <label>
            Chủ đề
            <input name="subject" placeholder="Ví dụ: nhầm phí gửi xe" required />
          </label>
          <label>
            Nội dung
            <input name="content" placeholder="Nhập nội dung phản hồi" required />
          </label>
          <button className="full-button" type="submit">
            Gửi phản hồi
          </button>
        </form>
      </div>
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Lịch sử</p>
            <h2>Phản hồi đã gửi</h2>
          </div>
          <ReceiptText size={22} />
        </div>
        <DataTable
          headers={["Chủ đề", "Nội dung", "Trạng thái", "Phản hồi", "Thao tác"]}
          rows={feedbackList.map((item) => [
            item.subject,
            item.content,
            item.status,
            item.response || "Chưa có",
            currentUser.role === "admin" && item.status !== "Đã phản hồi" ? (
              <button className="small-button" key={item.id} onClick={() => updateFeedbackStatus(item.id)} type="button">
                Phản hồi
              </button>
            ) : (
              "OK"
            ),
          ])}
        />
      </div>
    </section>
  );
}
