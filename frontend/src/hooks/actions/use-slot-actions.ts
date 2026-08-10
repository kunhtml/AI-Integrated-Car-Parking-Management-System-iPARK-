import type { FormEvent } from "react";
import { apiFetch } from "@/lib/client-api";
import type { ParkingSlot, SlotAccessPolicy, SlotStatus } from "@/types";

type SlotActionsParams = {
  setSlotList: (slots: ParkingSlot[] | ((items: ParkingSlot[]) => ParkingSlot[])) => void;
  setActionLog: (log: string) => void;
};

export function createSlotActions({ setSlotList, setActionLog }: SlotActionsParams) {
  async function createSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget; // giữ tham chiếu trước await (React nulls currentTarget sau await)
    const form = new FormData(formEl);
    const body = {
      slotCode: String(form.get("slotCode") || "").toUpperCase(),
      zoneId: String(form.get("zoneId") || ""),
      slotType: String(form.get("slotType") || "regular"),
      features: String(form.get("features") || "")
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
      floor: Number(form.get("floor") || 0),
      notes: String(form.get("notes") || "") || undefined,
    };
    const response = await apiFetch("/parking-slots", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không tạo được slot.");
      return;
    }
    setSlotList((items) => [...items, data.slot]);
    setActionLog(`Đã tạo slot "${data.slot.slotCode}".`);
    formEl.reset();
  }

  async function bulkCreateSlots(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget; // giữ tham chiếu trước await
    const form = new FormData(formEl);
    const body = {
      zoneId: String(form.get("zoneId") || ""),
      count: Number(form.get("count") || 1),
      slotType: String(form.get("slotType") || "regular"),
      features: String(form.get("features") || "")
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
      floor: Number(form.get("floor") || 0),
    };
    const response = await apiFetch("/parking-slots/bulk", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không tạo được slots.");
      return;
    }
    setSlotList((items) => [...items, ...data.slots]);
    setActionLog(`Đã tạo ${data.created} slot mới.`);
    formEl.reset();
  }

  async function updateSlotStatus(id: string, status: SlotStatus, notes?: string) {
    const response = await apiFetch(`/parking-slots/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không đổi trạng thái được.");
      return;
    }
    setSlotList((items) => items.map((s) => (s.id === id ? data.slot : s)));
    setActionLog(`Slot ${data.slot.slotCode} → ${status}.`);
  }

  async function deleteSlot(id: string) {
    const response = await apiFetch(`/parking-slots/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không xóa được slot.");
      return;
    }
    setSlotList((items) => items.filter((s) => s.id !== id));
    setActionLog("Đã xóa slot.");
  }

  async function updateSlotAccessPolicy(id: string, accessPolicy: SlotAccessPolicy) {
    const response = await apiFetch(`/parking-slots/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ accessPolicy }),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không cập nhật được chính sách slot.");
      return;
    }
    setSlotList((items) => items.map((s) => (s.id === id ? data.slot : s)));
    const label =
      accessPolicy === "resident"
        ? "Cư dân"
        : accessPolicy === "guest"
          ? "Vãng lai"
          : "Chung";
    setActionLog(`Slot ${data.slot.slotCode} → ${label}.`);
  }

  return {
    createSlot,
    bulkCreateSlots,
    updateSlotStatus,
    deleteSlot,
    updateSlotAccessPolicy,
  };
}
