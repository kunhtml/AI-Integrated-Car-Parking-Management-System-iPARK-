"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Radio, X } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { MemberRfidIssuePanel } from "./member-rfid-issue-panel";

type MyRfidCard = {
  id: string;
  plate?: string;
  cardId?: string;
  uid?: string;
  status: string;
};

type RfidPurchaseRequest = {
  id: string;
  vehicleId: string;
  status: "pending_payment" | "waiting_issuance" | "approved_waiting_assignment" | "completed" | "rejected";
};

export function CustomerRfidRegistrationView() {
  const { registeredVehicles, subscriptionList } = useParkingApp();
  const router = useRouter();
  const [myCards, setMyCards] = useState<MyRfidCard[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<RfidPurchaseRequest[]>([]);
  const [buyingVehicleId, setBuyingVehicleId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showIssuePanel, setShowIssuePanel] = useState(false);
  const [now] = useState(() => Date.now());

  async function refreshMyRfidCards() {
    try {
      const response = await apiFetch("/rfid/mine");
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.cards)) setMyCards(data.cards);
    } catch {}
  }

  async function refreshPurchaseRequests() {
    try {
      const response = await apiFetch("/rfid/purchase-requests/mine");
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.requests)) setPurchaseRequests(data.requests);
    } catch {}
  }

  function purchaseStatusLabel(status: RfidPurchaseRequest["status"]) {
    if (status === "waiting_issuance") return "Thanh toán thành công · Đang chờ gắn RFID";
    if (status === "approved_waiting_assignment") return "Đã duyệt · Đang chờ gắn RFID";
    if (status === "pending_payment") return "Đang chờ thanh toán";
    if (status === "rejected") return "Yêu cầu mua thẻ bị từ chối";
    return "Đang hoàn tất cấp thẻ RFID";
  }

  useEffect(() => {
    const refresh = () => {
      void refreshMyRfidCards();
      void refreshPurchaseRequests();
    };
    refresh();
    const intervalId = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(intervalId);
  }, []);

  async function handleBuyRfid(vehicleId: string, plate: string) {
    if (buyingVehicleId) return;
    setBuyingVehicleId(vehicleId);
    setNotice(null);
    try {
      const created = await apiFetch("/rfid/purchase-requests", { method: "POST", body: JSON.stringify({ vehicleId }) });
      const createdData = await created.json().catch(() => ({}));
      if (!created.ok) throw new Error(createdData.message || "Không thể tạo yêu cầu mua thẻ RFID.");
      const requestId = createdData.request?.id;
      if (!requestId) throw new Error("Không nhận được mã yêu cầu mua thẻ.");
      const payment = await apiFetch(`/rfid/purchase-requests/${requestId}/pay`, { method: "POST" });
      const paymentData = await payment.json().catch(() => ({}));
      if (!payment.ok) throw new Error(paymentData.message || "Không thể tạo QR thanh toán.");
      if (paymentData.payos?.checkoutUrl) window.open(paymentData.payos.checkoutUrl, "_blank", "noopener,noreferrer");
      setNotice(`Đã tạo yêu cầu cho xe ${plate}. Hãy thanh toán QR PayOS; sau khi thành công, trạng thái sẽ chuyển sang chờ gắn RFID.`);
      await refreshPurchaseRequests();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể mua thẻ RFID.");
    } finally {
      setBuyingVehicleId(null);
    }
  }

  return (
    <div className="subscriptions-page">
      <section className="customer-subs-section">
        <h2 className="section-title"><Radio size={18} /> Đăng ký mua thẻ RFID Member</h2>
        <p className="muted-cell">Chọn xe đã được xác minh, thanh toán phí phát hành qua QR PayOS, sau đó chờ Parking Manager duyệt và cấp thẻ vật lý từ kho.</p>
        {notice && <div className="feedback-banner info">{notice}</div>}
        <div className="table-wrap rfid-purchase-table">
          <table>
            <thead>
              <tr>
                <th>Biển số</th>
                <th>Thẻ RFID</th>
                <th>Gói thành viên</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {registeredVehicles.filter((vehicle) => vehicle.status !== "Blacklist" && vehicle.status !== "Cần duyệt").map((vehicle) => {
                const card = myCards.find((item) => item.plate?.replace(/[\s-]/g, "").toUpperCase() === vehicle.plate.replace(/[\s-]/g, "").toUpperCase() && ["active", "in-use"].includes(item.status));
                const purchaseRequest = purchaseRequests.find((item) => item.vehicleId === vehicle.id && item.status !== "completed");
                const membership = subscriptionList.find((item) => item.primaryVehicleId === vehicle.id && (item.status === "active" || item.status === "pending_payment" || (item.status === "cancelled" && new Date(item.endDate).getTime() > now)));
                const remainingDays = membership ? Math.max(0, Math.ceil((new Date(membership.endDate).getTime() - now) / 86_400_000)) : 0;
                const rfidStatus = card ? (card.cardId || card.uid || "Đã có RFID Member") : purchaseRequest ? purchaseStatusLabel(purchaseRequest.status) : "Chưa có thẻ";
                const membershipStatus = membership
                  ? membership.status === "pending_payment"
                    ? "Đang chờ thanh toán"
                    : `${membership.planName} · còn ${remainingDays} ngày`
                  : "Chưa có gói";

                return (
                  <tr key={vehicle.id}>
                    <td><strong>{vehicle.plate}</strong></td>
                    <td>{rfidStatus}</td>
                    <td>{membershipStatus}</td>
                    <td className="rfid-purchase-action">
                      {!card && !purchaseRequest && (
                        <button className="small-button" type="button" disabled={!!buyingVehicleId} onClick={() => void handleBuyRfid(vehicle.id, vehicle.plate)}>
                          {buyingVehicleId === vehicle.id ? "Đang tạo QR…" : "Mua thẻ ngay"}
                        </button>
                      )}
                      {card && !membership && <button className="small-button" type="button" onClick={() => router.push("/subscriptions")}>Mua gói ngay</button>}
                      {card && membership && <button className="small-button" type="button" onClick={() => setShowIssuePanel(true)}>Báo mất / hỏng thẻ</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="customer-subs-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div><h2 className="section-title"><AlertTriangle size={18} /> Hỗ trợ thẻ RFID</h2><p className="muted-cell">Báo mất hoặc báo hỏng thẻ RFID Member đang gắn với phương tiện của bạn.</p></div>
          {myCards.length > 0 && <button className="small-button" type="button" onClick={() => setShowIssuePanel(true)}><AlertTriangle size={15} /> Báo mất/hỏng RFID</button>}
        </div>
      </section>
      {showIssuePanel && <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(15,23,42,0.55)" }} onClick={(event) => { if (event.target === event.currentTarget) setShowIssuePanel(false); }}>
        <div style={{ position: "relative", width: "min(720px, 100%)", maxHeight: "92vh", overflowY: "auto" }}>
          <button type="button" aria-label="Đóng" onClick={() => setShowIssuePanel(false)} style={{ position: "absolute", right: 12, top: 12, zIndex: 2, minHeight: 32, padding: 6, borderRadius: 8 }}><X size={18} /></button>
          <MemberRfidIssuePanel />
        </div>
      </div>}
    </div>
  );
}
