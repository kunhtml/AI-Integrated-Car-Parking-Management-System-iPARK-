"use client";

import { ReceiptText, Settings } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { currency } from "@/lib/constants";
import { parkingConfig } from "@/lib/parking-config";

export function PricingView() {
  const { pricingConfigState, updatePricing } = useParkingApp();

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Admin</p>
            <h2>Cấu hình bảng giá</h2>
          </div>
          <Settings size={22} />
        </div>
        <form className="stack-form" key={pricingConfigState.updatedAt || pricingConfigState.id} onSubmit={updatePricing}>
          <label>
            Phút miễn phí
            <input defaultValue={pricingConfigState.freeMinutes} min={0} name="freeMinutes" required type="number" />
          </label>
          <label>
            Giá theo giờ
            <input defaultValue={pricingConfigState.hourlyRate} min={0} name="hourlyRate" required type="number" />
          </label>
          <label>
            Giá qua đêm
            <input defaultValue={pricingConfigState.overnightRate} min={0} name="overnightRate" required type="number" />
          </label>
          <label>
            Gói tháng
            <input defaultValue={pricingConfigState.monthlyRate} min={0} name="monthlyRate" required type="number" />
          </label>
          <label>
            Phạt quá hạn
            <input defaultValue={pricingConfigState.overdueFineRate} min={0} name="overdueFineRate" required type="number" />
          </label>
          <button className="full-button" type="submit">
            <Settings size={18} />
            Lưu bảng giá
          </button>
        </form>
      </div>
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Bảng giá hiện tại</p>
            <h2>Áp dụng khi checkout</h2>
          </div>
          <ReceiptText size={22} />
        </div>
        <DataTable
          headers={["Hạng mục", "Giá trị"]}
          rows={[
            ["Miễn phí đầu", `${pricingConfigState.freeMinutes} phút`],
            ["Theo giờ", currency.format(pricingConfigState.hourlyRate)],
            ["Qua đêm", currency.format(pricingConfigState.overnightRate)],
            ["Gói tháng", currency.format(pricingConfigState.monthlyRate)],
            ["Phạt quá hạn", currency.format(pricingConfigState.overdueFineRate)],
            ["Sức chứa", `${parkingConfig.totalCapacity} chỗ, khu A/B/C`],
          ]}
        />
      </div>
    </section>
  );
}
