"use client";

import { Camera, ScanLine, Upload } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { ParkingHistoryView } from "@/features/sessions/parking-history-view";

export function SessionsView() {
  const {
    currentUser,
    sessions,
    exitSessionId,
    setExitSessionId,
    createSession,
    checkoutWithImage,
    completeSession,
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

      <ParkingHistoryView />

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
