"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  MessageSquareWarning,
  Send,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import type { DisputeItem, DisputeStatus } from "@/types";

const apiOrigin = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
).replace(/\/api\/?$/, "");

function fileUrl(url: string) {
  return url.startsWith("http") ? url : `${apiOrigin}${url}`;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "Đã xử lý":
      return "badge success";
    case "Đang xử lý":
      return "badge warning";
    case "Từ chối":
      return "badge danger";
    default:
      return "badge";
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DISPUTE_STATUSES: DisputeStatus[] = [
  "Mới",
  "Đang xử lý",
  "Đã xử lý",
  "Từ chối",
];

export function DisputeDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { currentUser, setActionLog } = useParkingApp();
  const [detail, setDetail] = useState<DisputeItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [replyContent, setReplyContent] = useState("");
  const [newStatus, setNewStatus] = useState<DisputeStatus | "">("");
  const [sending, setSending] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  const isStaff =
    currentUser?.role === "admin" || currentUser?.role === "staff";

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/disputes/${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) {
        setActionLog(data.message || "Không tải được chi tiết khiếu nại.");
        router.replace("/disputes");
        return;
      }
      setDetail(data.dispute);
    } catch (error) {
      console.error("[disputes] detail load failed:", error);
      setActionLog("Lỗi kết nối khi tải chi tiết khiếu nại.");
      router.replace("/disputes");
    } finally {
      setLoading(false);
    }
  }, [id, router, setActionLog]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSending(true);
    try {
      const msgRes = await apiFetch(`/disputes/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: replyContent.trim() }),
      });
      const msgData = await msgRes.json();
      if (!msgRes.ok) {
        setActionLog(msgData.message || "Gửi tin nhắn thất bại.");
        return;
      }
      if (newStatus && newStatus !== detail?.status) {
        await apiFetch(`/disputes/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        });
      }
      setReplyContent("");
      setNewStatus("");
      await loadDetail();
      setActionLog("Đã gửi phản hồi.");
    } catch (err) {
      console.error("[disputes] reply failed:", err);
      setActionLog("Lỗi khi gửi phản hồi.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <section className="dispute-detail-page">
        <div className="dispute-detail-loading">
          <Loader2 size={20} className="animate-spin" />
          Đang tải chi tiết khiếu nại...
        </div>
      </section>
    );
  }

  if (!detail) return null;

  // Build full thread: original message + messages array
  const thread = [
    {
      id: "original",
      senderRole: "customer" as const,
      senderName: detail.contactName,
      content: detail.content,
      createdAt: detail.createdAt,
      attachments: detail.attachments,
    },
    ...(detail.messages ?? []).map((m) => ({
      id: m.id,
      senderRole: m.senderRole,
      senderName: m.senderName,
      content: m.content,
      createdAt: m.createdAt,
      attachments: [] as string[],
    })),
  ];

  const isClosed = detail.status === "Đã xử lý" || detail.status === "Từ chối";

  return (
    <section className="dispute-detail-page">
      <button
        className="secondary-button dispute-back-button"
        type="button"
        onClick={() => router.push("/disputes")}
      >
        <ArrowLeft size={16} /> Quay lại danh sách
      </button>

      <div className="dispute-ticket-layout">
        {/* ── Sidebar ── */}
        <aside className="panel dispute-ticket-sidebar">
          <div className="dispute-sidebar-title">
            <MessageSquareWarning size={18} />
            <strong>Thông tin khiếu nại</strong>
          </div>
          <div className="dispute-sidebar-item">
            <span>Mã</span>
            <strong>{detail.code}</strong>
          </div>
          <div className="dispute-sidebar-item">
            <span>Người gửi</span>
            <strong>{detail.contactName}</strong>
          </div>
          <div className="dispute-sidebar-item">
            <span>SĐT</span>
            <strong>{detail.contactPhone}</strong>
          </div>
          {detail.contactEmail && (
            <div className="dispute-sidebar-item">
              <span>Email</span>
              <strong>{detail.contactEmail}</strong>
            </div>
          )}
          <div className="dispute-sidebar-item">
            <span>Đã gửi</span>
            <strong>{formatDateTime(detail.createdAt)}</strong>
          </div>
          <div className="dispute-sidebar-item">
            <span>Trạng thái</span>
            <span className={statusBadgeClass(detail.status)}>
              {detail.status}
            </span>
          </div>
          <div className="dispute-sidebar-item">
            <span>Lý do</span>
            <strong>{detail.reason}</strong>
          </div>
          <div className="dispute-sidebar-item">
            <span>Biển số</span>
            <strong>{detail.plate || "—"}</strong>
          </div>
          {detail.handledAt && (
            <div className="dispute-sidebar-item">
              <span>Xử lý lúc</span>
              <strong>{formatDateTime(detail.handledAt)}</strong>
            </div>
          )}
        </aside>

        {/* ── Thread ── */}
        <main className="dispute-thread">
          <div className="dispute-thread-header">
            <div>
              <span className="dispute-ticket-code">#{detail.code}</span>
              <h1>{detail.reason}</h1>
              <p>
                {isStaff
                  ? "Trao đổi với khách và cập nhật trạng thái xử lý"
                  : "Trao đổi và theo dõi phản hồi từ bộ phận hỗ trợ"}
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Quay lại"
              onClick={() => router.push("/disputes")}
            >
              <X size={18} />
            </button>
          </div>

          <div className="dispute-chat-container">
            {thread.map((msg) => {
              const isCustomer = msg.senderRole === "customer";
              return (
                <article
                  key={msg.id}
                  className={`dispute-chat-message ${isCustomer ? "is-customer" : "is-staff"}`}
                >
                  <div className="dispute-chat-meta">
                    <div
                      className={`dispute-chat-avatar${isCustomer ? "" : " staff"}`}
                    >
                      {isCustomer
                        ? msg.senderName.charAt(0).toUpperCase()
                        : "iP"}
                    </div>
                    <div>
                      <strong>{msg.senderName}</strong>
                      <span>
                        {formatDateTime(msg.createdAt)} ·{" "}
                        {isCustomer
                          ? "Khách hàng"
                          : msg.senderRole === "admin"
                            ? "Quản trị viên"
                            : "Nhân viên"}
                      </span>
                    </div>
                  </div>
                  <div className="dispute-chat-bubble">
                    <p>{msg.content}</p>
                    {msg.attachments.length > 0 && (
                      <div className="dispute-attachments">
                        {msg.attachments.map((url) => (
                          <a
                            key={url}
                            href={fileUrl(url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img src={fileUrl(url)} alt="Minh chứng" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

            {/* Waiting notice for customers */}
            {!isStaff &&
              (detail.messages ?? []).filter((m) => m.senderRole !== "customer")
                .length === 0 && (
                <div className="dispute-waiting-message">
                  <MessageSquareWarning size={18} />
                  Khiếu nại đã được tiếp nhận. Bộ phận hỗ trợ sẽ phản hồi tại
                  đây.
                </div>
              )}

            <div ref={chatBottomRef} />
          </div>

          {/* ── Admin/Staff Reply Form ── */}
          {isStaff && !isClosed && (
            <form className="dispute-reply-form" onSubmit={handleReply}>
              <div className="dispute-reply-top">
                <label className="dispute-reply-status-label">
                  Cập nhật trạng thái
                  <select
                    value={newStatus}
                    onChange={(e) =>
                      setNewStatus(e.target.value as DisputeStatus | "")
                    }
                  >
                    <option value="">Giữ nguyên ({detail.status})</option>
                    {DISPUTE_STATUSES.filter((s) => s !== detail.status).map(
                      (s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <div className="dispute-reply-input-row">
                <textarea
                  className="dispute-reply-textarea"
                  placeholder="Nhập phản hồi cho khách hàng..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={3}
                  required
                  disabled={sending}
                />
                <button
                  className="primary-button dispute-reply-send"
                  type="submit"
                  disabled={sending || !replyContent.trim()}
                  aria-label="Gửi phản hồi"
                >
                  {sending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  {sending ? "Đang gửi..." : "Gửi"}
                </button>
              </div>
            </form>
          )}

          {isStaff && isClosed && (
            <div className="dispute-closed-notice">
              Khiếu nại đã{" "}
              <strong>
                {detail.status === "Đã xử lý" ? "được xử lý" : "bị từ chối"}
              </strong>
              . Không thể gửi thêm phản hồi.
            </div>
          )}

          {/* ── Customer Reply Form ── */}
          {!isStaff && !isClosed && (
            <form className="dispute-reply-form" onSubmit={handleReply}>
              <div className="dispute-reply-input-row">
                <textarea
                  className="dispute-reply-textarea"
                  placeholder="Nhập nội dung bổ sung cho khiếu nại..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={3}
                  required
                  disabled={sending}
                />
                <button
                  className="primary-button dispute-reply-send"
                  type="submit"
                  disabled={sending || !replyContent.trim()}
                  aria-label="Gửi tin nhắn"
                >
                  {sending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  {sending ? "Đang gửi..." : "Gửi"}
                </button>
              </div>
            </form>
          )}

          {!isStaff && isClosed && (
            <div className="dispute-closed-notice">
              Khiếu nại đã{" "}
              <strong>
                {detail.status === "Đã xử lý" ? "được xử lý" : "bị từ chối"}
              </strong>
              .
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
