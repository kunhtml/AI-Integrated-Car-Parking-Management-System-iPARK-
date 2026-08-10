"use client";

import { useState } from "react";
import { CalendarDays, Clock3, ClipboardCheck, FileText } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";

type ShiftReport = {
  totalSessions: number;
  totalRevenue: number;
  totalIncidents: number;
  handoverNote?: string;
  handoverAt?: string;
};

export function ShiftsView() {
  const { currentUser, shiftList, startShift, endShift } = useParkingApp();
  const [reportData, setReportData] = useState<Record<string, ShiftReport>>({});
  const [reportMsg, setReportMsg] = useState("");
  const [showReportForm, setShowReportForm] = useState<string | null>(null);

  const displayShifts = shiftList;

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!showReportForm) return;
    const form = new FormData(event.currentTarget);
    const body = {
      handoverNote: String(form.get("handoverNote") || ""),
      handoverTo: String(form.get("handoverTo") || ""),
    };
    const response = await apiFetch(`/shifts/${showReportForm}/report`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (response.ok) {
      setReportData((prev) => ({ ...prev, [showReportForm!]: data.report }));
      setReportMsg(data.message || "Đã nộp báo cáo ca.");
      setShowReportForm(null);
    } else {
      setReportMsg(data.message || "Lỗi nộp báo cáo.");
    }
  }

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Nhân viên</p>
            <h2>Quản lý ca làm việc</h2>
          </div>
          <CalendarDays size={22} />
        </div>

        {/* Start shift form */}
        <form className="filter-row" onSubmit={startShift} style={{ marginBottom: 16 }}>
          <input name="name" placeholder="Tên ca làm" required />
          <input name="note" placeholder="Ghi chú" />
          <button className="small-button" type="submit">
            <Clock3 size={14} /> Bắt đầu ca
          </button>
        </form>

        {reportMsg && <p className="muted-cell" style={{ marginBottom: 12 }}>{reportMsg}</p>}

        {/* Report submission form (modal-like) */}
        {showReportForm && (
          <div className="panel" style={{ border: "1.5px solid var(--primary, #2563eb)", marginBottom: 16 }}>
            <div className="panel-heading">
              <div><p>Báo cáo ca</p><h2>Nộp báo cáo & bàn giao</h2></div>
              <ClipboardCheck size={20} />
            </div>
            <form className="stack-form" onSubmit={submitReport}>
              <label>
                Ghi chú bàn giao
                <textarea name="handoverNote" placeholder="Tổng hợp ca làm: xe ra/vào, sự cố..." rows={3} />
              </label>
              <label>
                Bàn giao cho (ID nhân viên, nếu có)
                <input name="handoverTo" placeholder="ID nhân viên tiếp ca" />
              </label>
              <div className="inline-actions">
                <button className="full-button" type="submit">
                  <FileText size={16} /> Nộp báo cáo
                </button>
                <button className="small-button" onClick={() => setShowReportForm(null)} type="button">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Shifts table */}
        <DataTable
          headers={["Ca", "Bắt đầu", "Kết thúc", "Trạng thái", "Báo cáo", "Thao tác"]}
          rows={displayShifts.map((item) => {
            const report = reportData[item.id];
            return [
              item.name,
              new Date(item.startAt).toString() === "Invalid Date"
                ? item.startAt
                : new Date(item.startAt).toLocaleString("vi-VN"),
              item.endAt ? new Date(item.endAt).toLocaleString("vi-VN") : "—",
              <span className={item.status === "Đang làm" ? "badge warning" : "badge success"} key={`${item.id}-st`}>
                {item.status}
              </span>,
              report ? (
                <span className="muted-cell" key={`${item.id}-rp`}>
                  {report.totalSessions} phiên · {currency.format(report.totalRevenue)} · {report.totalIncidents} SC
                </span>
              ) : (
                "—"
              ),
              <div className="inline-actions" key={item.id}>
                {item.status === "Đang làm" && shiftList.length > 0 && (
                  <>
                    <button className="small-button" onClick={() => endShift(item.id)} type="button">
                      Kết thúc
                    </button>
                    <button className="small-button" onClick={() => setShowReportForm(item.id)} type="button">
                      <FileText size={13} /> Báo cáo
                    </button>
                  </>
                )}
                {item.status === "Đã kết thúc" && !report && shiftList.length > 0 && (
                  <button className="small-button" onClick={() => setShowReportForm(item.id)} type="button">
                    <FileText size={13} /> Nộp BC
                  </button>
                )}
              </div>,
            ];
          })}
        />
      </div>
    </section>
  );
}
