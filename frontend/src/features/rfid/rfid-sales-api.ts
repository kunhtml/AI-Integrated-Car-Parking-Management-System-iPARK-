import { apiFetch } from "@/lib/client-api";

export type RfidLifecycleStatus =
  | "available"
  | "pending-sale"
  | "in-use"
  | "active"
  | "lost"
  | "blocked"
  | "damaged"
  | "returned"
  | "inactive";

export type RfidPaymentMethod = "cash" | "payos" | "wallet";
export type RfidTransactionStatus = "pending" | "paid" | "failed" | "cancelled";

export type RfidInventoryItem = {
  id: string;
  uid: string;
  cardId?: string;
  cardType?: "guest" | "member";
  status: RfidLifecycleStatus;
  userId?: string;
  vehicleId?: string;
  plate?: string;
  ownerName?: string;
  salePrice: number;
  depositAmount: number;
  assignedAt?: string;
  soldAt?: string;
  returnedAt?: string;
  lostAt?: string;
  damagedAt?: string;
  blockedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RfidTransaction = {
  id: string;
  transactionType: "rfid_sale" | "rfid_deposit" | "rfid_replacement" | "rfid_refund";
  rfidCardId?: string;
  uid?: string;
  rfidCardType?: "guest" | "member";
  userId?: string;
  vehicleId?: string;
  amount: number;
  salePrice: number;
  depositAmount?: number;
  method: RfidPaymentMethod;
  status: RfidTransactionStatus;
  note?: string;
  paidAt?: string;
  createdAt?: string;
  payosCheckoutUrl?: string;
  payosQrCode?: string;
};

export type RfidSaleInput = {
  /** Bán đứt thẻ Member đã liên kết duy nhất với một xe. */
  cardType: "member";
  cardId: string;
  userId?: string;
  vehicleId: string;
  salePrice: number;
  depositAmount: number;
  method: RfidPaymentMethod;
  note?: string;
  freeReason?: string;
};

type InventoryResponse = {
  items: RfidInventoryItem[];
  total: number;
  page: number;
  limit: number;
  summary: Array<{ _id: RfidLifecycleStatus; count: number }>;
};

type TransactionsResponse = {
  items: RfidTransaction[];
  total: number;
  page: number;
  limit: number;
};

type SaleResponse = {
  transaction: RfidTransaction;
  card: RfidInventoryItem | null;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Không thể thực hiện thao tác RFID.");
  }
  return data as T;
}

export async function getRfidInventory(filters: { status?: RfidLifecycleStatus; search?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.search?.trim()) query.set("search", filters.search.trim());
  query.set("limit", String(filters.limit ?? 100));
  return parseResponse<InventoryResponse>(await apiFetch(`/rfid/inventory?${query.toString()}`));
}

export async function getRfidTransactions(filters: { status?: RfidTransactionStatus; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  query.set("limit", String(filters.limit ?? 50));
  return parseResponse<TransactionsResponse>(await apiFetch(`/rfid/transactions?${query.toString()}`));
}

export async function addRfidInventoryCard(input: { uid: string; notes?: string }) {
  return parseResponse<{ ok: boolean; card: RfidInventoryItem }>(await apiFetch("/rfid", {
    method: "POST",
    body: JSON.stringify({
      uid: input.uid.trim(),
      ownerName: "Kho RFID",
      plate: "",
      userType: "guest",
      status: "available",
      notes: input.notes?.trim() || undefined,
    }),
  }));
}

export async function createRfidSale(input: RfidSaleInput) {
  return parseResponse<SaleResponse>(await apiFetch("/rfid/sales", {
    method: "POST",
    body: JSON.stringify({ ...input, depositAmount: input.depositAmount ?? 0 }),
  }));
}

export async function reconcilePendingRfidSales() {
  return parseResponse<{ checked: number; updated: number }>(await apiFetch("/rfid/sales/reconcile-pending", { method: "POST" }));
}

export async function confirmRfidSale(transactionId: string) {
  return parseResponse<SaleResponse>(await apiFetch(`/rfid/sales/${transactionId}/confirm`, { method: "POST" }));
}

export async function returnRfidCard(cardId: string, input: { inspectionPassed: boolean; refundDeposit: boolean; refundReason?: string }) {
  return parseResponse<{ card: RfidInventoryItem; refund: RfidTransaction | null }>(await apiFetch(`/rfid/${cardId}/return`, {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function replaceRfidCard(cardId: string, input: RfidSaleInput) {
  return parseResponse<{ oldCard: RfidInventoryItem; card: RfidInventoryItem | null; transaction: RfidTransaction }>(await apiFetch(`/rfid/${cardId}/replace`, {
    method: "POST",
    body: JSON.stringify({ ...input, depositAmount: input.depositAmount ?? 0 }),
  }));
}

export async function updateRfidLifecycleStatus(cardId: string, action: "lost" | "blocked" | "damaged", reason?: string) {
  return parseResponse<{ card: RfidInventoryItem }>(await apiFetch(`/rfid/${cardId}/${action}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  }));
}
