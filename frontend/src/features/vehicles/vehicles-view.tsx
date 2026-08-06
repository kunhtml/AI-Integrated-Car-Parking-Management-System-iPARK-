"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Car,
  CheckCircle2,
  CreditCard,
  Loader2,
  Search,
  ShieldAlert,
  TicketCheck,
} from "lucide-react";
import { apiFetch } from "../../lib/client-api";

type VehicleStatus = "verified" | "pending" | "blacklist";

type VehicleRecord = {
  id: string;
  plate: string;
  ownerName: string;
  ownerPhone?: string;
  brand?: string;
  model?: string;
  color?: string;
  status: VehicleStatus;
  verifiedAt?: string;
  verificationNote?: string;
};

type GuestRfidCard = {
  id: string;
  code: string;
  plate: string;
  guestName: string;
  phone?: string;
  issuedAt: string;
  expiresAt: string;
  status: "active" | "returned";
  note?: string;
};

type VerificationResult = {
  plate: string;
  verified: boolean;
  status: VehicleStatus | "not_found";
  vehicle: VehicleRecord | null;
  activeGuestCard: GuestRfidCard | null;
  message: string;
};

const fallbackVehicles: VehicleRecord[] = [
  {
    id: "local-veh-001",
    plate: "30H67890",
    ownerName: "Nguyen Van A",
    ownerPhone: "0912345678",
    brand: "Toyota",
    model: "Vios",
    color: "White",
    status: "verified",
    verifiedAt: new Date().toISOString(),
    verificationNote: "Local fallback record.",
  },
  {
    id: "local-veh-002",
    plate: "30E34567",
    ownerName: "Tran Thi B",
    ownerPhone: "0987654321",
    brand: "Honda",
    model: "City",
    color: "Silver",
    status: "pending",
  },
];

const fallbackCards: GuestRfidCard[] = [
  {
    id: "local-card-001",
    code: "RFID-GUEST-1001",
    plate: "30H67890",
    guestName: "Le Minh",
    phone: "0900111222",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    status: "active",
    note: "Local fallback card.",
  },
];

function normalizePlate(value: string) {
  return value.trim().toUpperCase().replace(/[\s.-]+/g, "");
}

