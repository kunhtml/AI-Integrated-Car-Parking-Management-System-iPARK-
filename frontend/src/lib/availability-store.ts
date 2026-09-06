"use client";

import { apiBaseUrl } from "@/lib/constants";

/**
 * Shared availability polling store (module-level singleton).
 *
 * Vấn đề: PublicLanding (header + hero) và ParkingAvailability (section
 * "Chỗ trống") mỗi component tự fetch `/public/availability` mỗi 30s →
 * 2 request/30s cho cùng một dữ liệu.
 *
 * Giải pháp: một store duy nhất fetch mỗi 30s (pause khi tab ẩn), mọi
 * subscriber nhận cùng dữ liệu qua callback. Dedupe in-flight + pause khi
 * document.hidden + refresh ngay khi tab quay lại.
 */

export type ZoneData = {
  zone: string;
  description?: string;
  total: number;
  available: number;
  occupied: number;
  allowedVehicleTypes: string[];
};

export type AvailabilityAPI = {
  capacity: number;
  available: number;
  occupied: number;
  zones: ZoneData[];
};

type Listener = (data: AvailabilityAPI) => void;

const POLL_INTERVAL_MS = 30_000;

let listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
let lastData: AvailabilityAPI | null = null;
let lastFetchedAt = 0;

function notify() {
  if (!lastData) return;
  for (const fn of listeners) {
    try {
      fn(lastData);
    } catch {
      /* listener lỗi không được làm sập store */
    }
  }
}

async function fetchAvailability() {
  if (inFlight) return;
  inFlight = true;
  try {
    const r = await fetch(`${apiBaseUrl}/public/availability`);
    if (r.ok) {
      lastData = (await r.json()) as AvailabilityAPI;
      lastFetchedAt = Date.now();
      notify();
    }
  } catch {
    /* silent — giữ dữ liệu cũ */
  } finally {
    inFlight = false;
  }
}

function startTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return; // pause khi tab ẩn
    fetchAvailability();
  }, POLL_INTERVAL_MS);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function onVisibilityChange() {
  if (document.hidden) return;
  // Tab quay lại: nếu dữ liệu cũ hơn 1 chu kỳ thì fetch ngay
  if (Date.now() - lastFetchedAt > POLL_INTERVAL_MS) {
    fetchAvailability();
  }
}

/**
 * Subscribe nhận dữ liệu availability. Fetch ngay nếu chưa có dữ liệu
 * (hoặc dữ liệu cũ hơn 1 chu kỳ), sau đó poll mỗi 30s khi có subscriber.
 * Trả về hàm unsubscribe.
 */
export function subscribeAvailability(onData: Listener): () => void {
  listeners.add(onData);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", onVisibilityChange);
    startTimer();
  }
  // Fetch ngay nếu chưa có dữ liệu hoặc đã cũ (tránh fetch lại khi re-subscribe)
  if (!lastData || Date.now() - lastFetchedAt > POLL_INTERVAL_MS) {
    fetchAvailability();
  } else {
    // Đẩy dữ liệu cache ngay cho subscriber mới
    onData(lastData);
  }
  return () => {
    listeners.delete(onData);
    if (listeners.size === 0) {
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

/**
 * Fetch ngay lập tức (dùng cho nút "Làm mới"). Kết quả được phát tới mọi
 * subscriber qua callback đã đăng ký. Dedupe nếu đang có request.
 */
export function refreshAvailability(): Promise<void> {
  return fetchAvailability();
}
