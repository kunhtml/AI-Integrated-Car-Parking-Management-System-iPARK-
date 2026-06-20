"use client";

import { FormEvent, useMemo, useState } from "react";
import { BarChart, CreditCard, PlusCircle, Save, UsersRound } from "lucide-react";

type PackageStatus = "Active" | "Draft" | "Paused";

type MembershipPackage = {
  id: string;
  name: string;
  code: string;
  billingCycle: "Daily" | "Monthly" | "Quarterly" | "Custom";
  price: number;
  durationDays: number;
  subscriberCount: number;
  renewalRate: number;
  status: PackageStatus;
  features: string[];
  note: string;
};

const initialPackages: MembershipPackage[] = [
  {
    id: "daily-commuter",
    name: "Daily Commuter",
    code: "DAILY-01",
    billingCycle: "Daily",
    price: 50000,
    durationDays: 1,
    subscriberCount: 124,
    renewalRate: 62,
    status: "Active",
    features: ["Daily package fallback", "Single-day validity", "Auto apply after payment"],
    note: "Aligned with BR-05 default daily package when no valid membership exists.",
  },
  {
    id: "business-flex",
    name: "Business Flex",
    code: "FLEX-02",
    billingCycle: "Monthly",
    price: 1200000,
    durationDays: 30,
    subscriberCount: 86,
    renewalRate: 78,
    status: "Active",
    features: ["Monthly parking", "Member vehicle benefits", "Renewal management"],
    note: "Supports FT-03 subscription management and UC05/UC06/UC28.",
  },
  {
    id: "premium-quarterly",
    name: "Premium Quarterly",
    code: "PREMIUM-03",
    billingCycle: "Quarterly",
    price: 3200000,
    durationDays: 90,
    subscriberCount: 37,
    renewalRate: 84,
    status: "Draft",
    features: ["Quarterly validity", "Priority member tier", "Corporate partner ready"],
    note: "Draft tier for Add Custom Tier flow in P-14.",
  },
];

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

