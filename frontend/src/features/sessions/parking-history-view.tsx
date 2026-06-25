"use client";

import { ReceiptText, Search } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { currency } from "@/lib/constants";

export function ParkingHistoryView() {
  const {
    currentUser,
    filteredSessions,
    searchText,
    setSearchText,
    approveCheckout,
    createPaymentForSession,
  } = useParkingApp();

  if (!currentUser) {
    return null;
  }

  return (
    <div className="panel wide">
      <div className="panel-heading">
        <div>
          <p>View Parking History</p>
          <h2>Tìm kiếm thông tin gửi xe</h2>
        </div>
        <div className="search-box">
          <Search size={16} />
          <input
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Tìm biển số, mã phiên, chủ xe"
            value={searchText}
          />
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã phiên</th>
              <th>Biển số</th>
              <th>Chủ xe</th>
              <th>Vị trí</th>
              <th>AI biển vào</th>
              <th>Trạng thái</th>
              <th>Match</th>
              <th>Xác minh</th>
              <th>Thanh toán</th>
              <th>Điểm ảnh xe</th>
              <th>Phí</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.map((session) => (
              <tr key={session.id}>
                <td>{session.id}</td>
                <td>{session.plate}</td>
                <td>{session.owner}</td>
                <td>{session.slot}</td>
                <td>
                  {session.entryDetectedPlate || session.plate}
                  {session.entryConfidence ? ` (${session.entryConfidence}%)` : ""}
                </td>
                <td>
                  <span className={session.status === "Đang gửi" ? "badge warning" : "badge success"}>
                    {session.status}
                  </span>
                </td>
                <td>
                  <span className={session.matchStatus === "Không khớp" ? "badge warning" : "badge"}>
                    {session.matchStatus || "Chưa checkout"}
                  </span>
                </td>
                <td>
                  <span className={session.verificationStatus === "Chờ duyệt" ? "badge warning" : "badge"}>
                    {session.verificationStatus || "Không cần"}
                  </span>
                </td>
                <td>
                  <span className={session.paymentStatus === "paid" ? "badge success" : "badge warning"}>
                    {session.paymentStatus === "paid"
                      ? "Đã thanh toán"
                      : session.paymentStatus === "pending"
                        ? "Chờ xác nhận"
                        : "Chưa thanh toán"}
                  </span>
                </td>
                <td>{session.vehicleMatchScore ? `${session.vehicleMatchScore}%` : "Chưa có"}</td>
                <td>
                  <strong>
                    {session.feeBreakdown || session.status === "Đã hoàn thành"
                      ? currency.format(session.fee)
                      : "Chưa tính"}
                  </strong>
                  {session.feeBreakdown && (
                    <span className="muted-cell">
                      {session.feeBreakdown.totalMinutes} phút, {session.feeBreakdown.billableHours} giờ tính phí
                    </span>
                  )}
                </td>
                <td>
                  {session.verificationStatus === "Chờ duyệt" && currentUser.role === "admin" ? (
                    <button
                      className="small-button"
                      onClick={() => approveCheckout(session.id, session.exitDetectedPlate || session.plate)}
                      type="button"
                    >
                      Duyệt
                    </button>
                  ) : session.status === "Đã hoàn thành" && session.fee > 0 && session.paymentStatus !== "paid" ? (
                    <button className="small-button" onClick={() => createPaymentForSession(session.id)} type="button">
                      QR
                    </button>
                  ) : (
                    <ReceiptText size={18} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}