"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Radio, X } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { MemberRfidIssuePanel } from "./member-rfid-issue-panel";

type MyRfidCard = {
  id: string;
  plate?: string;
  status: string;
};

export function CustomerRfidRegistrationView() {
  const { registeredVehicles } = useParkingApp();
  const [myCards, setMyCards] = useState<MyRfidCard[]>([]);
  const [buyingVehicleId, setBuyingVehicleId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showIssuePanel, setShowIssuePanel] = useState(false);

  async function refreshMyRfidCards() {
    try {
      const response = await apiFetch("/rfid/mine");
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.cards)) setMyCards(data.cards);
    } catch {}
  }

  useEffect(() => {
    void Promise.resolve().then(refreshMyRfidCards);
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
      setNotice(`Đã tạo yêu cầu cho xe ${plate}. Hãy thanh toán QR PayOS, sau đó chờ cấp thẻ.`);
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
        <div className="subs-cards-grid">
          {registeredVehicles.filter((vehicle) => vehicle.status !== "Blacklist" && vehicle.status !== "Cần duyệt").map((vehicle) => {
            const hasCard = myCards.some((card) => card.plate?.replace(/[\s-]/g, "").toUpperCase() === vehicle.plate.replace(/[\s-]/g, "").toUpperCase() && card.status === "active");
            return <div className="subscription-card" key={vehicle.id}>
              <strong>{vehicle.plate}</strong><span>{hasCard ? "Đã có RFID Member" : "Chưa có RFID Member"}</span>
              {!hasCard && <button className="small-button" type="button" disabled={!!buyingVehicleId} onClick={() => void handleBuyRfid(vehicle.id, vehicle.plate)}>{buyingVehicleId === vehicle.id ? "Đang tạo QR…" : "Đăng ký mua thẻ RFID"}</button>}
            </div>;
          })}
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
