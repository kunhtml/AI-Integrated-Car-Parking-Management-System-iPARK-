import { apiFetch } from "@/lib/client-api";
import type { RegisteredVehicle, VehicleRequest } from "@/types";

type VehicleActionsParams = {
  setRegisteredVehicles: (vehicles: RegisteredVehicle[] | ((prev: RegisteredVehicle[]) => RegisteredVehicle[])) => void;
  setVehicleRequests: (requests: VehicleRequest[] | ((prev: VehicleRequest[]) => VehicleRequest[])) => void;
  setActionLog: (log: string) => void;
};

export function createVehicleActions({
  setRegisteredVehicles,
  setVehicleRequests,
  setActionLog,
}: VehicleActionsParams) {
  async function createEditRequest(
    vehicleId: string,
    subscriptionId: string,
    changes: Partial<RegisteredVehicle>,
  ) {
    const response = await apiFetch("/vehicle-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        subscriptionId,
        type: "edit",
        requestedChanges: changes,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không gửi được yêu cầu sửa xe.");
      return;
    }
    setVehicleRequests((items) => [data.request as VehicleRequest, ...items]);
    setActionLog("Đã gửi yêu cầu sửa xe. Vui lòng chờ admin duyệt.");
  }

  async function createDeleteRequest(vehicleId: string, subscriptionId: string, reason?: string) {
    const response = await apiFetch("/vehicle-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        subscriptionId,
        type: "delete",
        reason,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không gửi được yêu cầu xóa xe.");
      return;
    }
    setVehicleRequests((items) => [data.request as VehicleRequest, ...items]);
    setActionLog("Đã gửi yêu cầu xóa xe. Vui lòng chờ admin duyệt.");
  }

  async function loadVehicleRequests({ includeResolved = false } = {}) {
    const url = includeResolved ? "/vehicle-requests?status=all" : "/vehicle-requests";
    const response = await apiFetch(url);
    if (!response.ok) return;
    const data = await response.json();
    setVehicleRequests((data.requests as VehicleRequest[]) ?? []);
  }

  async function resolveRequest(
    requestId: string,
    action: "approved" | "rejected",
    adminNote?: string,
  ) {
    const response = await apiFetch(`/vehicle-requests/${requestId}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: requestId, action, adminNote }),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không xử lý được yêu cầu.");
      return;
    }
    setVehicleRequests((items) => items.map((r) => (r.id === requestId ? (data.request as VehicleRequest) : r)));

    if (action === "approved" && data.vehicle) {
      setRegisteredVehicles((items) =>
        items.map((v) => (v.id === data.vehicle.id ? (data.vehicle as RegisteredVehicle) : v)),
      );
    }

    if (action === "approved" && data.request?.type === "delete") {
      setRegisteredVehicles((items) =>
        items.filter((v) => v.id !== data.request.vehicleId),
      );
    }

    setActionLog(action === "approved" ? "Đã duyệt yêu cầu." : "Đã từ chối yêu cầu.");
  }

  async function loadVehicles() {
    const response = await apiFetch("/vehicles");
    if (!response.ok) return;
    const data = await response.json();
    setRegisteredVehicles((data.vehicles as RegisteredVehicle[]) ?? []);
  }

  async function addVehicle(data: {
    plate: string;
    ownerName?: string;
    ownerPhone?: string;
    ownerAddress?: string;
    brand?: string;
    model?: string;
    color?: string;
    year?: number;
    engineNo?: string;
    chassisNo?: string;
    imageUrl?: string;
  }) {
    const response = await apiFetch("/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      setActionLog(result.message || "Không thêm được xe.");
      return;
    }
    setRegisteredVehicles((items) => {
      if (items.some((v) => v.id === result.vehicle.id)) return items;
      return [result.vehicle as RegisteredVehicle, ...items];
    });
    // Nếu backend tạo request duyệt cho customer → thêm vào state
    if (result.request) {
      setVehicleRequests((items) => [result.request as VehicleRequest, ...items]);
    }
    setActionLog(`Đã thêm xe ${data.plate}.`);
  }

  async function editVehicle(id: string, data: {
    plate?: string;
    ownerName?: string;
    ownerPhone?: string;
    ownerAddress?: string;
    brand?: string;
    model?: string;
    color?: string;
    year?: number;
    engineNo?: string;
    chassisNo?: string;
    status?: string;
    imageUrl?: string;
  }) {
    const response = await apiFetch(`/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      setActionLog(result.message || "Không cập nhật được xe.");
      return;
    }
    setRegisteredVehicles((items) =>
      items.map((v) => (v.id === id ? (result.vehicle as RegisteredVehicle) : v)),
    );
    setActionLog("Đã cập nhật thông tin xe.");
  }

  async function removeVehicle(id: string) {
    const response = await apiFetch(`/vehicles/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      setActionLog(data.message || "Không xóa được xe.");
      return;
    }
    setRegisteredVehicles((items) => items.filter((v) => v.id !== id));
    setActionLog("Đã xóa phương tiện.");
  }

  return {
    createEditRequest,
    createDeleteRequest,
    loadVehicleRequests,
    resolveRequest,
    loadVehicles,
    addVehicle,
    editVehicle,
    removeVehicle,
  };
}
