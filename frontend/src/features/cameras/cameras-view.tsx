"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  Loader2,
  Lock,
  LockOpen,
<<<<<<< Updated upstream
  Power,
  RefreshCcw,
  ShieldAlert,
  Signal,
=======
  RefreshCcw,
>>>>>>> Stashed changes
  WifiOff,
} from "lucide-react";

import { bridgeBaseUrl } from "@/lib/constants";
<<<<<<< Updated upstream
import { bridgeFetch } from "@/lib/client-api";
=======
>>>>>>> Stashed changes
import { CamerasLogsPanel } from "@/features/cameras/cameras-logs-panel";

type Gate = "in" | "out";

type CameraStream = {
  id: string;
  gate: Gate;
  name: string;
<<<<<<< Updated upstream
  // snapshotUrl: ảnh tĩnh (fallback nếu stream lỗi)
  snapshotUrl: string;
  // streamUrl: MJPEG multipart stream (realtime, browser tự kéo liên tục)
=======
  snapshotUrl: string;
>>>>>>> Stashed changes
  streamUrl?: string;
};

const DEFAULT_STREAMS: CameraStream[] = [
  {
    id: "in",
    gate: "in",
    name: "Cổng vào",
    snapshotUrl: `${bridgeBaseUrl}/static/cam_in.jpg`,
    streamUrl: `${bridgeBaseUrl}/video_feed/in`,
  },
  {
    id: "out",
    gate: "out",
    name: "Cổng ra",
    snapshotUrl: `${bridgeBaseUrl}/static/cam_out.jpg`,
    streamUrl: `${bridgeBaseUrl}/video_feed/out`,
  },
];

type BarrierState = {
  in: "open" | "closed" | "opening" | "closing" | "error";
  out: "open" | "closed" | "opening" | "closing" | "error";
};

const INITIAL_BARRIER: BarrierState = { in: "closed", out: "closed" };

