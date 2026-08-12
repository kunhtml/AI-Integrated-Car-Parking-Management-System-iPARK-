"use client";

import { useState } from "react";
import { Car, CheckCircle2, Plus, X } from "lucide-react";
import type { RegisteredVehicle, Subscription } from "@/types";
import { VehicleCreateModal } from "./vehicle-create-modal";

type Props = {
  vehicles: RegisteredVehicle[];
  activeSubsForVehicle: (vehicleId: string) => Subscription | null;
  open: boolean;
  onClose: () => void;
  onSelect: (vehicle: RegisteredVehicle) => void;
  onVehicleCreated?: (vehicle: RegisteredVehicle) => void;
};

export function VehiclePickerModal({
  vehicles,
  activeSubsForVehicle,
  open,
  onClose,
  onSelect,
  onVehicleCreated,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);

  if (!open) return null;

  return (
    <div
      role="dialog"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 520,
          width: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxHeight: "90vh",
          overflowY: "auto",
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

        <div>
          <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Chọn xe để mua gói</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.88rem" }}>
            Mỗi gói gắn với một xe và RFID Member đã mua cho xe đó. Hệ thống sẽ tự liên kết thẻ; nếu xe chưa có thẻ Member, hãy mua thẻ trước.
          </p>
        </div>

        <button
          type="button"
          className="small-button"
          onClick={() => setCreateOpen(true)}
          style={{ alignSelf: "flex-start" }}
        >
          <Plus size={14} /> Đăng ký xe mới
        </button>

        {vehicles.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: "var(--primary-soft, #eff6ff)",
              color: "var(--primary)",
              textAlign: "center",
              fontSize: "0.92rem",
            }}
          >
            Bạn chưa có xe nào. Hãy bấm <strong>Đăng ký xe mới</strong> ở trên.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vehicles.map((v) => {
              const activeSub = activeSubsForVehicle(v.id);
              const ineligible = v.status === "Blacklist" || v.status === "Cần duyệt";
              const disabled = !!activeSub || ineligible;
              const subLabel = activeSub
                ? `Đã có vé tháng đến ${new Date(activeSub.endDate).toLocaleDateString("vi-VN")}`
                : ineligible
                  ? `Trạng thái: ${v.status}`
                  : "Sẽ tự liên kết RFID Member của xe";

              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && onSelect(v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--border, #e2e6ef)",
                    background: disabled ? "var(--surface-soft, #f3f4f6)" : "var(--surface)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    textAlign: "left",
                    opacity: disabled ? 0.7 : 1,
                  }}
                >
                  <Car size={20} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontFamily: "monospace" }}>{v.plate}</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                      {[v.brand, v.model, v.color].filter(Boolean).join(" · ") || "Chưa cập nhật thông tin xe"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        marginTop: 4,
                        color: disabled ? "var(--danger, #dc2626)" : "var(--success, #16a34a)",
                        fontWeight: 600,
                      }}
                    >
                      {subLabel}
                    </div>
                  </div>
                  {!disabled && <CheckCircle2 size={18} color="var(--primary)" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <VehicleCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(v) => {
          setCreateOpen(false);
          onVehicleCreated?.(v);
        }}
      />
    </div>
  );
}
