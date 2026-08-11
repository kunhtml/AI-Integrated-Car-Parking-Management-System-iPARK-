"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  CreditCard,
  Loader2,
  RefreshCcw,
  Trash2,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";
import { CheckoutPaymentModal } from "@/features/cameras/checkout-payment-modal";

type CameraLog = {
  id: string;
  direction: "in" | "out";
  detectedPlate: string;
  plate: string;
  ownerName?: string;
  rfidUid?: string;
  userType: "resident" | "guest" | "unknown";
  barrierOpened: boolean;
  imagePath?: string;
  sessionId?: string | null;
  sessionStatus?: string | null;
  sessionPaymentStatus?: "unpaid" | "partial_paid" | "fully_paid" | null;
  sessionFee?: number | null;
  sessionPaidAmount?: number | null;
  createdAt: string;
};

type PendingCheckout = {
  sessionId: string;
  plate: string;
  fee: number;
  payos: {
    qrCode: string;
    checkoutUrl: string;
    orderCode: number | string;
    amount: number;
    accountNumber?: string;
    accountName?: string;
    bin?: string;
    description?: string;
  };
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("vi-VN");
}

function userTypeBadge(type: string) {
  if (type === "resident") return <span className="badge">{type}</span>;
  if (type === "guest") return <span className="badge warning">{type}</span>;
  return <span className="badge muted">{type}</span>;
}

function paymentBadge(status: CameraLog["sessionPaymentStatus"]) {
  if (status === "fully_paid") {
    return <span className="badge success">Đã thanh toán</span>;
  }
  if (status === "partial_paid") {
    return <span className="badge warning">Một phần</span>;
  }
  return <span className="badge danger">Chưa thanh toán</span>;
}

