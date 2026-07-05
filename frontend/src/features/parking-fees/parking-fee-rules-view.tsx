"use client";

import { FormEvent, useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { apiFetch } from "@/lib/api";

type PricingConfigState = {
  freeMinutes: number;
  hourlyRate: number;
  overnightRate: number;
  dayStartHour: number;
  nightStartHour: number;
  monthlyRate: number;
  overdueFineRate: number;
  dailyMaxRate: number;
  graceExitMinutes: number;
  effectiveFrom: string;
  isActive: boolean;
};

const defaultConfig: PricingConfigState = {
  freeMinutes: 20,
  hourlyRate: 5000,
  overnightRate: 10000,
  dayStartHour: 6,
  nightStartHour: 22,
  monthlyRate: 1200000,
  overdueFineRate: 50000,
  dailyMaxRate: 120000,
  graceExitMinutes: 10,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  isActive: true,
};

export function ParkingFeeRulesView() {
  const [activeTab, setActiveTab] = useState<"price" | "fine" | "template">("price");
  const [config, setConfig] = useState<PricingConfigState>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadConfig() {
      try {
        const response = await apiFetch("/pricing");
        const data = await response.json().catch(() => ({}));
        if (mounted && response.ok && data.pricingConfig) {
          const cfg = data.pricingConfig;
          setConfig({
            freeMinutes: cfg.freeMinutes ?? defaultConfig.freeMinutes,
            hourlyRate: cfg.hourlyRate ?? defaultConfig.hourlyRate,
            overnightRate: cfg.overnightRate ?? defaultConfig.overnightRate,
            dayStartHour: cfg.dayStartHour ?? defaultConfig.dayStartHour,
            nightStartHour: cfg.nightStartHour ?? defaultConfig.nightStartHour,
            monthlyRate: cfg.monthlyRate ?? defaultConfig.monthlyRate,
            overdueFineRate: cfg.overdueFineRate ?? defaultConfig.overdueFineRate,
            dailyMaxRate: cfg.dailyMaxRate ?? defaultConfig.dailyMaxRate,
            graceExitMinutes: cfg.graceExitMinutes ?? defaultConfig.graceExitMinutes,
            effectiveFrom: cfg.effectiveFrom
              ? new Date(cfg.effectiveFrom).toISOString().slice(0, 10)
              : defaultConfig.effectiveFrom,
            isActive: Boolean(cfg.isActive),
          });
        }
      } catch {
        if (mounted) setConfig(defaultConfig);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadConfig();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      const response = await apiFetch("/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setMessage(data.message || "Đã lưu bảng giá thành công.");
        if (data.pricingConfig) {
          const cfg = data.pricingConfig;
          setConfig((current) => ({
            ...current,
            ...cfg,
          }));
        }
      } else {
        setMessage(data.message || "Không lưu được bảng giá.");
      }
    } catch {
      setMessage("Không kết nối được máy chủ API.");
    } finally {
      setSaving(false);
    }
  }

  const formattedDayRate = new Intl.NumberFormat("vi-VN").format(config.hourlyRate) + " đ/ngày";
  const formattedNightRate = new Intl.NumberFormat("vi-VN").format(config.overnightRate) + " đ/ngày";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-medium text-slate-400">Admin</p>
          <h1 className="text-xl font-bold text-slate-900">Cấu hình hệ thống</h1>
        </div>
        <Settings className="text-slate-400" size={22} />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-2">
        <button
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "price"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          onClick={() => setActiveTab("price")}
          type="button"
        >
          Bảng giá
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "fine"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          onClick={() => setActiveTab("fine")}
          type="button"
        >
          Giá phạt
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "template"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          onClick={() => setActiveTab("template")}
          type="button"
        >
          Mẫu thông báo
        </button>
      </div>

      {message && (
        <div className="mb-6 rounded-md bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700">
          {message}
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Đang tải cấu hình hệ thống...</p>
      ) : activeTab === "price" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Form Left */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <h2 className="text-base font-bold text-slate-900">Bảng giá khách vãng lai</h2>
              <p className="mt-1 text-xs text-slate-400">
                Phí tính theo giờ ra trong ngày: trong khung ngày áp giá ngày, ngoài khung áp giá đêm.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Giá ban ngày (VND/ngày)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  min={0}
                  onChange={(e) => setConfig({ ...config, hourlyRate: Number(e.target.value) })}
                  type="number"
                  value={config.hourlyRate}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Giá ban đêm (VND/ngày)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  min={0}
                  onChange={(e) => setConfig({ ...config, overnightRate: Number(e.target.value) })}
                  type="number"
                  value={config.overnightRate}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Giờ bắt đầu ngày (0-23)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  max={23}
                  min={0}
                  onChange={(e) => setConfig({ ...config, dayStartHour: Number(e.target.value) })}
                  type="number"
                  value={config.dayStartHour}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Giờ bắt đầu đêm (0-23)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  max={23}
                  min={0}
                  onChange={(e) => setConfig({ ...config, nightStartHour: Number(e.target.value) })}
                  type="number"
                  value={config.nightStartHour}
                />
              </div>
            </div>

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              disabled={saving}
              type="submit"
            >
              <Settings size={16} />
              {saving ? "Đang lưu..." : "Lưu bảng giá"}
            </button>
          </form>

          {/* Table Right */}
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-4">Bảng giá hiện tại</h2>
            <div className="overflow-hidden rounded-lg border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                    <th className="py-3 px-4">HẠNG MỤC</th>
                    <th className="py-3 px-4">GIÁ TRỊ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3.5 px-4 font-medium text-slate-700">Khung ngày</td>
                    <td className="py-3.5 px-4 text-slate-600">{config.dayStartHour}h - {config.nightStartHour}h</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-medium text-slate-700">Giá ban ngày</td>
                    <td className="py-3.5 px-4 text-slate-600">{formattedDayRate}</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-medium text-slate-700">Giá ban đêm</td>
                    <td className="py-3.5 px-4 text-slate-600">{formattedNightRate}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "fine" ? (
        <form className="max-w-xl space-y-5" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-base font-bold text-slate-900">Cấu hình giá phạt & Phụ phí</h2>
            <p className="mt-1 text-xs text-slate-400">Điều chỉnh mức phạt quá hạn và các mốc thời gian miễn phí.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mức phạt quá hạn (VND)</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                min={0}
                onChange={(e) => setConfig({ ...config, overdueFineRate: Number(e.target.value) })}
                type="number"
                value={config.overdueFineRate}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Số phút miễn phí ban đầu</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                min={0}
                onChange={(e) => setConfig({ ...config, freeMinutes: Number(e.target.value) })}
                type="number"
                value={config.freeMinutes}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Trần phí ngày (VND)</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                min={0}
                onChange={(e) => setConfig({ ...config, dailyMaxRate: Number(e.target.value) })}
                type="number"
                value={config.dailyMaxRate}
              />
            </div>
          </div>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            disabled={saving}
            type="submit"
          >
            <Settings size={16} />
            {saving ? "Đang lưu..." : "Lưu giá phạt"}
          </button>
        </form>
      ) : (
        <div className="py-12 text-center text-sm text-slate-400">
          Chưa có mẫu thông báo nào được cấu hình.
        </div>
      )}
    </div>
  );
}
