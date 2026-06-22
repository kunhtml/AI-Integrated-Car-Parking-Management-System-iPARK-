"use client";

import { CreditCard, Package, QrCode, Settings, Wallet } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { currency } from "@/lib/constants";
import { transactions } from "@/lib/mock-data";
import type { TransactionItem } from "@/types";

export function WalletView() {
  const {
    currentUser,
    paymentConfigState,
    pricingConfigState,
    transactionList,
    membershipActive,
    membershipExpiresAt,
    updatePaymentConfig,
    confirmTransaction,
    topUpWallet,
    payWithWallet,
    purchaseParkingPackage,
    activateMembership,
    paymentStatusLabel,
  } = useParkingApp();

  if (!currentUser) {
    return null;
  }

  const displayTransactions: TransactionItem[] = transactionList.length
    ? transactionList
    : transactions.map((item) => ({
        id: item.id,
        method: item.method,
        amount: item.amount,
        status: item.status === "Thành công" ? "paid" : "pending",
        content: item.id,
        createdAt: item.time,
      }));

  const invoices = displayTransactions.filter((item) => item.status === "paid");

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Số dư ví</p>
            <h2>{currency.format(currentUser.wallet || 0)}</h2>
          </div>
          <Wallet size={22} />
        </div>
        <div className="profile-lines">
          <span>Gói thành viên: {membershipActive ? `Đang hoạt động đến ${membershipExpiresAt}` : "Chưa kích hoạt"}</span>
          <span>Giá gói tháng: {currency.format(pricingConfigState.monthlyRate)}</span>
        </div>
      </div>

      {currentUser.role !== "admin" && (
        <>
          <div className="panel">
            <div className="panel-heading">
              <div>
                <p>Nạp ví</p>
                <h2>Top Up Wallet</h2>
              </div>
              <CreditCard size={22} />
            </div>
            <form className="stack-form" onSubmit={topUpWallet}>
              <label>
                Số tiền nạp (VND)
                <input min={10000} name="amount" placeholder="100000" required type="number" />
              </label>
              <button className="full-button" type="submit">
                Nạp tiền vào ví
              </button>
            </form>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <p>Gói gửi xe</p>
                <h2>Mua / gia hạn gói tháng</h2>
              </div>
              <Package size={22} />
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
        </>
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

      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Giao dịch</p>
            <h2>Trạng thái thanh toán & QR điện tử</h2>
          </div>
          <CreditCard size={22} />
        </div>
        <DataTable
          headers={["Mã", "Phương thức", "Số tiền", "Trạng thái", "Nội dung", "QR", "Thao tác"]}
          rows={displayTransactions.map((item) => [
            item.id,
            item.method,
            currency.format(item.amount),
            paymentStatusLabel(item.status),
            item.content,
            item.qrUrl ? (
              <a className="small-button" href={item.qrUrl} key={`${item.id}-qr`} rel="noreferrer" target="_blank">
                Xem QR
              </a>
            ) : (
              "Không có"
            ),
            item.status === "pending" && currentUser.role === "admin" ? (
              <button className="small-button" key={item.id} onClick={() => confirmTransaction(item.id)} type="button">
                Xác nhận
              </button>
            ) : item.status === "pending" && currentUser.role !== "admin" ? (
              <button className="small-button" key={item.id} onClick={() => payWithWallet(item.id)} type="button">
                Thanh toán ví
              </button>
            ) : (
              "OK"
            ),
          ])}
        />
      </div>

      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Hóa đơn</p>
            <h2>Biên lai đã thanh toán</h2>
          </div>
          <CreditCard size={22} />
        </div>
        <DataTable
          headers={["Mã hóa đơn", "Nội dung", "Số tiền", "Thời gian"]}
          rows={invoices.map((item) => [
            item.id,
            item.content,
            currency.format(item.amount),
            item.paidAt || item.createdAt,
          ])}
        />
      </div>
    </section>
  );
}
