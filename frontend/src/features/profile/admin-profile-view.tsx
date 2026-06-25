"use client";

import { Bell, CheckCircle2, ShieldCheck, UserRound } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { currency, roleLabels } from "@/lib/constants";

export function AdminProfileView() {
  const { currentUser, sessions, registeredVehicles, transactionList, notificationList } = useParkingApp();

  if (!currentUser) {
    return null;
  }

  const activeSessions = sessions.filter((session) => session.status === "Đang gửi").length;
  const approvedVehicles = registeredVehicles.filter((vehicle) => vehicle.status === "Đã đăng ký").length;
  const paidTransactions = transactionList.filter((transaction) => transaction.status === "paid").length;

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Admin Profile</p>
            <h2>{currentUser.name}</h2>
          </div>
          <ShieldCheck size={22} />
        </div>
        <div className="profile-lines">
          <span>Email: {currentUser.email}</span>
          <span>Vai trò: {roleLabels[currentUser.role]}</span>
          <span>Trạng thái: {currentUser.status}</span>
          <span>Ví nội bộ: {currency.format(currentUser.wallet)}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Giám sát vận hành</p>
            <h2>Chỉ số realtime</h2>
          </div>
          <CheckCircle2 size={22} />
        </div>
        <div className="profile-lines">
          <span>Phiên đang gửi: {activeSessions}</span>
          <span>Xe đã đăng ký: {approvedVehicles}</span>
          <span>Giao dịch đã thanh toán: {paidTransactions}</span>
          <span>Thông báo chưa đọc: {notificationList.filter((item) => !item.read).length}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Hồ sơ quản trị</p>
            <h2>Truy cập hệ thống</h2>
          </div>
          <UserRound size={22} />
        </div>
        <div className="profile-lines">
          <span>Quyền truy cập: {roleLabels.admin}</span>
          <span>Nhận cảnh báo realtime qua hệ thống thông báo.</span>
          <span>Theo dõi toàn bộ bãi đỗ, xe đăng ký và thanh toán.</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Thông báo</p>
            <h2>Tác vụ gần đây</h2>
          </div>
          <Bell size={22} />
        </div>
        <div className="profile-lines">
          <span>Tổng thông báo: {notificationList.length}</span>
          <span>Xe đang gửi: {activeSessions}</span>
          <span>Xe chờ duyệt: {registeredVehicles.filter((vehicle) => vehicle.status === "Cần duyệt").length}</span>
        </div>
      </div>
    </section>
  );
}