function formatDateTime(value?: string) {
  if (!value) return "Chua co";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusClasses(status: VehicleStatus | "not_found") {
  if (status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "blacklist") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function statusLabel(status: VehicleStatus | "not_found") {
  if (status === "verified") return "Da xac minh";
  if (status === "blacklist") return "Blacklist";
  if (status === "pending") return "Can xac minh";
  return "Chua co ho so";
}

export default function VehiclesView() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>(fallbackVehicles);
  const [cards, setCards] = useState<GuestRfidCard[]>(fallbackCards);
  const [plateQuery, setPlateQuery] = useState("30H-678.90");
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [message, setMessage] = useState("Ready to verify vehicle and plate information.");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [vehicleResponse, cardResponse] = await Promise.all([
          apiFetch("/vehicles"),
          apiFetch("/rfid-cards/guest"),
        ]);
        if (!cancelled && vehicleResponse.ok) {
          const data = await vehicleResponse.json();
          if (Array.isArray(data.vehicles)) setVehicles(data.vehicles);
        }
        if (!cancelled && cardResponse.ok) {
          const data = await cardResponse.json();
          if (Array.isArray(data.cards)) setCards(data.cards);
        }
      } catch {
        if (!cancelled) setMessage("API offline, using local fallback data.");
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    return {
      total: vehicles.length,
      verified: vehicles.filter((vehicle) => vehicle.status === "verified").length,
      activeCards: cards.filter((card) => card.status === "active").length,
      pending: vehicles.filter((vehicle) => vehicle.status === "pending").length,
    };
  }, [cards, vehicles]);

  async function verifyPlate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const plate = normalizePlate(plateQuery);
    if (!plate) return;

    setLoading(true);
    try {
      const response = await apiFetch(`/vehicle-verification?plate=${encodeURIComponent(plate)}`);
      if (!response.ok) throw new Error("verify failed");
      const data = (await response.json()) as VerificationResult;
      setVerification(data);
      setMessage(data.message);
    } catch {
      const vehicle = vehicles.find((item) => item.plate === plate) || null;
      const activeGuestCard = cards.find((card) => card.plate === plate && card.status === "active") || null;
      setVerification({
        plate,
        verified: vehicle?.status === "verified",
        status: vehicle?.status || "not_found",
        vehicle,
        activeGuestCard,
        message: vehicle ? "Vehicle and plate information found locally." : "No local vehicle record found.",
      });
      setMessage("API offline, verification used local fallback data.");
    } finally {
      setLoading(false);
    }
  }

  async function saveVerifiedVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const plate = normalizePlate(String(form.get("plate") || plateQuery));
    const payload = {
      plate,
      ownerName: String(form.get("ownerName") || "Guest vehicle").trim(),
      ownerPhone: String(form.get("ownerPhone") || "").trim(),
      brand: String(form.get("brand") || "").trim(),
      model: String(form.get("model") || "").trim(),
      color: String(form.get("color") || "").trim(),
      verificationNote: String(form.get("verificationNote") || "").trim(),
    };

    setLoading(true);
    try {
      const response = await apiFetch("/vehicles/verify", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("save failed");
      const data = await response.json();
      setVehicles((items) => {
        const next = items.filter((item) => item.id !== data.vehicle.id && item.plate !== data.vehicle.plate);
        return [data.vehicle, ...next];
      });
      setVerification({
        plate,
        verified: true,
        status: "verified",
        vehicle: data.vehicle,
        activeGuestCard: cards.find((card) => card.plate === plate && card.status === "active") || null,
        message: "Vehicle and plate information verified.",
      });
      setMessage("Vehicle and plate information verified.");
    } catch {
      const vehicle: VehicleRecord = {
        id: `local-${Date.now()}`,
        ...payload,
        status: "verified",
        verifiedAt: new Date().toISOString(),
      };
      setVehicles((items) => [vehicle, ...items.filter((item) => item.plate !== plate)]);
      setVerification({
        plate,
        verified: true,
        status: "verified",
        vehicle,
        activeGuestCard: cards.find((card) => card.plate === plate && card.status === "active") || null,
        message: "Vehicle verified locally.",
      });
      setMessage("API offline, saved verification locally for this session.");
    } finally {
      setLoading(false);
    }
  }

  async function issueGuestCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const plate = normalizePlate(String(form.get("plate") || plateQuery));
    const payload = {
      plate,
      guestName: String(form.get("guestName") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      note: String(form.get("note") || "").trim(),
    };

    setIssuing(true);
    try {
      const response = await apiFetch("/rfid-cards/guest", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "issue failed");
      setCards((items) => [data.card, ...items]);
      setMessage(`Issued guest RFID card ${data.card.code}.`);
      event.currentTarget.reset();
    } catch (error) {
      const verifiedVehicle = vehicles.find((item) => item.plate === plate && item.status === "verified");
      const activeCard = cards.find((card) => card.plate === plate && card.status === "active");
      if (!verifiedVehicle || activeCard) {
        setMessage(!verifiedVehicle ? "Verify vehicle before issuing RFID." : "This plate already has an active RFID card.");
      } else {
        const card: GuestRfidCard = {
          id: `local-card-${Date.now()}`,
          code: `RFID-GUEST-${Math.floor(1000 + Math.random() * 9000)}`,
          plate,
          guestName: payload.guestName,
          phone: payload.phone,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          status: "active",
          note: payload.note,
        };
        setCards((items) => [card, ...items]);
        setMessage(`API offline, issued local guest RFID card ${card.code}.`);
        event.currentTarget.reset();
      }
    } finally {
      setIssuing(false);
    }
  }

  const currentVehicle = verification?.vehicle;
  const defaultPlate = verification?.plate || normalizePlate(plateQuery);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.4)] backdrop-blur">
          <div className="flex flex-col gap-6 border-b border-slate-200/70 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Vehicle gate flow
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Verify Vehicle & Issue Guest RFID
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Check plate records, confirm vehicle ownership details, then issue a temporary RFID card for guests.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:self-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-4">
            <Metric label="Vehicles" value={summary.total} icon={<Car className="h-5 w-5" />} />
            <Metric label="Verified" value={summary.verified} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
            <Metric label="Guest RFID" value={summary.activeCards} icon={<CreditCard className="h-5 w-5" />} tone="cyan" />
            <Metric label="Pending" value={summary.pending} icon={<ShieldAlert className="h-5 w-5" />} tone="amber" />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-6">
            <form onSubmit={verifyPlate} className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                    Verify Vehicle & Plate Information
                  </p>
                  <h2 className="mt-1 text-xl font-bold">Plate lookup</h2>
                </div>
                <Search className="h-5 w-5 text-cyan-700" />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={plateQuery}
                  onChange={(event) => setPlateQuery(event.target.value)}
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm uppercase outline-none transition focus:border-cyan-400 focus:bg-white"
                  placeholder="30H-678.90"
                  required
                />
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                  disabled={loading}
                  type="submit"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Verify
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-500">{message}</p>
            </form>

            <form onSubmit={saveVerifiedVehicle} className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)]">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Confirm information
                </p>
                <h2 className="mt-1 text-xl font-bold">Verified vehicle record</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="plate" label="Plate" defaultValue={defaultPlate} mono required />
                <Field name="ownerName" label="Owner / Guest name" defaultValue={currentVehicle?.ownerName || ""} required />
                <Field name="ownerPhone" label="Phone" defaultValue={currentVehicle?.ownerPhone || ""} />
                <Field name="brand" label="Brand" defaultValue={currentVehicle?.brand || ""} />
                <Field name="model" label="Model" defaultValue={currentVehicle?.model || ""} />
                <Field name="color" label="Color" defaultValue={currentVehicle?.color || ""} />
                <Field name="verificationNote" label="Verification note" defaultValue={currentVehicle?.verificationNote || ""} wide />
              </div>
              <button
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
                disabled={loading}
                type="submit"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save verified vehicle
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)]">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  Issue RFID Card to Guest
                </p>
                <h2 className="mt-1 text-xl font-bold">Temporary guest card</h2>
              </div>
              <form onSubmit={issueGuestCard} className="space-y-4">
                <Field name="plate" label="Verified plate" defaultValue={defaultPlate} mono required />
                <Field name="guestName" label="Guest name" required />
                <Field name="phone" label="Phone" />
                <Field name="note" label="Note" />
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-70"
                  disabled={issuing}
                  type="submit"
                >
                  {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketCheck className="h-4 w-4" />}
                  Issue RFID card
                </button>
              </form>
            </div>

            <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/90 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)]">
              <div className="border-b border-slate-200 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Active guest RFID cards
                </p>
              </div>
              <div className="divide-y divide-slate-200">
                {cards.map((card) => (
                  <div key={card.id} className="grid gap-3 px-6 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-cyan-700">{card.code}</span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          {card.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {card.plate} - {card.guestName}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 sm:text-right">
                      Expires {formatDateTime(card.expiresAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/90 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)]">
          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b border-slate-200 p-6 md:border-b-0 md:border-r">
              <h2 className="text-lg font-bold">Verification result</h2>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-2xl font-black tracking-[0.12em] text-slate-900">
                    {verification?.plate || defaultPlate || "NO PLATE"}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(verification?.status || "not_found")}`}>
                    {statusLabel(verification?.status || "not_found")}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <span>Owner: {currentVehicle?.ownerName || "Chua co"}</span>
                  <span>Phone: {currentVehicle?.ownerPhone || "Chua co"}</span>
                  <span>Vehicle: {[currentVehicle?.brand, currentVehicle?.model, currentVehicle?.color].filter(Boolean).join(" / ") || "Chua co"}</span>
                  <span>Verified at: {formatDateTime(currentVehicle?.verifiedAt)}</span>
                </div>
              </div>
            </div>
            <div className="p-6">
              <h2 className="text-lg font-bold">Vehicle records</h2>
              <div className="mt-4 max-h-[280px] space-y-3 overflow-auto pr-1">
                {vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono font-black text-slate-900">{vehicle.plate}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(vehicle.status)}`}>
                        {statusLabel(vehicle.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {vehicle.ownerName} - {[vehicle.brand, vehicle.model, vehicle.color].filter(Boolean).join(" / ") || "No vehicle detail"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  mono,
  required,
  wide,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  mono?: boolean;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:bg-white ${
          mono ? "font-mono uppercase tracking-[0.08em]" : ""
        }`}
      />
    </label>
  );
}

function Metric({
  label,
  value,
  icon,
  tone = "slate",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "slate" | "emerald" | "cyan" | "amber";
}) {
  const classes = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <div className={`rounded-3xl border p-4 ${classes[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}
