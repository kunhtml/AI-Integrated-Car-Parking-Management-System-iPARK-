"use client";

import { Camera, ReceiptText, ScanLine, Search, Upload } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { currency } from "@/lib/constants";

export function SessionsView() {
  const {
    currentUser,
    sessions,
    filteredSessions,
    searchText,
    setSearchText,
    exitSessionId,
    setExitSessionId,
    createSession,
    checkoutWithImage,
    completeSession,
    approveCheckout,
    createPaymentForSession,
  } = useParkingApp();

  if (!currentUser) {
    return null;
  }

  const myActiveSessions = sessions.filter(
    (session) =>
      session.status === "Đang gửi" &&
      (session.owner === currentUser.name || session.owner === currentUser.email),
  );

  return (
    <section className="content-grid">
      {currentUser.role === "customer" && (
        <div className="panel wide">
          <div className="panel-heading">
            <div>
              <p>Phiên đang gửi</p>
              <h2>Theo dõi xe realtime</h2>
            </div>
          </div>
          {myActiveSessions.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mã phiên</th>
                    <th>Biển số</th>
                    <th>Vị trí</th>
                    <th>Giờ vào</th>
                    <th>Trạng thái</th>
                    <th>Thanh toán</th>
                  </tr>
                </thead>
                <tbody>
                  {myActiveSessions.map((session) => (
                    <tr key={session.id}>
                      <td>{session.id}</td>
                      <td>{session.plate}</td>
                      <td>{session.slot}</td>
                      <td>{session.checkIn}</td>
                      <td>
                        <span className="badge warning">{session.status}</span>
                      </td>
                      <td>
                        {session.paymentStatus === "paid"
                          ? "Đã thanh toán"
                          : session.paymentStatus === "pending"
                            ? "Chờ xác nhận"
                            : "Chưa thanh toán"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-text">Bạn chưa có phiên gửi xe đang hoạt động.</p>
          )}
        </div>
      )}

      {currentUser.role !== "customer" && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Vận hành</p>
              <h2>Xe vào bằng ảnh</h2>
            </div>
            <Camera size={22} />
          </div>
          <form className="stack-form" onSubmit={createSession}>
            <label>
              Chủ xe
              <input name="owner" placeholder="Tên khách hàng" required />
            </label>
            <label>
              Loại xe
              <select name="vehicleType">
                <option>Ô tô</option>
              </select>
            </label>
            <label>
              Ảnh xe vào
              <input accept="image/*" name="entryImage" required type="file" />
            </label>
            <button className="full-button" type="submit">
              <Upload size={18} />
              Upload và nhận diện
            </button>
          </form>
        </div>
      )}

      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Quản lý phiên</p>
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
                    ) : session.status === "Đang gửi" && currentUser.role !== "customer" ? (
                      <button className="small-button" onClick={() => setExitSessionId(session.id)} type="button">
                        Chọn checkout
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

      {currentUser.role !== "customer" && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Checkout</p>
              <h2>Xe ra bằng ảnh</h2>
            </div>
            <ScanLine size={22} />
          </div>
          <form className="stack-form" onSubmit={checkoutWithImage}>
            <label>
              Phiên đang gửi
              <select name="sessionId" onChange={(event) => setExitSessionId(event.target.value)} value={exitSessionId}>
                <option value="">Chọn phiên</option>
                {sessions
                  .filter((session) => session.status === "Đang gửi")
                  .map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.plate} - {session.slot}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Ảnh xe ra
              <input accept="image/*" name="exitImage" required type="file" />
            </label>
            <button className="full-button" type="submit">
              <ScanLine size={18} />
              Upload và đối chiếu
            </button>
            <button className="link-button" onClick={() => exitSessionId && completeSession(exitSessionId)} type="button">
              Xác minh thủ công nếu ảnh lỗi
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
