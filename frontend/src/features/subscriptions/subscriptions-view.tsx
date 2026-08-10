"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Radio, Wifi, Package, ListChecks, Plus } from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { VehicleDetailModal } from "@/features/vehicles/vehicles-view";
import type { RegisteredVehicle, Subscription } from "@/types";
import { AdminPlans } from "./admin-plans";
import { AdminSubscriptions } from "./admin-subscriptions";
import { PaymentModal } from "./payment-modal";
import { PlanGrid } from "./plan-grid";
import { StatusBadge } from "./status-badge";
import { SubscriptionCard } from "./subscription-card";
import { VehiclePickerModal } from "./vehicle-picker-modal";

type SubPayos = { qrCode: string; checkoutUrl: string; orderCode: string; amount: number; accountNumber?: string; accountName?: string; bin?: string };

type PurchaseState =
  | { open: true; planId: string }
  | { open: false };

type AdminTab = "plans" | "subscriptions";

type MyRfidCard = {
  id: string;
  uid: string;
  ownerName: string;
  plate: string;
  userType: "resident" | "guest";
  status: "active" | "inactive";
  createdAt: string;
};

export function SubscriptionsView() {
  const {
    currentUser,
    planList,
    subscriptionList,
    setSubscriptionList,
    cancelSubscription,
    fetchVehicleDetail,
    registeredVehicles,
    purchaseSubscription,
    renewSubscription,
  } = useParkingApp();

  const [purchasing, setPurchasing] = useState(false);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);
  const [payment, setPayment] = useState<{ subId: string; payos: SubPayos; renewMode: boolean; renewBaseEnd: number; plate: string } | null>(null);
  const [detailVehicle, setDetailVehicle] = useState<RegisteredVehicle | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [purchasePicker, setPurchasePicker] = useState<PurchaseState>({ open: false });
  const [adminTab, setAdminTab] = useState<AdminTab>("plans");

  if (!currentUser) return null;
  const isAdmin = currentUser.role === "admin";
  const isCustomer = currentUser.role === "customer";

  const now = Date.now();
  const myActiveSubs = useMemo(
    () =>
      subscriptionList.filter(
        (s) =>
          s.status === "active" ||
          s.status === "pending_payment" ||
          (s.status === "cancelled" && new Date(s.endDate).getTime() > now),
      ),
    [subscriptionList, now],
  );
  const heroSub = myActiveSubs[0] ?? null;

  const [myCards, setMyCards] = useState<MyRfidCard[]>([]);
  const [myCardsLoading, setMyCardsLoading] = useState(false);

  useEffect(() => {
    if (!isCustomer) return;
    let cancelled = false;
    setMyCardsLoading(true);
    (async () => {
      try {
        const r = await apiFetch("/rfid/mine");
        const d = await r.json().catch(() => ({}));
        if (!cancelled && r.ok && Array.isArray(d.cards)) {
          setMyCards(d.cards);
        }
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setMyCardsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCustomer]);

  async function refreshSubscriptionList() {
    try {
      const endpoint = isAdmin ? "/subscriptions" : "/subscriptions/my";
      const r = await apiFetch(endpoint);
      const d = await r.json();
      if (r.ok && d.subscriptions) setSubscriptionList(d.subscriptions);
    } catch {
      /* silent */
    }
  }

  async function loadVehicles() {
    try {
      const r = await apiFetch("/vehicles/my");
      if (r.ok) {
        const d = await r.json();
        return d.vehicles as RegisteredVehicle[];
      }
    } catch {
      /* silent */
    }
    return registeredVehicles;
  }

  function handlePurchase(planId: string) {
    if (purchasing) return;
    setFeedback(null);
    setPurchasePicker({ open: true, planId });
  }

  async function handlePurchaseConfirmed(vehicle: RegisteredVehicle, planId: string) {
    if (purchasing) return;
    setPurchasing(true);
    setActivePlanId(planId);
    setPurchasePicker({ open: false });
    setFeedback(null);
    try {
      const result = await purchaseSubscription(planId, vehicle.id);
      const base = subscriptionList.find((s) => s.id === result.subscription.id);
      const baseEnd = base ? new Date(base.endDate).getTime() : 0;
      if (result.payos?.qrCode) {
        setPayment({
          subId: result.subscription.id,
          payos: {
            qrCode: result.payos.qrCode,
            checkoutUrl: result.payos.checkoutUrl ?? "",
            orderCode: String(result.payos.orderCode ?? ""),
            amount: Number(result.payos.amount ?? 0),
            accountNumber: result.payos.accountNumber,
            accountName: result.payos.accountName,
            bin: result.payos.bin,
          },
          renewMode: false,
          renewBaseEnd: baseEnd,
          plate: vehicle.plate,
        });
        setFeedback({ type: "info", text: `Quét mã QR để hoàn tất thanh toán cho xe ${vehicle.plate}.` });
      } else {
        setFeedback({ type: "success", text: `Mua gói thành công cho xe ${vehicle.plate}.` });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Không mua được gói." });
    } finally {
      setPurchasing(false);
      setActivePlanId(null);
    }
  }

  async function handleContinuePayment(subId: string): Promise<boolean> {
    if (purchasing) return false;
    setPurchasing(true);
    setFeedback(null);
    const base = subscriptionList.find((s) => s.id === subId);
    const baseEnd = base ? new Date(base.endDate).getTime() : 0;
    const plate = base?.primaryVehicle?.plate ?? "—";
    try {
      const r = await apiFetch(`/subscriptions/${subId}/payment-info`);
      const d = await r.json();
      if (!r.ok) {
        setFeedback({ type: "error", text: d.message || "Không tải được QR thanh toán." });
        return false;
      }
      if (!d.qrCode) {
        setFeedback({ type: "error", text: "Yêu cầu thanh toán đã hết hạn hoặc không tồn tại. Hãy mua lại gói." });
        return false;
      }
      setPayment({
        subId,
        payos: {
          qrCode: d.qrCode,
          checkoutUrl: d.checkoutUrl ?? "",
          orderCode: String(d.orderCode ?? ""),
          amount: Number(d.amount ?? 0),
          accountNumber: d.accountNumber,
          accountName: d.accountName,
          bin: d.bin,
        },
        renewMode: false,
        renewBaseEnd: baseEnd,
        plate,
      });
      setFeedback({ type: "info", text: "Đã mở lại mã QR thanh toán." });
      return true;
    } catch {
      setFeedback({ type: "error", text: "Không tải được QR thanh toán." });
      return false;
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRenew(id: string) {
    if (purchasing) return;
    setPurchasing(true);
    setFeedback(null);
    const base = subscriptionList.find((s) => s.id === id);
    const baseEnd = base ? new Date(base.endDate).getTime() : 0;
    const plate = base?.primaryVehicle?.plate ?? "—";
    try {
      const result = await renewSubscription(id);
      setSubscriptionList((items) => items.map((s) => (s.id === id ? result.subscription : s)));
      if (result.payos?.qrCode) {
        setPayment({
          subId: id,
          payos: result.payos as SubPayos,
          renewMode: true,
          renewBaseEnd: baseEnd,
          plate,
        });
        setFeedback({ type: "info", text: `Quét mã QR để thanh toán và gia hạn gói cho xe ${plate}.` });
      } else {
        setFeedback({ type: "success", text: "Gia hạn gói thành công." });
      }
    } catch (err: any) {
      const errMsg = err?.message ?? "";
      const isPendingRenew = err?.status === 409 && /yêu cầu gia hạn chờ thanh toán/i.test(errMsg);
      if (isPendingRenew) {
        await openPendingPayment(id, baseEnd, plate);
      } else {
        setFeedback({ type: "error", text: errMsg || "Không gia hạn được." });
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function openPendingPayment(subId: string, renewBaseEnd: number, plate: string) {
    try {
      const r = await apiFetch(`/subscriptions/${subId}/payment-info`);
      const d = await r.json();
      if (!r.ok) {
        setFeedback({ type: "error", text: d.message || "Không tải được QR thanh toán." });
        return;
      }
      if (!d.qrCode) {
        setFeedback({ type: "error", text: "Yêu cầu thanh toán đã hết hạn hoặc đã xử lý. Hãy thử lại." });
        return;
      }
      setPayment({
        subId,
        payos: {
          qrCode: d.qrCode,
          checkoutUrl: d.checkoutUrl ?? "",
          orderCode: String(d.orderCode ?? ""),
          amount: Number(d.amount ?? 0),
          accountNumber: d.accountNumber,
          accountName: d.accountName,
          bin: d.bin,
        },
        renewMode: true,
        renewBaseEnd,
        plate,
      });
      setFeedback({ type: "info", text: "Đã mở lại mã QR thanh toán." });
    } catch {
      setFeedback({ type: "error", text: "Không tải được QR thanh toán." });
    }
  }

  async function handleCancel(id: string) {
    if (cancellingId) return;
    setCancellingId(id);
    try {
      await cancelSubscription(id);
      setFeedback({ type: "info", text: "Đã hủy gói. Sub còn hiệu lực tới endDate." });
      await refreshSubscriptionList();
    } finally {
      setCancellingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const r = await apiFetch(`/subscriptions/${id}`, { method: "DELETE" });
      if (r.ok) {
        setSubscriptionList((items) => items.filter((s) => s.id !== id));
        setFeedback({ type: "info", text: "Đã xóa đăng ký." });
      } else {
        const d = await r.json().catch(() => ({}));
        setFeedback({ type: "error", text: d.message || "Không xóa được." });
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleViewVehicle(vehicleId: string) {
    const v = await fetchVehicleDetail(vehicleId);
    if (v) setDetailVehicle(v);
  }

  async function onPaymentPaid() {
    setFeedback({ type: "success", text: payment?.renewMode ? "Gia hạn thành công!" : "Thanh toán thành công!" });
    await refreshSubscriptionList();
  }

  function activeSubForVehicle(vehicleId: string): Subscription | null {
    return myActiveSubs.find((s) => s.primaryVehicleId === vehicleId || s.primaryVehicle?.id === vehicleId) ?? null;
  }

  const visiblePlans = planList.filter((p) => p.isActive !== false);

  return (
    <>
      {detailVehicle && (
        <VehicleDetailModal vehicle={detailVehicle} onClose={() => setDetailVehicle(null)} />
      )}

      {payment && (
        <PaymentModal
          payos={payment.payos}
          subscriptionId={payment.subId}
          renewMode={payment.renewMode}
          renewBaseEnd={payment.renewBaseEnd}
          plate={payment.plate}
          onClose={() => setPayment(null)}
          onPaid={onPaymentPaid}
        />
      )}

      <VehiclePickerModal
        open={purchasePicker.open}
        vehicles={registeredVehicles}
        activeSubsForVehicle={activeSubForVehicle}
        onClose={() => setPurchasePicker({ open: false })}
        onSelect={(v) => {
          if (purchasePicker.open) handlePurchaseConfirmed(v, purchasePicker.planId);
        }}
        onVehicleCreated={() => loadVehicles()}
      />

      <div className="subscriptions-page">

        {/* Feedback banner */}
        {feedback && (
          <div className={`feedback-banner ${feedback.type}`}>
            {feedback.type === "success" ? <Check size={16} /> : <CreditCard size={16} />}
            {feedback.text}
          </div>
        )}

        {/* Hero: thẻ RFID của customer */}
        {isCustomer && heroSub && (
          <section className="hero-section">
            <div className="hero-header">
              <div className="hero-title">
                <div className="hero-icon rfid">
                  <Radio size={20} />
                </div>
                <div>
                  <h2>Thẻ RFID của bạn</h2>
                  <p>Quẹt khi gửi xe để được miễn phí</p>
                </div>
              </div>
              <div className="hero-badges">
                <span className="hero-plan-badge">
                  <CreditCard size={12} /> {heroSub.planName}
                </span>
                <StatusBadge status={heroSub.status} />
              </div>
            </div>

            {myCardsLoading ? (
              <div className="rfid-card-grid">
                <div className="rfid-card rfid-card-empty">
                  <p>Đang tải thẻ…</p>
                </div>
              </div>
            ) : myCards.length === 0 ? (
              <div className="rfid-card-grid">
                <div className="rfid-card rfid-card-empty">
                  <Radio size={28} />
                  <p>Chưa có thẻ RFID. Vui lòng liên hệ quản lý để đăng ký.</p>
                </div>
              </div>
            ) : (
              <div className="rfid-card-grid">
                {myCards.map((card) => {
                  // Mỗi thẻ có thể gắn với 1 biển; tìm gói subscription tương ứng.
                  // Ưu tiên: gói có primaryVehicle.plate khớp card.plate, fallback gói đầu tiên.
                  const cardSub =
                    myActiveSubs.find(
                      (s) =>
                        s.primaryVehicle?.plate &&
                        card.plate &&
                        s.primaryVehicle.plate.toUpperCase() === card.plate.toUpperCase(),
                    ) ?? heroSub;
                  const subEndDate = cardSub ? new Date(cardSub.endDate) : null;
                  const daysLeft = subEndDate
                    ? Math.max(
                        0,
                        Math.ceil(
                          (subEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
                        ),
                      )
                    : 0;
                  const expired =
                    subEndDate !== null && subEndDate.getTime() < Date.now();
                  return (
                    <article
                      key={card.id}
                      className={`rfid-card rfid-card-${card.status} rfid-card-${card.userType}`}
                    >
                      <div className="rfid-card-top">
                        <div className="rfid-card-brand">
                          <Radio size={16} />
                          <span>RFID · {card.userType === "resident" ? "Cư dân" : "Khách"}</span>
                        </div>
                        <span className={`rfid-status-pill ${card.status}`}>
                          {card.status === "active" ? "Hoạt động" : "Vô hiệu"}
                        </span>
                      </div>

                      <div className="rfid-card-uid-row">
                        <span className="rfid-label">Mã thẻ UID</span>
                        <span className="rfid-uid">{card.uid}</span>
                      </div>

                      <div className="rfid-card-info-row">
                        <div className="rfid-info">
                          <span className="rfid-label">Chủ thẻ</span>
                          <span className="rfid-value">{card.ownerName}</span>
                        </div>
                        <div className="rfid-info">
                          <span className="rfid-label">Biển số</span>
                          <span className="rfid-value rfid-plate">{card.plate || "—"}</span>
                        </div>
                      </div>

                      <div className="rfid-card-info-row">
                        <div className="rfid-info">
                          <span className="rfid-label">Hết hạn</span>
                          <span className="rfid-value">
                            {subEndDate
                              ? subEndDate.toLocaleDateString("vi-VN", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "—"}
                          </span>
                        </div>
                        <div className="rfid-info">
                          <span className="rfid-label">Còn lại</span>
                          <span className={`rfid-value ${expired ? "expired" : "accent"}`}>
                            {!subEndDate
                              ? "—"
                              : expired
                              ? "Hết hạn"
                              : daysLeft > 0
                              ? `${daysLeft} ngày`
                              : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="rfid-card-bottom">
                        <Wifi size={14} />
                        <span>Hệ thống tự động nhận diện khi xe vào/ra</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {myActiveSubs.length > 1 && (
              <p className="hero-note">
                Bạn có <strong>{myActiveSubs.length} gói</strong> đang hoạt động — xem chi tiết bên dưới.
              </p>
            )}
          </section>
        )}

        {/* Customer: all subscription cards */}
        {isCustomer && (
          <section className="customer-subs-section">
            <h2 className="section-title">
              <CreditCard size={18} />
              Gói của bạn
            </h2>

            {myActiveSubs.length === 0 ? (
              <PlanGrid
                plans={visiblePlans}
                purchasing={purchasing}
                activePlanId={activePlanId}
                onPurchase={handlePurchase}
              />
            ) : (
              <>
                <div className="subs-cards-grid">
                  {myActiveSubs.map((sub) => (
                    <SubscriptionCard
                      key={sub.id}
                      subscription={sub}
                      renewing={purchasing}
                      onRenew={handleRenew}
                      onContinuePayment={handleContinuePayment}
                      onViewVehicle={handleViewVehicle}
                    />
                  ))}
                </div>

                {/* Plans horizontal */}
                {visiblePlans.length > 0 && (
                  <div className="plans-horizontal">
                    <h3>Mua thêm gói cho xe khác</h3>
                    <div className="plans-row">
                      {visiblePlans.map((plan, idx) => (
                        <div key={plan.id} className={`plan-horizontal-card ${idx === 0 ? "featured" : ""}`}>
                          <div className="plan-badge">{idx === 0 ? "Phổ biến" : plan.duration}</div>
                          <h4>{plan.name}</h4>
                          <p className="plan-price">{currency.format(plan.price)}</p>
                          <span className="plan-days">{plan.durationDays} ngày</span>
                          <button
                            className="plan-buy-btn"
                            onClick={() => handlePurchase(plan.id)}
                            disabled={purchasing}
                          >
                            {purchasing && activePlanId === plan.id ? "Đang tạo..." : "Mua gói này"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Admin: Tabbed interface */}
        {isAdmin && (
          <section className="admin-section">
            <div className="admin-tabs">
              <button
                className={`admin-tab ${adminTab === "plans" ? "active" : ""}`}
                onClick={() => setAdminTab("plans")}
              >
                <Package size={18} />
                Quản lý gói
                <span className="tab-count">{planList.length}</span>
              </button>
              <button
                className={`admin-tab ${adminTab === "subscriptions" ? "active" : ""}`}
                onClick={() => setAdminTab("subscriptions")}
              >
                <ListChecks size={18} />
                Danh sách đăng ký
                <span className="tab-count">{subscriptionList.length}</span>
              </button>
            </div>

            <div className="admin-tab-content">
              {adminTab === "plans" && (
                <AdminPlans
                  plans={planList}
                  onCreate={async (data) => {
                    const r = await apiFetch("/subscriptions/plans", { method: "POST", body: JSON.stringify(data) });
                    const d = await r.json();
                    if (r.ok) {
                      setSubscriptionList((items) => items);
                      setFeedback({ type: "success", text: `Đã tạo gói "${d.plan.name}".` });
                    } else {
                      setFeedback({ type: "error", text: d.message || "Không tạo được gói." });
                    }
                  }}
                  onUpdate={async (id, data) => {
                    const r = await apiFetch(`/subscriptions/plans/${id}`, { method: "PUT", body: JSON.stringify(data) });
                    if (r.ok) setFeedback({ type: "success", text: "Đã cập nhật gói." });
                    else {
                      const d = await r.json().catch(() => ({}));
                      setFeedback({ type: "error", text: d.message || "Không cập nhật được gói." });
                    }
                  }}
                  onDelete={async (id) => {
                    const r = await apiFetch(`/subscriptions/plans/${id}`, { method: "DELETE" });
                    if (r.ok) setFeedback({ type: "info", text: "Đã ẩn gói." });
                    else {
                      const d = await r.json().catch(() => ({}));
                      setFeedback({ type: "error", text: d.message || "Không ẩn được gói." });
                    }
                  }}
                />
              )}
              {adminTab === "subscriptions" && (
                <AdminSubscriptions
                  subscriptions={subscriptionList}
                  deletingId={deletingId}
                  cancellingId={cancellingId}
                  onDelete={handleDelete}
                  onCancel={handleCancel}
                  onAfterAction={refreshSubscriptionList}
                />
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

// Import currency
import { currency } from "@/lib/constants";
