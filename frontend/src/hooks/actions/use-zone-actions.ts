import type { FormEvent } from "react";
import { apiFetch } from "@/lib/client-api";
import type { Zone } from "@/types";

type ZoneActionsParams = {
  setZoneList: (zones: Zone[] | ((items: Zone[]) => Zone[])) => void;
  setActionLog: (log: string) => void;
};

export function createZoneActions({ setZoneList, setActionLog }: ZoneActionsParams) {
  async function createZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const body = {
      name: String(form.get("name") || "").trim(),
      description: String(form.get("description") || "").trim() || undefined,
      capacity: Number(form.get("capacity") || 10),
      allowedVehicleTypes: ["Ô tô"],
      displayOrder: Number(form.get("displayOrder") || 0),
    };
    const response = await apiFetch("/zones", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không tạo được zone.");
      return;
    }
    setZoneList((items) => [...items, data.zone]);
    setActionLog(`Đã tạo zone "${data.zone.name}".`);
    formEl.reset();
  }

  async function updateZone(id: string, updates: Partial<Zone>) {
    const response = await apiFetch(`/zones/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không cập nhật được zone.");
      return;
    }
    setZoneList((items) => items.map((z) => (z.id === id ? data.zone : z)));
    setActionLog(`Đã cập nhật zone "${data.zone.name}".`);
  }

  async function deleteZone(id: string) {
    const response = await apiFetch(`/zones/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không xóa được zone.");
      return;
    }
    setZoneList((items) => items.filter((z) => z.id !== id));
    setActionLog("Đã vô hiệu hóa zone.");
  }

  return { createZone, updateZone, deleteZone };
}
