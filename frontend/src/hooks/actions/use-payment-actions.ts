import { FormEvent } from "react";

import { apiFetch } from "@/lib/client-api";
import type { ParkingSession, PricingConfig, TransactionItem, DemoUser, PaymentConfig } from "@/types";

type PaymentActionsParams = {
  setSessions: (sessions: ParkingSession[] | ((items: ParkingSession[]) => ParkingSession[])) => void;
  setPricingConfigState: (config: PricingConfig) => void;
  setTransactionList: (transactions: TransactionItem[] | ((items: TransactionItem[]) => TransactionItem[])) => void;
  setActionLog: (log: string) => void;
  currentUser: DemoUser | null;
  setCurrentUser: (user: DemoUser | null) => void;
  setPaymentConfigState: (config: PaymentConfig) => void;
  pricingConfigState: PricingConfig;
  transactionList: TransactionItem[];
  setMembershipActive: (active: boolean) => void;
  setMembershipExpiresAt: (expiresAt: string) => void;
};

export function createPaymentActions({
  setSessions,
  setPricingConfigState,
  setTransactionList,
  setActionLog,
  currentUser,
  setCurrentUser,
  setPaymentConfigState,
  pricingConfigState,
  transactionList,
  setMembershipActive,
  setMembershipExpiresAt,
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
          if (status?.transaction?.status === "paid") {
            clearInterval(intervalId);
            await reloadSessions();
            setActionLog(`Thanh toán thành công cho phiên ${sessionId.slice(-6)}.`);
            return;
          }
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

  async function updatePaymentConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      bankName: String(form.get("bankName") || ""),
      bankBin: String(form.get("bankBin") || ""),
      accountNumber: String(form.get("accountNumber") || ""),
      accountName: String(form.get("accountName") || ""),
      transferPrefix: String(form.get("transferPrefix") || ""),
    };

    try {
      const response = await apiFetch("/payment-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setActionLog(data.message || "Không lưu được cấu hình thanh toán.");
        return;
      }

      setPaymentConfigState(data.paymentConfig);
      setActionLog("Đã lưu cấu hình VietQR.");
    } catch {
      setActionLog("Không kết nối được API thanh toán.");
    }
  }

  async function topUpWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser) return;
    const amount = Number(new FormData(event.currentTarget).get("amount") || 0);
    if (amount <= 0) {
      setActionLog("Số tiền nạp phải lớn hơn 0.");
      return;
    }

    const topUp: TransactionItem = {
      id: `GD-NAP-${Date.now().toString().slice(-5)}`,
      method: "Nạp ví",
      amount,
      status: "paid",
      content: "Nạp tiền vào ví nội bộ",
      createdAt: new Date().toLocaleString("vi-VN"),
      paidAt: new Date().toLocaleString("vi-VN"),
    };

    setCurrentUser({
      ...currentUser,
      wallet: (currentUser.wallet || 0) + amount,
    });
    setTransactionList((items) => [topUp, ...items]);
    setActionLog(`Đã nạp ${amount.toLocaleString("vi-VN")}đ vào ví.`);
    event.currentTarget.reset();
  }

  async function payWithWallet(transactionId: string) {
    if (!currentUser) return;
    const transaction = transactionList.find((item) => item.id === transactionId);
    if (!transaction || transaction.status !== "pending") {
      setActionLog("Giao dịch không hợp lệ để thanh toán.");
      return;
    }

    if ((currentUser.wallet || 0) < transaction.amount) {
      setActionLog("Số dư ví không đủ. Vui lòng nạp thêm.");
      return;
    }

    setCurrentUser({
      ...currentUser,
      wallet: (currentUser.wallet || 0) - transaction.amount,
    });

    setTransactionList((items) =>
      items.map((item) =>
        item.id === transactionId
          ? {
              ...item,
              status: "paid",
              method: "Ví nội bộ",
              paidAt: new Date().toLocaleString("vi-VN"),
            }
          : item
      )
    );
    setActionLog(`Đã thanh toán online ${transaction.amount.toLocaleString("vi-VN")}đ bằng ví.`);
  }

  async function purchaseParkingPackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser) return;
    const form = new FormData(event.currentTarget);
    const months = Number(form.get("months") || 1);
    const amount = pricingConfigState.monthlyRate * months;

    if ((currentUser.wallet || 0) < amount) {
      setActionLog("Số dư ví không đủ để mua gói. Vui lòng nạp thêm.");
      return;
    }

    const expires = new Date();
    expires.setMonth(expires.getMonth() + months);

    setCurrentUser({
      ...currentUser,
      wallet: (currentUser.wallet || 0) - amount,
    });

    setMembershipActive(false);
    setMembershipExpiresAt("");

    setTransactionList((items) => [
      {
        id: `GD-GOI-${Date.now().toString().slice(-5)}`,
        method: "Gói gửi xe tháng",
        amount,
        status: "paid",
        content: `Mua gói ${months} tháng`,
        createdAt: new Date().toLocaleString("vi-VN"),
        paidAt: new Date().toLocaleString("vi-VN"),
      },
      ...items,
    ]);

    setActionLog(`Đã mua gói gửi xe ${months} tháng. Nhấn "Kích hoạt gói" để sử dụng.`);
    event.currentTarget.reset();
  }

  function activateMembership() {
    if (!currentUser) return;
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 1);
    setMembershipActive(true);
    setMembershipExpiresAt(expires.toLocaleDateString("vi-VN"));
    setActionLog("Đã kích hoạt gói thành viên.");
  }

  function paymentStatusLabel(status: TransactionItem["status"]) {
    switch (status) {
      case "paid":
        return "Đã thanh toán";
      case "pending":
        return "Chờ thanh toán";
      case "failed":
        return "Thất bại";
      case "cancelled":
        return "Đã hủy";
      default:
        return "Không rõ";
    }
  }

  return {
    updatePricing,
    updatePaymentConfig,
    confirmTransaction,
    createPaymentForSession,
    topUpWallet,
    payWithWallet,
    purchaseParkingPackage,
    activateMembership,
    paymentStatusLabel,
  };
}
