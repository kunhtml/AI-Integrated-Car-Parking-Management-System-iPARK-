"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Car,
  Check,
  Download,
  Edit,
  Eye,
  Image,
  ImageIcon,
  Loader2,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import type { FormEvent } from "react";
import type { RegisteredVehicle, VehicleRequest } from "@/types";
import { apiFetch } from "@/lib/client-api";

type StatusFilter = "all" | "Đã đăng ký" | "Cần duyệt" | "Blacklist";
type SortField = "plate" | "owner" | "status" | "createdAt";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function statusLabel(status: string) {
  return status === "Blacklist" ? "Từ chối" : status;
}

function statusIcon(status: string) {
  switch (status) {
    case "Đã đăng ký":
      return <ShieldCheck size={14} color="#22c55e" />;
    case "Cần duyệt":
      return <Shield size={14} color="#eab308" />;
    case "Blacklist":
      return <ShieldAlert size={14} color="#ef4444" />;
    default:
      return null;
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "Đã đăng ký":
      return "badge success";
    case "Cần duyệt":
      return "badge warning";
    case "Blacklist":
      return "badge danger";
    default:
      return "badge";
  }
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

export function VehicleDetailModal({
  vehicle,
  onClose,
  onApprove,
  onReject,
  rejectReason,
  onRejectReasonChange,
  processing,
  onEdit,
  isAdmin,
}: {
  vehicle: RegisteredVehicle;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  processing: boolean;
  onEdit?: () => void;
  isAdmin?: boolean;
}) {
  const isPending = vehicle.status === "Cần duyệt";
  const isRejected = vehicle.status === "Blacklist";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15,23,42,0.58)",
        backdropFilter: "blur(4px)",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 20,
          padding: 28,
          width: "min(900px, 100%)",
          maxHeight: "min(760px, 92vh)",
          overflowY: "auto",
          boxShadow: "0 24px 80px rgba(15,23,42,0.28)",
          border: "1px solid var(--border, #e2e6ef)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            paddingBottom: 18,
            borderBottom: "1px solid var(--border, #e2e6ef)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: "rgba(37,99,235,0.1)",
                color: "var(--primary)",
              }}
            >
              <Car size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
                Chi tiết phương tiện
              </h2>
              <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                Thông tin đăng ký xe
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "var(--muted)",
            }}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Ảnh xe nổi bật */}
        {vehicle.imageUrl && (
          <div
            style={{
              position: "relative",
              marginBottom: 20,
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid var(--border, #e2e6ef)",
              background: "linear-gradient(145deg, #f8fafc, #e2e8f0)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.65)",
              aspectRatio: "16 / 6",
              minHeight: 150,
            }}
          >
            <img
              src={vehicle.imageUrl}
              alt={`Xe ${vehicle.plate}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                padding: 10,
              }}
              onError={(e) => {
                const image = e.target as HTMLImageElement;
                image.style.display = "none";
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 14,
                bottom: 12,
                padding: "5px 10px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.68)",
                color: "#fff",
                fontSize: "0.72rem",
                fontWeight: 600,
                backdropFilter: "blur(6px)",
              }}
            >
              Ảnh phương tiện
            </div>
          </div>
        )}

        <div
          style={{
            background: "linear-gradient(135deg, var(--primary), #1d4ed8)",
            color: "#fff",
            borderRadius: 14,
            padding: "18px 22px",
            marginBottom: 26,
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "clamp(1.45rem, 4vw, 2rem)",
              fontWeight: 800,
              letterSpacing: 3,
            }}
          >
            {vehicle.plate}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              padding: "5px 12px",
              borderRadius: 16,
              fontSize: "0.8rem",
              fontWeight: 600,
              background:
                vehicle.status === "Đã đăng ký"
                  ? "rgba(34,197,94,0.25)"
                  : vehicle.status === "Cần duyệt"
                    ? "rgba(234,179,8,0.25)"
                    : "rgba(239,68,68,0.25)",
              color:
                vehicle.status === "Đã đăng ký"
                  ? "#86efac"
                  : vehicle.status === "Cần duyệt"
                    ? "#fde047"
                    : "#fca5a5",
            }}
          >
            {statusIcon(vehicle.status)}
            {statusLabel(vehicle.status)}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 10,
            }}
          >
            Thông tin xe
          </h3>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            {[
              ["Nhãn hiệu", vehicle.brand],
              ["Màu sơn", vehicle.color],
            ].map(([label, val]) => (
              <div
                key={label}
                className="info-box"
                style={{ minWidth: 0, padding: "14px 16px", borderRadius: 12 }}
              >
                <span className="muted-cell" style={{ fontSize: "0.72rem" }}>
                  {label}
                </span>
                <div style={{ wordBreak: "break-all" }}>
                  <strong>{val || "—"}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 10,
            }}
          >
            Chủ xe
          </h3>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            <div
              className="info-box"
              style={{ minWidth: 0, padding: "14px 16px", borderRadius: 12 }}
            >
              <span className="muted-cell" style={{ fontSize: "0.72rem" }}>
                Họ tên chủ tài khoản
              </span>
              <div style={{ wordBreak: "break-word" }}>
                <strong>{vehicle.user?.name || vehicle.owner || "—"}</strong>
              </div>
            </div>
            <div
              className="info-box"
              style={{ minWidth: 0, padding: "14px 16px", borderRadius: 12 }}
            >
              <span className="muted-cell" style={{ fontSize: "0.72rem" }}>
                Email tài khoản
              </span>
              <div style={{ wordBreak: "break-word" }}>
                <strong>{vehicle.user?.email || "—"}</strong>
              </div>
            </div>
          </div>
        </div>

        {isRejected && (
          <div
            style={{
              marginTop: 22,
              padding: 16,
              borderRadius: 14,
              border: "1px solid #fecaca",
              background: "rgba(239,68,68,0.06)",
            }}
          >
            <div style={{ color: "#b91c1c", fontWeight: 700, marginBottom: 6 }}>
              Lý do từ chối
            </div>
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {vehicle.rejectionReason || "Chưa có lý do từ chối."}
            </div>
          </div>
        )}

        {isPending && isAdmin && (
          <div
            style={{
              marginTop: 22,
              padding: 16,
              borderRadius: 14,
              border: "1px solid var(--border, #e2e6ef)",
              background: "rgba(234,179,8,0.06)",
            }}
          >
            <label
              htmlFor="vehicle-reject-reason"
              style={{ display: "block", marginBottom: 8, fontWeight: 700 }}
            >
              Nhập lý do từ chối
            </label>
            <textarea
              id="vehicle-reject-reason"
              value={rejectReason}
              onChange={(event) => onRejectReasonChange(event.target.value)}
              placeholder="Nhập lý do nếu từ chối yêu cầu..."
              rows={3}
              style={{
                width: "100%",
                resize: "vertical",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border, #e2e6ef)",
                background: "var(--surface)",
                color: "inherit",
              }}
            />
          </div>
        )}

        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 18,
            marginTop: 22,
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "var(--muted)",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span>Tạo: {formatDate(vehicle.createdAt)}</span>
          <span>Cập nhật: {formatDate(vehicle.updatedAt)}</span>
          {vehicle.isCompanyVehicle && (
            <span style={{ color: "var(--primary)", fontWeight: 600 }}>
              Xe công ty
            </span>
          )}
        </div>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {isRejected && onEdit && (
            <button
              className="small-button primary"
              onClick={onEdit}
              type="button"
            >
              <Edit size={14} /> Chỉnh sửa và gửi lại
            </button>
          )}
          {isPending && isAdmin && (
            <>
              <button
                className="small-button"
                onClick={onReject}
                disabled={processing}
                type="button"
                style={{ color: "#dc2626", borderColor: "#fecaca" }}
              >
                <X size={14} /> Từ chối
              </button>
              <button
                className="small-button"
                onClick={onApprove}
                disabled={processing}
                type="button"
                style={{ color: "#15803d", borderColor: "#bbf7d0" }}
              >
                <Check size={14} /> Duyệt
              </button>
            </>
          )}
          <button className="small-button" onClick={onClose} type="button">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function VehicleEditModal({
  vehicle,
  onClose,
  onSave,
}: {
  vehicle: RegisteredVehicle | null;
  onClose: () => void;
  onSave: (
    data: Parameters<ReturnType<typeof useParkingApp>["editVehicle"]>[1],
  ) => Promise<void>;
}) {
  const isNew = !vehicle;
  const [form, setForm] = useState({
    plate: vehicle?.plate ?? "",
    ownerName: vehicle?.owner ?? "",
    ownerPhone: vehicle?.ownerPhone ?? "",
    ownerAddress: vehicle?.ownerAddress ?? "",
    brand: vehicle?.brand ?? "",
    model: vehicle?.model ?? "",
    color: vehicle?.color ?? "",
    year: vehicle?.year?.toString() ?? "",
    engineNo: vehicle?.engineNo ?? "",
    chassisNo: vehicle?.chassisNo ?? "",
    status: vehicle?.status ?? "Đã đăng ký",
  });
  const [imageUrl, setImageUrl] = useState<string | null>(
    vehicle?.imageUrl ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  function validateForm(): Record<string, string> {
    const errs: Record<string, string> = {};
    const plate = form.plate
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "");
    if (isNew) {
      if (!plate) errs.plate = "Vui lòng nhập biển số.";
      else if (!/^[A-Z0-9]{5,9}$/.test(plate))
        errs.plate = "Biển số chỉ gồm chữ và số (5–9 ký tự).";
    } else if (plate && !/^[A-Z0-9]{5,9}$/.test(plate)) {
      errs.plate = "Biển số chỉ gồm chữ và số (5–9 ký tự).";
    }
    if (form.ownerName.trim() && form.ownerName.trim().length < 2) {
      errs.ownerName = "Họ tên phải có ít nhất 2 ký tự.";
    }
    const phone = form.ownerPhone.trim();
    if (phone) {
      if (!/^0\d{8,10}$/.test(phone))
        errs.ownerPhone = "SĐT phải bắt đầu bằng 0 và có 9–11 chữ số.";
    }
    const yearStr = form.year.trim();
    if (yearStr) {
      const y = Number(yearStr);
      const now = new Date().getFullYear();
      if (!Number.isInteger(y) || y < 1900 || y > now + 1) {
        errs.year = `Năm SX phải nằm trong khoảng 1900–${now + 1}.`;
      }
    }
    if (form.engineNo.trim() && form.engineNo.trim().length < 4) {
      errs.engineNo = "Số máy phải có ít nhất 4 ký tự.";
    }
    if (form.chassisNo.trim() && form.chassisNo.trim().length < 4) {
      errs.chassisNo = "Số khung phải có ít nhất 4 ký tự.";
    }
    return errs;
  }

  function clearError(key: string) {
    if (errors[key])
      setErrors((e) => {
        const n = { ...e };
        delete n[key];
        return n;
      });
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Chỉ chấp nhận file ảnh.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Ảnh tối đa 5MB.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/uploads/vehicle", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.message || "Upload thất bại.");
        return;
      }
      setImageUrl(data.url as string);
    } catch (err) {
      console.error("[upload] failed:", err);
      setUploadError(
        err instanceof Error
          ? `Lỗi kết nối: ${err.message}`
          : "Lỗi kết nối khi upload.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    const yearNum = form.year.trim() ? Number(form.year) : undefined;
    const data = {
      ...(isNew
        ? {
            plate: form.plate
              .trim()
              .toUpperCase()
              .replace(/[\s-]+/g, ""),
          }
        : {}),
      ownerName: form.ownerName.trim() || undefined,
      ownerPhone: form.ownerPhone.trim() || undefined,
      ownerAddress: form.ownerAddress.trim() || undefined,
      brand: form.brand.trim() || undefined,
      model: form.model.trim() || undefined,
      color: form.color.trim() || undefined,
      year: yearNum && !Number.isNaN(yearNum) ? yearNum : undefined,
      engineNo: form.engineNo.trim() || undefined,
      chassisNo: form.chassisNo.trim() || undefined,
      ...(isNew ? {} : { status: form.status }),
      imageUrl: imageUrl ?? undefined,
    };
    await onSave(
      data as Parameters<ReturnType<typeof useParkingApp>["editVehicle"]>[1],
    );
    setSaving(false);
  }

  const fields: { key: keyof typeof form; label: string; span?: boolean }[] = [
    { key: "plate", label: "Biển số" },
    { key: "ownerName", label: "Họ tên chủ xe" },
    { key: "brand", label: "Nhãn hiệu" },
    { key: "color", label: "Màu sơn" },
  ];

  return (
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
        if (e.target === e.currentTarget) onClose();
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
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isNew ? <Plus size={22} /> : <Edit size={22} />}
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
              {isNew ? "Thêm phương tiện" : "Sửa phương tiện"}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "var(--muted)",
            }}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Ảnh xe */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              marginBottom: 16,
              padding: 12,
              background: "var(--surface-2, #f5f6fa)",
              borderRadius: 10,
              border: "1px solid var(--border, #e2e6ef)",
            }}
          >
            <div
              onClick={() => {
                if (imageUrl && !uploading) setPreviewOpen(true);
              }}
              title={imageUrl ? "Bấm để xem ảnh lớn" : ""}
              style={{
                width: 96,
                height: 72,
                borderRadius: 8,
                overflow: "hidden",
                flexShrink: 0,
                background: "var(--border, #e2e6ef)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: imageUrl
                  ? "2px solid #22c55e"
                  : uploading
                    ? "2px solid #eab308"
                    : "1px solid var(--border, #e2e6ef)",
                cursor: imageUrl && !uploading ? "zoom-in" : "default",
                position: "relative",
                transition: "border-color 0.2s",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <ImageIcon
                  size={28}
                  style={{ color: "var(--muted)", opacity: 0.4 }}
                />
              )}
              {imageUrl && !uploading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageUrl(null);
                    setUploadError(null);
                  }}
                  title="Xoá ảnh"
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 20,
                    height: 20,
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
                  <X size={12} />
                </button>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--muted)",
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Ảnh phương tiện
                {imageUrl && !uploading && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      padding: "1px 6px",
                      borderRadius: 10,
                      background: "rgba(34,197,94,0.15)",
                      color: "#16a34a",
                    }}
                  >
                    Đã tải
                  </span>
                )}
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
                  transition: "border-color 0.15s",
                  opacity: uploading ? 0.7 : 1,
                }}
              >
                {uploading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Upload size={13} />
                )}
                {uploading
                  ? "Đang tải..."
                  : imageUrl
                    ? "Đổi ảnh"
                    : "Tải ảnh lên"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  style={{ display: "none" }}
                  disabled={uploading}
                />
              </label>
              {uploadError && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#ef4444",
                    marginTop: 4,
                  }}
                >
                  {uploadError}
                </div>
              )}
              {!uploadError && (
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--muted)",
                    marginTop: 4,
                  }}
                >
                  PNG, JPG tối đa 5MB — lưu vào /uploads/vehicles/
                </div>
              )}
            </div>
          </div>

          {/* Lightbox xem ảnh lớn */}
          {previewOpen && imageUrl && (
            <div
              onClick={() => setPreviewOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 100,
                background: "rgba(0,0,0,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "zoom-out",
              }}
            >
              <img
                src={imageUrl}
                alt="Preview"
                style={{
                  maxWidth: "92vw",
                  maxHeight: "92vh",
                  borderRadius: 12,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                }}
              />
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                style={{
                  position: "absolute",
                  top: 20,
                  right: 20,
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={22} />
              </button>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {fields.map(({ key, label, span }) => (
              <div
                key={key}
                style={{ gridColumn: span ? "span 2" : undefined, minWidth: 0 }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "var(--muted)",
                  }}
                >
                  {label}
                </label>
                {key === "status" ? (
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid var(--border, #e2e6ef)",
                      borderRadius: 8,
                      fontSize: "0.9rem",
                      background: "var(--surface)",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="Đã đăng ký">Đã đăng ký</option>
                    <option value="Cần duyệt">Cần duyệt</option>
                    <option value="Blacklist">Từ chối</option>
                  </select>
                ) : (
                  <>
                    <input
                      value={form[key]}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, [key]: e.target.value }));
                        clearError(key as string);
                      }}
                      required={key === "plate" && isNew}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: `1px solid ${errors[key as string] ? "#ef4444" : "var(--border, #e2e6ef)"}`,
                        borderRadius: 8,
                        fontSize: "0.9rem",
                        boxSizing: "border-box",
                      }}
                      type={key === "year" ? "number" : "text"}
                    />
                    {errors[key as string] && (
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "#ef4444",
                          marginTop: 4,
                        }}
                      >
                        {errors[key as string]}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="small-button" onClick={onClose} type="button">
              Hủy
            </button>
            <button
              className="small-button primary"
              disabled={saving}
              type="submit"
            >
              {saving ? (
                <Loader2 size={14} />
              ) : isNew ? (
                <Plus size={14} />
              ) : (
                <Check size={14} />
              )}
              {saving ? "Đang lưu..." : isNew ? "Thêm xe" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequestStatusBadge({ request }: { request: VehicleRequest }) {
  const cls =
    request.status === "approved"
      ? "badge success"
      : request.status === "rejected"
        ? "badge danger"
        : "badge warning";
  const label =
    request.status === "approved"
      ? "Đã duyệt"
      : request.status === "rejected"
        ? "Từ chối"
        : "Chờ duyệt";
  return <span className={cls}>{label}</span>;
}

function ResubmitVehicleModal({
  vehicle,
  onClose,
  onSubmit,
}: {
  vehicle: RegisteredVehicle;
  onClose: () => void;
  onSubmit: (data: Partial<RegisteredVehicle>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    plate: vehicle.plate ?? "",
    ownerName: vehicle.owner ?? "",
    ownerPhone: vehicle.ownerPhone ?? "",
    ownerAddress: vehicle.ownerAddress ?? "",
    brand: vehicle.brand ?? "",
    model: vehicle.model ?? "",
    color: vehicle.color ?? "",
    year: vehicle.year?.toString() ?? "",
    engineNo: vehicle.engineNo ?? "",
    chassisNo: vehicle.chassisNo ?? "",
  });
  const [imageUrl, setImageUrl] = useState<string | null>(
    vehicle.imageUrl ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Chỉ chấp nhận file ảnh.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Ảnh tối đa 5MB.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/uploads/vehicle", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.message || "Upload thất bại.");
        return;
      }
      setImageUrl(data.url as string);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? `Lỗi kết nối: ${err.message}`
          : "Lỗi kết nối khi upload.",
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function validateForm(): Record<string, string> {
    const errs: Record<string, string> = {};
    const plate = form.plate.trim().toUpperCase();
    if (!plate) errs.plate = "Vui lòng nhập biển số.";
    else if (!/^[A-Z0-9]{5,9}$/.test(plate)) errs.plate = "Biển số chỉ gồm chữ và số (5–9 ký tự).";
    if (form.ownerName.trim() && form.ownerName.trim().length < 2)
      errs.ownerName = "Họ tên phải có ít nhất 2 ký tự.";
    const phone = form.ownerPhone.trim();
    if (phone && !/^0\d{8,10}$/.test(phone))
      errs.ownerPhone = "SĐT phải bắt đầu bằng 0 và có 9–11 chữ số.";
    const yearStr = form.year.trim();
    if (yearStr) {
      const y = Number(yearStr);
      const now = new Date().getFullYear();
      if (!Number.isInteger(y) || y < 1900 || y > now + 1)
        errs.year = `Năm SX phải nằm trong khoảng 1900–${now + 1}.`;
    }
    if (form.engineNo.trim() && form.engineNo.trim().length < 4)
      errs.engineNo = "Số máy phải có ít nhất 4 ký tự.";
    if (form.chassisNo.trim() && form.chassisNo.trim().length < 4)
      errs.chassisNo = "Số khung phải có ít nhất 4 ký tự.";
    return errs;
  }

  function clearError(key: string) {
    if (errors[key])
      setErrors((e) => {
        const n = { ...e };
        delete n[key];
        return n;
      });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    const yearNum = form.year.trim() ? Number(form.year) : undefined;
    await onSubmit({
      plate: form.plate.trim().toUpperCase(),
      owner: form.ownerName.trim() || undefined,
      ownerPhone: form.ownerPhone.trim() || undefined,
      ownerAddress: form.ownerAddress.trim() || undefined,
      brand: form.brand.trim() || undefined,
      model: form.model.trim() || undefined,
      color: form.color.trim() || undefined,
      year: yearNum && !Number.isNaN(yearNum) ? yearNum : undefined,
      engineNo: form.engineNo.trim() || undefined,
      chassisNo: form.chassisNo.trim() || undefined,
      imageUrl: imageUrl ?? undefined,
    });
    setSaving(false);
  }

  const fields: { key: keyof typeof form; label: string; span?: boolean }[] = [
    { key: "plate", label: "Biển số" },
    { key: "ownerName", label: "Họ tên chủ xe" },
    { key: "brand", label: "Nhãn hiệu" },
    { key: "color", label: "Màu sơn" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 20,
          padding: 28,
          width: "min(560px, 100%)",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 24px 80px rgba(15,23,42,0.28)",
          border: "1px solid var(--border, #e2e6ef)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                background: "rgba(234,179,8,0.12)",
                color: "#d97706",
              }}
            >
              <Edit size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
                Chỉnh sửa và gửi lại đơn
              </h2>
              <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                Có thể sửa biển số trước khi gửi lại đơn
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "var(--muted)",
            }}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            margin: "12px 0 16px",
            padding: "10px 14px",
            background: "rgba(239,68,68,0.08)",
            borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.2)",
            fontSize: "0.85rem",
            color: "#b91c1c",
          }}
        >
          Đơn đăng ký xe này đã bị từ chối
          {vehicle.rejectionReason ? (
            <>
              : <strong>{vehicle.rejectionReason}</strong>
            </>
          ) : (
            "."
          )}{" "}
          Bạn có thể chỉnh sửa thông tin và gửi lại để admin xét duyệt.
        </div>

        {/* Ảnh xe */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 16,
            padding: 12,
            background: "var(--surface-2, #f5f6fa)",
            borderRadius: 10,
            border: "1px solid var(--border, #e2e6ef)",
          }}
        >
          <div
            onClick={() => {
              if (imageUrl && !uploading) setPreviewOpen(true);
            }}
            style={{
              width: 96,
              height: 72,
              borderRadius: 8,
              overflow: "hidden",
              flexShrink: 0,
              background: "var(--border, #e2e6ef)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: imageUrl
                ? "2px solid #22c55e"
                : "1px solid var(--border, #e2e6ef)",
              cursor: imageUrl && !uploading ? "zoom-in" : "default",
              position: "relative",
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <ImageIcon
                size={28}
                style={{ color: "var(--muted)", opacity: 0.4 }}
              />
            )}
            {imageUrl && !uploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageUrl(null);
                }}
                title="Xoá ảnh"
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 20,
                  height: 20,
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
                <X size={12} />
              </button>
            )}
          </div>
          <div style={{ flex: 1 }}>
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
              {uploading ? "Đang tải..." : imageUrl ? "Đổi ảnh" : "Tải ảnh lên"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFile}
                style={{ display: "none" }}
                disabled={uploading}
              />
            </label>
            {uploadError && (
              <div
                style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 4 }}
              >
                {uploadError}
              </div>
            )}
            {!uploadError && (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                  marginTop: 4,
                }}
              >
                PNG, JPG tối đa 5MB (tùy chọn)
              </div>
            )}
          </div>
        </div>

        {previewOpen && imageUrl && (
          <div
            onClick={() => setPreviewOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(0,0,0,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "zoom-out",
            }}
          >
            <img
              src={imageUrl}
              alt="Preview"
              style={{
                maxWidth: "92vw",
                maxHeight: "92vh",
                borderRadius: 12,
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {fields.map(({ key, label, span }) => (
              <div
                key={key}
                style={{ gridColumn: span ? "span 2" : undefined, minWidth: 0 }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "var(--muted)",
                  }}
                >
                  {label}
                </label>
                <input
                  value={form[key]}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, [key]: e.target.value }));
                    clearError(key);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: `1px solid ${errors[key] ? "#ef4444" : "var(--border, #e2e6ef)"}`,
                    borderRadius: 8,
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                  type={key === "year" ? "number" : "text"}
                />
                {errors[key] && (
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "#ef4444",
                      marginTop: 4,
                    }}
                  >
                    {errors[key]}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="small-button" onClick={onClose} type="button">
              Hủy
            </button>
            <button
              className="small-button primary"
              disabled={saving}
              type="submit"
            >
              {saving ? <Loader2 size={14} /> : <Check size={14} />}
              {saving ? "Đang gửi..." : "Gửi lại đơn đăng ký"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerEditRequestModal({
  vehicle,
  subscriptionId,
  onClose,
  onSubmit,
}: {
  vehicle: RegisteredVehicle;
  subscriptionId: string;
  onClose: () => void;
  onSubmit: (changes: Partial<RegisteredVehicle>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    plate: vehicle.plate ?? "",
    ownerName: vehicle.owner ?? "",
    ownerPhone: vehicle.ownerPhone ?? "",
    ownerAddress: vehicle.ownerAddress ?? "",
    brand: vehicle.brand ?? "",
    model: vehicle.model ?? "",
    color: vehicle.color ?? "",
    year: vehicle.year?.toString() ?? "",
    engineNo: vehicle.engineNo ?? "",
    chassisNo: vehicle.chassisNo ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageUrl, setImageUrl] = useState<string | null>(
    vehicle.imageUrl ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Chỉ chấp nhận file ảnh.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Ảnh tối đa 5MB.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/uploads/vehicle", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.message || "Upload thất bại.");
        return;
      }
      setImageUrl(data.url as string);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? `Lỗi kết nối: ${err.message}`
          : "Lỗi kết nối khi upload.",
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function validateForm(): Record<string, string> {
    const errs: Record<string, string> = {};
    const plate = form.plate
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "");
    if (plate && !/^[A-Z0-9]{5,9}$/.test(plate))
      errs.plate = "Biển số chỉ gồm chữ và số (5–9 ký tự).";
    if (form.ownerName.trim() && form.ownerName.trim().length < 2)
      errs.ownerName = "Họ tên phải có ít nhất 2 ký tự.";
    const phone = form.ownerPhone.trim();
    if (phone && !/^0\d{8,10}$/.test(phone))
      errs.ownerPhone = "SĐT phải bắt đầu bằng 0 và có 9–11 chữ số.";
    const yearStr = form.year.trim();
    if (yearStr) {
      const y = Number(yearStr);
      const now = new Date().getFullYear();
      if (!Number.isInteger(y) || y < 1900 || y > now + 1)
        errs.year = `Năm SX phải nằm trong khoảng 1900–${now + 1}.`;
    }
    if (form.engineNo.trim() && form.engineNo.trim().length < 4)
      errs.engineNo = "Số máy phải có ít nhất 4 ký tự.";
    if (form.chassisNo.trim() && form.chassisNo.trim().length < 4)
      errs.chassisNo = "Số khung phải có ít nhất 4 ký tự.";
    return errs;
  }

  function clearError(key: string) {
    if (errors[key])
      setErrors((e) => {
        const n = { ...e };
        delete n[key];
        return n;
      });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    const yearNum = form.year.trim() ? Number(form.year) : undefined;
    const changes: Partial<RegisteredVehicle> = {
      plate:
        form.plate
          .trim()
          .toUpperCase()
          .replace(/[\s-]+/g, "") || undefined,
      owner: form.ownerName.trim() || undefined,
      ownerPhone: form.ownerPhone.trim() || undefined,
      ownerAddress: form.ownerAddress.trim() || undefined,
      brand: form.brand.trim() || undefined,
      model: form.model.trim() || undefined,
      color: form.color.trim() || undefined,
      year: yearNum && !Number.isNaN(yearNum) ? yearNum : undefined,
      engineNo: form.engineNo.trim() || undefined,
      chassisNo: form.chassisNo.trim() || undefined,
      imageUrl: imageUrl ?? undefined,
    };
    await onSubmit(changes);
    setSaving(false);
  }

  const fields: { key: keyof typeof form; label: string; span?: boolean }[] = [
    { key: "plate", label: "Biển số" },
    { key: "ownerName", label: "Họ tên chủ xe" },
    { key: "brand", label: "Nhãn hiệu" },
    { key: "model", label: "Model" },
    { key: "color", label: "Màu sơn" },
    { key: "year", label: "Năm SX" },
    { key: "engineNo", label: "Số máy" },
    { key: "chassisNo", label: "Số khung" },
    { key: "ownerPhone", label: "Số điện thoại" },
    { key: "ownerAddress", label: "Địa chỉ", span: true },
  ];

  return (
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
        if (e.target === e.currentTarget) onClose();
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
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Edit size={22} />
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Yêu cầu sửa xe</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "var(--muted)",
            }}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <p
          style={{
            margin: "0 0 16px",
            padding: "8px 12px",
            background: "rgba(234,179,8,0.1)",
            borderRadius: 8,
            fontSize: "0.85rem",
            color: "#a16207",
          }}
        >
          Yêu cầu sẽ được gửi tới admin duyệt. Mã gói:{" "}
          <strong style={{ fontFamily: "monospace" }}>
            {subscriptionId.slice(-8)}
          </strong>
        </p>

        {/* Ảnh xe */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 16,
            padding: 12,
            background: "var(--surface-2, #f5f6fa)",
            borderRadius: 10,
            border: "1px solid var(--border, #e2e6ef)",
          }}
        >
          <div
            onClick={() => {
              if (imageUrl && !uploading) setPreviewOpen(true);
            }}
            title={imageUrl ? "Bấm để xem ảnh lớn" : ""}
            style={{
              width: 96,
              height: 72,
              borderRadius: 8,
              overflow: "hidden",
              flexShrink: 0,
              background: "var(--border, #e2e6ef)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: imageUrl
                ? "2px solid #22c55e"
                : uploading
                  ? "2px solid #eab308"
                  : "1px solid var(--border, #e2e6ef)",
              cursor: imageUrl && !uploading ? "zoom-in" : "default",
              position: "relative",
              transition: "border-color 0.2s",
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <ImageIcon
                size={28}
                style={{ color: "var(--muted)", opacity: 0.4 }}
              />
            )}
            {imageUrl && !uploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageUrl(null);
                  setUploadError(null);
                }}
                title="Xoá ảnh"
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 20,
                  height: 20,
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
                <X size={12} />
              </button>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--muted)",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Ảnh phương tiện
              {imageUrl && !uploading && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: "rgba(34,197,94,0.15)",
                    color: "#16a34a",
                  }}
                >
                  Đã tải
                </span>
              )}
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 500,
                  color: "var(--muted)",
                }}
              >
                (tùy chọn)
              </span>
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
                transition: "border-color 0.15s",
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              {uploading ? "Đang tải..." : imageUrl ? "Đổi ảnh" : "Tải ảnh lên"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFile}
                style={{ display: "none" }}
                disabled={uploading}
              />
            </label>
            {uploadError && (
              <div
                style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 4 }}
              >
                {uploadError}
              </div>
            )}
            {!uploadError && (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                  marginTop: 4,
                }}
              >
                PNG, JPG tối đa 5MB — admin sẽ duyệt cùng yêu cầu sửa.
              </div>
            )}
          </div>
        </div>

        {/* Lightbox xem ảnh lớn */}
        {previewOpen && imageUrl && (
          <div
            onClick={() => setPreviewOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(0,0,0,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "zoom-out",
            }}
          >
            <img
              src={imageUrl}
              alt="Preview"
              style={{
                maxWidth: "92vw",
                maxHeight: "92vh",
                borderRadius: 12,
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
            />
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={22} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {fields.map(({ key, label, span }) => (
              <div
                key={key}
                style={{ gridColumn: span ? "span 2" : undefined, minWidth: 0 }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "var(--muted)",
                  }}
                >
                  {label}
                </label>
                <input
                  value={form[key]}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, [key]: e.target.value }));
                    clearError(key as string);
                  }}
                  required={key === "plate"}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: `1px solid ${errors[key as string] ? "#ef4444" : "var(--border, #e2e6ef)"}`,
                    borderRadius: 8,
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                  type={key === "year" ? "number" : "text"}
                />
                {errors[key as string] && (
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "#ef4444",
                      marginTop: 4,
                    }}
                  >
                    {errors[key as string]}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="small-button" onClick={onClose} type="button">
              Hủy
            </button>
            <button
              className="small-button primary"
              disabled={saving}
              type="submit"
            >
              {saving ? <Loader2 size={14} /> : <Check size={14} />}
              {saving ? "Đang gửi..." : "Gửi yêu cầu sửa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerDeleteRequestModal({
  vehicle,
  subscriptionId,
  onClose,
  onSubmit,
}: {
  vehicle: RegisteredVehicle;
  subscriptionId: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    await onSubmit(reason.trim());
    setSaving(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.85)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 24,
          width: "90vw",
          maxWidth: 460,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Trash2 size={22} color="#ef4444" />
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Yêu cầu xóa xe</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "var(--muted)",
            }}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "0.85rem",
            color: "var(--muted)",
          }}
        >
          Xe{" "}
          <strong style={{ fontFamily: "monospace", color: "var(--primary)" }}>
            {vehicle.plate}
          </strong>{" "}
          sẽ được gửi yêu cầu xóa tới admin. Hành động không thể hoàn tác sau
          khi admin duyệt.
        </p>
        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            Lý do xóa <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={5}
            rows={3}
            placeholder="VD: bán xe, không còn sử dụng, hỏng nặng..."
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid var(--border, #e2e6ef)",
              borderRadius: 8,
              fontSize: "0.9rem",
              boxSizing: "border-box",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 16,
            }}
          >
            <button className="small-button" onClick={onClose} type="button">
              Hủy
            </button>
            <button
              className="small-button"
              disabled={saving || !reason.trim()}
              type="submit"
              style={{ background: "#ef4444", color: "#fff", border: "none" }}
            >
              {saving ? <Loader2 size={14} /> : <Trash2 size={14} />}
              {saving ? "Đang gửi..." : "Gửi yêu cầu xóa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
}) {
  if (field !== sortField)
    return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
  return sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

function exportVehiclesToCSV(vehicles: RegisteredVehicle[]) {
  const headers = [
    "Biển số",
    "Chủ xe",
    "SĐT chủ",
    "Hãng",
    "Model",
    "Màu",
    "Năm SX",
    "Số máy",
    "Số khung",
    "Trạng thái",
    "Tài khoản",
    "Email",
    "Ngày tạo",
    "Ảnh URL",
  ];
  const rows = vehicles.map((v) => [
    v.plate,
    v.owner,
    v.ownerPhone ?? "",
    v.brand ?? "",
    v.model ?? "",
    v.color ?? "",
    v.year?.toString() ?? "",
    v.engineNo ?? "",
    v.chassisNo ?? "",
    v.status,
    v.user?.name ?? "",
    v.user?.email ?? "",
    v.createdAt ? new Date(v.createdAt).toISOString() : "",
    v.imageUrl ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vehicles_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function VehiclesView() {
  const {
    registeredVehicles,
    approveVehicle,
    fetchVehicleDetail,
    loadVehicles,
    currentUser,
    vehicleRequests,
    resolveRequest,
    loadVehicleRequests,
    editVehicle,
    removeVehicle,
    addVehicle,
    createEditRequest,
    createDeleteRequest,
    subscriptionList,
  } = useParkingApp();

  const [detailVehicle, setDetailVehicle] = useState<RegisteredVehicle | null>(
    null,
  );
  const [editingVehicle, setEditingVehicle] =
    useState<RegisteredVehicle | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [yearFrom, setYearFrom] = useState<string>("");
  const [yearTo, setYearTo] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isCompanyFilter, setIsCompanyFilter] = useState<
    "all" | "company" | "personal"
  >("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [detailRequest, setDetailRequest] = useState<VehicleRequest | null>(
    null,
  );
  const [detailRejectNote, setDetailRejectNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "all" | "active" | "pending" | "blacklist" | "requests"
  >("all");
  const [requestStatusFilter, setRequestStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [customerEditTarget, setCustomerEditTarget] =
    useState<RegisteredVehicle | null>(null);
  const [customerDeleteTarget, setCustomerDeleteTarget] =
    useState<RegisteredVehicle | null>(null);
  const [resubmitTarget, setResubmitTarget] =
    useState<RegisteredVehicle | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    loadVehicleRequests({ includeResolved: true });
  }, [isAdmin]);

  // Map vehicleId → active subscriptionId của customer (1 xe 1 sub)
  const vehicleSubscriptionMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!isAdmin) {
      subscriptionList.forEach((s) => {
        if (s.primaryVehicle?.id) map.set(s.primaryVehicle.id, s.id);
      });
    }
    return map;
  }, [subscriptionList, isAdmin]);

  const pendingRequests = vehicleRequests.filter(
    (r) =>
      r.status === "pending" &&
      (requestStatusFilter === "all" || requestStatusFilter === "pending"),
  );
  const resolvedRequests = vehicleRequests.filter(
    (r) =>
      r.status !== "pending" &&
      (requestStatusFilter === "all" || r.status === requestStatusFilter),
  );

  // Stats summary
  const stats = useMemo(() => {
    const total = registeredVehicles.length;
    const active = registeredVehicles.filter(
      (v) => v.status === "Đã đăng ký",
    ).length;
    const pending = registeredVehicles.filter(
      (v) => v.status === "Cần duyệt",
    ).length;
    const blacklist = registeredVehicles.filter(
      (v) => v.status === "Blacklist",
    ).length;
    return { total, active, pending, blacklist };
  }, [registeredVehicles]);

  // Distinct brand list (for filter dropdown)
  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    registeredVehicles.forEach((v) => {
      const b = (v.brand ?? "").trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [registeredVehicles]);

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const yFrom = yearFrom.trim() ? Number(yearFrom) : null;
    const yTo = yearTo.trim() ? Number(yearTo) : null;
    const dFrom = dateFrom ? new Date(dateFrom).getTime() : null;
    const dTo = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return registeredVehicles.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (brandFilter !== "all" && (v.brand ?? "") !== brandFilter)
        return false;
      if (isCompanyFilter === "company" && !v.isCompanyVehicle) return false;
      if (isCompanyFilter === "personal" && v.isCompanyVehicle) return false;
      if (yFrom !== null && (v.year ?? -Infinity) < yFrom) return false;
      if (yTo !== null && (v.year ?? Infinity) > yTo) return false;
      if (dFrom !== null) {
        const ts = v.createdAt ? new Date(v.createdAt).getTime() : 0;
        if (ts < dFrom) return false;
      }
      if (dTo !== null) {
        const ts = v.createdAt ? new Date(v.createdAt).getTime() : 0;
        if (ts > dTo) return false;
      }
      if (!q) return true;
      return (
        v.plate.toLowerCase().includes(q) ||
        v.owner.toLowerCase().includes(q) ||
        (v.ownerPhone ?? "").toLowerCase().includes(q) ||
        (v.brand ?? "").toLowerCase().includes(q) ||
        (v.model ?? "").toLowerCase().includes(q) ||
        (v.color ?? "").toLowerCase().includes(q) ||
        (v.engineNo ?? "").toLowerCase().includes(q) ||
        (v.chassisNo ?? "").toLowerCase().includes(q) ||
        (v.user?.name ?? "").toLowerCase().includes(q) ||
        (v.user?.email ?? "").toLowerCase().includes(q) ||
        (v.user?.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [
    registeredVehicles,
    search,
    statusFilter,
    brandFilter,
    yearFrom,
    yearTo,
    dateFrom,
    dateTo,
    isCompanyFilter,
  ]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp = (a: RegisteredVehicle, b: RegisteredVehicle): number => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortField) {
        case "plate":
          av = a.plate.toLowerCase();
          bv = b.plate.toLowerCase();
          break;
        case "owner":
          av = a.owner.toLowerCase();
          bv = b.owner.toLowerCase();
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
        case "createdAt":
          av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    };
    arr.sort(cmp);
    return arr;
  }, [filtered, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    brandFilter,
    yearFrom,
    yearTo,
    dateFrom,
    dateTo,
    isCompanyFilter,
    pageSize,
  ]);

  // Cleanup selectedIds when item no longer in list
  useEffect(() => {
    const visible = new Set(
      pageItems.map((v) => v.id).filter(Boolean) as string[],
    );
    setSelectedIds((cur) => {
      const next = new Set<string>();
      cur.forEach((id) => {
        if (visible.has(id)) next.add(id);
      });
      return next;
    });
  }, [pageItems]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    const pageIds = pageItems.map((v) => v.id).filter(Boolean) as string[];
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function handleDetail(vehicle: RegisteredVehicle) {
    if (vehicle.id) {
      const full = await fetchVehicleDetail(vehicle.id);
      if (full) setDetailVehicle(full);
    } else {
      setDetailVehicle(vehicle);
    }
  }

  async function handleResolve(
    requestId: string,
    action: "approved" | "rejected",
    adminNote?: string,
  ) {
    setResolvingId(requestId);
    await resolveRequest(requestId, action, adminNote);
    setResolvingId(null);
  }

  async function handleDeleteConfirm(id: string) {
    await removeVehicle(id);
    setConfirmDelete(null);
    setSelectedIds((cur) => {
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await removeVehicle(id);
      }
      setSelectedIds(new Set());
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleCustomerEdit(
    vehicle: RegisteredVehicle,
    changes: Partial<RegisteredVehicle>,
  ) {
    const subId = vehicleSubscriptionMap.get(vehicle.id);
    if (!subId) {
      alert(
        "Xe này chưa gắn với gói đăng ký nào. Vui lòng mua gói trước khi sửa.",
      );
      return;
    }
    setRequestSubmitting(true);
    try {
      await createEditRequest(vehicle.id, subId, changes);
      setCustomerEditTarget(null);
      await Promise.all([
        loadVehicles(),
        loadVehicleRequests({ includeResolved: true }),
      ]);
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function handleCustomerDelete(
    vehicle: RegisteredVehicle,
    reason: string,
  ) {
    const subId = vehicleSubscriptionMap.get(vehicle.id);
    if (!subId) {
      alert("Xe này chưa gắn với gói đăng ký nào.");
      return;
    }
    setRequestSubmitting(true);
    try {
      await createDeleteRequest(vehicle.id, subId, reason);
      setCustomerDeleteTarget(null);
      await loadVehicleRequests({ includeResolved: true });
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function handleCustomerAdd(data: Parameters<typeof addVehicle>[0]) {
    await addVehicle(data);
  }

  async function handleResubmit(
    vehicle: RegisteredVehicle,
    data: Partial<RegisteredVehicle>,
  ) {
    setRequestSubmitting(true);
    try {
      const res = await apiFetch(`/vehicles/${vehicle.id}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate: data.plate || undefined,
          ownerName: (data.owner as string) || undefined,
          ownerAddress: data.ownerAddress || undefined,
          brand: data.brand || undefined,
          model: data.model || undefined,
          color: data.color || undefined,
          year: data.year || undefined,
          engineNo: data.engineNo || undefined,
          chassisNo: data.chassisNo || undefined,
          imageUrl: data.imageUrl || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        alert(json?.message || "Không thể gửi lại đơn đăng ký.");
        return;
      }
      setResubmitTarget(null);
      await Promise.all([
        loadVehicles(),
        loadVehicleRequests({ includeResolved: true }),
      ]);
    } finally {
      setRequestSubmitting(false);
    }
  }

  const allOnPageSelected =
    pageItems.length > 0 &&
    pageItems.every((v) => v.id && selectedIds.has(v.id));

  return (
    <>
      {detailVehicle && (
        <VehicleDetailModal
          vehicle={detailVehicle}
          onClose={() => setDetailVehicle(null)}
          onApprove={async () => {
            if (!detailVehicle.id) return;
            await approveVehicle(detailVehicle);
            setDetailVehicle(null);
          }}
          onReject={async () => {
            if (!detailVehicle.id) return;
            const reason = detailRejectNote.trim();
            if (!reason) {
              alert("Vui lòng nhập lý do từ chối.");
              return;
            }
            const response = await apiFetch(`/vehicles/${detailVehicle.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: detailVehicle.id,
                status: "Blacklist",
                rejectionReason: reason,
              }),
            });
            if (!response.ok) {
              const data = await response.json().catch(() => null);
              alert(data?.message || "Không thể từ chối phương tiện.");
              return;
            }
            await loadVehicles();
            setDetailVehicle(null);
          }}
          rejectReason={detailRejectNote}
          onRejectReasonChange={setDetailRejectNote}
          processing={resolvingId === detailVehicle.id}
          isAdmin={isAdmin}
          onEdit={
            !isAdmin && detailVehicle.id && detailVehicle.status === "Blacklist"
              ? () => {
                  setDetailVehicle(null);
                  setResubmitTarget(detailVehicle);
                }
              : !isAdmin &&
                  detailVehicle.id &&
                  vehicleSubscriptionMap.has(detailVehicle.id)
                ? () => {
                    setDetailVehicle(null);
                    setCustomerEditTarget(detailVehicle);
                  }
                : undefined
          }
        />
      )}

      {(editingVehicle !== null || showAddForm) && (
        <VehicleEditModal
          vehicle={editingVehicle}
          onClose={() => {
            setEditingVehicle(null);
            setShowAddForm(false);
          }}
          onSave={async (data) => {
            if (showAddForm) {
              await addVehicle(data as Parameters<typeof addVehicle>[0]);
            } else if (editingVehicle?.id) {
              await editVehicle(
                editingVehicle.id,
                data as Parameters<typeof editVehicle>[1],
              );
            }
            setEditingVehicle(null);
            setShowAddForm(false);
          }}
        />
      )}

      {resubmitTarget && resubmitTarget.id && (
        <ResubmitVehicleModal
          vehicle={resubmitTarget}
          onClose={() => setResubmitTarget(null)}
          onSubmit={async (data) => handleResubmit(resubmitTarget, data)}
        />
      )}

      {customerEditTarget &&
        customerEditTarget.id &&
        vehicleSubscriptionMap.has(customerEditTarget.id) && (
          <CustomerEditRequestModal
            vehicle={customerEditTarget}
            subscriptionId={
              vehicleSubscriptionMap.get(customerEditTarget.id) ?? ""
            }
            onClose={() => setCustomerEditTarget(null)}
            onSubmit={async (changes) =>
              handleCustomerEdit(customerEditTarget, changes)
            }
          />
        )}

      {customerDeleteTarget &&
        customerDeleteTarget.id &&
        vehicleSubscriptionMap.has(customerDeleteTarget.id) && (
          <CustomerDeleteRequestModal
            vehicle={customerDeleteTarget}
            subscriptionId={
              vehicleSubscriptionMap.get(customerDeleteTarget.id) ?? ""
            }
            onClose={() => setCustomerDeleteTarget(null)}
            onSubmit={async (reason) =>
              handleCustomerDelete(customerDeleteTarget, reason)
            }
          />
        )}

      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.85)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(null);
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: 24,
              width: "90vw",
              maxWidth: 400,
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ margin: "0 0 12px" }}>Xác nhận xóa</h3>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>
              Bạn có chắc muốn xóa phương tiện này? Hành động này không thể hoàn
              tác.
            </p>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                className="small-button"
                onClick={() => setConfirmDelete(null)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="small-button"
                onClick={() => handleDeleteConfirm(confirmDelete)}
                style={{ background: "#ef4444", color: "#fff", border: "none" }}
                type="button"
              >
                <Trash2 size={14} /> Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Chi tiết yêu cầu */}
      {detailRequest && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.85)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDetailRequest(null);
              setDetailRejectNote("");
            }
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: 24,
              width: "90vw",
              maxWidth: 560,
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              maxHeight: "90vh",
              overflowY: "auto",
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
              <h3 style={{ margin: 0 }}>Chi tiết yêu cầu</h3>
              <button
                onClick={() => {
                  setDetailRequest(null);
                  setDetailRejectNote("");
                }}
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                }}
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                fontSize: "0.9rem",
              }}
            >
              <div>
                <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  Loại yêu cầu
                </div>
                <div style={{ fontWeight: 600 }}>
                  {detailRequest.type === "edit" &&
                  detailRequest.requestedChanges?.status === "Đã đăng ký"
                    ? "Đăng ký xe mới"
                    : detailRequest.type === "edit"
                      ? "Sửa thông tin xe"
                      : "Xóa xe"}
                </div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  Trạng thái
                </div>
                <div>
                  <RequestStatusBadge request={detailRequest} />
                </div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  Ngày gửi
                </div>
                <div>{formatDate(detailRequest.createdAt)}</div>
              </div>

              {detailRequest.user && (
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    Khách hàng
                  </div>
                  <div>
                    {detailRequest.user.name}
                    {detailRequest.user.email && (
                      <span style={{ color: "var(--muted)" }}>
                        {" "}
                        · {detailRequest.user.email}
                      </span>
                    )}
                    {detailRequest.user.phone && (
                      <span style={{ color: "var(--muted)" }}>
                        {" "}
                        · {detailRequest.user.phone}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {detailRequest.vehicle && (
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    Phương tiện
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 360,
                        height: 240,
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid var(--border, #e2e6ef)",
                        background: "var(--surface-2, #f5f6fa)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {detailRequest.vehicle.imageUrl ? (
                        <img
                          src={detailRequest.vehicle.imageUrl}
                          alt={detailRequest.vehicle.plate}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                            cursor: "zoom-in",
                          }}
                          onClick={() =>
                            window.open(
                              detailRequest.vehicle!.imageUrl!,
                              "_blank",
                            )
                          }
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <Car
                          size={72}
                          style={{ color: "var(--muted)", opacity: 0.4 }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        fontSize: "0.9rem",
                      }}
                    >
                      <div>
                        <span style={{ color: "var(--muted)" }}>
                          Biển số xe:{" "}
                        </span>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            color: "var(--primary)",
                            fontSize: "1rem",
                          }}
                        >
                          {detailRequest.vehicle.plate}
                        </span>
                      </div>
                      {detailRequest.vehicle.owner && (
                        <div>
                          <span style={{ color: "var(--muted)" }}>
                            Tên chủ xe:{" "}
                          </span>
                          <span style={{ fontWeight: 500 }}>
                            {detailRequest.vehicle.owner}
                          </span>
                        </div>
                      )}
                      {detailRequest.vehicle.brand && (
                        <div>
                          <span style={{ color: "var(--muted)" }}>
                            Nhãn hiệu:{" "}
                          </span>
                          <span style={{ fontWeight: 500 }}>
                            {detailRequest.vehicle.brand}
                          </span>
                        </div>
                      )}
                      {detailRequest.vehicle.color && (
                        <div>
                          <span style={{ color: "var(--muted)" }}>Màu: </span>
                          <span style={{ fontWeight: 500 }}>
                            {detailRequest.vehicle.color}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {detailRequest.type === "edit" &&
                detailRequest.requestedChanges &&
                detailRequest.requestedChanges.status !== "Đã đăng ký" && (
                  <div>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.78rem",
                        marginBottom: 6,
                      }}
                    >
                      Nội dung thay đổi
                    </div>
                    <div
                      style={{
                        background: "var(--surface-2, #f5f6fa)",
                        borderRadius: 8,
                        padding: 12,
                        border: "1px solid var(--border, #e2e6ef)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {Object.entries(detailRequest.requestedChanges)
                        .filter(([, v]) => v != null && v !== "")
                        .map(([k, v]) => (
                          <div key={k} style={{ display: "flex", gap: 8 }}>
                            <span
                              style={{ color: "var(--muted)", minWidth: 110 }}
                            >
                              {k}:
                            </span>
                            <span style={{ fontWeight: 500 }}>{String(v)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {detailRequest.reason && (
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    Lý do từ phía khách hàng
                  </div>
                  <div>{detailRequest.reason}</div>
                </div>
              )}

              {detailRequest.adminNote && (
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    Ghi chú của admin
                  </div>
                  <div
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 6,
                      padding: 10,
                    }}
                  >
                    {detailRequest.adminNote}
                  </div>
                </div>
              )}

              {detailRequest.resolvedAt && (
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    Ngày xử lý
                  </div>
                  <div>{formatDate(detailRequest.resolvedAt)}</div>
                </div>
              )}
            </div>

            {isAdmin && detailRequest.status === "pending" && (
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid var(--border, #e2e6ef)",
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.78rem",
                      color: "var(--muted)",
                      marginBottom: 4,
                    }}
                  >
                    Nội dung từ chối{" "}
                    <span style={{ fontStyle: "italic" }}>
                      (bỏ trống nếu duyệt)
                    </span>
                  </label>
                  <textarea
                    value={detailRejectNote}
                    onChange={(e) => setDetailRejectNote(e.target.value)}
                    placeholder="Nhập lý do từ chối (không bắt buộc khi duyệt)..."
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border, #e2e6ef)",
                      fontSize: "0.88rem",
                      fontFamily: "inherit",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    className="small-button"
                    disabled={resolvingId === detailRequest.id}
                    onClick={async () => {
                      const id = detailRequest.id;
                      setDetailRequest(null);
                      setDetailRejectNote("");
                      await handleResolve(id, "approved");
                    }}
                    style={{ padding: "6px 14px" }}
                    type="button"
                  >
                    {resolvingId === detailRequest.id ? (
                      <Loader2 size={14} />
                    ) : (
                      <Check size={14} />
                    )}{" "}
                    Duyệt
                  </button>
                  <button
                    className="small-button"
                    disabled={resolvingId === detailRequest.id}
                    onClick={async () => {
                      const id = detailRequest.id;
                      const note = detailRejectNote.trim();
                      setDetailRequest(null);
                      setDetailRejectNote("");
                      await handleResolve(id, "rejected", note);
                    }}
                    style={{
                      padding: "6px 14px",
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                    }}
                    type="button"
                  >
                    <X size={14} /> Từ chối
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedIds.size > 0 && isAdmin && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 16,
            zIndex: 50,
            background: "var(--surface)",
            border: "1px solid var(--border, #e2e6ef)",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "10px 20px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.14)",
            display: "flex",
            gap: 12,
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: "0.9rem" }}>
            Đã chọn <strong>{selectedIds.size}</strong> xe
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="small-button"
              onClick={() => setSelectedIds(new Set())}
              type="button"
            >
              Bỏ chọn
            </button>
            <button
              className="small-button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              style={{ background: "#ef4444", color: "#fff", border: "none" }}
              type="button"
            >
              {bulkDeleting ? <Loader2 size={14} /> : <Trash2 size={14} />}
              {bulkDeleting ? "Đang xóa..." : `Xóa ${selectedIds.size} xe`}
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Phương tiện</p>
            <h2>Xe đăng ký, từ chối và ngoại lệ</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="muted-cell" style={{ fontSize: "0.85rem" }}>
              {filtered.length} / {registeredVehicles.length} xe
            </span>
            <Car size={22} />
          </div>
        </div>

        {/* Stats summary — always visible, clickable */}
        <div className="veh-stats">
          <div
            className={`veh-stat${activeTab === "all" ? " active" : ""}`}
            onClick={() => {
              setActiveTab("all");
              setStatusFilter("all");
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="veh-stat-label">Tổng</div>
            <div className="veh-stat-value">{stats.total}</div>
          </div>
          <div
            className={`veh-stat green${activeTab === "active" ? " active" : ""}`}
            onClick={() => {
              setActiveTab("active");
              setStatusFilter("Đã đăng ký");
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="veh-stat-label">Đã đăng ký</div>
            <div className="veh-stat-value">{stats.active}</div>
          </div>
          <div
            className={`veh-stat amber${activeTab === "pending" ? " active" : ""}`}
            onClick={() => {
              setActiveTab("pending");
              setStatusFilter("Cần duyệt");
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="veh-stat-label">Cần duyệt</div>
            <div className="veh-stat-value">{stats.pending}</div>
          </div>
          <div
            className={`veh-stat red${activeTab === "blacklist" ? " active" : ""}`}
            onClick={() => {
              setActiveTab("blacklist");
              setStatusFilter("Blacklist");
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="veh-stat-label">Từ chối</div>
            <div className="veh-stat-value">{stats.blacklist}</div>
          </div>
          <div
            className={`veh-stat${activeTab === "requests" ? " active" : ""}`}
            onClick={() => setActiveTab("requests")}
            style={{ cursor: "pointer", position: "relative" }}
          >
            <div className="veh-stat-label">
              {isAdmin ? "Yêu cầu" : "Yêu cầu của tôi"}
            </div>
            <div
              className="veh-stat-value"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              {vehicleRequests.length}
              {pendingRequests.length > 0 && (
                <span
                  className="badge warning"
                  style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                >
                  {pendingRequests.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {activeTab !== "requests" && (
          <>
            {/* Toolbar */}
            <div className="veh-toolbar">
              {/* Always-visible filters */}
              <div className="veh-toolbar-left">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  className="veh-select"
                  style={{ maxWidth: 140 }}
                  aria-label="Lọc theo trạng thái"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="Đã đăng ký">Đã đăng ký</option>
                  <option value="Cần duyệt">Cần duyệt</option>
                  <option value="Blacklist">Từ chối</option>
                </select>

                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="veh-select"
                  style={{ maxWidth: 180 }}
                  aria-label="Lọc theo hãng xe"
                >
                  <option value="all">Tất cả hãng</option>
                  {brandOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                {/* Lọc ngày tạo */}
                <div className="veh-date-range">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    aria-label="Ngày tạo từ"
                    className="veh-input"
                    title="Ngày tạo từ"
                  />
                  <span className="veh-date-sep">–</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-label="Ngày tạo đến"
                    className="veh-input"
                    title="Ngày tạo đến"
                  />
                  {(dateFrom || dateTo) && (
                    <button
                      className="small-button"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                      type="button"
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                      title="Xóa lọc ngày"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {brandFilter !== "all" && (
                  <button
                    className="small-button"
                    onClick={() => setBrandFilter("all")}
                    title="Xóa lọc hãng"
                    type="button"
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <X size={12} /> Xóa lọc
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="veh-toolbar-right">
                {isAdmin && (
                  <>
                    <button
                      className="small-button"
                      onClick={() => exportVehiclesToCSV(sorted)}
                      disabled={sorted.length === 0}
                      title="Xuất CSV"
                      type="button"
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Download size={13} />
                    </button>
                  </>
                )}
                {!isAdmin && (
                  <button
                    className="small-button primary"
                    onClick={() => {
                      setShowAddForm(true);
                      setEditingVehicle(null);
                    }}
                    type="button"
                    title="Đăng ký xe mới (cần admin duyệt)"
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Plus size={14} /> Đăng ký xe
                  </button>
                )}

                {/* Search */}
                <div className="veh-search">
                  <Search size={14} />
                  <input
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm kiếm..."
                    value={search}
                    type="search"
                  />
                </div>
              </div>
            </div>

            <DataTable
              headers={[
                isAdmin ? (
                  <input
                    key="selectAll"
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Chọn tất cả xe trên trang"
                  />
                ) : null,
                "Ảnh",
                <button
                  key="col-plate"
                  onClick={() => toggleSort("plate")}
                  className="veh-sort-btn"
                >
                  Biển số{" "}
                  <SortIcon
                    field="plate"
                    sortField={sortField}
                    sortDir={sortDir}
                  />
                </button>,
                <button
                  key="col-owner"
                  onClick={() => toggleSort("owner")}
                  className="veh-sort-btn"
                >
                  Chủ xe{" "}
                  <SortIcon
                    field="owner"
                    sortField={sortField}
                    sortDir={sortDir}
                  />
                </button>,
                "Thông tin",
                <button
                  key="col-status"
                  onClick={() => toggleSort("status")}
                  className="veh-sort-btn"
                >
                  Trạng thái{" "}
                  <SortIcon
                    field="status"
                    sortField={sortField}
                    sortDir={sortDir}
                  />
                </button>,
                <button
                  key="col-date"
                  onClick={() => toggleSort("createdAt")}
                  className="veh-sort-btn"
                >
                  Ngày tạo{" "}
                  <SortIcon
                    field="createdAt"
                    sortField={sortField}
                    sortDir={sortDir}
                  />
                </button>,
                "Thao tác",
              ]}
              rows={pageItems.map((vehicle) => [
                isAdmin ? (
                  <input
                    key="check"
                    type="checkbox"
                    checked={!!vehicle.id && selectedIds.has(vehicle.id)}
                    onChange={() => vehicle.id && toggleSelect(vehicle.id)}
                    aria-label={`Chọn xe ${vehicle.plate}`}
                  />
                ) : null,
                <div
                  key="img"
                  className="veh-thumb"
                  onClick={() => handleDetail(vehicle)}
                  title={vehicle.imageUrl ? "Xem chi tiết" : "Chưa có ảnh"}
                >
                  {vehicle.imageUrl ? (
                    <img
                      src={vehicle.imageUrl}
                      alt={vehicle.plate}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Car size={20} className="veh-thumb-icon" />
                  )}
                </div>,
                <span key="plate" className="veh-plate">
                  {vehicle.plate}
                </span>,
                <span
                  key="owner"
                  style={{ fontSize: "0.85rem", wordBreak: "break-word" }}
                >
                  {vehicle.owner}
                  {vehicle.ownerPhone && (
                    <div className="veh-owner-phone">{vehicle.ownerPhone}</div>
                  )}
                </span>,
                <span key="info" className="veh-info-cell">
                  {[vehicle.brand, vehicle.model, vehicle.color]
                    .filter(Boolean)
                    .join(" • ") || "—"}
                </span>,
                <span className={statusBadgeClass(vehicle.status)} key="status">
                  {statusIcon(vehicle.status)}
                  {statusLabel(vehicle.status)}
                </span>,
                formatDate(vehicle.createdAt),
                <div
                  key="actions"
                  style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
                >
                  <button
                    className="small-button"
                    onClick={() => handleDetail(vehicle)}
                    title="Chi tiết"
                    type="button"
                    style={{ padding: "3px 7px" }}
                  >
                    <Eye size={13} />
                  </button>
                  {isAdmin && (
                    <button
                      className="small-button"
                      onClick={() => setConfirmDelete(vehicle.id ?? null)}
                      title="Xóa"
                      type="button"
                      style={{ padding: "3px 7px", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  {!isAdmin &&
                    vehicle.id &&
                    vehicleSubscriptionMap.has(vehicle.id) && (
                      <button
                        className="small-button"
                        onClick={() => setCustomerDeleteTarget(vehicle)}
                        title="Gửi yêu cầu xóa (admin duyệt)"
                        type="button"
                        style={{ padding: "3px 7px", color: "#ef4444" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                </div>,
              ])}
            />

            {/* Pagination */}
            {sorted.length > 0 && (
              <div className="veh-pagination">
                <div className="veh-pagination-info">
                  <span style={{ fontWeight: 500 }}>{sorted.length}</span> xe ·
                  Trang <span style={{ fontWeight: 500 }}>{page}</span>/
                  {totalPages}
                </div>
                <div className="veh-pagination-controls">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="veh-select"
                    style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    className="small-button"
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    type="button"
                    title="Trang đầu"
                  >
                    «
                  </button>
                  <button
                    className="small-button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    type="button"
                    title="Trang trước"
                  >
                    ‹
                  </button>
                  <button
                    className="small-button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    type="button"
                    title="Trang sau"
                  >
                    ›
                  </button>
                  <button
                    className="small-button"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    type="button"
                    title="Trang cuối"
                  >
                    »
                  </button>
                </div>
              </div>
            )}

            {filtered.length === 0 && (
              <p className="veh-empty">Không có xe nào khớp bộ lọc.</p>
            )}
          </>
        )}

        {/* ─── Tab: Yêu cầu ─── */}
        {activeTab === "requests" && (
          <>
            <div className="veh-toolbar" style={{ marginBottom: 16 }}>
              <div className="veh-toolbar-left">
                <select
                  value={requestStatusFilter}
                  onChange={(e) =>
                    setRequestStatusFilter(
                      e.target.value as
                        | "all"
                        | "pending"
                        | "approved"
                        | "rejected",
                    )
                  }
                  className="veh-select"
                  aria-label="Lọc theo trạng thái yêu cầu"
                >
                  <option value="all">Tất cả yêu cầu</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="rejected">Từ chối</option>
                </select>
              </div>
            </div>
            {pendingRequests.length === 0 && resolvedRequests.length === 0 ? (
              <p className="muted-cell" style={{ fontSize: "0.85rem" }}>
                {isAdmin
                  ? "Chưa có yêu cầu nào."
                  : "Bạn chưa gửi yêu cầu sửa/xóa xe nào."}
              </p>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {pendingRequests.length > 0 && (
                  <div>
                    <h4 className="veh-req-heading">
                      CHỜ DUYỆT ({pendingRequests.length})
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {pendingRequests.map((req) => (
                        <div key={req.id} className="veh-req-card">
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 12,
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  marginBottom: 6,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={{
                                    padding: "2px 10px",
                                    borderRadius: 12,
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    background:
                                      req.type === "edit" &&
                                      req.requestedChanges?.status ===
                                        "Đã đăng ký"
                                        ? "rgba(34,197,94,0.15)"
                                        : req.type === "edit"
                                          ? "rgba(59,130,246,0.15)"
                                          : "rgba(239,68,68,0.15)",
                                    color:
                                      req.type === "edit" &&
                                      req.requestedChanges?.status ===
                                        "Đã đăng ký"
                                        ? "#16a34a"
                                        : req.type === "edit"
                                          ? "#2563eb"
                                          : "#dc2626",
                                  }}
                                >
                                  {req.type === "edit" &&
                                  req.requestedChanges?.status === "Đã đăng ký"
                                    ? "Đăng ký mới"
                                    : req.type === "edit"
                                      ? "Sửa"
                                      : "Xóa"}
                                </span>
                                <RequestStatusBadge request={req} />
                                <span
                                  className="muted-cell"
                                  style={{ fontSize: "0.8rem" }}
                                >
                                  {formatDate(req.createdAt)}
                                </span>
                              </div>
                              {req.type === "edit" &&
                              req.requestedChanges?.status === "Đã đăng ký" ? (
                                <div style={{ fontSize: "0.85rem" }}>
                                  Yêu cầu đăng ký xe mới{" "}
                                  <strong style={{ fontFamily: "monospace" }}>
                                    {req.vehicle?.plate ?? req.vehicleId}
                                  </strong>
                                </div>
                              ) : req.type === "edit" &&
                                req.requestedChanges ? (
                                <div style={{ fontSize: "0.85rem" }}>
                                  <strong style={{ fontFamily: "monospace" }}>
                                    {req.vehicle?.plate ?? req.vehicleId}
                                  </strong>
                                  {" → "}
                                  {Object.entries(req.requestedChanges)
                                    .filter(([, v]) => v != null && v !== "")
                                    .map(([k, v]) => (
                                      <span key={k} style={{ marginRight: 8 }}>
                                        <strong>{k}:</strong> {String(v)}
                                      </span>
                                    ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: "0.85rem" }}>
                                  Yêu cầu xóa xe{" "}
                                  <strong>
                                    {req.vehicle?.plate ?? req.vehicleId}
                                  </strong>
                                  {req.reason && (
                                    <span
                                      className="muted-cell"
                                      style={{ marginLeft: 8 }}
                                    >
                                      — Lý do: {req.reason}
                                    </span>
                                  )}
                                </div>
                              )}
                              {req.user && isAdmin && (
                                <div
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "var(--muted)",
                                    marginTop: 4,
                                  }}
                                >
                                  Khách hàng: {req.user.name}{" "}
                                  {req.user.email ? `(${req.user.email})` : ""}
                                </div>
                              )}
                            </div>
                            {isAdmin && (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  className="small-button"
                                  onClick={() => setDetailRequest(req)}
                                  style={{ padding: "5px 10px" }}
                                  type="button"
                                  title="Xem chi tiết yêu cầu"
                                >
                                  <Eye size={14} /> Xem chi tiết
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {resolvedRequests.length > 0 && (
                  <div>
                    <h4 className="veh-req-heading">
                      ĐÃ XỬ LÝ ({resolvedRequests.length})
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {resolvedRequests.slice(0, 10).map((req) => (
                        <div
                          key={req.id}
                          className="veh-req-card"
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 10,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                background:
                                  req.type === "edit" &&
                                  req.requestedChanges?.status === "Đã đăng ký"
                                    ? "rgba(34,197,94,0.1)"
                                    : req.type === "edit"
                                      ? "rgba(59,130,246,0.1)"
                                      : "rgba(239,68,68,0.1)",
                                color:
                                  req.type === "edit" &&
                                  req.requestedChanges?.status === "Đã đăng ký"
                                    ? "#16a34a"
                                    : req.type === "edit"
                                      ? "#2563eb"
                                      : "#dc2626",
                              }}
                            >
                              {req.type === "edit" &&
                              req.requestedChanges?.status === "Đã đăng ký"
                                ? "Đăng ký mới"
                                : req.type === "edit"
                                  ? "Sửa"
                                  : "Xóa"}
                            </span>
                            <RequestStatusBadge request={req} />
                            <span
                              style={{
                                fontFamily: "monospace",
                                fontSize: "0.85rem",
                              }}
                            >
                              {req.vehicle?.plate ?? req.vehicleId}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              className="muted-cell"
                              style={{ fontSize: "0.75rem" }}
                            >
                              {formatDate(req.resolvedAt ?? req.updatedAt)}
                            </span>
                            <button
                              className="small-button"
                              onClick={() => setDetailRequest(req)}
                              style={{ padding: "3px 8px" }}
                              type="button"
                              title="Xem chi tiết"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
