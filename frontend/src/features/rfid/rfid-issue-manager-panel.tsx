"use client";

import { useEffect, useState } from "react";
import * as api from "./rfid-api";
import { getRfidInventory, type RfidInventoryItem } from "./rfid-sales-api";

const labels: Record<string, string> = {
  pending_payment: "Chờ thanh toán",
  waiting_issuance: "Đã thanh toán · chờ duyệt cấp thẻ",
  approved_waiting_assignment: "Đã duyệt · chờ gắn thẻ",
  completed: "Đã bàn giao",
  rejected: "Từ chối",
};

async function loadAvailableInventoryCards() {
  const firstPage = await getRfidInventory({ status: "available", limit: 100, page: 1 });
  const pages = Math.ceil(firstPage.total / firstPage.limit);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
      getRfidInventory({ status: "available", limit: 100, page: index + 2 }),
    ),
  );

  return [firstPage, ...rest]
    .flatMap((result) => result.items)
    .filter((card) => card.cardType === "guest")
    .sort((firstCard, secondCard) => firstCard.uid.localeCompare(secondCard.uid));
}

export function RfidIssueManagerPanel() {
  const [items, setItems] = useState<api.RfidPurchaseRequest[]>([]);
  const [availableCards, setAvailableCards] = useState<RfidInventoryItem[]>([]);
  const [selectedUid, setSelectedUid] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [requestsResponse, cards] = await Promise.all([
        api.fetchRfidPurchaseRequests(),
        loadAvailableInventoryCards(),
      ]);
      const data = await requestsResponse.json();
      if (!requestsResponse.ok) {
        throw new Error(data.message || "Không thể tải yêu cầu cấp thẻ.");
      }
      setItems(data.requests || []);
      setAvailableCards(cards);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải dữ liệu RFID.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  async function action(id: string, actionType: "approve" | "reject") {
    const response = await api.reviewRfidPurchaseRequest(id, { action: actionType, reason: note[id] });
    const data = await response.json();
    setMessage(response.ok ? "Đã cập nhật yêu cầu." : data.message || "Không thể cập nhật.");
    if (response.ok) await load();
  }

  async function assign(id: string) {
    const uid = selectedUid[id];
    if (!uid) {
      setMessage("Hãy chọn một thẻ RFID còn trống trong kho.");
      return;
    }

    setAssigningId(id);
    try {
      const response = await api.assignRfidPurchaseCard(id, { uid });
      const data = await response.json();
      setMessage(response.ok ? "Đã gán thẻ kho và hoàn tất bàn giao." : data.message || "Không thể cấp thẻ.");
      if (response.ok) {
        setSelectedUid((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        await load();
      }
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-header">
        <div>
          <h3>Yêu cầu mua và cấp RFID Member</h3>
          <p className="muted-text">
            Chỉ xử lý yêu cầu đã thanh toán: duyệt, chọn thẻ còn trống trong kho và bàn giao cho thành viên.
          </p>
        </div>
      </div>

      {message && <p className="action-log">{message}</p>}

      {loading ? (
        <p>Đang tải yêu cầu và thẻ RFID trong kho...</p>
      ) : items.length === 0 ? (
        <p className="muted-text">Chưa có yêu cầu mua thẻ nào.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => (
            <div key={item.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
              <strong>{item.vehicle?.plate || "—"}</strong> · {item.vehicle?.ownerName || "Thành viên"}
              <span className="badge warning" style={{ marginLeft: 8 }}>
                {labels[item.status]}
              </span>
              <p className="muted-text" style={{ margin: "7px 0" }}>
                Phí phát hành: {new Intl.NumberFormat("vi-VN").format(item.salePrice)} ₫ · {new Date(item.createdAt).toLocaleString("vi-VN")}
              </p>

              {item.status === "waiting_issuance" && (
                <>
                  <textarea
                    rows={2}
                    placeholder="Lý do từ chối hoặc ghi chú duyệt"
                    value={note[item.id] || ""}
                    onChange={(event) => setNote({ ...note, [item.id]: event.target.value })}
                    style={{ width: "100%", marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="small-button primary" onClick={() => void action(item.id, "approve")}>Duyệt yêu cầu</button>
                    <button className="small-button" onClick={() => void action(item.id, "reject")}>Từ chối</button>
                  </div>
                </>
              )}

              {item.status === "approved_waiting_assignment" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    aria-label="Chọn thẻ RFID còn trống trong kho"
                    value={selectedUid[item.id] || ""}
                    onChange={(event) => setSelectedUid({ ...selectedUid, [item.id]: event.target.value })}
                    disabled={assigningId === item.id || availableCards.length === 0}
                    style={{ minWidth: 260, flex: "1 1 260px" }}
                  >
                    <option value="">
                      {availableCards.length ? "Chọn thẻ RFID còn trống trong kho" : "Kho hiện không còn thẻ RFID trống"}
                    </option>
                    {availableCards.map((card) => (
                      <option key={card.id} value={card.uid}>
                        {card.uid}{card.cardId ? " · " + card.cardId : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    className="small-button primary"
                    onClick={() => void assign(item.id)}
                    disabled={!selectedUid[item.id] || assigningId === item.id}
                  >
                    {assigningId === item.id ? "Đang gắn thẻ..." : "Cấp và gắn thẻ"}
                  </button>
                </div>
              )}

              {item.status === "pending_payment" && <p className="muted-text">Đang chờ thành viên thanh toán QR.</p>}
              {item.status === "completed" && <p className="muted-text success">Đã hoàn tất cấp thẻ: {item.card?.uid || "—"}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
