"use client";

import { UserRound, Wallet } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { currency, roleLabels } from "@/lib/constants";

export function ProfileView() {
  const { currentUser, transactionList, membershipActive, membershipExpiresAt } = useParkingApp();

  if (!currentUser) {
    return null;
  }

  const latestTransaction = transactionList[0];

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Hồ sơ</p>
            <h2>{currentUser.name}</h2>
          </div>
          <UserRound size={22} />
        </div>
        <div className="profile-lines">
          <span>Email: {currentUser.email}</span>
          <span>Vai trò: {roleLabels[currentUser.role]}</span>
          <span>Trạng thái: {currentUser.status}</span>
          <span>
            Gói thành viên: {membershipActive ? `Đang dùng đến ${membershipExpiresAt}` : "Chưa kích hoạt"}
          </span>
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Ví điện tử</p>
            <h2>{currency.format(currentUser.wallet)}</h2>
          </div>
          <Wallet size={22} />
        </div>
        <div className="profile-lines">
          <span>
            Giao dịch gần nhất:{" "}
            {latestTransaction
              ? `${latestTransaction.content} (${currency.format(latestTransaction.amount)})`
              : "Chưa có giao dịch"}
          </span>
          <span>Phương thức: {latestTransaction?.method || "—"}</span>
        </div>
      </div>
    </section>
  );
}
