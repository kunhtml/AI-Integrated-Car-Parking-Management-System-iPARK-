"use client";

import { useState } from "react";
import { Camera, CreditCard, ReceiptText, ScanLine, Search, Upload } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { currency } from "@/lib/constants";
import type { ParkingSession } from "@/types";

type EntryMode = "plate" | "rfid" | "image";

function isActiveSession(session: ParkingSession) {
  return session.status === "Đang gửi";
}

function isCompletedSession(session: ParkingSession) {
  return session.status === "Đã hoàn thành";
}

function isPaid(session: ParkingSession) {
  return ["paid", "fully_paid"].includes(session.paymentStatus || "");
}

function paymentLabel(session: ParkingSession) {
  if (session.paymentMethod === "subscription" || session.isMember) return "Gói thành viên";
  if (session.paymentStatus === "fully_paid") return "Đã thanh toán";
  if (session.paymentStatus === "partial_paid") return "Thanh toán một phần";
  if (session.paymentStatus === "paid") return "Đã thanh toán";
  if (session.paymentStatus === "pending") return "Chờ xác nhận";
  return "Chưa thanh toán";
}

export function SessionsView() {
  const [entryMode, setEntryMode] = useState<EntryMode>("plate");
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
    cameraEntry,
    cameraExit,
    deviceList,
  } = useParkingApp();

  if (!currentUser) {
    return null;
  }

  const myActiveSessions = sessions.filter(
    (session) =>
      isActiveSession(session) &&
      (session.owner === currentUser.name || session.owner === currentUser.email),
  );
  const entryCameras = deviceList.filter((device) => device.gate === "entry" && device.status !== "offline");
  const exitCameras = deviceList.filter((device) => device.gate === "exit" && device.status !== "offline");

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
            <SessionTable
              currentRole={currentUser.role}
              onApprove={approveCheckout}
              onCreatePayment={createPaymentForSession}
              onSelectExit={setExitSessionId}
              sessions={myActiveSessions}
            />
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
              <h2>Tạo phiên đỗ mới</h2>
            </div>
            <Camera size={22} />
          </div>

          <div className="action-row">
            <button className={entryMode === "plate" ? "active small-button" : "small-button"} onClick={() => setEntryMode("plate")} type="button">
              Biển số
            </button>
            <button className={entryMode === "rfid" ? "active small-button" : "small-button"} onClick={() => setEntryMode("rfid")} type="button">
              RFID UID
            </button>
            <button className={entryMode === "image" ? "active small-button" : "small-button"} onClick={() => setEntryMode("image")} type="button">
              Upload ảnh
            </button>
          </div>

          <form className="stack-form" onSubmit={createSession}>
            <label>
              Chủ xe
              <input name="owner" placeholder="Khách vãng lai / tên thành viên" />
            </label>

            {(entryMode === "plate" || entryMode === "image") && (
              <label>
                Biển số
                <input name="plate" placeholder="VD: 30H67890" required={entryMode === "plate"} />
              </label>
            )}

            {(entryMode === "rfid" || entryMode === "image") && (
              <label>
                RFID UID
                <input name="rfidUid" placeholder="VD: RFID-0001" required={entryMode === "rfid"} />
              </label>
            )}

            <label>
              Loại xe
              <select name="vehicleType">
                <option>Ô tô</option>
              </select>
            </label>

            {entryMode === "image" && (
              <label>
                Ảnh xe vào
                <input accept="image/*" name="entryImage" required type="file" />
              </label>
            )}

            <button className="full-button" type="submit">
              {entryMode === "image" ? <Upload size={18} /> : <CreditCard size={18} />}
              Tạo phiên
            </button>
          </form>

          {entryCameras.length > 0 && (
            <div className="action-row">
              {entryCameras.map((device) => (
                <button className="small-button" key={device.id} onClick={() => cameraEntry(device.id)} type="button">
                  <Camera size={14} />
                  Snapshot {device.name}
                </button>
              ))}
            </div>
          )}
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
              placeholder="Tìm biển số, mã phiên, chủ xe, RFID"
              value={searchText}
            />
          </div>
        </div>

        <SessionTable
          currentRole={currentUser.role}
          onApprove={approveCheckout}
          onCreatePayment={createPaymentForSession}
          onSelectExit={setExitSessionId}
          sessions={filteredSessions}
        />
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
                {sessions.filter(isActiveSession).map((session) => (
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

          {exitCameras.length > 0 && (
            <div className="action-row">
              {exitCameras.map((device) => (
                <button className="small-button" key={device.id} onClick={() => cameraExit(device.id)} type="button">
                  <Camera size={14} />
                  Snapshot {device.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SessionTable({
  currentRole,
  onApprove,
  onCreatePayment,
  onSelectExit,
  sessions,
}: {
  currentRole: string;
  onApprove: (id: string, plate: string) => void;
  onCreatePayment: (id: string) => void;
  onSelectExit: (id: string) => void;
  sessions: ParkingSession[];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã phiên</th>
            <th>Biển số / RFID</th>
            <th>Chủ xe</th>
            <th>Vị trí</th>
            <th>Loại phiên</th>
            <th>Trạng thái</th>
            <th>Thanh toán</th>
            <th>QR tra cứu</th>
            <th>Phí</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>{session.id}</td>
              <td>
                <strong>{session.plate}</strong>
                {session.rfidUid && <span className="muted-cell">RFID: {session.rfidUid}</span>}
              </td>
              <td>{session.owner}</td>
              <td>{session.slot}</td>
              <td>
                <span className={session.isMember ? "badge success" : "badge"}>
                  {session.isMember ? "Thành viên" : "Khách vãng lai"}
                </span>
                {session.subscriptionPlanName && <span className="muted-cell">{session.subscriptionPlanName}</span>}
                {session.barrierTriggered && <span className="muted-cell">Da mo barrier</span>}
              </td>
              <td>
                <span className={isActiveSession(session) ? "badge warning" : "badge success"}>
                  {session.status}
                </span>
              </td>
              <td>
                <span className={isPaid(session) ? "badge success" : "badge warning"}>
                  {paymentLabel(session)}
                </span>
              </td>
              <td>
                {session.paymentLookupCode ? (
                  <>
                    <span className="badge">{session.paymentLookupCode}</span>
                    {session.qrExpiry && (
                      <span className="muted-cell">
                        Exp {new Date(session.qrExpiry).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="muted-cell">Không cần</span>
                )}
              </td>
              <td>
                <strong>
                  {session.feeBreakdown || isCompletedSession(session)
                    ? currency.format(session.fee)
                    : session.isMember
                      ? "0 đ"
                      : "Chưa tính"}
                </strong>
                {session.feeBreakdown && (
                  <span className="muted-cell">
                    {session.feeBreakdown.totalMinutes} phút, {session.feeBreakdown.billableHours} giờ tính phí
                  </span>
                )}
              </td>
              <td>
                {session.verificationStatus === "Chờ duyệt" && currentRole === "admin" ? (
                  <button
                    className="small-button"
                    onClick={() => onApprove(session.id, session.exitDetectedPlate || session.plate)}
                    type="button"
                  >
                    Duyệt
                  </button>
                ) : isCompletedSession(session) && session.fee > 0 && !isPaid(session) ? (
                  <button className="small-button" onClick={() => onCreatePayment(session.id)} type="button">
                    QR
                  </button>
                ) : isActiveSession(session) && currentRole !== "customer" ? (
                  <button className="small-button" onClick={() => onSelectExit(session.id)} type="button">
                    Chọn checkout
                  </button>
                ) : (
                  <ReceiptText size={18} />
                )}
              </td>
            </tr>
          ))}
          {sessions.length === 0 && (
            <tr>
              <td className="muted-cell" colSpan={10}>
                Chưa có phiên đỗ xe nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
