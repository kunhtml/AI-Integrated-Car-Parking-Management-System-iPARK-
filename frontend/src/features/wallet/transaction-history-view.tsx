"use client";

import { CreditCard } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { currency } from "@/lib/constants";
import { transactions } from "@/lib/mock-data";
import type { TransactionItem } from "@/types";

export function TransactionHistoryView() {
  const { currentUser, transactionList, paymentStatusLabel, confirmTransaction, payWithWallet } = useParkingApp();

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
    <>
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>View Transaction History</p>
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
          rows={invoices.map((item) => [item.id, item.content, currency.format(item.amount), item.paidAt || item.createdAt])}
        />
      </div>
    </>
  );
}