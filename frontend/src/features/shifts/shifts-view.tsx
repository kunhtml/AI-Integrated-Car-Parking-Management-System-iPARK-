"use client";

import { CalendarDays, Clock3 } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { fallbackShifts } from "@/lib/mock-data";

export function ShiftsView() {
  const { shiftList, startShift, endShift } = useParkingApp();

  const displayShifts = shiftList.length ? shiftList : fallbackShifts();

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p>Nhân viên</p>
          <h2>Quản lý ca làm việc</h2>
        </div>
        <CalendarDays size={22} />
      </div>
      <form className="action-row" onSubmit={startShift}>
        <input name="name" placeholder="Tên ca làm" required />
        <input name="note" placeholder="Ghi chú" />
        <button type="submit">
          <Clock3 size={18} />
          Bắt đầu ca
        </button>
      </form>
      <DataTable
        headers={["Ca", "Bắt đầu", "Kết thúc", "Trạng thái", "Thao tác"]}
        rows={displayShifts.map((item) => [
          item.name,
          new Date(item.startedAt || "").toString() === "Invalid Date"
            ? item.startedAt
            : new Date(item.startedAt || "").toLocaleString("vi-VN"),
          item.endedAt ? new Date(item.endedAt).toLocaleString("vi-VN") : "Chưa kết thúc",
          item.status,
          item.status === "Đang làm" && shiftList.length ? (
            <button className="small-button" key={item.id} onClick={() => endShift(item.id)} type="button">
              Kết thúc
            </button>
          ) : (
            "OK"
          ),
        ])}
      />
    </div>
  );
}
