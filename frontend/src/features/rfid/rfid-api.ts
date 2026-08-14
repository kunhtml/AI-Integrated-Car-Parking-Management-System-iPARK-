import { apiFetch } from "@/lib/client-api";
import type { RfidCard, RfidScanLog } from "@/types";

// ─── Card API ───

export async function fetchRfidAssignments() { return apiFetch("/rfid/assignments"); }



export async function fetchMyRfidCards() { return apiFetch("/rfid/mine"); }

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

export type RfidIssueRequest = { id: string; userId?: string; vehicleId?: string | null; rfidCardId: string; uid: string; type: "lost" | "damaged"; description: string; status: "pending" | "processing" | "completed" | "rejected"; managerNote: string; createdAt: string; handledAt?: string | null; card?: { uid?: string; cardId?: string; plate?: string } | null };
export async function fetchMyRfidIssues() { return apiFetch("/rfid/issue-requests/mine"); }
export async function createMyRfidIssue(body: { rfidCardId: string; type: "lost" | "damaged"; description?: string }) { return apiFetch("/rfid/issue-requests", { method: "POST", body: JSON.stringify(body) }); }
export async function fetchRfidIssues() { return apiFetch("/rfid/issue-requests"); }
export async function updateRfidIssue(id: string, body: { status: "processing" | "completed" | "rejected"; managerNote?: string }) { return apiFetch("/rfid/issue-requests/" + id, { method: "PATCH", body: JSON.stringify(body) }); }

export type RfidPurchaseRequest = { id: string; vehicleId: string; vehicle?: { plate?: string; ownerName?: string; status?: string } | null; status: "pending_payment" | "waiting_issuance" | "approved_waiting_assignment" | "completed" | "rejected"; salePrice: number; card?: { id?: string; uid?: string; cardId?: string } | null; transactionId?: string; rejectionReason?: string; createdAt: string; };
export async function fetchMyRfidPurchaseRequests() { return apiFetch("/rfid/purchase-requests/mine"); }
export async function createRfidPurchaseRequest(body: { vehicleId: string; note?: string }) { return apiFetch("/rfid/purchase-requests", { method: "POST", body: JSON.stringify(body) }); }
export async function payRfidPurchaseRequest(id: string) { return apiFetch(`/rfid/purchase-requests/${id}/pay`, { method: "POST" }); }
export async function fetchRfidPurchaseRequests() { return apiFetch("/rfid/purchase-requests"); }
export async function reviewRfidPurchaseRequest(id: string, body: { action: "approve" | "reject"; reason?: string }) { return apiFetch(`/rfid/purchase-requests/${id}/review`, { method: "POST", body: JSON.stringify(body) }); }
export async function assignRfidPurchaseCard(id: string, body: { uid: string }) { return apiFetch(`/rfid/purchase-requests/${id}/assign`, { method: "POST", body: JSON.stringify(body) }); }
