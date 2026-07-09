"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Plus,
  Play,
  Square,
  UsersRound,
} from "lucide-react";
import { apiFetch } from "../../lib/client-api";
import { fallbackShifts, type ShiftItem } from "../../lib/mock-data";

function statusClasses(status: string) {
  if (status === "Đang làm") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Đã kết thúc") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function currentTimeValue() {
  return new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toShiftItem(input: Partial<ShiftItem> & { id: string }): ShiftItem {
  return {
    id: input.id,
    name: input.name || "Ca làm",
    staff: input.staff || "Chưa phân công",
    startAt: input.startAt || currentTimeValue(),
    endAt: input.endAt || "",
    status: input.status || "Đang làm",
    note: input.note || "Ca làm được tạo từ màn admin.",
  };
}

export default function ShiftsView() {
  const [shifts, setShifts] = useState<ShiftItem[]>(fallbackShifts());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadShifts() {
      try {
        const response = await apiFetch("/shifts");
        if (!response.ok || cancelled) {
          return;
        }

        const data = await response.json();
        if (!cancelled && Array.isArray(data.shifts)) {
          setShifts(data.shifts);
        }
      } catch {
        if (!cancelled) {
          setShifts(fallbackShifts());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadShifts();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const active = shifts.filter((shift) => shift.status === "Đang làm").length;
    const finished = shifts.filter((shift) => shift.status === "Đã kết thúc").length;
    return {
      total: shifts.length,
      active,
      finished,
      coverage: shifts.length ? Math.round((active / shifts.length) * 100) : 0,
    };
  }, [shifts]);

  async function handleCreateShift(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || "Ca làm mới").trim(),
      staff: String(form.get("staff") || "Chưa phân công").trim(),
      startAt: String(form.get("startAt") || currentTimeValue()).trim(),
      endAt: String(form.get("endAt") || "").trim(),
      note: String(form.get("note") || "").trim(),
    };

    const optimisticShift = toShiftItem({
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()),
      ...payload,
      status: "Đang làm",
    });

    setSavingId(optimisticShift.id);
    try {
      const response = await apiFetch("/shifts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.shift) {
          setShifts((items) => [data.shift, ...items]);
        } else {
          setShifts((items) => [optimisticShift, ...items]);
        }
      } else {
        setShifts((items) => [optimisticShift, ...items]);
      }
    } catch {
      setShifts((items) => [optimisticShift, ...items]);
    } finally {
      setSavingId(null);
      event.currentTarget.reset();
    }
  }

  async function handleEndShift(id: string) {
    setSavingId(id);
    try {
      const response = await apiFetch(`/shifts/${id}/end`, {
        method: "PATCH",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.shift) {
          setShifts((items) => items.map((item) => (item.id === id ? data.shift : item)));
          return;
        }
      }
    } catch {
      // Fall back to local state below.
    }

    setShifts((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "Đã kết thúc",
              endAt: item.endAt || currentTimeValue(),
            }
          : item,
      ),
    );
    setSavingId(null);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_35%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col gap-6 border-b border-slate-200/70 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                <CalendarDays className="h-3.5 w-3.5" />
                Admin flow
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Manage Work Shifts
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Quản lý ca làm việc cho đội ngũ admin và staff, theo dõi ca đang chạy,
                  tạo ca mới và kết thúc ca ngay trong một màn hình.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Về dashboard
              </Link>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                <Clock3 className="h-4 w-4" />
                {loading ? "Đang tải..." : "Sẵn sàng vận hành"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Tổng ca
              </p>
              <p className="mt-3 text-3xl font-black">{summary.total}</p>
            </div>
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Đang làm
              </p>
              <p className="mt-3 text-3xl font-black text-emerald-700">{summary.active}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Đã kết thúc
              </p>
              <p className="mt-3 text-3xl font-black">{summary.finished}</p>
            </div>
            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                Coverage
              </p>
              <p className="mt-3 text-3xl font-black text-blue-700">{summary.coverage}%</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_1.4fr]">
          <form
            onSubmit={handleCreateShift}
            className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)] backdrop-blur"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                  Tạo ca mới
                </p>
                <h2 className="mt-1 text-xl font-bold">Nhập thông tin ca làm</h2>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
                <Plus className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Tên ca
                </span>
                <input
                  name="name"
                  defaultValue="Ca mới"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Nhân viên phụ trách
                </span>
                <input
                  name="staff"
                  placeholder="nv.1@ipark.vn"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Bắt đầu
                  </span>
                  <input
                    name="startAt"
                    type="time"
                    defaultValue="06:00"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Kết thúc
                  </span>
                  <input
                    name="endAt"
                    type="time"
                    defaultValue="14:00"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Ghi chú
                </span>
                <textarea
                  name="note"
                  rows={4}
                  placeholder="Ví dụ: Ưu tiên xử lý cổng vào và hỗ trợ xe tháng."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </label>

              <button
                type="submit"
                disabled={savingId !== null}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Play className="h-4 w-4" />
                {savingId ? "Đang lưu..." : "Bắt đầu ca"}
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                  Danh sách ca
                </p>
                <h2 className="mt-1 text-xl font-bold">Quản lý làm việc theo thời gian thực</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
                <UsersRound className="h-4 w-4" />
                {shifts.length} ca
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {shifts.map((shift) => (
                <div key={shift.id} className="grid gap-4 px-6 py-5 lg:grid-cols-[1.2fr_1fr_0.8fr_auto] lg:items-center">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{shift.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{shift.note}</p>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p>
                      <span className="font-semibold text-slate-500">Staff:</span> {shift.staff}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">Thời gian:</span> {shift.startAt} - {shift.endAt || "..."}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                        shift.status,
                      )}`}
                    >
                      {shift.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => handleEndShift(shift.id)}
                      disabled={savingId === shift.id || shift.status === "Đã kết thúc"}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Square className="h-4 w-4" />
                      Kết thúc ca
                    </button>
                  </div>
                </div>
              ))}

              {!shifts.length ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">
                  Chưa có ca làm việc nào.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}