export function MembershipPackagesView() {
  const [packages, setPackages] = useState<MembershipPackage[]>(initialPackages);
  const [selectedId, setSelectedId] = useState(initialPackages[0]?.id || "");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | PackageStatus>("All");
  const [message, setMessage] = useState<string | null>(null);

  const selectedPackage = packages.find((item) => item.id === selectedId) || packages[0];

  const filteredPackages = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return packages.filter((item) => {
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesQuery =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.code.toLowerCase().includes(keyword) ||
        item.billingCycle.toLowerCase().includes(keyword);
      return matchesStatus && matchesQuery;
    });
  }, [packages, query, statusFilter]);

  const summary = useMemo(() => {
    const active = packages.filter((item) => item.status === "Active");
    const subscribers = packages.reduce((sum, item) => sum + item.subscriberCount, 0);
    const revenue = packages.reduce((sum, item) => sum + item.price * item.subscriberCount, 0);
    const avgRenewal = packages.length
      ? Math.round(packages.reduce((sum, item) => sum + item.renewalRate, 0) / packages.length)
      : 0;

    return {
      activeCount: active.length,
      subscribers,
      revenue,
      avgRenewal,
    };
  }, [packages]);

  function handleCreatePlan() {
    const newPlan: MembershipPackage = {
      id: `custom-${Date.now()}`,
      name: "Custom Tier",
      code: `CUSTOM-${packages.length + 1}`,
      billingCycle: "Custom",
      price: 0,
      durationDays: 30,
      subscriberCount: 0,
      renewalRate: 0,
      status: "Draft",
      features: ["Custom feature"],
      note: "New tier created from UC28 Create New Plan flow.",
    };

    setPackages((items) => [newPlan, ...items]);
    setSelectedId(newPlan.id);
    setMessage("Đã tạo bản nháp gói thành viên mới.");
  }

  function updateSelected(changes: Partial<MembershipPackage>) {
    if (!selectedPackage) return;
    setPackages((items) => items.map((item) => (item.id === selectedPackage.id ? { ...item, ...changes } : item)));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Đã cập nhật package settings trên giao diện. UC28: Package settings are updated.");
  }

  return (
    <section className="bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">Parking Manager / System Admin</p>
            <h1 className="text-2xl font-bold text-slate-900">Manage Membership Packages</h1>
            <p className="mt-1 text-sm text-slate-500">UC28 - FT-03 Subscription Management - SC-28 Membership administration</p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            onClick={handleCreatePlan}
            type="button"
          >
            <PlusCircle size={16} />
            Create New Plan
          </button>
        </div>

        {message && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}

        <div className="grid gap-6 md:grid-cols-4">
          <SummaryTile icon={<CreditCard size={20} />} label="Active tiers" value={String(summary.activeCount)} />
          <SummaryTile icon={<UsersRound size={20} />} label="Subscribers" value={String(summary.subscribers)} />
          <SummaryTile icon={<BarChart size={20} />} label="Projected revenue" value={currency.format(summary.revenue)} />
          <SummaryTile icon={<CreditCard size={20} />} label="Avg renewal" value={`${summary.avgRenewal}%`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Tier Cards</h2>
                <p className="text-sm text-slate-500">Search and filter membership plans by name, code, cycle, or status.</p>
              </div>
              <div className="flex gap-2">
                <input
                  className="w-52 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search plans"
                  value={query}
                />
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) => setStatusFilter(event.target.value as "All" | PackageStatus)}
                  value={statusFilter}
                >
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                  <option value="Paused">Paused</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPackages.map((item) => (
                <button
                  className={`rounded-lg border p-4 text-left transition hover:border-blue-300 hover:shadow-sm ${
                    item.id === selectedPackage?.id ? "border-blue-500 bg-blue-50/50" : "border-slate-200 bg-white"
                  }`}
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  type="button"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{item.name}</h3>
                      <p className="text-xs text-slate-500">{item.code}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status}</span>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between">
                      <span>Cycle</span>
                      <strong className="text-slate-900">{item.billingCycle}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Price</span>
                      <strong className="text-slate-900">{currency.format(item.price)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Subscribers</span>
                      <strong className="text-slate-900">{item.subscriberCount}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Renewal</span>
                      <strong className="text-slate-900">{item.renewalRate}%</strong>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {filteredPackages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No membership package matches the current filter.</p>}
          </div>

          {selectedPackage && (
            <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
              <div className="mb-5 border-b border-slate-100 pb-4">
                <p className="text-sm text-slate-500">Package Settings</p>
                <h2 className="font-bold text-slate-900">Edit Selected Plan</h2>
              </div>
              <div className="space-y-4">
                <TextField label="Package name" onChange={(value) => updateSelected({ name: value })} value={selectedPackage.name} />
                <TextField label="Package code" onChange={(value) => updateSelected({ code: value })} value={selectedPackage.code} />
                <label className="block text-sm font-medium text-slate-700">
                  Billing cycle
                  <select
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    onChange={(event) => updateSelected({ billingCycle: event.target.value as MembershipPackage["billingCycle"] })}
                    value={selectedPackage.billingCycle}
                  >
                    <option value="Daily">Daily</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Custom">Custom</option>
                  </select>
                </label>
                <NumberField label="Price" onChange={(value) => updateSelected({ price: Number(value || 0) })} value={selectedPackage.price} />
                <NumberField label="Duration days" onChange={(value) => updateSelected({ durationDays: Number(value || 0) })} value={selectedPackage.durationDays} />
                <NumberField label="Renewal rate (%)" max={100} onChange={(value) => updateSelected({ renewalRate: Number(value || 0) })} value={selectedPackage.renewalRate} />
                <label className="block text-sm font-medium text-slate-700">
                  Status
                  <select
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    onChange={(event) => updateSelected({ status: event.target.value as PackageStatus })}
                    value={selectedPackage.status}
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Paused">Paused</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Feature list
                  <textarea
                    className="mt-1 min-h-[92px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    onChange={(event) => updateSelected({ features: event.target.value.split("\n").filter(Boolean) })}
                    value={selectedPackage.features.join("\n")}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Administration note
                  <textarea
                    className="mt-1 min-h-[72px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    onChange={(event) => updateSelected({ note: event.target.value })}
                    value={selectedPackage.note}
                  />
                </label>
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700" type="submit">
                  <Save size={16} />
                  Save Package Settings
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Performance Chart</h2>
                <p className="text-sm text-slate-500">Subscriber count by membership tier.</p>
              </div>
              <BarChart className="text-blue-600" size={22} />
            </div>
            <div className="grid h-56 grid-cols-3 items-end gap-4">
              {packages.slice(0, 3).map((item) => {
                const height = Math.max(8, Math.min(100, item.subscriberCount));
                return (
                  <div className="flex h-full flex-col items-center justify-end" key={item.id}>
                    <div className="w-16 rounded-t bg-blue-100" style={{ height: `${height}%` }} />
                    <span className="mt-2 text-xs font-semibold text-slate-700">{item.code}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900">Insights</h2>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">
                Forecast: renewals may increase by 14.2% if Business Flex remains active this month.
              </p>
              <p className="rounded-md bg-blue-50 p-3 text-blue-700">
                BR-03: subscription time starts immediately after successful registration/payment.
              </p>
              <p className="rounded-md bg-amber-50 p-3 text-amber-700">
                Empty/error states should be handled when billing gateway or database sync fails.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function SummaryTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600">{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <strong className="text-xl text-slate-900">{value}</strong>
      </div>
    </div>
  );
}

function TextField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function NumberField({
  label,
  max,
  onChange,
  value,
}: {
  label: string;
  max?: number;
  onChange: (value: string) => void;
  value: number;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        max={max}
        min={0}
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
    </label>
  );
}

function statusClass(status: PackageStatus) {
  if (status === "Active") return "bg-emerald-50 text-emerald-700";
  if (status === "Draft") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}
