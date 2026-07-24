import { apiFetch } from "@/lib/client-api";
import type { RfidCard, RfidScanLog } from "@/types";

// ─── Card API ───

export async function fetchRfidCards(params?: {
  status?: string;
  limit?: number;
  skip?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.skip) search.set("skip", String(params.skip));
  const qs = search.toString();
  const response = await apiFetch(`/rfid-cards${qs ? `?${qs}` : ""}`);
  return response;
}

export async function fetchRfidCardDetail(id: string) {
  return apiFetch(`/rfid-cards/${id}`);
}

export async function registerRfidCard(body: {
  cardId: string;
  notes?: string;
}) {
  return apiFetch("/rfid-cards", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRfidCardStatus(
  id: string,
  body: { status: string; blockedReason?: string; notes?: string },
) {
  return apiFetch(`/rfid-cards/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function reportLostCard(id: string, notes?: string) {
  return apiFetch(`/rfid-cards/${id}/report-lost`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function unblockCard(id: string, notes?: string) {
  return apiFetch(`/rfid-cards/${id}/unblock`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

// ─── Scan Operations ───

export type RfidGate = "entry" | "exit";

export async function scanRfidEntry(body: {
  cardId: string;
  gate: RfidGate;
  deviceId?: string;
  plateDetected?: string;
}) {
  return apiFetch("/rfid-cards/scan/entry", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function scanRfidExit(body: {
  cardId: string;
  gate: RfidGate;
  deviceId?: string;
  plateDetected?: string;
}) {
  return apiFetch("/rfid-cards/scan/exit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function assignRfidCard(body: {
  cardId: string;
  sessionId: string;
  gate: RfidGate;
}) {
  return apiFetch("/rfid-cards/assign", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function returnRfidCard(body: {
  cardId: string;
  sessionId: string;
}) {
  return apiFetch("/rfid-cards/return", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function confirmRfidExit(body: {
  cardId: string;
  sessionId: string;
  action: "confirm" | "reject";
}) {
  return apiFetch("/rfid-cards/confirm-exit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Scan Logs API ───

export async function fetchRfidCardHistory(id: string) {
  return apiFetch(`/rfid-cards/${id}/history`);
}

export async function fetchRfidScanLogs(params?: {
  cardId?: string;
  action?: string;
  status?: string;
  limit?: number;
  page?: number;
  skip?: number;
}) {
  const search = new URLSearchParams();
  if (params?.cardId) search.set("cardId", params.cardId);
  if (params?.action) search.set("action", params.action);
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.page) search.set("page", String(params.page));
  if (params?.skip != null && !params?.page) {
    // Backend paginates by page; derive page from skip when needed
    const limit = params.limit || 20;
    search.set("page", String(Math.floor(params.skip / limit) + 1));
  }
  const qs = search.toString();
  return apiFetch(`/rfid-cards/scan-logs${qs ? `?${qs}` : ""}`);
}
