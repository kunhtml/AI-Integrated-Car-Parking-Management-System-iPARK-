"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  Loader2,
  MessageSquareWarning,
  Send,
  Upload,
  X,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import type { DisputeItem, DisputeSessionRef } from "@/types";

const REASONS = [
  "Sai phí gửi xe",
  "Sai thời gian vào/ra",
  "Nhận dạng biển số sai",
  "Thanh toán trùng / chưa ghi nhận",
  "Hư hỏng - mất mát tài sản",
  "Thái độ phục vụ",
  "Khác",
];

const MAX_ATTACHMENTS = 5;
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

function formatMoney(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DisputesView() {
  const router = useRouter();
  const { currentUser, setActionLog } = useParkingApp();

  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [sessionRefs, setSessionRefs] = useState<DisputeSessionRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<DisputeItem | null>(null);

  const [form, setForm] = useState({
    sessionId: "",
    reason: REASONS[0],
    content: "",
    contactName: currentUser?.name ?? "",
    contactPhone: currentUser?.phone ?? "",
    contactEmail: currentUser?.email ?? "",
  });
  const [attachments, setAttachments] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [disputeRes, referenceRes] = await Promise.all([
        apiFetch("/disputes"),
        apiFetch("/disputes/references"),
      ]);
      if (disputeRes.ok) {
        const data = await disputeRes.json();
        setDisputes(data.disputes);
      }
      if (referenceRes.ok) {
        const data = await referenceRes.json();
        setSessionRefs(data.sessions);
      }
    } catch (error) {
      console.error("[disputes] load failed:", error);
      setActionLog("Không tải được dữ liệu khiếu nại.");
    } finally {
      setLoading(false);
    }
  }, [setActionLog]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCount = useMemo(
    () =>
      disputes.filter(
        (item) => item.status === "Mới" || item.status === "Đang xử lý",
      ).length,
    [disputes],
  );

  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (attachments.length >= MAX_ATTACHMENTS) {
      setErrors((prev) => ({
        ...prev,
        attachments: `Tối đa ${MAX_ATTACHMENTS} ảnh.`,
      }));
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({
        ...prev,
        attachments: "Chỉ chấp nhận file ảnh.",
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, attachments: "Ảnh tối đa 5MB." }));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/uploads/dispute", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          attachments: data.message || "Upload thất bại.",
        }));
        return;
      }
      setAttachments((prev) => [...prev, data.url as string]);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.attachments;
        return next;
      });
    } catch (error) {
      console.error("[disputes] upload failed:", error);
      setErrors((prev) => ({
        ...prev,
        attachments: "Lỗi kết nối khi upload.",
      }));
    } finally {
      setUploading(false);
    }
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.sessionId) errs.sessionId = "Chọn phiên gửi xe liên quan.";
    if (form.content.trim().length < 10)
      errs.content = "Nội dung tối thiểu 10 ký tự.";
    if (!form.contactName.trim()) errs.contactName = "Nhập họ tên liên hệ.";
    if (!/^0\d{9,10}$/.test(form.contactPhone.trim()))
      errs.contactPhone = "Số điện thoại không hợp lệ.";
    return errs;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/disputes", {
        method: "POST",
        body: JSON.stringify({
          sessionId: form.sessionId,
          reason: form.reason,
          content: form.content.trim(),
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim(),
          contactEmail: form.contactEmail.trim() || undefined,
          attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionLog(data.message || "Gửi khiếu nại thất bại.");
        return;
      }
      setDisputes((prev) => [data.dispute, ...prev]);
      setAttachments([]);
      setForm((prev) => ({
        ...prev,
        sessionId: "",
        content: "",
      }));
      setActionLog(`Đã gửi khiếu nại ${data.dispute.code}.`);
    } catch (error) {
      console.error("[disputes] submit failed:", error);
      setActionLog("Lỗi kết nối khi gửi khiếu nại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    const res = await apiFetch(`/disputes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setActionLog(data.message || "Không huỷ được khiếu nại.");
      return;
    }
    setDisputes((prev) => prev.filter((item) => item.id !== id));
    setActionLog("Đã huỷ khiếu nại.");
  }

  if (!currentUser) return null;

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Khiếu nại</p>
            <h2>Gửi khiếu nại mới</h2>
          </div>
          <MessageSquareWarning size={22} />
        </div>

        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Phiên gửi xe liên quan
            <select
              value={form.sessionId}
              onChange={(e) => update("sessionId", e.target.value)}
            >
              <option value="">— Chọn phiên gửi xe —</option>
              {sessionRefs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.plate} · {formatDateTime(item.checkInAt)} · {item.slot}{" "}
                  · {formatMoney(item.fee)}
                </option>
              ))}
            </select>
            {errors.sessionId && (
              <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>
                {errors.sessionId}
              </span>
            )}
          </label>

          <label>
            Lý do khiếu nại
            <select
              value={form.reason}
              onChange={(e) => update("reason", e.target.value)}
            >
              {REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>

          <label>
            Nội dung chi tiết
            <textarea
              rows={4}
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              placeholder="Mô tả rõ sự việc, thời gian, số tiền chênh lệch..."
              maxLength={2000}
            />
            {errors.content && (
              <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>
                {errors.content}
              </span>
            )}
          </label>

          <label>
            Họ tên liên hệ
            <input
              value={form.contactName}
              onChange={(e) => update("contactName", e.target.value)}
            />
            {errors.contactName && (
              <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>
                {errors.contactName}
              </span>
            )}
          </label>

          <label>
            Số điện thoại
            <input
              value={form.contactPhone}
              onChange={(e) => update("contactPhone", e.target.value)}
              placeholder="0xxxxxxxxx"
              inputMode="tel"
            />
            {errors.contactPhone && (
              <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>
                {errors.contactPhone}
              </span>
            )}
          </label>

          <label>
            Email nhận phản hồi
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
            />
          </label>

          <div>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--muted)",
                marginBottom: 6,
              }}
            >
              Minh chứng ({attachments.length}/{MAX_ATTACHMENTS})
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 8,
              }}
            >
              {attachments.map((url) => (
                <div
                  key={url}
                  style={{
                    position: "relative",
                    width: 72,
                    height: 56,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid var(--border, #e2e6ef)",
                  }}
                >
                  <img
                    src={fileUrl(url)}
                    alt="Minh chứng khiếu nại"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Xoá ảnh minh chứng"
                    onClick={() =>
                      setAttachments((prev) =>
                        prev.filter((item) => item !== url),
                      )
                    }
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.6)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                border: "1px solid var(--border, #e2e6ef)",
                borderRadius: 8,
                cursor: uploading ? "wait" : "pointer",
                fontSize: "0.82rem",
                fontWeight: 500,
                background: "var(--surface)",
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              {uploading ? "Đang tải..." : "Đính kèm ảnh"}
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                style={{ display: "none" }}
                disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
              />
            </label>
            {errors.attachments ? (
              <div
                style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 4 }}
              >
                {errors.attachments}
              </div>
            ) : (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                  marginTop: 4,
                }}
              >
                PNG, JPG tối đa 5MB mỗi ảnh.
              </div>
            )}
          </div>

          <button
            className="full-button"
            type="submit"
            disabled={submitting || uploading}
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {submitting ? "Đang gửi..." : "Gửi khiếu nại"}
          </button>
        </form>
      </div>

      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Theo dõi</p>
            <h2>
              Khiếu nại của tôi{openCount > 0 ? ` · ${openCount} đang mở` : ""}
            </h2>
          </div>
          <Eye size={22} />
        </div>

        {loading ? (
          <p style={{ color: "var(--muted)" }}>Đang tải khiếu nại...</p>
        ) : (
          <DataTable
            headers={["Mã", "Lý do", "Ngày gửi", "Trạng thái"]}
            rows={disputes.map((item) => [
              item.code,
              item.reason,
              formatDateTime(item.createdAt),
              <span
                className={statusBadgeClass(item.status)}
                key={`${item.id}-status`}
              >
                {item.status}
              </span>,
            ])}
            onRowClick={(rowIndex) => {
              const dispute = disputes[rowIndex];
              if (dispute)
                router.push(`/disputes/${encodeURIComponent(dispute.id)}`);
            }}
          />
        )}
      </div>

      {detail && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.85)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: 24,
              width: "90vw",
              maxWidth: 560,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
                Khiếu nại {detail.code}
              </h2>
              <button
                onClick={() => setDetail(null)}
                aria-label="Đóng"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                }}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, fontSize: "0.88rem" }}>
              <div>
                <strong>Trạng thái:</strong>{" "}
                <span className={statusBadgeClass(detail.status)}>
                  {detail.status}
                </span>
              </div>
              <div>
                <strong>Lý do:</strong> {detail.reason}
              </div>
              <div>
                <strong>Biển số:</strong> {detail.plate || "—"}
              </div>
              <div>
                <strong>Nội dung:</strong> {detail.content}
              </div>
              <div>
                <strong>Liên hệ:</strong> {detail.contactName} ·{" "}
                {detail.contactPhone}
                {detail.contactEmail ? ` · ${detail.contactEmail}` : ""}
              </div>
              <div>
                <strong>Ngày gửi:</strong> {formatDateTime(detail.createdAt)}
              </div>
              {detail.handledAt && (
                <div>
                  <strong>Ngày xử lý:</strong>{" "}
                  {formatDateTime(detail.handledAt)}
                </div>
              )}
              {detail.resolutionNote && (
                <div>
                  <strong>Phản hồi:</strong> {detail.resolutionNote}
                </div>
              )}
              {detail.attachments.length > 0 && (
                <div>
                  <strong>Minh chứng:</strong>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 6,
                    }}
                  >
                    {detail.attachments.map((url) => (
                      <a
                        key={url}
                        href={fileUrl(url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={fileUrl(url)}
                          alt="Minh chứng khiếu nại"
                          style={{
                            width: 96,
                            height: 72,
                            objectFit: "cover",
                            borderRadius: 8,
                          }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
