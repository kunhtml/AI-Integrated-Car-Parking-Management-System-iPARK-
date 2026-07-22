"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, RefreshCw, Search } from "lucide-react";

import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";

type SubscriptionVehicle = {
  id: string;
  plate: string;
  ownerName: string;
  status: string;
};

type SubscriptionItem = {
  id: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  startDate: string;
  endDate: string;
  status: "pending_payment" | "active" | "cancelled" | "expired" | string;
  autoRenew: boolean;
  renewalCount: number;
  registeredVehicles: SubscriptionVehicle[];
  registeredPlates: string[];
  isValidNow: boolean;
};

type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  duration: "monthly" | "quarterly" | "yearly" | string;
  durationDays: number;
  price: number;
  maxVehicles: number;
  isActive: boolean;
};

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function statusLabel(status: string) {
  if (status === "active") return "Đang hiệu lực";
  if (status === "cancelled") return "Đã hủy, còn hạn";
  if (status === "pending_payment") return "Chờ thanh toán";
  if (status === "expired") return "Hết hạn";
  return status;
}

function durationLabel(duration: string) {
  if (duration === "monthly") return "Tháng";
  if (duration === "quarterly") return "Quý";
  if (duration === "yearly") return "Năm";
  return duration;
}

export function SubscriptionsView() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadSubscriptions() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await apiFetch("/subscriptions");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message || "Không tải được danh sách gói dịch vụ.");
        return;
      }
      setSubscriptions(data.subscriptions || []);
      setPlans(data.plans || []);
    } catch {
      setMessage("Không kết nối được API gói dịch vụ.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const summary = useMemo(() => {
    const valid = subscriptions.filter((item) => item.isValidNow).length;
    const expired = subscriptions.filter((item) => !item.isValidNow).length;
    const vehicles = subscriptions.reduce(
      (sum, item) => sum + item.registeredVehicles.length + item.registeredPlates.length,
      0,
    );
    return { valid, expired, vehicles };
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return subscriptions;
    return subscriptions.filter((item) => {
      const plates = [
        ...item.registeredVehicles.map((vehicle) => vehicle.plate),
        ...item.registeredPlates,
      ].join(" ");
      return `${item.customerName} ${item.customerEmail} ${item.planName} ${plates}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [query, subscriptions]);

  return (
    <section className="dashboard">
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon"><CreditCard size={20} /></div>
          <span>Gói còn hiệu lực</span>
          <strong>{summary.valid}</strong>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><CreditCard size={20} /></div>
          <span>Gói hết hiệu lực</span>
          <strong>{summary.expired}</strong>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><CreditCard size={20} /></div>
          <span>Biển số đăng ký</span>
          <strong>{summary.vehicles}</strong>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><CreditCard size={20} /></div>
          <span>Loại gói dịch vụ</span>
          <strong>{plans.length}</strong>
        </div>
      </div>

      <div className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Gói dịch vụ</p>
              <h2>Cấu hình gói</h2>
            </div>
            <CreditCard size={22} />
          </div>
          <div className="module-list">
            {plans.map((plan) => (
              <div className="module-item" key={plan.id}>
                <CreditCard size={18} />
                <div>
                  <strong>{plan.name}</strong>
                  <span className="muted-cell">
                    {durationLabel(plan.duration)} - {plan.durationDays} ngày - {currency.format(plan.price)}
                  </span>
                  <span className="muted-cell">
                    {plan.maxVehicles < 0 ? "Không giới hạn biển số" : `Tối đa ${plan.maxVehicles} biển số`}
                  </span>
                </div>
              </div>
            ))}
            {plans.length === 0 && <p className="muted-text">Chưa có cấu hình gói dịch vụ.</p>}
          </div>
        </div>

        <div className="panel wide">
          <div className="panel-heading">
            <div>
              <p>Đối chiếu tự động</p>
              <h2>Danh sách gói thành viên</h2>
            </div>
            <div className="inline-actions">
              <div className="search-box">
                <Search size={16} />
                <input
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm khách hàng, gói, biển số"
                  value={query}
                />
              </div>
              <button className="small-button" disabled={loading} onClick={loadSubscriptions} type="button">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {message && <p className="system-log">{message}</p>}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Gói</th>
                  <th>Thời hạn</th>
                  <th>Trạng thái</th>
                  <th>Biển số áp dụng</th>
                  <th>Áp dụng giảm giá</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((item) => {
                  const plates = [
                    ...item.registeredVehicles.map((vehicle) => vehicle.plate),
                    ...item.registeredPlates,
                  ].filter(Boolean);

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.customerName}</strong>
                        <span className="muted-cell">{item.customerEmail}</span>
                      </td>
                      <td>{item.planName}</td>
                      <td>
                        {formatDate(item.startDate)} - {formatDate(item.endDate)}
                      </td>
                      <td>
                        <span className={item.isValidNow ? "badge success" : "badge warning"}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td>
                        {plates.length ? plates.join(", ") : <span className="muted-cell">Chưa đăng ký biển số</span>}
                      </td>
                      <td>
                        <span className={item.isValidNow && plates.length ? "badge success" : "badge"}>
                          {item.isValidNow && plates.length ? "Giảm 100%" : "Không áp dụng"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredSubscriptions.length === 0 && (
                  <tr>
                    <td className="muted-cell" colSpan={6}>
                      Chưa có gói dịch vụ nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
