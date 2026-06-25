import type { FormEvent } from "react";
import { apiFetch } from "@/lib/client-api";
import type { Zone } from "@/types";

type ZoneActionsParams = {
  setZoneList: (zones: Zone[] | ((items: Zone[]) => Zone[])) => void;
  setActionLog: (log: string) => void;
  onServerError?: (errors: FieldErrors) => void;
};

type FieldErrors = {
  name?: string;
  capacity?: string;
  displayOrder?: string;
};

// ---------- validation helpers ----------
type ValidationResult = { ok: true } | { ok: false; message: string };

function validateCreateBody(raw: {
  name: string;
  capacity: number;
  displayOrder: number;
}): ValidationResult {
  const name = raw.name.trim();

  if (!name) {
    return { ok: false, message: "Tên khu vực không được để trống." };
  }
  if (name.length > 50) {
    return { ok: false, message: "Tên khu vực không được dài quá 50 ký tự." };
  }
  if (/\s{2,}/.test(name)) {
    return { ok: false, message: "Tên khu vực không được chứa nhiều khoảng trắng liên tiếp." };
  }

  const cap = Number(raw.capacity);
  if (!Number.isInteger(cap) || cap < 1) {
    return { ok: false, message: "Sức chứa phải là số nguyên lớn hơn 0." };
  }

  const order = Number(raw.displayOrder);
  if (!Number.isInteger(order) || order < 0) {
    return { ok: false, message: "Thứ tự hiển thị phải là số nguyên không âm." };
  }

  return { ok: true };
}

function validateUpdateBody(updates: Partial<Zone>): ValidationResult {
  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!name) return { ok: false, message: "Tên khu vực không được để trống." };
    if (name.length > 50) return { ok: false, message: "Tên khu vực không được dài quá 50 ký tự." };
  }
  if (updates.capacity !== undefined) {
    const cap = Number(updates.capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      return { ok: false, message: "Sức chứa phải là số nguyên lớn hơn 0." };
    }
  }
  if (updates.displayOrder !== undefined) {
    const order = Number(updates.displayOrder);
    if (!Number.isInteger(order) || order < 0) {
      return { ok: false, message: "Thứ tự hiển thị phải là số nguyên không âm." };
    }
  }
  return { ok: true };
}

// ---------- actions ----------
export function createZoneActions({
  setZoneList,
  setActionLog,
  onServerError,
}: ZoneActionsParams) {
  async function createZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    const name = String(form.get("name") || "").trim();
    const capacity = Number(form.get("capacity") || 0);
    const displayOrder = Number(form.get("displayOrder") || 0);

    const validation = validateCreateBody({ name, capacity, displayOrder });
    if (!validation.ok) {
      setActionLog(validation.message);
      return;
    }

    const body = {
      name,
      description: String(form.get("description") || "").trim() || undefined,
      capacity,
      allowedVehicleTypes: ["Ô tô"],
      displayOrder,
    };

    const response = await apiFetch("/zones", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok) {
      const msg = data.message || "Tạo khu vực thất bại.";
      if (
        msg.includes("thứ tự") ||
        msg.includes("đã được sử dụng") ||
        msg.includes("số âm")
      ) {
        onServerError?.({ displayOrder: msg });
      } else if (msg.includes("tên") && msg.includes("đã tồn")) {
        onServerError?.({ name: msg });
      } else {
        setActionLog(msg);
      }
      return;
    }

    setZoneList((items) => [...items, data.zone]);
    setActionLog(`Đã tạo khu vực "${data.zone.name}".`);
    formEl.reset();
    // restore defaults
    const capInput = formEl.querySelector<HTMLInputElement>('[name="capacity"]');
    if (capInput) capInput.value = "10";
    const orderInput = formEl.querySelector<HTMLInputElement>('[name="displayOrder"]');
    if (orderInput) orderInput.value = "0";
  }

  async function updateZone(id: string, updates: Partial<Zone>) {
    const validation = validateUpdateBody(updates);
    if (!validation.ok) {
      setActionLog(validation.message);
      return;
    }

    const response = await apiFetch(`/zones/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    const data = await response.json();

    if (!response.ok) {
      setActionLog(data.message || "Cập nhật thất bại. Vui lòng thử lại.");
      return;
    }

    setZoneList((items) => items.map((z) => (z.id === id ? data.zone : z)));
    setActionLog(`Đã cập nhật khu vực "${data.zone.name}".`);
  }

  async function deleteZone(id: string) {
    const response = await apiFetch(`/zones/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Xóa khu vực thất bại. Vui lòng thử lại.");
      return;
    }
    setZoneList((items) => items.filter((z) => z.id !== id));
    setActionLog("Đã vô hiệu hóa khu vực.");
  }

  return { createZone, updateZone, deleteZone };
}
