"use client";

import { FormEvent, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  Clock,
  Cpu,
  CreditCard,
  FileText,
  Play,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type ProcessResult = {
  totalMinutes: number;
  freeMinutes: number;
  billableMinutes: number;
  billableHours: number;
  dayHours: number;
  nightHours: number;
  hourlyRate: number;
  overnightRate: number;
  baseParkingFee: number;
  dailyMaxCapApplied: boolean;
  parkingFee: number;
  packageValid: boolean;
  packageName?: string;
  packageExpiry?: string;
  packageDiscount: number;
  overdueMinutes: number;
  overdueFine: number;
  fineReason?: string;
  fineRulesApplied: string[];
  totalFee: number;
  processLogs: string[];
};

export function SystemProcessView() {
  const [plate, setPlate] = useState("30A-888.88");
  
  // Default check-in 3 hours ago, check-out now
  const now = new Date();
  const defaultCheckIn = new Date(now.getTime() - 3.5 * 3600000).toISOString().slice(0, 16);
  const defaultCheckOut = now.toISOString().slice(0, 16);

  const [checkInTime, setCheckInTime] = useState(defaultCheckIn);
  const [checkOutTime, setCheckOutTime] = useState(defaultCheckOut);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRunProcess(e?: FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiFetch("/pricing/auto-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate: plate.trim(),
          checkInAt: new Date(checkInTime).toISOString(),
          checkOutAt: new Date(checkOutTime).toISOString(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.result) {
        setResult(data.result);
      } else {
        setError(data.message || "Không thể thực hiện quy trình tự động.");
      }
    } catch {
      setError("Lỗi kết nối máy chủ API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Cpu size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Automated System Process</p>
              <h1 className="text-xl font-bold text-slate-900">Quy Trình Xử Lý Tự Động</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 size={14} /> Hệ thống sẵn sàng
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          Hệ thống tự động thực hiện 3 quy trình cốt lõi khi gửi/trả xe:
          <strong className="text-slate-900 font-semibold"> (1) Auto Validate Parking Package</strong>,
          <strong className="text-slate-900 font-semibold"> (2) Auto Calculate Parking Fee</strong>, và
          <strong className="text-slate-900 font-semibold"> (3) Auto Apply Fine Rules</strong>.
        </p>
      </div>

      {/* 3 Process Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <BadgeCheck size={20} />
            </div>
            <h2 className="text-sm font-bold text-slate-900">1. Auto Validate Package</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tự động tra cứu biển số trong DB, kiểm tra thời hạn gói đỗ xe tháng/VIP và tự động miễn phí gửi xe nếu gói hợp lệ.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Calculator size={20} />
            </div>
            <h2 className="text-sm font-bold text-slate-900">2. Auto Calculate Fee</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tự động tính phí theo khung giờ Ban Ngày / Ban Đêm, trừ phút miễn phí ban đầu và áp dụng trần phí ngày tối đa.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ShieldAlert size={20} />
            </div>
            <h2 className="text-sm font-bold text-slate-900">3. Auto Apply Fine Rules</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tự động phát hiện vi phạm thời gian đỗ quá hạn 24h hoặc quá giờ ra cổng sau khi thanh toán để áp dụng mức phạt.
          </p>
        </div>
      </div>

      {/* Interactive Simulation Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Sparkles className="text-blue-600" size={18} />
          Mô phỏng Quy Trình Tự Động Real-time
        </h2>

        <form className="grid gap-4 sm:grid-cols-3" onSubmit={handleRunProcess}>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Biển số xe</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(e) => setPlate(e.target.value)}
              placeholder="VD: 30A-123.45"
              required
              type="text"
              value={plate}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Thời gian vào (Check-in)</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(e) => setCheckInTime(e.target.value)}
              required
              type="datetime-local"
              value={checkInTime}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Thời gian ra (Check-out)</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(e) => setCheckOutTime(e.target.value)}
              required
              type="datetime-local"
              value={checkOutTime}
            />
          </div>

          <div className="sm:col-span-3 flex justify-end gap-3 pt-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
              type="submit"
            >
              <Play size={16} />
              {loading ? "Đang xử lý tự động..." : "Kích Hoạt Quy Trình Tự Động"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Process Execution Output */}
      {result && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Card 1: Package Validation Status */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="text-xs font-bold uppercase text-slate-400">1. Package Validation</span>
              {result.packageValid ? (
                <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                  Hợp lệ
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  Không áp dụng
                </span>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Trạng thái gói:</span>
                <strong className="text-slate-900">{result.packageValid ? "Đang hoạt động" : "Không có gói"}</strong>
              </div>
              {result.packageValid && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tên gói:</span>
                    <strong className="text-purple-700">{result.packageName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ngày hết hạn:</span>
                    <span className="text-slate-700">{result.packageExpiry}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Miễn trừ phí:</span>
                    <strong className="text-emerald-600">-{result.packageDiscount.toLocaleString("vi-VN")} đ</strong>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Card 2: Fee Calculation Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="text-xs font-bold uppercase text-slate-400">2. Fee Breakdown</span>
              <span className="text-xs font-semibold text-blue-600">{result.totalMinutes} phút đỗ</span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Phút miễn phí:</span>
                <span className="text-slate-700">{result.freeMinutes} phút</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Giờ ban ngày ({result.dayHours}h):</span>
                <span className="text-slate-700">{(result.dayHours * result.hourlyRate).toLocaleString("vi-VN")} đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Giờ ban đêm ({result.nightHours}h):</span>
                <span className="text-slate-700">{(result.nightHours * result.overnightRate).toLocaleString("vi-VN")} đ</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
                <span className="text-slate-700">Tiền đỗ xe tính toán:</span>
                <span className="text-slate-900">{result.parkingFee.toLocaleString("vi-VN")} đ</span>
              </div>
            </div>
          </div>

          {/* Card 3: Fine Rules Application */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="text-xs font-bold uppercase text-slate-400">3. Fine Rules</span>
              {result.overdueFine > 0 ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                  Có vi phạm
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  Không vi phạm
                </span>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Phút quá hạn (&gt;24h):</span>
                <span className="text-slate-700">{result.overdueMinutes} phút</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phí phạt tự động:</span>
                <strong className={result.overdueFine > 0 ? "text-amber-600" : "text-slate-700"}>
                  {result.overdueFine.toLocaleString("vi-VN")} đ
                </strong>
              </div>
              {result.fineReason && (
                <div className="rounded bg-amber-50 p-2 text-xs text-amber-800">
                  {result.fineReason}
                </div>
              )}
            </div>
          </div>

          {/* Process Execution Audit Logs */}
          <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
                <FileText size={16} /> Audit Log Nhật Ký Xử Lý Tự Động
              </span>
              <span className="text-lg font-bold text-emerald-400">
                Tổng thanh toán: {result.totalFee.toLocaleString("vi-VN")} đ
              </span>
            </div>

            <div className="font-mono text-xs space-y-2 leading-relaxed text-slate-300">
              {result.processLogs.map((log, index) => (
                <div className="flex items-start gap-2" key={index}>
                  <span className="text-blue-400 font-bold select-none">&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
