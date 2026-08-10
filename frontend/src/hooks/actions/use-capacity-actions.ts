import { apiFetch } from "@/lib/client-api";
import type {
  CapacityChangeLog,
  CapacityConfig,
  CapacityUsage,
  CapacityZoneSummary,
  ZoneSlotsResponse,
} from "@/types";

type CapacityActionsParams = {
  setCapacityConfig: (cfg: CapacityConfig | null) => void;
  setCapacityUsage: (usage: CapacityUsage | null) => void;
  setCapacityHistory: (logs: CapacityChangeLog[]) => void;
  setZoneSlots: (zoneId: string, data: ZoneSlotsResponse | null) => void;
  setActionLog: (log: string) => void;
};

export function createCapacityActions({
  setCapacityConfig,
  setCapacityUsage,
  setCapacityHistory,
  setZoneSlots,
  setActionLog,
}: CapacityActionsParams) {
  async function loadConfig() {
    const response = await apiFetch("/capacity-config");
    if (!response.ok) return null;
    const data = await response.json();
    setCapacityConfig(data.config ?? null);
    return data;
  }

  async function loadUsage() {
    const response = await apiFetch("/capacity-config/usage");
    if (!response.ok) return null;
    const data = await response.json();
    setCapacityUsage(data);
    return data;
  }

  async function loadHistory(params?: { entityType?: "global" | "zone"; zoneId?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.entityType) query.set("entityType", params.entityType);
    if (params?.zoneId) query.set("zoneId", params.zoneId);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    const response = await apiFetch(`/capacity-config/history${qs ? `?${qs}` : ""}`);
    if (!response.ok) {
      setActionLog("Không tải được lịch sử thay đổi.");
      return [] as CapacityChangeLog[];
    }
    const data = await response.json();
    const list: CapacityChangeLog[] = Array.isArray(data.history) ? data.history : [];
    setCapacityHistory(list);
    return list;
  }

  async function loadZoneSlots(zoneId: string): Promise<ZoneSlotsResponse | null> {
    const response = await apiFetch(`/capacity-config/slots?zoneId=${encodeURIComponent(zoneId)}`);
    if (!response.ok) {
      setActionLog("Không tải được danh sách vị trí đỗ.");
      return null;
    }
    const data = (await response.json()) as ZoneSlotsResponse;
    setZoneSlots(zoneId, data);
    return data;
  }

  async function updateGlobalCapacity(payload: {
    globalCapacity: number;
    reason?: string;
  }): Promise<boolean> {
    const response = await apiFetch("/capacity-config/global", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không cập nhật được tổng sức chứa.");
      return false;
    }
    setCapacityConfig(data.config ?? null);
    setActionLog("Đã cập nhật tổng sức chứa bãi xe.");
    return true;
  }

  async function updateZoneCapacity(
    zoneId: string,
    payload: { capacity: number; walkInQuota: number; subscriberQuota: number; reason?: string },
  ): Promise<boolean> {
    const response = await apiFetch(`/capacity-config/zones/${zoneId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không cập nhật được sức chứa zone.");
      return false;
    }
    setActionLog(`Đã cập nhật cấu hình sức chứa cho zone.`);
    return true;
  }

  function applyZoneUpdateToSummary(
    summary: CapacityZoneSummary | null,
    updated: { id: string; capacity: number; walkInQuota: number; subscriberQuota: number },
  ): CapacityZoneSummary | null {
    if (!summary) return null;
    return {
      ...summary,
      capacity: updated.capacity,
      walkInQuota: updated.walkInQuota,
      subscriberQuota: updated.subscriberQuota,
    };
  }

  return {
    loadConfig,
    loadUsage,
    loadHistory,
    loadZoneSlots,
    updateGlobalCapacity,
    updateZoneCapacity,
    applyZoneUpdateToSummary,
  };
}
