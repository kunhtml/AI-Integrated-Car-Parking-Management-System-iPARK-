"use client";

import { BarChart3, Car, CreditCard, FileDown, ParkingCircle, ReceiptText, RefreshCcw } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { Metric } from "@/components/ui/metric";
import { useParkingApp } from "@/context/parking-app-context";
import { currency } from "@/lib/constants";

export function ReportsView() {
  const {
    stats,
    reportFrom,
    setReportFrom,
    reportTo,
    setReportTo,
    reportSummary,
    loadReportSummary,
    downloadReport,
  } = useParkingApp();

  return (
    <section className="dashboard">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Báo cáo</p>
            <h2>Doanh thu và lượt xe</h2>
          </div>
          <FileDown size={22} />
        </div>
        <div className="report-filters">
          <label>
            Từ ngày
            <input onChange={(event) => setReportFrom(event.target.value)} type="date" value={reportFrom} />
          </label>
          <label>
            Đến ngày
            <input onChange={(event) => setReportTo(event.target.value)} type="date" value={reportTo} />
          </label>
        </div>
        <div className="action-grid">
          <button onClick={() => loadReportSummary(reportFrom, reportTo)} type="button">
            <RefreshCcw size={18} />
            Tải lại
          </button>
          <button onClick={() => downloadReport("sessions")} type="button">
            <FileDown size={18} />
            Phiên đỗ xe
          </button>
          <button onClick={() => downloadReport("revenue")} type="button">
            <FileDown size={18} />
            Doanh thu
          </button>
          <button onClick={() => downloadReport("revenue", "pdf")} type="button">
            <FileDown size={18} />
            PDF
          </button>
        </div>
      </div>
      <div className="metric-grid">
        <Metric icon={<Car />} label="Xe vào" value={String(reportSummary?.entryCount ?? 0)} />
        <Metric icon={<ReceiptText />} label="Xe ra" value={String(reportSummary?.exitCount ?? 0)} />
        <Metric icon={<ParkingCircle />} label="Đang gửi" value={String(reportSummary?.activeCount ?? stats.active)} />
        <Metric icon={<CreditCard />} label="Doanh thu" value={currency.format(reportSummary?.revenue ?? 0)} />
      </div>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Chi tiết</p>
            <h2>Phiên miễn phí và có phí</h2>
          </div>
          <BarChart3 size={22} />
        </div>
        <DataTable
          headers={["Khoảng ngày", "Phiên miễn phí", "Phiên có phí", "Tổng phiên ra", "Doanh thu"]}
          rows={[
            [
              reportSummary ? `${reportSummary.from} - ${reportSummary.to}` : `${reportFrom} - ${reportTo}`,
              String(reportSummary?.freeSessionCount ?? 0),
              String(reportSummary?.paidSessionCount ?? 0),
              String(reportSummary?.exitCount ?? 0),
              currency.format(reportSummary?.revenue ?? 0),
            ],
          ]}
        />
      </div>
    </section>
  );
}
