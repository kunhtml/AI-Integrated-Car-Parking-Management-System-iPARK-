import { apiFetch } from "@/lib/client-api";
import type {
  StaffApplication,
  StaffApplicationHistory,
  StaffApplicationListResponse,
  StaffApplicationShift,
} from "@/types";

export type StaffApplicationFormPayload = {
  phone: string;
  idCardNumber: string;
  address: string;
  experience?: string;
  reason: string;
  preferredShift: StaffApplicationShift;
};

export type StaffApplicationMyResponse = {
  application: StaffApplication | null;
};

export async function fetchMyStaffApplication(): Promise<StaffApplicationMyResponse> {
  const r = await apiFetch("/staff-applications/me");
  const data = (await r.json().catch(() => ({}))) as StaffApplicationMyResponse;
  if (!r.ok) {
    throw new Error(
      (data as { message?: string }).message || "Không tải được đơn đăng ký.",
    );
  }
  return data;
}

export async function submitStaffApplication(
  payload: StaffApplicationFormPayload,
): Promise<StaffApplication> {
  const r = await apiFetch("/staff-applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Không gửi được đơn.");
  return (data.application ?? data) as StaffApplication;
}

export async function saveStaffApplication(
  id: string,
  payload: StaffApplicationFormPayload,
): Promise<StaffApplication> {
  const r = await apiFetch(`/staff-applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Không lưu được đơn.");
  return (data.application ?? data) as StaffApplication;
}

export async function resubmitStaffApplication(id: string): Promise<StaffApplication> {
  const r = await apiFetch(`/staff-applications/${id}/resubmit`, {
    method: "POST",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Không gửi lại được đơn.");
  return (data.application ?? data) as StaffApplication;
}

export async function fetchStaffApplicationHistory(
  id: string,
  admin = false,
): Promise<StaffApplicationHistory[]> {
  const path = admin
    ? `/staff-applications/${id}/history/admin`
    : `/staff-applications/${id}/history`;
  const r = await apiFetch(path);
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Không tải được lịch sử đơn.");
  return (data.history ?? []) as StaffApplicationHistory[];
}

export async function cancelMyStaffApplication(): Promise<StaffApplication> {
  const r = await apiFetch("/staff-applications/me/cancel", { method: "PATCH" });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Không hủy được đơn.");
  return (data.application ?? data) as StaffApplication;
}

export type AdminStaffApplicationListParams = {
  status?: "draft" | "pending" | "approved" | "rejected" | "cancelled";
  search?: string;
  page?: number;
  limit?: number;
};

export async function fetchAdminStaffApplications(
  params: AdminStaffApplicationListParams = {},
): Promise<StaffApplicationListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  const r = await apiFetch(`/staff-applications${qs ? `?${qs}` : ""}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Không tải được danh sách đơn.");
  return data as StaffApplicationListResponse;
}

export type StaffApplicationReviewPayload = {
  decision: "approved" | "rejected";
  note?: string;
};

export async function reviewStaffApplication(
  id: string,
  payload: StaffApplicationReviewPayload,
): Promise<StaffApplication> {
  const r = await apiFetch(`/staff-applications/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Không xét duyệt được đơn.");
  return (data.application ?? data) as StaffApplication;
}

export function maskIdCard(idCard: string | null | undefined): string {
  if (!idCard) return "—";
  const trimmed = idCard.trim();
  if (trimmed.length <= 4) return trimmed;
  return `${"*".repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}
