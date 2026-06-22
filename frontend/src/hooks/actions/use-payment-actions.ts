import { FormEvent } from "react";

import { apiFetch } from "@/lib/client-api";
import type { DemoUser, PaymentConfig, PricingConfig, TransactionItem } from "@/types";

type PaymentActionsParams = {
  currentUser: DemoUser | null;
  setCurrentUser: (user: DemoUser | null) => void;
  pricingConfigState: PricingConfig;
  setPricingConfigState: (config: PricingConfig) => void;
  setPaymentConfigState: (config: PaymentConfig) => void;
  setTransactionList: (transactions: TransactionItem[] | ((items: TransactionItem[]) => TransactionItem[])) => void;
  transactionList: TransactionItem[];
  setMembershipActive: (active: boolean) => void;
  setMembershipExpiresAt: (value: string) => void;
  setActionLog: (log: string) => void;
};

function paymentStatusLabel(status: TransactionItem["status"]) {
  if (status === "paid") return "Đã thanh toán";
  if (status === "pending") return "Chờ xác nhận";
  if (status === "failed") return "Thất bại";
  return "Đã hủy";
}

export function createPaymentActions({
  currentUser,
  setCurrentUser,
  pricingConfigState,
  setPricingConfigState,
  setPaymentConfigState,
  setTransactionList,
  transactionList,
  setMembershipActive,
  setMembershipExpiresAt,
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
    if (data.transaction) {
      setTransactionList((items) => [data.transaction, ...items.filter((item) => item.id !== data.transaction.id)]);
    }
    setActionLog(data.message || "Đã tạo giao dịch cho phiên.");
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

    setCurrentUser({ ...currentUser, wallet: (currentUser.wallet || 0) + amount });
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

    setCurrentUser({ ...currentUser, wallet: (currentUser.wallet || 0) - transaction.amount });
    setTransactionList((items) =>
      items.map((item) =>
        item.id === transactionId
          ? { ...item, status: "paid", method: "Ví nội bộ", paidAt: new Date().toLocaleString("vi-VN") }
          : item,
      ),
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

    setCurrentUser({ ...currentUser, wallet: (currentUser.wallet || 0) - amount });
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
