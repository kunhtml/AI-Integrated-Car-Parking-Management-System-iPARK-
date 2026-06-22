"use client";

import { Ban, CircleAlert } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";

export function IncidentsView() {
  const { currentUser, incidentList, createIncident, resolveIncident } = useParkingApp();

  if (!currentUser) {
    return null;
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
          headers={["Loại", "Biển số", "Ghi chú", "Trạng thái", "Thao tác"]}
          rows={incidentList.map((item) => [
            item.type,
            item.plate || "Không có",
            item.note,
            item.status,
            item.status !== "Đã xử lý" && currentUser.role === "admin" ? (
              <button className="small-button" key={item.id} onClick={() => resolveIncident(item.id)} type="button">
                Xử lý
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
