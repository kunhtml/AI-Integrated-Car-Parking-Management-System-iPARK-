"use client";

import { FormEvent, useMemo, useState } from "react";
import { CreditCard, ParkingCircle, Save } from "lucide-react";

type FeeRuleForm = {
  freeMinutes: number;
  hourlyRate: number;
  overnightRate: number;
  monthlyRate: number;
  overdueFineRate: number;
  dailyMaxRate: number;
  graceExitMinutes: number;
  effectiveFrom: string;
  isActive: boolean;
};

const defaultRules: FeeRuleForm = {
  freeMinutes: 20,
  hourlyRate: 0,
  overnightRate: 0,
  monthlyRate: 0,
  overdueFineRate: 0,
  dailyMaxRate: 0,
  graceExitMinutes: 10,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  isActive: true,
};

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

export function ParkingFeeRulesView() {
  const [rules, setRules] = useState<FeeRuleForm>(defaultRules);
  const [message, setMessage] = useState<string | null>(null);

  const previewItems = useMemo(
    () => [
      { label: "Miễn phí ban đầu", value: `${rules.freeMinutes} phút` },
      { label: "Phí theo giờ", value: currency.format(rules.hourlyRate) },
      { label: "Phí qua đêm", value: currency.format(rules.overnightRate) },
      { label: "Gói tháng", value: currency.format(rules.monthlyRate) },
      { label: "Phạt quá hạn", value: currency.format(rules.overdueFineRate) },
      { label: "Trần phí ngày", value: currency.format(rules.dailyMaxRate) },
    ],
    [rules],
  );

  function updateNumber(field: keyof FeeRuleForm, value: string) {
    setRules((current) => ({
      ...current,
      [field]: Math.max(0, Number(value || 0)),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Đã lưu cấu hình phí trên giao diện. Backend sẽ được nối ở bước sau.");
  }

  return (
    <section className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-6xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm text-slate-500">Admin</p>
            <h1 className="text-2xl font-bold text-slate-900">Configure Parking Fee Rules</h1>
          </div>
          <CreditCard className="text-blue-600" size={24} />
        </div>

        {message && <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <NumberField
                label="Số phút miễn phí"
                min={0}
                onChange={(value) => updateNumber("freeMinutes", value)}
                suffix="phút"
                value={rules.freeMinutes}
              />
              <NumberField
                label="Thời gian miễn phí khi ra cổng"
                min={0}
                onChange={(value) => updateNumber("graceExitMinutes", value)}
                suffix="phút"
                value={rules.graceExitMinutes}
              />
              <NumberField
                label="Phí gửi theo giờ"
                min={0}
                onChange={(value) => updateNumber("hourlyRate", value)}
                suffix="VND"
                value={rules.hourlyRate}
              />
              <NumberField
                label="Phí gửi qua đêm"
                min={0}
                onChange={(value) => updateNumber("overnightRate", value)}
                suffix="VND"
                value={rules.overnightRate}
              />
              <NumberField
                label="Gói gửi xe tháng"
                min={0}
                onChange={(value) => updateNumber("monthlyRate", value)}
                suffix="VND"
                value={rules.monthlyRate}
              />
              <NumberField
                label="Phí phạt quá hạn"
                min={0}
                onChange={(value) => updateNumber("overdueFineRate", value)}
                suffix="VND"
                value={rules.overdueFineRate}
              />
              <NumberField
                label="Trần phí trong ngày"
                min={0}
                onChange={(value) => updateNumber("dailyMaxRate", value)}
                suffix="VND"
                value={rules.dailyMaxRate}
              />
              <label className="block text-sm font-medium text-slate-700">
                Ngày áp dụng
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setRules((current) => ({ ...current, effectiveFrom: event.target.value }))}
                  type="date"
                  value={rules.effectiveFrom}
                />
              </label>
            </div>

            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-slate-900">Kích hoạt bộ quy tắc này</span>
                <span className="block text-xs text-slate-500">Chỉ bộ quy tắc đang hoạt động mới được dùng để tính phí.</span>
              </span>
              <input
                checked={rules.isActive}
                className="h-5 w-5 accent-blue-600"
                onChange={(event) => setRules((current) => ({ ...current, isActive: event.target.checked }))}
                type="checkbox"
              />
            </label>

            <div className="flex justify-end">
              <button
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                type="submit"
              >
                <Save size={16} />
                Lưu cấu hình
              </button>
            </div>
          </form>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <ParkingCircle size={20} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Preview</h2>
                <p className="text-xs text-slate-500">Tóm tắt cấu hình hiện tại</p>
              </div>
            </div>

            <div className="space-y-3">
              {previewItems.map((item) => (
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-0" key={item.label}>
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <strong className="text-sm text-slate-900">{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-md bg-white p-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Trạng thái: </span>
              {rules.isActive ? "Đang hoạt động" : "Tạm tắt"} từ ngày {rules.effectiveFrom || "chưa chọn"}.
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function NumberField({
  label,
  min,
  onChange,
  suffix,
  value,
}: {
  label: string;
  min: number;
  onChange: (value: string) => void;
  suffix: string;
  value: number;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <div className="mt-1 flex rounded-md border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <input
          className="min-w-0 flex-1 rounded-l-md px-3 py-2 text-sm outline-none"
          min={min}
          onChange={(event) => onChange(event.target.value)}
          type="number"
          value={value}
        />
        <span className="flex items-center border-l border-slate-200 px-3 text-xs font-semibold text-slate-500">{suffix}</span>
      </div>
    </label>
  );
}
