import { FormEvent } from "react";

import { apiFetch } from "@/lib/client-api";
import type { DeviceItem } from "@/types";

type DeviceActionsParams = {
  setDeviceList: (devices: DeviceItem[] | ((items: DeviceItem[]) => DeviceItem[])) => void;
  setActionLog: (log: string) => void;
};

export function createDeviceActions({ setDeviceList, setActionLog }: DeviceActionsParams) {
  async function saveDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get("id") || "");
    const payload = {
      name: String(form.get("name") || ""),
      gate: String(form.get("gate") || "entry"),
      rtspUrl: String(form.get("rtspUrl") || ""),
      username: String(form.get("username") || ""),
      password: String(form.get("password") || ""),
      roiNote: String(form.get("roiNote") || ""),
    };
    const response = await apiFetch(id ? `/devices/${id}` : "/devices", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (response.ok) {
      setDeviceList((items) =>
        id ? items.map((item) => (item.id === id ? data.device : item)) : [data.device, ...items],
      );
      setActionLog("Đã lưu cấu hình camera.");
      event.currentTarget.reset();
    } else {
      setActionLog(data.message || "Không lưu được camera.");
    }
  }

  async function snapshotDevice(id: string) {
    const response = await apiFetch(`/devices/${id}/snapshot`, { method: "POST" });
    const data = await response.json();
    if (response.ok) {
      setDeviceList((items) => items.map((item) => (item.id === id ? data.device : item)));
      setActionLog("Đã chụp snapshot camera.");
    } else {
      setActionLog(data.message || "Không chụp được camera.");
    }
  }

  return {
    saveDevice,
    snapshotDevice,
  };
}
