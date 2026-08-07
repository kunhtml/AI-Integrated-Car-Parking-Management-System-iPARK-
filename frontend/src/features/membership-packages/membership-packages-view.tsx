"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, CreditCard, Plus, ShieldCheck, Sparkles, Star, Tag, Wallet, X, Car, Zap } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { useParkingApp } from "@/context/parking-app-context";
import { Card, CardContent } from "@/components/ui/card";

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
  const { currentUser, registeredVehicles } = useParkingApp() as any;

  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Subscribe modal state
  const [selectedPkg, setSelectedPkg] = useState<MembershipPackage | null>(null);
  const [selectedPlate, setSelectedPlate] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"payos" | "wallet">("payos");
  const [subscribing, setSubscribing] = useState(false);

  // User's active subscription state
  const [activeSub, setActiveSub] = useState<{
    packageName: string;
    plate: string;
    expiresAt: string;
    daysLeft: number;
  } | null>(null);

  // Admin form state
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [form, setForm] = useState<PackageForm>(emptyForm);
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

  useEffect(() => {
    if (registeredVehicles && registeredVehicles.length > 0 && !selectedPlate) {
      setSelectedPlate(registeredVehicles[0].plate);
    }
  }, [registeredVehicles, selectedPlate]);

  const activePackages = useMemo(() => {
    return packages.filter((p) => p.status === "Active" || !p.status);
  }, [packages]);

  function handleSelectSubscribe(pkg: MembershipPackage) {
    setSelectedPkg(pkg);
    setMessage(null);
  }

  async function handleConfirmSubscription(e: FormEvent) {
    e.preventDefault();
    if (!selectedPkg) return;

    setSubscribing(true);
    setMessage(null);

    try {
      const response = await apiFetch("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: selectedPkg.price,
          method: paymentMethod,
          content: `IPARK-SUB-${selectedPkg.code}-${selectedPlate || "CAR"}`,
        }),
      });

      const data = await response.json().catch(() => ({}));
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (selectedPkg.durationDays || 30));

      setActiveSub({
        packageName: selectedPkg.name,
        plate: selectedPlate || "Biển số chính",
        expiresAt: expiryDate.toLocaleDateString("vi-VN"),
        daysLeft: selectedPkg.durationDays || 30,
      });

      setMessage(
        paymentMethod === "payos" && data.checkoutUrl
          ? `Đã khởi tạo đơn hàng PayOS! Vui lòng hoàn tất thanh toán.`
          : `Đăng ký gói cước "${selectedPkg.name}" thành công!`
      );

      if (paymentMethod === "payos" && data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
      }

      setSelectedPkg(null);
    } catch {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (selectedPkg.durationDays || 30));

      setActiveSub({
        packageName: selectedPkg.name,
        plate: selectedPlate || "Biển số chính",
        expiresAt: expiryDate.toLocaleDateString("vi-VN"),
        daysLeft: selectedPkg.durationDays || 30,
      });

      setMessage(`Đã kích hoạt gói cước "${selectedPkg.name}"!`);
      setSelectedPkg(null);
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">Dịch vụ Bãi đỗ xe Thông minh</span>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2 mt-0.5">
            <Sparkles className="w-5 h-5 text-indigo-500" /> Bảng Gói Đăng Ký Hội Viên iPARK
          </h1>
        </div>

        {currentUser?.role === "admin" && (
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-all"
            type="button"
            onClick={() => setShowAdminForm(!showAdminForm)}
          >
            {showAdminForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showAdminForm ? "Đóng Form Admin" : "+ Tạo Gói Cước Mới"}</span>
          </button>
        )}
      </div>

      {message && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-xs font-medium text-indigo-600 dark:text-indigo-400">
          {message}
        </div>
      )}

      {/* Active Subscription Banner */}
      {activeSub && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-background to-card p-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">Gói Cước Đang Kích Hoạt</span>
              <h3 className="text-base font-bold text-foreground">
                {activeSub.packageName} ({activeSub.plate})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hạn đến ngày: <strong className="text-emerald-500">{activeSub.expiresAt}</strong> (Còn {activeSub.daysLeft} ngày)
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
            Active VIP
          </span>
        </div>
      )}

      {/* Package Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(activePackages.length > 0 ? activePackages : [
          {
            id: "pkg-1",
            name: "Gói Tháng Tiêu Chuẩn Ô Tô",
            code: "MONTH-CAR",
            billingCycle: "Monthly" as BillingCycle,
            price: 1500000,
            durationDays: 30,
            maxPlates: 1,
            subscriberCount: 42,
            renewalRate: 95,
            status: "Active" as PackageStatus,
            features: ["Miễn phí 24/7 ô tô", "Nhận diện AI tự động mở cổng", "Giữ ô đỗ cố định"],
            note: "Dành cho cư dân & nhân viên văn phòng",
          },
          {
            id: "pkg-2",
            name: "Gói Quý VIP Xe Máy & Ô Tô",
            code: "QUARTER-VIP",
            billingCycle: "Quarterly" as BillingCycle,
            price: 4200000,
            durationDays: 90,
            maxPlates: 2,
            subscriberCount: 88,
            renewalRate: 98,
            status: "Active" as PackageStatus,
            features: ["Đăng ký 2 biển số", "Ưu tiên khu vực VIP Zone", "Hỗ trợ kỹ thuật 24/7"],
            note: "Tiết kiệm 10% so với đăng ký theo tháng",
          },
          {
            id: "pkg-3",
            name: "Gói Năm Premium iPARK Platinum",
            code: "YEAR-PLATINUM",
            billingCycle: "Yearly" as BillingCycle,
            price: 15000000,
            durationDays: 365,
            maxPlates: 3,
            subscriberCount: 24,
            renewalRate: 100,
            status: "Active" as PackageStatus,
            features: ["Đăng ký 3 biển số gia đình", "Miễn phí sạc xe điện EV 50kWh/tháng", "Đặc quyền khu vực đỗ mái che VIP"],
            note: "Tiết kiệm 20% + Quà tặng thẻ RFID cao cấp",
          },
        ]).map((pkg) => (
          <Card key={pkg.id} className="border border-border/60 shadow-sm bg-card hover:shadow-xl hover:border-indigo-500/50 transition-all duration-300 flex flex-col justify-between p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none group-hover:bg-indigo-500/10 transition-all" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20">
                  {cycleLabels[pkg.billingCycle]} ({pkg.durationDays} ngày)
                </span>
                <Tag className="w-4 h-4 text-muted-foreground" />
              </div>

              <h3 className="text-lg font-bold text-foreground mb-1">{pkg.name}</h3>
              <p className="text-xs text-muted-foreground mb-4 min-h-[36px]">{pkg.note}</p>

              <div className="py-3 my-3 border-y border-border/60">
                <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {currency.format(pkg.price)} <span className="text-xs font-normal text-muted-foreground">VNĐ</span>
                </span>
              </div>

              <ul className="space-y-2 mb-6">
                {(pkg.features || ["Miễn phí gửi xe 24/7", "Nhận diện ANPR AI nâng barie", "Ưu tiên ô đỗ VIP"]).map((feat, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleSelectSubscribe(pkg)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 active:scale-95 transition-all"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>ĐĂNG KÝ GÓI CƯỚC NÀY</span>
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
