"use client";

import { Bot, ScanLine, Upload } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { aiQueue } from "@/lib/mock-data";

export function AiView() {
  const { simulateAction } = useParkingApp();

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>AI nhận dạng</p>
            <h2>Tải ảnh xe lên</h2>
          </div>
          <Bot size={22} />
        </div>
        <div className="upload-box">
          <Upload size={28} />
          <span>Upload ảnh xe vào/ra để mô phỏng nhận dạng biển số</span>
          <button onClick={() => simulateAction("AI thật đang chạy qua upload ảnh xe ở module Phiên đỗ xe.")} type="button">
            Chạy nhận dạng
          </button>
        </div>
      </div>
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Queue</p>
            <h2>Biển số, loại xe, màu xe, lỗi nhận dạng</h2>
          </div>
          <ScanLine size={22} />
        </div>
        <DataTable
          headers={["Biển số", "Tin cậy", "Loại xe", "Màu", "Tình trạng"]}
          rows={aiQueue.map((item) => [item.plate, item.confidence, item.type, item.color, item.issue])}
        />
      </div>
    </section>
  );
}
