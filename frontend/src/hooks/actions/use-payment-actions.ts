import { FormEvent } from "react";

import { apiFetch } from "@/lib/client-api";
import type { ParkingSession, PricingConfig, TransactionItem } from "@/types";

type PaymentActionsParams = {
  setSessions: (sessions: ParkingSession[] | ((items: ParkingSession[]) => ParkingSession[])) => void;
  setPricingConfigState: (config: PricingConfig) => void;
  setTransactionList: (transactions: TransactionItem[] | ((items: TransactionItem[]) => TransactionItem[])) => void;
  setActionLog: (log: string) => void;
};

export function createPaymentActions({
  setSessions,
  setPricingConfigState,
  setTransactionList,
  setActionLog,
}: PaymentActionsParams) {
  async function updatePricing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      freeMinutes: Number(form.get("freeMinutes") || 0),
      hourlyRate: Number(form.get("hourlyRate") || 0),
      overnightRate: Number(form.get("overnightRate") || 0),
      monthlyRate: Number(form.get("monthlyRate") || 0),
      overdueFineRate: Number(form.get("overdueFineRate") || 0),
    };

    try {
      const response = await apiFetch("/pricing-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setActionLog(data.message || "Không lưu được bảng giá.");
        return;
      }

      setPricingConfigState(data.pricingConfig);
      setActionLog("Đã cập nhật bảng giá trong MongoDB.");
    } catch {
      setActionLog("Không kết nối được API cấu hình giá.");
    }
  }

  async function confirmTransaction(id: string) {
    const response = await apiFetch(`/transactions/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Admin xác nhận thủ công" }),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không xác nhận được giao dịch.");
      return;
    }
    setTransactionList((items) => items.map((item) => (item.id === id ? data.transaction : item)));
    setActionLog("Đã xác nhận thanh toán.");
  }

  async function createPaymentForSession(id: string) {
    const response = await apiFetch(`/transactions/session/${id}`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không tạo được giao dịch.");
      return;
    }

    const payosOrderCode = data.payos?.orderCode;
    const frontendUrl = data.payos?.checkoutUrl;

    // Reload sessions and start polling for payment status
    await reloadSessions();

    if (payosOrderCode) {
      setActionLog("Đã tạo liên kết thanh toán. Đang chờ thanh toán...");
      pollPaymentStatus(id, payosOrderCode);
    } else {
      setActionLog(data.message || "Đã tạo giao dịch cho phiên.");
    }
  }

  async function reloadSessions() {
    const sessionResponse = await apiFetch("/parking-sessions");
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      setSessions(sessionData.sessions);
    }
  }

  async function pollPaymentStatus(sessionId: string, orderCode: number | string) {
    const MAX_ATTEMPTS = 60; // poll for up to 3 minutes (3s interval)
    let attempts = 0;

    const intervalId = setInterval(async () => {
      attempts++;
      try {
        const res = await apiFetch(`/public/session/${sessionId}/payment-status`);
        if (res.ok) {
          const status = await res.json();
          if (status.paymentStatus === "fully_paid" || status.paymentStatus === "partial_paid") {
            clearInterval(intervalId);
            await reloadSessions();
            setActionLog(`Thanh toán thành công cho phiên ${sessionId.slice(-6)}.`);
            return;
          }
        }
        if (status?.transaction?.status === "paid") {
          clearInterval(intervalId);
          await reloadSessions();
          setActionLog(`Thanh toán thành công cho phiên ${sessionId.slice(-6)}.`);
          return;
        }
      } catch {
        // ignore errors during polling
      }
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(intervalId);
        setActionLog(`Hết thời gian chờ thanh toán cho phiên ${sessionId.slice(-6)}.`);
      }
    }, 3000);
  }

  return {
    updatePricing,
    confirmTransaction,
    createPaymentForSession,
  };
}
