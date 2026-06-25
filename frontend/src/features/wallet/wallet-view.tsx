"use client";

import { Package, QrCode, Settings, Wallet } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { currency } from "@/lib/constants";
import { TransactionHistoryView } from "@/features/wallet/transaction-history-view";

export function WalletView() {
  const {
    currentUser,
    paymentConfigState,
    pricingConfigState,
    membershipActive,
    membershipExpiresAt,
    updatePaymentConfig,
    purchaseParkingPackage,
    activateMembership,
  } = useParkingApp();

  if (!currentUser) {
    return null;
  }

  return (
    <section className="content-grid">
      {currentUser.role !== "admin" && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Gói gửi xe</p>
              <h2>Mua / gia hạn gói tháng</h2>
            </div>
            <Package size={22} />
          </div>
          <div className="profile-lines mb-4">
            <span>Gói thành viên: {membershipActive ? `Đang hoạt động đến ${membershipExpiresAt}` : "Chưa kích hoạt"}</span>
            <span>Giá gói tháng: {currency.format(pricingConfigState.monthlyRate)}</span>
          </div>
          <form className="stack-form" onSubmit={purchaseParkingPackage}>
            <label>
              Số tháng
              <select defaultValue="1" name="months">
                <option value="1">1 tháng</option>
                <option value="3">3 tháng</option>
                <option value="6">6 tháng</option>
                <option value="12">12 tháng</option>
              </select>
            </label>
            <button className="full-button" type="submit">
              Mua / gia hạn gói
            </button>
            <button className="full-button" onClick={activateMembership} type="button">
              Kích hoạt gói thành viên
            </button>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>VietQR</p>
            <h2>{paymentConfigState.bankName}</h2>
          </div>
          <QrCode size={22} />
        </div>
        {currentUser.role === "admin" ? (
          <form className="stack-form" key={paymentConfigState.id} onSubmit={updatePaymentConfig}>
            <label>
              Ngân hàng
              <input defaultValue={paymentConfigState.bankName} name="bankName" required />
            </label>
            <label>
              BIN ngân hàng
              <input defaultValue={paymentConfigState.bankBin} name="bankBin" required />
            </label>
            <label>
              Số tài khoản
              <input defaultValue={paymentConfigState.accountNumber} name="accountNumber" required />
            </label>
            <label>
              Chủ tài khoản
              <input defaultValue={paymentConfigState.accountName} name="accountName" required />
            </label>
            <label>
              Tiền tố nội dung
              <input defaultValue={paymentConfigState.transferPrefix} name="transferPrefix" required />
            </label>
            <button className="full-button" type="submit">
              <Settings size={18} />
              Lưu VietQR
            </button>
          </form>
        ) : (
          <div className="profile-lines">
            <span>Thanh toán online qua VietQR hoặc ví nội bộ.</span>
            <span>Nội dung chuyển khoản theo từng phiên gửi xe.</span>
          </div>
        )}
      </div>

      <TransactionHistoryView />
    </section>
  );
}
