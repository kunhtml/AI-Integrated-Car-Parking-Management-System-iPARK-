"use client";

import { Check, CreditCard, Loader2 } from "lucide-react";
import type { SubscriptionPlan } from "@/types";
import { currency } from "@/lib/constants";
import { DURATION_LABELS } from "./styles";

type Props = {
  plans: SubscriptionPlan[];
  purchasing: boolean;
  activePlanId: string | null;
  onPurchase: (planId: string) => void;
};

export function PlanGrid({ plans, purchasing, activePlanId, onPurchase }: Props) {
  if (plans.length === 0) {
    return (
      <div className="plan-grid-empty">
        Chưa có gói nào đang bán.
      </div>
    );
  }

  return (
    <div className="plan-grid-horizontal">
      {plans.map((plan, idx) => {
        const isLoading = purchasing && activePlanId === plan.id;
        const isFeatured = idx === 0;
        return (
          <div
            key={plan.id}
            className={`plan-card-horizontal ${isFeatured ? "featured" : ""}`}
          >
            {isFeatured && (
              <div className="plan-popular-badge">Phổ biến nhất</div>
            )}

            <div className="plan-card-duration">
              {DURATION_LABELS[plan.duration] ?? plan.duration}
            </div>

            <h3 className="plan-card-name">{plan.name}</h3>

            {plan.description && (
              <p className="plan-card-desc">{plan.description}</p>
            )}

            <div className="plan-card-price">
              <span className="price-value">{currency.format(plan.price)}</span>
              <span className="price-days">{plan.durationDays} ngày</span>
            </div>

            <button
              type="button"
              className={`plan-card-btn ${isFeatured ? "featured" : ""}`}
              onClick={() => onPurchase(plan.id)}
              disabled={purchasing}
            >
              {isLoading ? <Loader2 size={14} className="spin" /> : <CreditCard size={14} />}
              {isLoading ? "Đang tạo..." : "Mua gói này"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