export function CamerasView() {
  const [streams, setStreams] = useState<CameraStream[]>(DEFAULT_STREAMS);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [loadedAt, setLoadedAt] = useState<Record<string, Date>>({});
  const [failedAt, setFailedAt] = useState<Record<string, boolean>>({});
<<<<<<< Updated upstream
  // Cache-buster cho mỗi camera; chỉ thay đổi khi user bấm "Reconnect"
  // để ép <img> reload stream kết nối mới (vd: bridge restart).
  const [streamKey, setStreamKey] = useState<Record<string, number>>({});
  const imgRefs = useRef<Record<string, HTMLImageElement | null>>({});
  // Trạng thái barie per-gate + cooldown chống double-click
=======
  const [streamKey, setStreamKey] = useState<Record<string, number>>({});
  const imgRefs = useRef<Record<string, HTMLImageElement | null>>({});
>>>>>>> Stashed changes
  const [barriers, setBarriers] = useState<BarrierState>(INITIAL_BARRIER);
  const [barrierMsg, setBarrierMsg] = useState<string>("");
  const barrierActionLockRef = useRef<Record<Gate, boolean>>({ in: false, out: false });

<<<<<<< Updated upstream
  // Probe bridge service để biết online/offline
=======
  // Probe bridge service
>>>>>>> Stashed changes
  useEffect(() => {
    let cancelled = false;
    async function probe() {
      try {
        const res = await fetch(`${bridgeBaseUrl}/api/cameras/health`, {
          cache: "no-store",
        });
        if (!cancelled) setBridgeOnline(res.ok);
      } catch {
        if (!cancelled) setBridgeOnline(false);
      }
    }
    probe();
    const id = window.setInterval(probe, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

<<<<<<< Updated upstream
  // Lấy danh sách camera từ bridge (nếu được) — fallback về default
=======
  // Load cameras from bridge
>>>>>>> Stashed changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${bridgeBaseUrl}/api/cameras`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (
          !cancelled &&
          Array.isArray(data.cameras) &&
          data.cameras.length > 0
        ) {
<<<<<<< Updated upstream
          // Normalize gate → "in" | "out" (giữ default nếu bridge trả "entry"/"exit")
=======
>>>>>>> Stashed changes
          const normalized = data.cameras.map((c: CameraStream) => ({
            ...c,
            gate: c.gate === "exit" ? "out" : "in",
          })) as CameraStream[];
          setStreams(normalized);
        }
      } catch {
<<<<<<< Updated upstream
        // ignore — dùng defaults
=======
        // ignore
>>>>>>> Stashed changes
      }
    }
    load();
  }, []);

  const orderedStreams = useMemo(() => streams, [streams]);

  function handleLoaded(streamId: string) {
    setLoadedAt((cur) => ({ ...cur, [streamId]: new Date() }));
    setFailedAt((cur) => ({ ...cur, [streamId]: false }));
  }

  function handleError(streamId: string) {
    setFailedAt((cur) => ({ ...cur, [streamId]: true }));
  }

  function reconnectAll() {
<<<<<<< Updated upstream
    // Bump cache-buster cho tất cả camera → browser ép reload <img>
    // (dùng cho MJPEG, trick cache-buster thay đổi là browser sẽ reconnect)
=======
>>>>>>> Stashed changes
    const next: Record<string, number> = {};
    orderedStreams.forEach((s) => {
      next[s.id] = (streamKey[s.id] || 0) + 1;
    });
    setStreamKey(next);
    setLoadedAt({});
    setFailedAt({});
  }

<<<<<<< Updated upstream
  // Build URL cho <img>: dùng streamUrl nếu bridge trả về, fallback về /video_feed/<id>
=======
>>>>>>> Stashed changes
  function buildStreamUrl(stream: CameraStream): string {
    const base = stream.streamUrl || `${bridgeBaseUrl}/video_feed/${stream.id}`;
    const bust = streamKey[stream.id] || 0;
    return `${base}${base.includes("?") ? "&" : "?"}t=${bust}`;
  }

<<<<<<< Updated upstream
  /**
   * Gửi lệnh mở/đóng barie tới bridge.
   * Endpoint: POST {bridgeBaseUrl}/gate/<in|out>/<open|close>
   * Có cooldown 1.2s để chống spam (ESP32/Arduino cần thời gian xử lý).
   */
=======
>>>>>>> Stashed changes
  async function controlBarrier(gate: Gate, action: "open" | "close") {
    if (barrierActionLockRef.current[gate]) return;
    if (bridgeOnline !== true) {
      setBarrierMsg("Bridge service chưa sẵn sàng. Kiểm tra kết nối.");
      return;
    }

    barrierActionLockRef.current[gate] = true;
    const nextPhase = action === "open" ? "opening" : "closing";
    setBarriers((cur) => ({ ...cur, [gate]: nextPhase }));
    setBarrierMsg("");
    try {
<<<<<<< Updated upstream
      const res = await bridgeFetch(`/gate/${gate}/${action}`, { method: "POST" });
=======
      const res = await fetch(`${bridgeBaseUrl}/gate/${gate}/${action}`, {
        method: "POST",
      });
>>>>>>> Stashed changes
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBarriers((cur) => ({ ...cur, [gate]: action === "open" ? "open" : "closed" }));
        setBarrierMsg(
          action === "open"
            ? `Đã mở barie ${gate === "in" ? "cổng vào" : "cổng ra"}`
            : `Đã đóng barie ${gate === "in" ? "cổng vào" : "cổng ra"}`,
        );
      } else {
        setBarriers((cur) => ({ ...cur, [gate]: "error" }));
        setBarrierMsg(data.message || `Bridge từ chối (HTTP ${res.status}).`);
      }
    } catch (err) {
      setBarriers((cur) => ({ ...cur, [gate]: "error" }));
<<<<<<< Updated upstream
      // TypeError "Failed to fetch" thường là network/CORS/down
=======
>>>>>>> Stashed changes
      setBarrierMsg(
        err instanceof TypeError
          ? "Không kết nối được bridge service. Kiểm tra port 5050 và CORS."
          : "Lỗi không xác định khi gọi bridge.",
      );
      console.error("Barrier control error", err);
    } finally {
<<<<<<< Updated upstream
      // Cooldown 1.2s
=======
>>>>>>> Stashed changes
      window.setTimeout(() => {
        barrierActionLockRef.current[gate] = false;
      }, 1200);
    }
  }

<<<<<<< Updated upstream
  // Auto-clear barrierMsg sau 4s
=======
>>>>>>> Stashed changes
  useEffect(() => {
    if (!barrierMsg) return;
    const id = window.setTimeout(() => setBarrierMsg(""), 4000);
    return () => window.clearTimeout(id);
  }, [barrierMsg]);

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Giám sát trực tiếp</p>
            <h2>Camera cổng vào/ra</h2>
          </div>
          <div className="panel-heading-right">
            <BridgeStatus online={bridgeOnline} />
            <Camera size={22} />
          </div>
        </div>

        {bridgeOnline === false && (
          <div className="cam-bridge-offline">
            <WifiOff size={18} />
            <div>
              <div className="cam-bridge-offline-title">
                Bridge service chưa chạy hoặc không truy cập được
              </div>
              <div>
<<<<<<< Updated upstream
                Camera stream yêu cầu Python service (<code>smart_parking_rut_gon</code>) chạy tại{" "}
                <code>{bridgeBaseUrl}</code>. Chạy <code>python app.py</code> trong thư mục{" "}
                <code>smart_parking_rut_gon</code> để bật camera.
=======
                Camera stream yêu cầu Python service chạy tại{" "}
                <code>{bridgeBaseUrl}</code>. Chạy <code>python app.py</code> trong thư mục{" "}
                <code>ai-service</code> để bật camera.
>>>>>>> Stashed changes
              </div>
            </div>
          </div>
        )}

<<<<<<< Updated upstream
        {/* Toolbar */}
=======
>>>>>>> Stashed changes
        <div className="cam-toolbar">
          <button
            className="small-button primary"
            onClick={reconnectAll}
            type="button"
          >
            <RefreshCcw size={13} /> Kết nối lại camera
          </button>

          <span className="cam-toolbar-hint">
            MJPEG realtime · không cần refresh
          </span>

          {orderedStreams.length > 0 && (
            <span className="cam-toolbar-meta">
              {orderedStreams.length} camera
            </span>
          )}
        </div>

        {barrierMsg && (
          <div
            className={`cam-barrier-msg ${
              barrierMsg.startsWith("Đã") ? "ok" : "err"
            }`}
          >
            {barrierMsg}
          </div>
        )}

<<<<<<< Updated upstream
        {/* Camera grid */}
=======
>>>>>>> Stashed changes
        <div className="cam-grid">
          {orderedStreams.map((stream) => {
            const failed = !!failedAt[stream.id];
            const lastLoaded = loadedAt[stream.id];
            const gate: Gate = stream.gate === "out" ? "out" : "in";
            const barrier = barriers[gate];
            return (
              <article key={stream.id} className="cam-card">
                <header
                  className={`cam-card-head ${gate === "in" ? "entry" : "exit"}`}
                >
                  <div className="cam-card-title">
                    {gate === "in" ? (
                      <ArrowDownToLine size={16} />
                    ) : (
                      <ArrowUpFromLine size={16} />
                    )}
                    <span>{stream.name}</span>
                  </div>
                  <div className={`cam-live ${failed ? "offline" : ""}`}>
                    {failed ? (
                      <>
                        <WifiOff size={11} /> Offline
                      </>
                    ) : (
                      <>
                        <span className="cam-live-dot" />
                        LIVE
                      </>
                    )}
                  </div>
                </header>

                <div className="cam-stage">
                  {failed ? (
                    <div className="cam-failed">
                      <WifiOff size={40} />
                      <div className="cam-failed-title">
                        Không kết nối được camera
                      </div>
                      <div className="cam-failed-sub">
                        Kiểm tra bridge service đang chạy và CORS đã bật.
                      </div>
                    </div>
                  ) : (
<<<<<<< Updated upstream
                    // MJPEG stream: browser tự đọc multipart và render liên tục.
                    // Không cần reload theo interval — backend push frame mới liên tục.
=======
>>>>>>> Stashed changes
                    <img
                      ref={(el) => {
                        imgRefs.current[stream.id] = el;
                      }}
                      src={buildStreamUrl(stream)}
                      alt={stream.name}
                      className="cam-stream"
                      onLoad={() => handleLoaded(stream.id)}
                      onError={() => handleError(stream.id)}
                    />
                  )}
                </div>

<<<<<<< Updated upstream
                {/* Footer: meta + barrier controls */}
=======
>>>>>>> Stashed changes
                <footer className="cam-card-foot">
                  <div className="cam-meta">
                    <span
                      className="cam-meta-url"
                      title={
                        stream.streamUrl ||
                        `${bridgeBaseUrl}/video_feed/${stream.id}`
                      }
                    >
                      {(stream.streamUrl || `${bridgeBaseUrl}/video_feed/${stream.id}`).split("?")[0]}
                    </span>
                    <span className="cam-meta-time">
                      {lastLoaded
                        ? `Connected ${lastLoaded.toLocaleTimeString("vi-VN")}`
                        : "—"}
                    </span>
                  </div>

                  <div className="cam-barrier">
                    <div className={`cam-barrier-state state-${barrier}`}>
                      <BarrierStatusIcon state={barrier} />
                      <span>{barrierLabel(barrier)}</span>
                    </div>
                    <div className="cam-barrier-actions">
                      <button
                        type="button"
                        className="cam-barrier-btn open"
                        onClick={() => controlBarrier(gate, "open")}
                        disabled={
                          bridgeOnline !== true ||
                          barrier === "opening" ||
                          barrier === "open"
                        }
                        title={
                          bridgeOnline !== true
                            ? "Bridge service chưa sẵn sàng"
                            : `Mở barie ${gate === "in" ? "cổng vào" : "cổng ra"}`
                        }
                      >
                        {barrier === "opening" ? (
                          <Loader2 size={13} className="spin" />
                        ) : (
                          <LockOpen size={13} />
                        )}
                        Mở
                      </button>
                      <button
                        type="button"
                        className="cam-barrier-btn close"
                        onClick={() => controlBarrier(gate, "close")}
                        disabled={
                          bridgeOnline !== true ||
                          barrier === "closing" ||
                          barrier === "closed"
                        }
                        title={
                          bridgeOnline !== true
                            ? "Bridge service chưa sẵn sàng"
                            : `Đóng barie ${gate === "in" ? "cổng vào" : "cổng ra"}`
                        }
                      >
                        {barrier === "closing" ? (
                          <Loader2 size={13} className="spin" />
                        ) : (
                          <Lock size={13} />
                        )}
                        Đóng
                      </button>
                    </div>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
<<<<<<< Updated upstream

        {orderedStreams.length === 0 && (
          <p className="cam-loading">
            <Loader2 size={16} className="spin" /> Đang tải danh sách camera từ bridge service...
          </p>
        )}
=======
>>>>>>> Stashed changes
      </div>

      <CamerasLogsPanel />
    </section>
  );
}

<<<<<<< Updated upstream
/* =========================== Sub components =========================== */

function BridgeStatus({ online }: { online: boolean | null }) {
  if (online === null) {
    return (
      <span className="badge cam-badge">
        <Loader2 size={11} className="spin" /> Đang kiểm tra
      </span>
    );
  }
  if (online) {
    return (
      <span className="badge success cam-badge">
        <Signal size={11} /> Bridge online
      </span>
    );
  }
  return (
    <span className="badge warning cam-badge">
      <WifiOff size={11} /> Bridge offline
=======
function BridgeStatus({ online }: { online: boolean | null }) {
  if (online === null) {
    return <span className="bridge-status checking">Đang kiểm tra...</span>;
  }
  return (
    <span className={`bridge-status ${online ? "online" : "offline"}`}>
      <span className="bridge-dot" />
      {online ? "Bridge Online" : "Bridge Offline"}
>>>>>>> Stashed changes
    </span>
  );
}

<<<<<<< Updated upstream
function BarrierStatusIcon({ state }: { state: BarrierState["in"] }) {
  if (state === "opening" || state === "closing") return <Loader2 size={13} className="spin" />;
  if (state === "open") return <LockOpen size={13} />;
  if (state === "closed") return <Lock size={13} />;
  return <ShieldAlert size={13} />;
}

function barrierLabel(state: BarrierState["in"]) {
=======
function BarrierStatusIcon({ state }: { state: string }) {
  switch (state) {
    case "open":
      return <LockOpen size={13} />;
    case "closed":
      return <Lock size={13} />;
    case "opening":
    case "closing":
      return <Loader2 size={13} className="spin" />;
    case "error":
      return <WifiOff size={13} />;
    default:
      return <Lock size={13} />;
  }
}

function barrierLabel(state: string): string {
>>>>>>> Stashed changes
  switch (state) {
    case "open":
      return "Đang mở";
    case "closed":
<<<<<<< Updated upstream
      return "Đã đóng";
=======
      return "Đang đóng";
>>>>>>> Stashed changes
    case "opening":
      return "Đang mở...";
    case "closing":
      return "Đang đóng...";
    case "error":
      return "Lỗi";
    default:
<<<<<<< Updated upstream
      return "—";
  }
}
=======
      return "Đang đóng";
  }
}
>>>>>>> Stashed changes
