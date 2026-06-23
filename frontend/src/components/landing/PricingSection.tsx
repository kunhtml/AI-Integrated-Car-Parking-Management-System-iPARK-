"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock, LucideIcon, Moon, RefreshCcw, Star, Tag } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface PricingData {
  hourlyRate: number;
  dailyMaxRate: number;
  monthlyRate: number;
  overnightRate: number;
  freeMinutes: number;
  overdueFineRate: number;
  graceExitMinutes: number;
}

interface PackageTier {
  id: string;
  icon: LucideIcon;
  name: string;
  badge?: string;
  badgeColor: string;
  description: string;
  priceKey: keyof PricingData | "dailyMax";
  priceSuffix: string;
  dailyEquivalent?: string;
  features: string[];
  cta: string;
  popular?: boolean;
  style: "default" | "highlight";
}

const TIERS: PackageTier[] = [
  {
    id: "luot",
    icon: Clock,
    name: "Gói Lượt",
    description: "Phù hợp cho khách vãng lai gửi xe ngắn hạn hoặc trong ngày.",
    priceKey: "hourlyRate",
    priceSuffix: "/ giờ",
    features: [
      "Miễn phí 20 phút đầu tiên",
      "Nhận dạng biển số tự động bằng AI",
      "Thanh toán qua cổng tự động",
      "Camera giám sát 24/7",
      "Hỗ trợ tìm kiếm xe nhanh",
    ],
    cta: "Bắt đầu gửi xe",
    style: "default",
  },
  {
    id: "thang",
    icon: Star,
    name: "Gói Tháng",
    badge: "Phổ biến nhất",
    badgeColor: "bg-blue-600 text-white",
    description: "Dành cho cư dân, nhân viên văn phòng có nhu cầu gửi xe cố định.",
    priceKey: "monthlyRate",
    priceSuffix: "/ tháng",
    dailyEquivalent: "Tương đương ~40.000đ/ngày",
    features: [
      "Không giới hạn số lượt vào/ra bãi",
      "Đăng ký biển số xe định danh cố định",
      "Quản lý gia hạn tiện lợi trên hệ thống",
      "Ưu tiên vị trí đỗ xe cố định",
      "Hỗ trợ ưu tiên khi đầy chỗ",
    ],
    cta: "Đăng ký ngay",
    popular: true,
    style: "highlight",
  },
  {
    id: "tuan",
    icon: RefreshCcw,
    name: "Gói Tuần",
    description: "Phù hợp cho khách công tác, du lịch ngắn hạn từ 7 ngày trở lên.",
    priceKey: "overnightRate",
    priceSuffix: "/ tuần",
    features: [
      "Giá tiết kiệm hơn gói lượt",
      "Không giới hạn ra vào trong kỳ",
      "Biển số định danh tạm thời",
      "Thanh toán linh hoạt một lần",
      "Gia hạn dễ dàng khi cần",
    ],
    cta: "Chọn gói tuần",
    style: "default",
  },
];

const DETAIL_ROWS = [
  { icon: Tag, label: "Miễn phí ban đầu", key: "freeMinutes", suffix: " phút" },
  { icon: Clock, label: "Giá theo giờ", key: "hourlyRate", suffix: "/ giờ" },
  { icon: Moon, label: "Qua đêm", key: "overnightRate", suffix: "/ đêm" },
  { icon: RefreshCcw, label: "Tối đa 1 ngày", key: "dailyMaxRate", suffix: "/ ngày" },
  { icon: Star, label: "Gói tháng", key: "monthlyRate", suffix: "/ tháng" },
];

const formatPrice = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const formatWeeklyPrice = (hourlyRate: number) => {
  const weekly = hourlyRate * 8 * 7;
  return formatPrice(weekly);
};

export default function PricingSection() {
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPricing() {
      try {
        setLoading(true);
        setError(false);
        const res = await apiFetch("/dashboard/public-pricing");
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (!cancelled) setPricing(data.pricing);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPricing();
    return () => { cancelled = true; };
  }, []);

  const getPrice = (tier: PackageTier): string => {
    if (!pricing) return "—";
    if (tier.priceKey === "dailyMax") return formatPrice(pricing.dailyMaxRate);
    return formatPrice(pricing[tier.priceKey] as number);
  };

  return (
    <section id="pricing" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto mb-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-600 mb-4">
            <Tag size={12} />
            Bảng giá chính thức
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-3">
            Bảng giá dịch vụ
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Giá được cấu hình và cập nhật trực tiếp từ hệ thống quản trị. Phiên gửi xe tính phí tự động theo thời gian thực.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-8">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const isHighlight = tier.style === "highlight";

            return (
              <div
                key={tier.id}
                className={[
                  "relative flex flex-col rounded-2xl border p-7 transition-all duration-300",
                  isHighlight
                    ? "border-blue-200 bg-white shadow-lg shadow-blue-100/60 scale-[1.02]"
                    : "border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5",
                ].join(" ")}
              >
                {/* Badge */}
                {tier.badge && (
                  <div className={[
                    "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider shadow-sm",
                    tier.badgeColor,
                  ].join(" ")}>
                    {tier.badge}
                  </div>
                )}

                {/* Icon */}
                <div className={[
                  "mb-4 flex h-12 w-12 items-center justify-center rounded-xl",
                  isHighlight ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500",
                ].join(" ")}>
                  <Icon size={22} />
                </div>

                {/* Name & Description */}
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">{tier.name}</h3>
                <p className="text-sm text-slate-500 mb-5 leading-relaxed flex-1">
                  {tier.description}
                </p>

                {/* Price */}
                <div className="mb-1">
                  {loading ? (
                    <div className="h-8 w-28 animate-pulse rounded bg-slate-200" />
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-slate-900">
                        {getPrice(tier)}
                      </span>
                      <span className="text-sm font-medium text-slate-500">
                        {tier.priceSuffix}
                      </span>
                    </div>
                  )}
                  {tier.dailyEquivalent && !loading && pricing && (
                    <p className="text-xs text-blue-600 font-medium mt-0.5">
                      {tier.dailyEquivalent}
                    </p>
                  )}
                  {tier.id === "tuan" && !loading && pricing && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      ({formatWeeklyPrice(pricing.hourlyRate)}/tuần quy đổi)
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div className={[
                  "h-px my-5 -mx-7",
                  isHighlight ? "bg-blue-100" : "bg-slate-100",
                ].join(" ")} />

                {/* Features */}
                <ul className="space-y-2.5 text-sm text-slate-600 mb-6 flex-1">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle2
                        size={15}
                        className={isHighlight ? "text-blue-500 mt-0.5 shrink-0" : "text-emerald-500 mt-0.5 shrink-0"}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  className={[
                    "w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-200",
                    isHighlight
                      ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98]",
                  ].join(" ")}
                >
                  {tier.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Error fallback */}
        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 text-center">
            Không tải được bảng giá từ server. Giá mặc định sẽ được hiển thị khi server hoạt động.
          </div>
        )}

        {/* Detail Table */}
        {pricing && !loading && (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                  Chi tiết bảng giá
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {DETAIL_ROWS.map((row) => {
                  const Icon = row.icon;
                  const val = pricing[row.key as keyof PricingData] as number;
                  return (
                    <div
                      key={row.key}
                      className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <Icon size={15} className="text-slate-400" />
                        {row.label}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        {row.key === "freeMinutes"
                          ? `${val} phút`
                          : `${formatPrice(val)}${row.suffix}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
