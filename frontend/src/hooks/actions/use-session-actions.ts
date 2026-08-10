import { FormEvent } from "react";

import { apiFetch } from "@/lib/client-api";
import type { ParkingSession } from "@/types";

type SessionActionsParams = {
  exitSessionId: string;
  setSessions: (sessions: ParkingSession[] | ((items: ParkingSession[]) => ParkingSession[])) => void;
  setExitSessionId: (id: string) => void;
  setActionLog: (log: string) => void;
  // Refresh slot list sau checkin/checkout để UI thấy slot được gán/nhả.
  reloadSlots: () => Promise<void>;
};

export function createSessionActions({
  exitSessionId,
  setSessions,
  setExitSessionId,
  setActionLog,
  reloadSlots,
}: SessionActionsParams) {
  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const image = form.get("entryImage");

    if (!(image instanceof File) || !image.name) {
      setActionLog("Vui lòng upload ảnh xe vào để nhận diện biển số.");
      return;
    }

    try {
      const payload = new FormData();
      payload.append("action", "entry");
      payload.append("image", image);

      const response = await apiFetch("/parking-sessions/upload", { method: "POST", body: payload });
      const data = await response.json();
      if (!response.ok) {
        setActionLog(data.message || "Không tạo được phiên đỗ xe.");
        return;
      }
      setSessions((items) => [data.session, ...items]);
      setExitSessionId(data.session.id);
      await reloadSlots();
      setActionLog(
        data.isMember
          ? `Đã nhận diện biển ${data.detection.plate} → gán vào slot ${data.session.slot ?? ""}. Thành viên hợp lệ.`
          : `Đã nhận diện biển ${data.detection.plate} → gán vào slot ${data.session.slot ?? ""}.`,
      );
      formElement.reset();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      setActionLog(msg || "Không kết nối được API nhận diện ảnh xe vào. Kiểm tra AI service Python.");
    }
  }

  async function checkoutWithImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const sessionId = String(form.get("sessionId") ?? "");
    const image = form.get("exitImage");

    if (!sessionId || !(image instanceof File) || !image.name) {
      setActionLog("Vui lòng chọn phiên và upload ảnh xe ra.");
      return;
    }

    try {
      const payload = new FormData();
      payload.append("action", "exit");
      payload.append("sessionId", sessionId);
      payload.append("image", image);
      const response = await apiFetch("/parking-sessions/upload", { method: "POST", body: payload });
      const data = await response.json();
      if (!response.ok) {
        setActionLog(data.message || "Không checkout được bằng ảnh.");
        return;
      }

      setSessions((items) => items.map((item) => (item.id === sessionId ? data.session : item)));
      await reloadSlots();
      setActionLog(data.message);
      formElement.reset();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      setActionLog(msg || "Không kết nối được API nhận diện ảnh xe ra. Kiểm tra AI service Python.");
    }
  }

  async function completeSession(id: string) {
    try {
      const response = await apiFetch("/parking-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setActionLog(data.message || "Không hoàn thành được phiên.");
        return;
      }
      setSessions((items) => items.map((item) => (item.id === id ? data.session : item)));
      await reloadSlots();
      setActionLog(`Đã hoàn thành phiên ${id} và lưu biên lai vào MongoDB.`);
    } catch {
      setActionLog("Không kết nối được API hoàn thành phiên.");
    }
  }

  async function approveCheckout(id: string, plate: string) {
    const response = await apiFetch(`/parking-sessions/${id}/approve-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manualPlate: plate, verificationNote: "Admin duyệt từ UI" }),
    });
    const data = await response.json();
    if (response.ok) {
      setSessions((items) => items.map((item) => (item.id === id ? data.session : item)));
      await reloadSlots();
      setActionLog("Admin đã duyệt checkout thủ công.");
    } else {
      setActionLog(data.message || "Không duyệt được checkout.");
    }
  }

  async function cameraEntry(deviceId: string) {
    const response = await apiFetch("/parking-sessions/camera-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    const data = await response.json();
    if (response.ok) {
      setSessions((items) => [data.session, ...items]);
      await reloadSlots();
      setActionLog(
        `Camera đã tạo phiên xe vào → gán slot ${data.session?.slot ?? ""}.`,
      );
    } else {
      setActionLog(data.message || "Camera xe vào lỗi.");
    }
  }

  async function cameraExit(deviceId: string) {
    if (!exitSessionId) {
      setActionLog("Chọn phiên checkout trước khi dùng camera cổng ra.");
      return;
    }
    const response = await apiFetch("/parking-sessions/camera-exit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, sessionId: exitSessionId }),
    });
    const data = await response.json();
    if (response.ok) {
      setSessions((items) => items.map((item) => (item.id === exitSessionId ? data.session : item)));
      await reloadSlots();
      setActionLog(data.message || "Camera checkout đã xử lý → đã nhả slot.");
    } else {
      setActionLog(data.message || "Camera xe ra lỗi.");
    }
  }

  return {
    createSession,
    checkoutWithImage,
    completeSession,
    approveCheckout,
    cameraEntry,
    cameraExit,
  };
}
