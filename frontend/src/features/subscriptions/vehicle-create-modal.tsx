"use client";

import { useState } from "react";
import { Car, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import type { RegisteredVehicle } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (vehicle: RegisteredVehicle) => void;
};

export function VehicleCreateModal({ open, onClose, onCreated }: Props) {
  const [plate, setPlate] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [year, setYear] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setPlate("");
    setOwnerName("");
    setOwnerPhone("");
    setBrand("");
    setModel("");
    setColor("");
    setYear("");
    setError(null);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!plate.trim()) {
      setError("Vui lòng nhập biển số xe.");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        plate: plate.trim().toUpperCase(),
        ownerName: ownerName.trim() || undefined,
        ownerPhone: ownerPhone.trim() || undefined,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        color: color.trim() || undefined,
        year: year && Number.isFinite(Number(year)) ? Number(year) : undefined,
      };
      const r = await apiFetch("/vehicles", { method: "POST", body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) {
        setError(d.message || "Không tạo được xe.");
        return;
      }
      reset();
      onCreated(d.vehicle);
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border, #e2e6ef)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: "0.92rem",
    width: "100%",
  } as const;

  return (
    <div
      role="dialog"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 480,
          width: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 8,
          }}
        >
          <X size={16} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Car size={18} />
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Đăng ký xe mới</h2>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Biển số *</span>
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="VD: 30A-12345"
              required
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Chủ xe</span>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Họ và tên"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Số điện thoại</span>
            <input
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder="VD: 0901234567"
              style={inputStyle}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Hãng</span>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Mẫu</span>
              <input value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Màu</span>
              <input value={color} onChange={(e) => setColor(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Năm SX</span>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="VD: 2023"
              inputMode="numeric"
              style={inputStyle}
            />
          </label>

          {error && (
            <div
              style={{
                color: "var(--danger, #dc2626)",
                fontSize: "0.85rem",
                padding: 8,
                borderRadius: 8,
                background: "rgba(220, 38, 38, 0.08)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="small-button primary"
            disabled={submitting}
            style={{ marginTop: 8, justifyContent: "center" }}
          >
            {submitting ? <Loader2 size={14} className="spin" /> : <Car size={14} />}
            {submitting ? "Đang tạo..." : "Tạo xe"}
          </button>
        </form>
      </div>
    </div>
  );
}
