import type { FormEvent } from "react";
import { apiFetch } from "@/lib/client-api";
import type { RegisteredVehicle, Subscription, SubscriptionPlan } from "@/types";

type SubscriptionActionsParams = {
  setPlanList: (items: SubscriptionPlan[] | ((prev: SubscriptionPlan[]) => SubscriptionPlan[])) => void;
  setSubscriptionList: (items: Subscription[] | ((prev: Subscription[]) => Subscription[])) => void;
  setRegisteredVehicles: (vehicles: RegisteredVehicle[] | ((prev: RegisteredVehicle[]) => RegisteredVehicle[])) => void;
  setActionLog: (log: string) => void;
};

export function createSubscriptionActions({
  setPlanList,
  setSubscriptionList,
  setRegisteredVehicles,
  setActionLog,
}: SubscriptionActionsParams) {
  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const body = {
      name: String(form.get("name") || ""),
      description: String(form.get("description") || ""),
      duration: String(form.get("duration") || "monthly"),
      durationDays: Number(form.get("durationDays") || 30),
      price: Number(form.get("price") || 0),
      maxVehicles: Number(form.get("maxVehicles") ?? -1),
    };
    const response = await apiFetch("/subscriptions/plans", { method: "POST", body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không tạo được gói.");
      return;
    }
    setPlanList((items) => [...items, data.plan]);
    setActionLog(`Đã tạo gói "${data.plan.name}".`);
    formEl.reset();
  }

  async function updatePlan(planId: string, body: {
    name?: string;
    description?: string;
    price?: number;
    maxVehicles?: number;
    isActive?: boolean;
  }) {
    const response = await apiFetch(`/subscriptions/plans/${planId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không cập nhật được gói.");
      return null;
    }
    setPlanList((items) => items.map((p) => (p.id === planId ? data.plan : p)));
    setActionLog(`Đã cập nhật gói "${data.plan.name}".`);
    return data.plan as SubscriptionPlan;
  }

  async function deletePlan(planId: string) {
    const response = await apiFetch(`/subscriptions/plans/${planId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setActionLog(data.message || "Không xoá được gói.");
      return;
    }
    setPlanList((items) => items.map((p) => (p.id === planId ? { ...p, isActive: false } : p)));
    setActionLog("Đã ẩn gói khỏi danh sách mua.");
  }

  /**
   * Mua gói mới — bắt buộc truyền vehicleId.
   * Vehicle phải thuộc user và chưa có gói còn hiệu lực.
   */
  async function purchaseSubscription(planId: string, vehicleId: string) {
    const response = await apiFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({ planId, vehicleId }),
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || "Không mua được gói.") as Error & { status: number };
      ;(err as any).status = response.status;
      throw err;
    }
    setSubscriptionList((items) => [data.subscription, ...items]);
    setActionLog(`Đã đăng ký gói "${data.subscription.planName}".`);
    return data as { subscription: Subscription; payos?: Record<string, unknown> };
  }

  async function renewSubscription(id: string) {
    const response = await apiFetch(`/subscriptions/${id}/renew`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || "Không gia hạn được.") as Error & { status: number };
      ;(err as any).status = response.status;
      throw err;
    }
    setSubscriptionList((items) => items.map((s) => (s.id === id ? data.subscription : s)));
    setActionLog("Đã gia hạn gói thành công.");
    return data as { subscription: Subscription; payos?: Record<string, unknown> };
  }

  async function cancelSubscription(id: string) {
    const response = await apiFetch(`/subscriptions/${id}/cancel`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không hủy được gói.");
      return;
    }
    if (data.subscription === null) {
      setSubscriptionList((items) => items.filter((s) => s.id !== id));
    } else {
      setSubscriptionList((items) => items.map((s) => (s.id === id ? data.subscription : s)));
    }
    setActionLog("Đã hủy gói.");
  }

  /**
   * Tạo xe mới cho user hiện tại.
   * Sau khi tạo, sẽ đẩy vào danh sách registeredVehicles để picker cập nhật.
   */
  async function createVehicle(data: {
    plate: string;
    ownerName?: string;
    ownerPhone?: string;
    brand?: string;
    model?: string;
    color?: string;
    year?: number;
  }) {
    const response = await apiFetch("/vehicles", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      const err = new Error(result.message || "Không tạo được xe.") as Error & { status: number };
      ;(err as any).status = response.status;
      throw err;
    }
    if (result.vehicle) {
      setRegisteredVehicles((items) => {
        if (items.some((v) => v.id === result.vehicle.id)) return items;
        return [result.vehicle, ...items];
      });
    }
    return result.vehicle as RegisteredVehicle;
  }

  return {
    createPlan,
    updatePlan,
    deletePlan,
    purchaseSubscription,
    renewSubscription,
    cancelSubscription,
    createVehicle,
  };
}
