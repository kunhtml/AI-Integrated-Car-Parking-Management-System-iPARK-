import { FormEvent } from "react";

import { apiFetch } from "@/lib/client-api";
import type { DeviceItem } from "@/types";

type DeviceActionsParams = {
  setDeviceList: (
    devices: DeviceItem[] | ((items: DeviceItem[]) => DeviceItem[]),
  ) => void;
  setActionLog: (log: string) => void;
};

export function createDeviceActions({
  setDeviceList,
  setActionLog,
}: DeviceActionsParams) {
  async function saveDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get("id") || "");
    const payload = {
      id: id || undefined,
      name: String(form.get("name") || ""),
      gate: String(form.get("gate") || "entry"),
      rtspUrl: String(form.get("rtspUrl") || ""),
      username: String(form.get("username") || ""),
      password: String(form.get("password") || ""),
      roiNote: String(form.get("roiNote") || ""),
    };

    // API backend của chúng ta sử dụng POST cho cả tạo mới và cập nhật (dựa vào payload.id)
    const response = await apiFetch("/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (response.ok) {
      setDeviceList((items) => {
        const exists = items.some((item) => item.id === data.device.id);
        if (exists) {
          return items.map((item) =>
            item.id === data.device.id ? data.device : item,
          );
        }
        return [data.device, ...items];
      });
      setActionLog("Đã lưu cấu hình camera.");
      event.currentTarget.reset();
    } else {
      setActionLog(data.message || "Không lưu được camera.");
    }
  }

  async function snapshotDevice(id: string) {
    const response = await apiFetch(`/devices/${id}/snapshot`, {
      method: "POST",
    });
    const data = await response.json();
    if (response.ok) {
      setDeviceList((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "online",
                lastSnapshotAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setActionLog("Đã chụp snapshot camera.");
    } else {
      setActionLog(data.message || "Không chụp được camera.");
    }
  }

  async function deleteDevice(id: string) {
    const response = await apiFetch(`/devices/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (response.ok) {
      setDeviceList((items) => items.filter((item) => item.id !== id));
      setActionLog("Đã xóa thiết bị thành công.");
    } else {
      setActionLog(data.message || "Không thể xóa thiết bị.");
    }
  }

  return {
    saveDevice,
    snapshotDevice,
    deleteDevice,
  };
}
