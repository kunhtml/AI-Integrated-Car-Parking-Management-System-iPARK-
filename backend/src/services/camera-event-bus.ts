import { EventEmitter } from "node:events";

/**
 * Bus phát sự kiện camera realtime từ controller sang các SSE client.
 *
 * - `emitIngest(log)`: được gọi từ `camera-bridge.controller.ts` SAU KHI
 *   ghi `ParkingCameraLog` thành công. Payload tối thiểu để /staff-desk
 *   render popup và cập nhật danh sách.
 * - `subscribe(listener)`: trả về hàm `unsubscribe` để đóng listener.
 *
 * Sử dụng 
ode:events` (đã có sẵn trong Node) — KHÔNG cần thêm dependency.
 */
export type CameraIngestEvent = {
  id: string;
  direction: "in" | "out";
  plate: string;
  detectedPlate: string;
  confidence?: number;
  rfidUid?: string;
  ownerName?: string;
  userType: "resident" | "guest" | "unknown";
  imagePath?: string;
  entryImagePath?: string;
  barrierOpened: boolean;
  sessionId?: string | null;
  checkInAt?: string | null;
  sessionStatus?: string | null;
  sessionPaymentStatus?: string | null;
  exitState?: string | null;
  fee?: number | null;
  action?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
  duplicateSession?: boolean;
};

export type ExitSessionStateEvent = {
  sessionId: string;
  status: string;
  exitState?: string | null;
};

class CameraEventBus extends EventEmitter {
  emitIngest(event: CameraIngestEvent) {
    this.emit("ingest", event);
  }

  emitExitState(event: ExitSessionStateEvent) {
    this.emit("exit-state", event);
  }

  subscribe(listener: (event: CameraIngestEvent) => void): () => void {
    this.on("ingest", listener);
    return () => this.off("ingest", listener);
  }

  subscribeExitState(
    listener: (event: ExitSessionStateEvent) => void,
  ): () => void {
    this.on("exit-state", listener);
    return () => this.off("exit-state", listener);
  }
}

// Singleton toàn cục (chia sẻ giữa controller và route SSE).
export const cameraEventBus = new CameraEventBus();
cameraEventBus.setMaxListeners(50);
