"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CreditCard, Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

type BillingCycle = "Monthly" | "Quarterly" | "Yearly";
type PackageStatus = "Active" | "Draft" | "Paused";

type MembershipPackage = {
  id: string;
  name: string;
  code: string;
  billingCycle: BillingCycle;
  price: number;
  durationDays: number;
  maxPlates: number;
  subscriberCount: number;
  renewalRate: number;
  status: PackageStatus;
  features: string[];
  note: string;
  createdAt?: string;
};

type PackageForm = {
  name: string;
  note: string;
  billingCycle: BillingCycle;
  durationDays: number;
  price: number;
  maxPlates: number;
};

const emptyForm: PackageForm = {
  name: "",
  note: "",
  billingCycle: "Monthly",
  durationDays: 30,
  price: 0,
  maxPlates: -1,
};

const cycleLabels: Record<BillingCycle, string> = {
  Monthly: "Tháng",
  Quarterly: "Quý",
  Yearly: "Năm",
};

const cycleDays: Record<BillingCycle, number> = {
  Monthly: 30,
  Quarterly: 90,
  Yearly: 365,
};

const currency = new Intl.NumberFormat("vi-VN");

export function MembershipPackagesView() {
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadPackages() {
      try {
        const response = await apiFetch("/membership-packages");
        const data = await response.json().catch(() => ({}));
        if (mounted && response.ok) {
          setPackages(data.packages || []);
        }
      } catch {
        if (mounted) setPackages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPackages();
    return () => {
      mounted = false;
    };
  }, []);

  const sortedPackages = useMemo(
    () =>
      [...packages].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }),
    [packages],
  );

  function updateCycle(nextCycle: BillingCycle) {
    setForm((current) => ({
      ...current,
      billingCycle: nextCycle,
      durationDays: cycleDays[nextCycle],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    const code = `${form.billingCycle.toUpperCase()}-${Date.now().toString().slice(-5)}`;
    const payload = {
      name: form.name.trim(),
      code,
      billingCycle: form.billingCycle,
      price: form.price,
      durationDays: form.durationDays,
      maxPlates: form.maxPlates,
      subscriberCount: 0,
      renewalRate: 0,
      status: "Active" as PackageStatus,
      features: [
        form.maxPlates < 0 ? "Không giới hạn biển số" : `Tối đa ${form.maxPlates} biển số`,
        `${form.durationDays} ngày`,
      ],
      note: form.note.trim(),
    };

    try {
      const response = await apiFetch("/membership-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.message || "Không tạo được gói đăng ký.");
        return;
      }

      setPackages((items) => [data.package || { id: code, ...payload }, ...items]);
      setForm(emptyForm);
      setFormOpen(false);
      setMessage(data.message || "Đã tạo gói đăng ký.");
    } catch {
      setPackages((items) => [{ id: code, ...payload }, ...items]);
      setForm(emptyForm);
      setFormOpen(false);
      setMessage("Đã tạo gói tạm trên giao diện vì chưa kết nối được API.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-slate-50 px-6 py-8">
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Quản lý</p>
              <div className="mt-2 flex items-center gap-2">
                <CreditCard size={18} />
                <h2 className="text-lg font-bold text-slate-950">Tạo gói mới</h2>
              </div>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              onClick={() => setFormOpen((open) => !open)}
              type="button"
            >
              {formOpen ? <X size={16} /> : <Plus size={16} />}
              {formOpen ? "Đóng" : "Tạo gói"}
            </button>
          </div>

          {formOpen && (
            <form className="rounded-lg border border-slate-200 bg-slate-50 p-5" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <TextInput
                  label="Tên gói"
                  onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                  placeholder="VD: Gói tháng VIP"
                  required
                  value={form.name}
                />
                <TextInput
                  label="Mô tả"
                  onChange={(value) => setForm((current) => ({ ...current, note: value }))}
                  placeholder="VD: Gửi xe không giới hạn"
                  value={form.note}
                />

                <label className="block text-sm font-semibold text-slate-900">
                  Loại
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    onChange={(event) => updateCycle(event.target.value as BillingCycle)}
                    value={form.billingCycle}
                  >
                    <option value="Monthly">Tháng</option>
                    <option value="Quarterly">Quý</option>
                    <option value="Yearly">Năm</option>
                  </select>
                </label>

                <NumberInput
                  label="Số ngày"
                  onChange={(value) => setForm((current) => ({ ...current, durationDays: Number(value || 0) }))}
                  required
                  value={form.durationDays}
                />
                <NumberInput
                  label="Giá (VND)"
                  min={0}
                  onChange={(value) => setForm((current) => ({ ...current, price: Number(value || 0) }))}
                  required
                  value={form.price}
                />
                <NumberInput
                  label="Số biển số tối đa"
                  min={-1}
                  onChange={(value) => setForm((current) => ({ ...current, maxPlates: Number(value || 0) }))}
                  value={form.maxPlates}
                />
                <p className="text-xs text-slate-700">Để -1 nếu không giới hạn biển số.</p>

                <button
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                  disabled={saving}
                  type="submit"
                >
                  <CreditCard size={16} />
                  {saving ? "Đang tạo..." : "Tạo gói"}
                </button>
              </div>
            </form>
          )}
        </aside>

        <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Đăng ký</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">Tất cả gói đăng kí</h2>
            </div>
            <span className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600">
              {packages.length} gói
            </span>
          </div>

          {message && <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}
          {loading && <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Đang tải gói đăng ký...</p>}

          {sortedPackages.length === 0 ? (
            <div className="flex min-h-[150px] flex-col items-center justify-center text-center">
              <CreditCard className="mb-5 text-slate-400" size={34} />
              <p className="text-sm text-slate-950">Chưa có đăng ký nào.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                    <th className="py-3 pr-4">Gói</th>
                    <th className="py-3 pr-4">Loại</th>
                    <th className="py-3 pr-4">Số ngày</th>
                    <th className="py-3 pr-4">Giá</th>
                    <th className="py-3 pr-4">Biển số tối đa</th>
                    <th className="py-3 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPackages.map((item) => (
                    <tr className="border-b border-slate-100 last:border-0" key={item.id}>
                      <td className="py-3 pr-4">
                        <strong className="text-slate-950">{item.name}</strong>
                        <p className="mt-1 text-xs text-slate-500">{item.note || item.code}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{cycleLabels[item.billingCycle] || item.billingCycle}</td>
                      <td className="py-3 pr-4 text-slate-700">{item.durationDays}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-950">{currency.format(item.price)} đ</td>
                      <td className="py-3 pr-4 text-slate-700">{item.maxPlates < 0 ? "Không giới hạn" : item.maxPlates}</td>
                      <td className="py-3 text-right">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {statusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function TextInput({
  label,
  onChange,
  placeholder,
  required,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-900">
      {label}
      {required && <span className="mt-1 block">*</span>}
      <input
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={value}
      />
    </label>
  );
}

function NumberInput({
  label,
  min,
  onChange,
  required,
  value,
}: {
  label: string;
  min?: number;
  onChange: (value: string) => void;
  required?: boolean;
  value: number;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-900">
      {label}
      {required && <span className="mt-1 block">*</span>}
      <input
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        min={min}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type="number"
        value={value}
      />
    </label>
  );
}

function statusLabel(status: PackageStatus) {
  if (status === "Active") return "Đã bật";
  if (status === "Paused") return "Tạm dừng";
  return "Bản nháp";
}