export function CamerasLogsPanel() {
  const [logs, setLogs] = useState<CameraLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<PendingCheckout | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await apiFetch("/camera-logs/logs?limit=100");
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg(data.message || "Không tải được nhật ký.");
      }
    } catch {
      setMsg("Lỗi kết nối tới backend.");
    } finally {
      setLoading(false);
    }
  }

  async function clearAll() {
    if (!confirming) {
      setConfirming(true);
      setMsg(
        "Bấm lần nữa để xác nhận xóa toàn bộ nhật ký camera. Sau 5s nút sẽ reset."
      );
      window.setTimeout(() => setConfirming(false), 5000);
      return;
    }
    setDeleting(true);
    setMsg("");
    try {
      const res = await apiFetch("/camera-logs/logs", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setLogs([]);
        setMsg(
          data.message ||
            `Đã xóa ${data.deleted ?? 0} bản ghi nhật ký camera.`
        );
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg(data.message || "Xóa thất bại.");
      }
    } catch {
      setMsg("Lỗi kết nối tới backend.");
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

<<<<<<< Updated upstream
  /**
   * Khách vãng lai checkout (qua camera hoặc thủ công):
   * - Nếu phiên đang mở → gọi PATCH /parking-sessions để finalizeCheckout (tính phí).
   * - Tạo PayOS payment link và mở modal QR nếu còn nợ phí.
   */
=======
>>>>>>> Stashed changes
  async function handleCheckoutPayment(log: CameraLog) {
    if (!log.sessionId) return;
    setPayingId(log.id);
    setMsg("");
    try {
<<<<<<< Updated upstream
      // Bước 1: nếu phiên còn "Đang gửi" → kết thúc phiên để tính phí theo PricingConfig
=======
>>>>>>> Stashed changes
      if (log.sessionStatus === "Đang gửi") {
        const checkoutRes = await apiFetch(`/parking-sessions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: log.sessionId }),
        });
        const checkoutData = await checkoutRes.json().catch(() => ({}));
        if (!checkoutRes.ok) {
          setMsg(checkoutData.message || "Không thể kết thúc phiên đỗ xe.");
          return;
        }
<<<<<<< Updated upstream
        // cập nhật log cục bộ để hiển thị phí mới
=======
>>>>>>> Stashed changes
        log.sessionStatus = "Đã hoàn thành";
        log.sessionFee = Number(checkoutData?.session?.fee ?? log.sessionFee ?? 0);
      }

<<<<<<< Updated upstream
      // Bước 2: tạo PayOS link (nếu còn phí)
=======
>>>>>>> Stashed changes
      const res = await apiFetch(`/transactions/session/${log.sessionId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.message || "Không tạo được liên kết thanh toán.");
        await load();
        return;
      }
      if (!data.payos?.qrCode) {
<<<<<<< Updated upstream
        // Đã thanh toán đủ hoặc không phát sinh phí → reload & thông báo
=======
>>>>>>> Stashed changes
        await load();
        setMsg(data.message || "Phiên không phát sinh phí / đã thanh toán đủ.");
        return;
      }
      const totalFee = Number(log.sessionFee ?? data.sessionFee ?? 0);
      const remaining = Number(data.payos.amount ?? totalFee);
      setPending({
        sessionId: log.sessionId,
        plate: log.plate || log.detectedPlate || "—",
        fee: totalFee || remaining,
        payos: data.payos,
      });
    } catch {
      setMsg("Không tạo được liên kết thanh toán. Kiểm tra kết nối tới backend.");
    } finally {
      setPayingId(null);
    }
  }

  async function handlePaid() {
    setMsg("Đã nhận thanh toán. Đang cập nhật nhật ký…");
    await load();
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-heading">
        <div>
          <p>Camera & RFID</p>
          <h2>Nhật ký cổng vào/ra</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="muted-cell" style={{ fontSize: "0.85rem" }}>
            {logs.length} bản ghi
          </span>
          <Camera size={22} />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          className="small-button"
          onClick={load}
          disabled={loading || deleting}
          type="button"
        >
          <RefreshCcw size={13} className={loading ? "spin" : ""} /> Tải lại
        </button>
        <button
          className="small-button"
          onClick={clearAll}
          disabled={loading || deleting || logs.length === 0}
          type="button"
          style={{
            color: confirming ? "#dc2626" : undefined,
            borderColor: confirming ? "rgba(239,68,68,0.5)" : undefined,
          }}
        >
          <Trash2 size={13} className={deleting ? "spin" : ""} />{" "}
          {confirming ? "Xác nhận xóa?" : "Xóa log"}
        </button>
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
          Dữ liệu được Python bridge service đẩy lên từ camera ESP32 + RFID.
          Hiển thị 100 bản ghi gần nhất.
        </p>
      </div>

      {msg && (
        <p
          className="muted-cell"
          style={{
            marginBottom: 12,
            color: msg.includes("Lỗi") || msg.includes("Xóa thất bại")
              ? "var(--danger)"
              : "var(--success, #16a34a)",
          }}
        >
          {msg}
        </p>
      )}

      {loading && logs.length === 0 ? (
        <p className="muted-cell" style={{ padding: 32, textAlign: "center" }}>
          <Loader2
            size={16}
            className="spin"
            style={{ verticalAlign: "middle", marginRight: 6 }}
          />
          Đang tải...
        </p>
      ) : (
        <DataTable
          headers={[
            "Thời gian",
            "Hướng",
            "Biển số",
            "Chủ xe",
            "UID",
            "Loại",
            "Phí",
            "Thanh toán",
            "Thao tác",
          ]}
          rows={logs.map((log) => {
            const fee = Number(log.sessionFee ?? 0);
<<<<<<< Updated upstream
            // Phiên còn nợ gì: có phí chưa thanh toán, HOẶC phiên vẫn "Đang gửi"
=======
>>>>>>> Stashed changes
            const hasPendingFee =
              Boolean(log.sessionId) && fee > 0 && log.sessionPaymentStatus !== "fully_paid";
            const isOpenSession =
              Boolean(log.sessionId) && log.sessionStatus === "Đang gửi";
            const isActionable = hasPendingFee || isOpenSession;
            return [
              <span
                key="t"
                style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}
              >
                {formatDate(log.createdAt)}
              </span>,
              <span
                key="dir"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: log.direction === "in" ? "#16a34a" : "#2563eb",
                  fontWeight: 600,
                }}
              >
                {log.direction === "in" ? (
                  <ArrowDownToLine size={13} />
                ) : (
                  <ArrowUpFromLine size={13} />
                )}
                {log.direction === "in" ? "Vào" : "Ra"}
              </span>,
              <span
                key="plate"
                style={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  color: "var(--primary)",
                }}
              >
                {log.plate || log.detectedPlate || "—"}
              </span>,
              <span key="owner" style={{ fontSize: "0.85rem" }}>
                {log.ownerName || "—"}
              </span>,
              <span
                key="uid"
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.8rem",
                  color: "var(--muted)",
                }}
              >
                {log.rfidUid || "—"}
              </span>,
              <span key="type">{userTypeBadge(log.userType)}</span>,
              <span key="fee" style={{ fontSize: "0.85rem" }}>
                {log.sessionId ? (
                  fee > 0 ? (
                    currency.format(fee)
                  ) : (
                    <span style={{ color: "var(--muted)" }}>Miễn phí</span>
                  )
                ) : (
                  "—"
                )}
              </span>,
<<<<<<< Updated upstream
              <span key="pay">{paymentBadge(log.sessionPaymentStatus)}</span>,
              <span key="act" style={{ display: "inline-flex", gap: 4 }}>
=======
              <span key="payment">
                {log.sessionId ? paymentBadge(log.sessionPaymentStatus) : "—"}
              </span>,
              <span key="action">
>>>>>>> Stashed changes
                {isActionable ? (
                  <button
                    type="button"
                    className="small-button primary"
<<<<<<< Updated upstream
                    style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                    disabled={payingId === log.id || pending !== null}
                    onClick={() => handleCheckoutPayment(log)}
                    title={
                      isOpenSession
                        ? "Kết thúc phiên đỗ và tạo QR thanh toán"
                        : "Tạo QR PayOS để khách chuyển khoản"
                    }
=======
                    onClick={() => handleCheckoutPayment(log)}
                    disabled={payingId === log.id}
                    style={{ fontSize: "0.78rem" }}
>>>>>>> Stashed changes
                  >
                    {payingId === log.id ? (
                      <Loader2 size={12} className="spin" />
                    ) : (
                      <CreditCard size={12} />
                    )}
<<<<<<< Updated upstream
                    {isOpenSession ? (hasPendingFee ? "Checkout & TT" : "Checkout") : "Thanh toán"}
                  </button>
                ) : log.sessionId && log.sessionPaymentStatus === "fully_paid" ? (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--success, #16a34a)",
                      fontWeight: 600,
                    }}
                  >
                    ✓ Hoàn tất
                  </span>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>—</span>
=======
                    Thanh toán
                  </button>
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>—</span>
>>>>>>> Stashed changes
                )}
              </span>,
            ];
          })}
        />
      )}

<<<<<<< Updated upstream
      {logs.length === 0 && !loading && (
        <p style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          Chưa có nhật ký nào. Bật Python bridge service để bắt đầu ghi log.
        </p>
      )}

=======
>>>>>>> Stashed changes
      {pending && (
        <CheckoutPaymentModal
          sessionId={pending.sessionId}
          plate={pending.plate}
          fee={pending.fee}
          payos={pending.payos}
          onClose={() => setPending(null)}
<<<<<<< Updated upstream
          onPaid={() => {
            setPending(null);
            handlePaid();
          }}
=======
          onPaid={handlePaid}
>>>>>>> Stashed changes
        />
      )}
    </div>
  );
<<<<<<< Updated upstream
}
=======
}
>>>>>>> Stashed changes
