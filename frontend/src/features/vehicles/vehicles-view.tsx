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

export function VehicleDetailModal({ vehicle, onClose }: { vehicle: RegisteredVehicle; onClose: () => void }) {
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 24,
          width: "90vw",
          maxWidth: 640,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Car size={22} />
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Chi tiết phương tiện</h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)" }} type="button">
            <X size={20} />
          </button>
        </div>

        {/* Ảnh xe nổi bật */}
        {vehicle.imageUrl && (
          <div style={{ marginBottom: 16, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border, #e2e6ef)" }}>
            <img
              src={vehicle.imageUrl}
              alt={`Xe ${vehicle.plate}`}
              style={{ width: "100%", maxHeight: 240, objectFit: "cover", display: "block" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        <div style={{ background: "var(--primary)", color: "#fff", borderRadius: 12, padding: "16px 20px", marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontFamily: "monospace", fontSize: "1.8rem", fontWeight: 800, letterSpacing: 3 }}>
            {vehicle.plate}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, padding: "4px 12px", borderRadius: 16, fontSize: "0.8rem", fontWeight: 600, background: vehicle.status === "Đã đăng ký" ? "rgba(34,197,94,0.25)" : vehicle.status === "Cần duyệt" ? "rgba(234,179,8,0.25)" : "rgba(239,68,68,0.25)", color: vehicle.status === "Đã đăng ký" ? "#86efac" : vehicle.status === "Cần duyệt" ? "#fde047" : "#fca5a5" }}>
            {statusIcon(vehicle.status)}
            {vehicle.status}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Thông tin xe</h3>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: vehicle.imageUrl ? "80px 1fr 1fr" : "1fr 1fr" }}>
            {vehicle.imageUrl && (
              <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border, #e2e6ef)" }}>
                <img src={vehicle.imageUrl} alt={vehicle.plate} style={{ width: "100%", height: 60, objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
            {[
              ["Nhãn hiệu", vehicle.brand],
              ["Model", vehicle.model],
              ["Màu sơn", vehicle.color],
              ["Năm SX", vehicle.year?.toString()],
              ["Loại xe", vehicle.type],
              ["Số máy", vehicle.engineNo],
              ["Số khung", vehicle.chassisNo],
            ].map(([label, val]) => (
              <div key={label} className="info-box" style={{ minWidth: 0 }}>
                <span className="muted-cell">{label}</span>
                <div style={{ wordBreak: "break-all" }}><strong>{val || "—"}</strong></div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Thông tin chủ xe</h3>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <div className="info-box" style={{ gridColumn: "span 2", minWidth: 0 }}>
              <span className="muted-cell">Họ tên chủ xe</span>
              <div style={{ wordBreak: "break-word" }}><strong>{vehicle.owner}</strong></div>
            </div>
            <div className="info-box" style={{ minWidth: 0 }}>
              <span className="muted-cell">Số điện thoại</span>
              <div style={{ wordBreak: "break-word" }}>{vehicle.ownerPhone || "—"}</div>
            </div>
            <div className="info-box" style={{ minWidth: 0 }}>
              <span className="muted-cell">Địa chỉ</span>
              <div style={{ wordBreak: "break-word" }}>{vehicle.ownerAddress || "—"}</div>
            </div>
          </div>
        </div>

        {vehicle.user && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Tài khoản đăng ký</h3>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              {[
                ["Họ tên", vehicle.user.name],
                ["Email", vehicle.user.email],
                ["SĐT", vehicle.user.phone],
              ].map(([label, val]) => (
                <div key={label} className="info-box" style={{ minWidth: 0 }}>
                  <span className="muted-cell">{label}</span>
                  <div style={{ wordBreak: "break-word" }}><strong>{val || "—"}</strong></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", flexWrap: "wrap", gap: 8 }}>
          <span>Tạo: {formatDate(vehicle.createdAt)}</span>
          <span>Cập nhật: {formatDate(vehicle.updatedAt)}</span>
          {vehicle.isCompanyVehicle && <span style={{ color: "var(--primary)", fontWeight: 600 }}>Xe công ty</span>}
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button className="small-button" onClick={onClose} type="button">Đóng</button>
        </div>
      </div>
    </div>
  );
}

function VehicleEditModal({ vehicle, onClose, onSave }: {
  vehicle: RegisteredVehicle | null;
  onClose: () => void;
  onSave: (data: Parameters<ReturnType<typeof useParkingApp>["editVehicle"]>[1]) => Promise<void>;
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
  const [imageUrl, setImageUrl] = useState<string | null>(vehicle?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  function validateForm(): Record<string, string> {
    const errs: Record<string, string> = {};
    const plate = form.plate.trim().toUpperCase().replace(/[\s-]+/g, "");
    if (isNew) {
      if (!plate) errs.plate = "Vui lòng nhập biển số.";
      else if (!/^[A-Z0-9]{5,9}$/.test(plate)) errs.plate = "Biển số chỉ gồm chữ và số (5–9 ký tự).";
    } else if (plate && !/^[A-Z0-9]{5,9}$/.test(plate)) {
      errs.plate = "Biển số chỉ gồm chữ và số (5–9 ký tự).";
    }
    if (form.ownerName.trim() && form.ownerName.trim().length < 2) {
      errs.ownerName = "Họ tên phải có ít nhất 2 ký tự.";
    }
    const phone = form.ownerPhone.trim();
    if (phone) {
      if (!/^0\d{8,10}$/.test(phone)) errs.ownerPhone = "SĐT phải bắt đầu bằng 0 và có 9–11 chữ số.";
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
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setUploadError("Chỉ chấp nhận file ảnh."); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError("Ảnh tối đa 5MB."); return; }
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/uploads/vehicle", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.message || "Upload thất bại.");
        return;
      }
      setImageUrl(data.url as string);
    } catch (err) {
      console.error("[upload] failed:", err);
      setUploadError(err instanceof Error ? `Lỗi kết nối: ${err.message}` : "Lỗi kết nối khi upload.");
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
      ...(isNew ? { plate: form.plate.trim().toUpperCase().replace(/[\s-]+/g, "") } : {}),
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
    await onSave(data as Parameters<ReturnType<typeof useParkingApp>["editVehicle"]>[1]);
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
        position: "fixed", inset: 0, zIndex: 60, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.85)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface)", borderRadius: 16, padding: 24,
        width: "90vw", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isNew ? <Plus size={22} /> : <Edit size={22} />}
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>{isNew ? "Thêm phương tiện" : "Sửa phương tiện"}</h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)" }} type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Ảnh xe */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16, padding: 12, background: "var(--surface-2, #f5f6fa)", borderRadius: 10, border: "1px solid var(--border, #e2e6ef)" }}>
            <div
              onClick={() => { if (imageUrl && !uploading) setPreviewOpen(true); }}
              title={imageUrl ? "Bấm để xem ảnh lớn" : ""}
              style={{
                width: 96, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0,
                background: "var(--border, #e2e6ef)", display: "flex", alignItems: "center", justifyContent: "center",
                border: imageUrl ? "2px solid #22c55e" : uploading ? "2px solid #eab308" : "1px solid var(--border, #e2e6ef)",
                cursor: imageUrl && !uploading ? "zoom-in" : "default",
                position: "relative", transition: "border-color 0.2s",
              }}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <ImageIcon size={28} style={{ color: "var(--muted)", opacity: 0.4 }} />
              )}
              {imageUrl && !uploading && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setImageUrl(null); setUploadError(null); }}
                  title="Xoá ảnh"
                  style={{
                    position: "absolute", top: 2, right: 2, width: 20, height: 20,
                    borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff",
                    border: "none", cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                Ảnh phương tiện
                {imageUrl && !uploading && (
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "1px 6px", borderRadius: 10, background: "rgba(34,197,94,0.15)", color: "#16a34a" }}>
                    Đã tải
                  </span>
                )}
              </div>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 14px", border: "1px solid var(--border, #e2e6ef)",
                borderRadius: 8, cursor: uploading ? "wait" : "pointer", fontSize: "0.82rem", fontWeight: 500,
                background: "var(--surface)", transition: "border-color 0.15s", opacity: uploading ? 0.7 : 1,
              }}>
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {uploading ? "Đang tải..." : imageUrl ? "Đổi ảnh" : "Tải ảnh lên"}
                <input type="file" accept="image/*" onChange={handleImageFile} style={{ display: "none" }} disabled={uploading} />
              </label>
              {uploadError && (
                <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 4 }}>{uploadError}</div>
              )}
              {!uploadError && (
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 4 }}>PNG, JPG tối đa 5MB — lưu vào /uploads/vehicles/</div>
              )}
            </div>
          </div>

          {/* Lightbox xem ảnh lớn */}
          {previewOpen && imageUrl && (
            <div
              onClick={() => setPreviewOpen(false)}
              style={{
                position: "fixed", inset: 0, zIndex: 100,
                background: "rgba(0,0,0,0.85)", display: "flex",
                alignItems: "center", justifyContent: "center", cursor: "zoom-out",
              }}
            >
              <img
                src={imageUrl}
                alt="Preview"
                style={{ maxWidth: "92vw", maxHeight: "92vh", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
              />
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                style={{
                  position: "absolute", top: 20, right: 20, width: 40, height: 40,
                  borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "#fff",
                  border: "none", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={22} />
              </button>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {fields.map(({ key, label, span }) => (
              <div key={key} style={{ gridColumn: span ? "span 2" : undefined, minWidth: 0 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4, color: "var(--muted)" }}>{label}</label>
                {key === "status" ? (
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border, #e2e6ef)", borderRadius: 8, fontSize: "0.9rem", background: "var(--surface)", boxSizing: "border-box" }}
                  >
                    <option value="Đã đăng ký">Đã đăng ký</option>
                    <option value="Cần duyệt">Cần duyệt</option>
                    <option value="Blacklist">Blacklist</option>
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
                        width: "100%", padding: "8px 10px",
                        border: `1px solid ${errors[key as string] ? "#ef4444" : "var(--border, #e2e6ef)"}`,
                        borderRadius: 8, fontSize: "0.9rem", boxSizing: "border-box",
                      }}
                      type={key === "year" ? "number" : "text"}
                    />
                    {errors[key as string] && (
                      <div style={{ fontSize: "0.72rem", color: "#ef4444", marginTop: 4 }}>{errors[key as string]}</div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="small-button" onClick={onClose} type="button">Hủy</button>
            <button className="small-button primary" disabled={saving} type="submit">
              {saving ? <Loader2 size={14} /> : isNew ? <Plus size={14} /> : <Check size={14} />}
              {saving ? "Đang lưu..." : isNew ? "Thêm xe" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequestStatusBadge({ request }: { request: VehicleRequest }) {
  const cls = request.status === "approved" ? "badge success" : request.status === "rejected" ? "badge danger" : "badge warning";
  const label = request.status === "approved" ? "Đã duyệt" : request.status === "rejected" ? "Từ chối" : "Chờ duyệt";
  return <span className={cls}>{label}</span>;
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
  const [imageUrl, setImageUrl] = useState<string | null>(vehicle.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setUploadError("Chỉ chấp nhận file ảnh."); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError("Ảnh tối đa 5MB."); return; }
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/uploads/vehicle", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.message || "Upload thất bại.");
        return;
      }
      setImageUrl(data.url as string);
    } catch (err) {
      setUploadError(err instanceof Error ? `Lỗi kết nối: ${err.message}` : "Lỗi kết nối khi upload.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function validateForm(): Record<string, string> {
    const errs: Record<string, string> = {};
    const plate = form.plate.trim().toUpperCase().replace(/[\s-]+/g, "");
    if (plate && !/^[A-Z0-9]{5,9}$/.test(plate)) errs.plate = "Biển số chỉ gồm chữ và số (5–9 ký tự).";
    if (form.ownerName.trim() && form.ownerName.trim().length < 2) errs.ownerName = "Họ tên phải có ít nhất 2 ký tự.";
    const phone = form.ownerPhone.trim();
    if (phone && !/^0\d{8,10}$/.test(phone)) errs.ownerPhone = "SĐT phải bắt đầu bằng 0 và có 9–11 chữ số.";
    const yearStr = form.year.trim();
    if (yearStr) {
      const y = Number(yearStr);
      const now = new Date().getFullYear();
      if (!Number.isInteger(y) || y < 1900 || y > now + 1) errs.year = `Năm SX phải nằm trong khoảng 1900–${now + 1}.`;
    }
    if (form.engineNo.trim() && form.engineNo.trim().length < 4) errs.engineNo = "Số máy phải có ít nhất 4 ký tự.";
    if (form.chassisNo.trim() && form.chassisNo.trim().length < 4) errs.chassisNo = "Số khung phải có ít nhất 4 ký tự.";
    return errs;
  }

  function clearError(key: string) {
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
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
      plate: form.plate.trim().toUpperCase().replace(/[\s-]+/g, "") || undefined,
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
        position: "fixed", inset: 0, zIndex: 60, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.85)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface)", borderRadius: 16, padding: 24,
        width: "90vw", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Edit size={22} />
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Yêu cầu sửa xe</h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)" }} type="button">
            <X size={20} />
          </button>
        </div>
        <p style={{ margin: "0 0 16px", padding: "8px 12px", background: "rgba(234,179,8,0.1)", borderRadius: 8, fontSize: "0.85rem", color: "#a16207" }}>
          Yêu cầu sẽ được gửi tới admin duyệt. Mã gói: <strong style={{ fontFamily: "monospace" }}>{subscriptionId.slice(-8)}</strong>
        </p>

        {/* Ảnh xe */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16, padding: 12, background: "var(--surface-2, #f5f6fa)", borderRadius: 10, border: "1px solid var(--border, #e2e6ef)" }}>
          <div
            onClick={() => { if (imageUrl && !uploading) setPreviewOpen(true); }}
            title={imageUrl ? "Bấm để xem ảnh lớn" : ""}
            style={{
              width: 96, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0,
              background: "var(--border, #e2e6ef)", display: "flex", alignItems: "center", justifyContent: "center",
              border: imageUrl ? "2px solid #22c55e" : uploading ? "2px solid #eab308" : "1px solid var(--border, #e2e6ef)",
              cursor: imageUrl && !uploading ? "zoom-in" : "default",
              position: "relative", transition: "border-color 0.2s",
            }}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <ImageIcon size={28} style={{ color: "var(--muted)", opacity: 0.4 }} />
            )}
            {imageUrl && !uploading && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setImageUrl(null); setUploadError(null); }}
                title="Xoá ảnh"
                style={{
                  position: "absolute", top: 2, right: 2, width: 20, height: 20,
                  borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff",
                  border: "none", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", padding: 0,
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              Ảnh phương tiện
              {imageUrl && !uploading && (
                <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "1px 6px", borderRadius: 10, background: "rgba(34,197,94,0.15)", color: "#16a34a" }}>
                  Đã tải
                </span>
              )}
              <span style={{ fontSize: "0.7rem", fontWeight: 500, color: "var(--muted)" }}>(tùy chọn)</span>
            </div>
            <label style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 14px", border: "1px solid var(--border, #e2e6ef)",
              borderRadius: 8, cursor: uploading ? "wait" : "pointer", fontSize: "0.82rem", fontWeight: 500,
              background: "var(--surface)", transition: "border-color 0.15s", opacity: uploading ? 0.7 : 1,
            }}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? "Đang tải..." : imageUrl ? "Đổi ảnh" : "Tải ảnh lên"}
              <input type="file" accept="image/*" onChange={handleImageFile} style={{ display: "none" }} disabled={uploading} />
            </label>
            {uploadError && (
              <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 4 }}>{uploadError}</div>
            )}
            {!uploadError && (
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 4 }}>PNG, JPG tối đa 5MB — admin sẽ duyệt cùng yêu cầu sửa.</div>
            )}
          </div>
        </div>

        {/* Lightbox xem ảnh lớn */}
        {previewOpen && imageUrl && (
          <div
            onClick={() => setPreviewOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(0,0,0,0.85)", display: "flex",
              alignItems: "center", justifyContent: "center", cursor: "zoom-out",
            }}
          >
            <img
              src={imageUrl}
              alt="Preview"
              style={{ maxWidth: "92vw", maxHeight: "92vh", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
            />
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              style={{
                position: "absolute", top: 20, right: 20, width: 40, height: 40,
                borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "#fff",
                border: "none", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={22} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {fields.map(({ key, label, span }) => (
              <div key={key} style={{ gridColumn: span ? "span 2" : undefined, minWidth: 0 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4, color: "var(--muted)" }}>{label}</label>
                <input
                  value={form[key]}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, [key]: e.target.value }));
                    clearError(key as string);
                  }}
                  required={key === "plate"}
                  style={{
                    width: "100%", padding: "8px 10px",
                    border: `1px solid ${errors[key as string] ? "#ef4444" : "var(--border, #e2e6ef)"}`,
                    borderRadius: 8, fontSize: "0.9rem", boxSizing: "border-box",
                  }}
                  type={key === "year" ? "number" : "text"}
                />
                {errors[key as string] && (
                  <div style={{ fontSize: "0.72rem", color: "#ef4444", marginTop: 4 }}>{errors[key as string]}</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="small-button" onClick={onClose} type="button">Hủy</button>
            <button className="small-button primary" disabled={saving} type="submit">
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
        position: "fixed", inset: 0, zIndex: 70, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.85)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface)", borderRadius: 16, padding: 24,
        width: "90vw", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Trash2 size={22} color="#ef4444" />
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Yêu cầu xóa xe</h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)" }} type="button">
            <X size={20} />
          </button>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--muted)" }}>
          Xe <strong style={{ fontFamily: "monospace", color: "var(--primary)" }}>{vehicle.plate}</strong> sẽ được gửi yêu cầu xóa tới admin. Hành động không thể hoàn tác sau khi admin duyệt.
        </p>
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
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
              width: "100%", padding: "8px 10px", border: "1px solid var(--border, #e2e6ef)",
              borderRadius: 8, fontSize: "0.9rem", boxSizing: "border-box", resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="small-button" onClick={onClose} type="button">Hủy</button>
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

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
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
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
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

  const [detailVehicle, setDetailVehicle] = useState<RegisteredVehicle | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<RegisteredVehicle | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"vehicles" | "requests">("vehicles");
  const [customerEditTarget, setCustomerEditTarget] = useState<RegisteredVehicle | null>(null);
  const [customerDeleteTarget, setCustomerDeleteTarget] = useState<RegisteredVehicle | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    loadVehicleRequests({ includeResolved: true });
  }, [isAdmin]);

  // Map vehicleId → active subscriptionId của customer (1 xe 1 sub)
  const vehicleSubscriptionMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!isAdmin) {
      subscriptionList
        .filter((s) => s.status === "active" || s.status === "cancelled")
        .forEach((s) => {
          if (s.primaryVehicle?.id) map.set(s.primaryVehicle.id, s.id);
        });
    }
    return map;
  }, [subscriptionList, isAdmin]);

  const pendingRequests = vehicleRequests.filter((r) => r.status === "pending");
  const resolvedRequests = vehicleRequests.filter((r) => r.status !== "pending");

  // Stats summary
  const stats = useMemo(() => {
    const total = registeredVehicles.length;
    const active = registeredVehicles.filter((v) => v.status === "Đã đăng ký").length;
    const pending = registeredVehicles.filter((v) => v.status === "Cần duyệt").length;
    const blacklist = registeredVehicles.filter((v) => v.status === "Blacklist").length;
    return { total, active, pending, blacklist };
  }, [registeredVehicles]);

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registeredVehicles.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
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
  }, [registeredVehicles, search, statusFilter]);

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
  }, [search, statusFilter, pageSize]);

  // Cleanup selectedIds when item no longer in list
  useEffect(() => {
    const visible = new Set(pageItems.map((v) => v.id).filter(Boolean) as string[]);
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

  async function handleResolve(requestId: string, action: "approved" | "rejected") {
    setResolvingId(requestId);
    await resolveRequest(requestId, action);
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

  async function handleCustomerEdit(vehicle: RegisteredVehicle, changes: Partial<RegisteredVehicle>) {
    const subId = vehicleSubscriptionMap.get(vehicle.id);
    if (!subId) {
      alert("Xe này chưa gắn với gói đăng ký nào. Vui lòng mua gói trước khi sửa.");
      return;
    }
    setRequestSubmitting(true);
    try {
      await createEditRequest(vehicle.id, subId, changes);
      setCustomerEditTarget(null);
      await loadVehicleRequests({ includeResolved: true });
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function handleCustomerDelete(vehicle: RegisteredVehicle, reason: string) {
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

  const allOnPageSelected =
    pageItems.length > 0 &&
    pageItems.every((v) => v.id && selectedIds.has(v.id));

  return (
    <>
      {detailVehicle && (
        <VehicleDetailModal vehicle={detailVehicle} onClose={() => setDetailVehicle(null)} />
      )}

      {(editingVehicle !== null || showAddForm) && (
        <VehicleEditModal
          vehicle={editingVehicle}
          onClose={() => { setEditingVehicle(null); setShowAddForm(false); }}
          onSave={async (data) => {
            if (showAddForm) {
              await addVehicle(data as Parameters<typeof addVehicle>[0]);
            } else if (editingVehicle?.id) {
              await editVehicle(editingVehicle.id, data as Parameters<typeof editVehicle>[1]);
            }
            setEditingVehicle(null);
            setShowAddForm(false);
          }}
        />
      )}

      {customerEditTarget && customerEditTarget.id && vehicleSubscriptionMap.has(customerEditTarget.id) && (
        <CustomerEditRequestModal
          vehicle={customerEditTarget}
          subscriptionId={vehicleSubscriptionMap.get(customerEditTarget.id) ?? ""}
          onClose={() => setCustomerEditTarget(null)}
          onSubmit={async (changes) => handleCustomerEdit(customerEditTarget, changes)}
        />
      )}

      {customerDeleteTarget && customerDeleteTarget.id && vehicleSubscriptionMap.has(customerDeleteTarget.id) && (
        <CustomerDeleteRequestModal
          vehicle={customerDeleteTarget}
          subscriptionId={vehicleSubscriptionMap.get(customerDeleteTarget.id) ?? ""}
          onClose={() => setCustomerDeleteTarget(null)}
          onSubmit={async (reason) => handleCustomerDelete(customerDeleteTarget, reason)}
        />
      )}

      {confirmDelete && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 70,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.85)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div style={{
            background: "var(--surface)", borderRadius: 16, padding: 24,
            width: "90vw", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}>
            <h3 style={{ margin: "0 0 12px" }}>Xác nhận xóa</h3>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>
              Bạn có chắc muốn xóa phương tiện này? Hành động này không thể hoàn tác.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="small-button" onClick={() => setConfirmDelete(null)} type="button">Hủy</button>
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

      {selectedIds.size > 0 && isAdmin && (
        <div
          style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
            background: "var(--surface)", borderTop: "1px solid var(--border, #e2e6ef)",
            padding: "12px 20px", boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
            display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "0.9rem" }}>
            Đã chọn <strong>{selectedIds.size}</strong> xe
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="small-button" onClick={() => setSelectedIds(new Set())} type="button">
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
            <h2>Xe đăng ký, blacklist và ngoại lệ</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="muted-cell" style={{ fontSize: "0.85rem" }}>
              {filtered.length} / {registeredVehicles.length} xe
            </span>
            <Car size={22} />
          </div>
        </div>

        {(
          <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: "1px solid var(--border, #e2e6ef)" }}>
            <button
              onClick={() => setActiveTab("vehicles")}
              style={{
                padding: "8px 16px", border: "none", borderBottom: activeTab === "vehicles" ? "2px solid var(--primary)" : "2px solid transparent",
                background: "transparent", cursor: "pointer", fontWeight: activeTab === "vehicles" ? 700 : 400, color: activeTab === "vehicles" ? "var(--primary)" : "var(--muted)",
                fontSize: "0.9rem",
              }}
              type="button"
            >
              Danh sách xe
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              style={{
                padding: "8px 16px", border: "none", borderBottom: activeTab === "requests" ? "2px solid var(--primary)" : "2px solid transparent",
                background: "transparent", cursor: "pointer", fontWeight: activeTab === "requests" ? 700 : 400, color: activeTab === "requests" ? "var(--primary)" : "var(--muted)",
                fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 6,
              }}
              type="button"
            >
              {isAdmin ? "Yêu cầu" : "Yêu cầu của tôi"}
              {pendingRequests.length > 0 && <span className="badge warning" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>{pendingRequests.length}</span>}
            </button>
          </div>
        )}

        {/* ─── Tab: Danh sách xe ─── */}
        {activeTab === "vehicles" && (
          <>
            {/* Stats summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
              <div style={{ padding: "10px 14px", background: "var(--surface-2, #f5f6fa)", borderRadius: 10, border: "1px solid var(--border, #e2e6ef)" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>Tổng</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{stats.total}</div>
              </div>
              <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.08)", borderRadius: 10, border: "1px solid rgba(34,197,94,0.25)" }}>
                <div style={{ fontSize: "0.78rem", color: "#16a34a", fontWeight: 600 }}>Đã đăng ký</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#16a34a" }}>{stats.active}</div>
              </div>
              <div style={{ padding: "10px 14px", background: "rgba(234,179,8,0.08)", borderRadius: 10, border: "1px solid rgba(234,179,8,0.25)" }}>
                <div style={{ fontSize: "0.78rem", color: "#ca8a04", fontWeight: 600 }}>Cần duyệt</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#ca8a04" }}>{stats.pending}</div>
              </div>
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.25)" }}>
                <div style={{ fontSize: "0.78rem", color: "#dc2626", fontWeight: 600 }}>Blacklist</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#dc2626" }}>{stats.blacklist}</div>
              </div>
            </div>

            {/* Toolbar */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
              {/* Filters */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  style={{
                    padding: "6px 10px", border: "1px solid var(--border, #e2e6ef)",
                    borderRadius: 6, fontSize: "0.85rem", background: "var(--surface)", cursor: "pointer",
                  }}
                  aria-label="Lọc theo trạng thái"
                >
                  <option value="all">Tất cả</option>
                  <option value="Đã đăng ký">Đã đăng ký</option>
                  <option value="Cần duyệt">Cần duyệt</option>
                  <option value="Blacklist">Blacklist</option>
                </select>
              </div>

              <div style={{ flex: 1 }} />

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                    <button
                      className="small-button primary"
                      onClick={() => { setShowAddForm(true); setEditingVehicle(null); }}
                      type="button"
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Plus size={14} /> Thêm xe
                    </button>
                  </>
                )}
                {!isAdmin && (
                  <button
                    className="small-button primary"
                    onClick={() => { setShowAddForm(true); setEditingVehicle(null); }}
                    type="button"
                    title="Đăng ký xe mới (cần admin duyệt)"
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Plus size={14} /> Đăng ký xe
                  </button>
                )}
              </div>

              {/* Search */}
              <div style={{ position: "relative", width: 220 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <input
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm..."
                  value={search}
                  style={{
                    width: "100%", padding: "6px 10px 6px 32px",
                    border: "1px solid var(--border, #e2e6ef)", borderRadius: 6,
                    fontSize: "0.85rem", boxSizing: "border-box", background: "var(--surface)",
                  }}
                  type="search"
                />
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
                <button key="col-plate" onClick={() => toggleSort("plate")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: "inherit" }}>
                  Biển số <SortIcon field="plate" sortField={sortField} sortDir={sortDir} />
                </button>,
                <button key="col-owner" onClick={() => toggleSort("owner")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: "inherit" }}>
                  Chủ xe <SortIcon field="owner" sortField={sortField} sortDir={sortDir} />
                </button>,
                "Thông tin",
                <button key="col-status" onClick={() => toggleSort("status")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: "inherit" }}>
                  Trạng thái <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                </button>,
                <button key="col-date" onClick={() => toggleSort("createdAt")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: "inherit" }}>
                  Ngày tạo <SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} />
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
                  onClick={() => handleDetail(vehicle)}
                  title={vehicle.imageUrl ? "Xem chi tiết" : "Chưa có ảnh"}
                  style={{ width: 56, height: 40, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border, #e2e6ef)", background: "var(--surface-2, #f5f6fa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", position: "relative" }}
                >
                  {vehicle.imageUrl ? (
                    <img
                      src={vehicle.imageUrl}
                      alt={vehicle.plate}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <Car size={20} style={{ color: "var(--muted)", opacity: 0.4 }} />
                  )}
                </div>,
                <span key="plate" style={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: 1, color: "var(--primary)" }}>
                  {vehicle.plate}
                </span>,
                <span key="owner" style={{ fontSize: "0.85rem", wordBreak: "break-word" }}>
                  {vehicle.owner}
                  {vehicle.ownerPhone && (
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{vehicle.ownerPhone}</div>
                  )}
                </span>,
                <span key="info" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {[vehicle.brand, vehicle.model, vehicle.color].filter(Boolean).join(" • ") || "—"}
                </span>,
                <span className={statusBadgeClass(vehicle.status)} key="status">
                  {statusIcon(vehicle.status)}
                  {vehicle.status}
                </span>,
                formatDate(vehicle.createdAt),
                <div key="actions" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <button className="small-button" onClick={() => handleDetail(vehicle)} title="Chi tiết" type="button" style={{ padding: "3px 7px" }}>
                    <Eye size={13} />
                  </button>
                  {isAdmin && vehicle.status === "Cần duyệt" && (
                    <button className="small-button" onClick={() => approveVehicle(vehicle)} title="Duyệt" type="button" style={{ padding: "3px 7px" }}>
                      <Check size={13} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="small-button"
                      onClick={() => setEditingVehicle(vehicle)}
                      title="Sửa"
                      type="button"
                      style={{ padding: "3px 7px" }}
                    >
                      <Edit size={13} />
                    </button>
                  )}
                  {!isAdmin && vehicle.id && (
                    <button
                      className="small-button"
                      onClick={() => setCustomerEditTarget(vehicle)}
                      title="Gửi yêu cầu sửa (admin duyệt)"
                      type="button"
                      style={{ padding: "3px 7px" }}
                    >
                      <Edit size={13} />
                    </button>
                  )}
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
                  {!isAdmin && vehicle.id && vehicleSubscriptionMap.has(vehicle.id) && (
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, padding: "8px 0", borderTop: "1px solid var(--border, #e2e6ef)" }}>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  <span style={{ fontWeight: 500 }}>{sorted.length}</span> xe · Trang <span style={{ fontWeight: 500 }}>{page}</span>/{totalPages}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    style={{ padding: "4px 8px", border: "1px solid var(--border, #e2e6ef)", borderRadius: 4, background: "var(--surface)", fontSize: "0.8rem", cursor: "pointer" }}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
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
              <p style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                Không có xe nào khớp bộ lọc.
              </p>
            )}
          </>
        )}

        {/* ─── Tab: Yêu cầu sửa/xóa ─── */}
        {activeTab === "requests" && (
          <>
            {pendingRequests.length === 0 && resolvedRequests.length === 0 ? (
              <p className="muted-cell" style={{ fontSize: "0.85rem" }}>
                {isAdmin ? "Chưa có yêu cầu nào." : "Bạn chưa gửi yêu cầu sửa/xóa xe nào."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {pendingRequests.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem", fontWeight: 700, color: "var(--muted)" }}>
                      CHỜ DUYỆT ({pendingRequests.length})
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {pendingRequests.map((req) => (
                        <div key={req.id} style={{
                          background: "var(--surface-2, #f5f6fa)", borderRadius: 10,
                          padding: "12px 14px", border: "1px solid var(--border, #e2e6ef)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: "0.75rem", fontWeight: 700, background: req.type === "edit" && req.requestedChanges?.status === "Đã đăng ký" ? "rgba(34,197,94,0.15)" : req.type === "edit" ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.15)", color: req.type === "edit" && req.requestedChanges?.status === "Đã đăng ký" ? "#16a34a" : req.type === "edit" ? "#2563eb" : "#dc2626" }}>
                                  {req.type === "edit" && req.requestedChanges?.status === "Đã đăng ký" ? "Đăng ký mới" : req.type === "edit" ? "Sửa" : "Xóa"}
                                </span>
                                <RequestStatusBadge request={req} />
                                <span className="muted-cell" style={{ fontSize: "0.8rem" }}>{formatDate(req.createdAt)}</span>
                              </div>
                              {req.type === "edit" && req.requestedChanges?.status === "Đã đăng ký" ? (
                                <div style={{ fontSize: "0.85rem" }}>
                                  Yêu cầu đăng ký xe mới <strong style={{ fontFamily: "monospace" }}>{req.vehicle?.plate ?? req.vehicleId}</strong>
                                </div>
                              ) : req.type === "edit" && req.requestedChanges ? (
                                <div style={{ fontSize: "0.85rem" }}>
                                  <strong style={{ fontFamily: "monospace" }}>{req.vehicle?.plate ?? req.vehicleId}</strong>
                                  {" → "}
                                  {Object.entries(req.requestedChanges).filter(([, v]) => v != null && v !== "").map(([k, v]) => (
                                    <span key={k} style={{ marginRight: 8 }}><strong>{k}:</strong> {String(v)}</span>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: "0.85rem" }}>
                                  Yêu cầu xóa xe <strong>{req.vehicle?.plate ?? req.vehicleId}</strong>
                                  {req.reason && <span className="muted-cell" style={{ marginLeft: 8 }}>— Lý do: {req.reason}</span>}
                                </div>
                              )}
                              {req.user && isAdmin && (
                                <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 4 }}>
                                  Khách hàng: {req.user.name} {req.user.email ? `(${req.user.email})` : ""}
                                </div>
                              )}
                            </div>
                            {isAdmin && (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="small-button" disabled={resolvingId === req.id} onClick={() => handleResolve(req.id, "approved")} style={{ padding: "5px 10px" }} type="button">
                                  {resolvingId === req.id ? <Loader2 size={14} /> : <Check size={14} />} Duyệt
                                </button>
                                <button className="small-button" disabled={resolvingId === req.id} onClick={() => handleResolve(req.id, "rejected")} style={{ padding: "5px 10px" }} type="button">
                                  <X size={14} /> Từ chối
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
                    <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem", fontWeight: 700, color: "var(--muted)" }}>
                      ĐÃ XỬ LÝ ({resolvedRequests.length})
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {resolvedRequests.slice(0, 10).map((req) => (
                        <div key={req.id} style={{
                          background: "var(--surface-2, #f5f6fa)", borderRadius: 8,
                          padding: "8px 12px", border: "1px solid var(--border, #e2e6ef)",
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: "0.72rem", fontWeight: 700, background: req.type === "edit" && req.requestedChanges?.status === "Đã đăng ký" ? "rgba(34,197,94,0.1)" : req.type === "edit" ? "rgba(59,130,246,0.1)" : "rgba(239,68,68,0.1)", color: req.type === "edit" && req.requestedChanges?.status === "Đã đăng ký" ? "#16a34a" : req.type === "edit" ? "#2563eb" : "#dc2626" }}>
                              {req.type === "edit" && req.requestedChanges?.status === "Đã đăng ký" ? "Đăng ký mới" : req.type === "edit" ? "Sửa" : "Xóa"}
                            </span>
                            <RequestStatusBadge request={req} />
                            <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{req.vehicle?.plate ?? req.vehicleId}</span>
                          </div>
                          <span className="muted-cell" style={{ fontSize: "0.75rem" }}>{formatDate(req.resolvedAt ?? req.updatedAt)}</span>
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
