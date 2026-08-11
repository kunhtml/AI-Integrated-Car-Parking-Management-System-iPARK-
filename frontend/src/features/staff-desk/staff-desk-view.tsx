"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Loader2,
  LogIn,
  Nfc,
  QRCode,
  Radio,
  RefreshCcw,
  ScanLine,
  ShieldAlert,
  Signal,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";

import { apiFetch, bridgeFetch } from "@/lib/client-api";
import { bridgeBaseUrl } from "@/lib/constants";
import {
  CameraIngestEvent,
  CameraStreamStatus,
  resolveBridgeImageUrl,
  useCameraIngestEvents,
} from "@/features/staff-desk/use-camera-events";

type Phase = "idle" | "creating" | "opening" | "done" | "error";

const SCAN_POLL_MS = 1000;
const SCAN_TIMEOUT_MS = 60_000;

const IN_STREAM_URL = `${bridgeBaseUrl}/video_feed/in`;
const OUT_STREAM_URL = `${bridgeBaseUrl}/video_feed/out`;

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("vi-VN");
}

function statusLabel(s: CameraStreamStatus) {
  if (s === "open") return "Đã kết nối";
  if (s === "connecting") return "Đang kết nối…";
  if (s === "error") return "Mất kết nối (đang thử lại)";
  return "Đã đóng";
}

export function StaffDeskView() {
  // ====== Camera ingest realtime (SSE) ======
  const { latest: pendingIngest, status: streamStatus } =
    useCameraIngestEvents();
  const [activeIngest, setActiveIngest] = useState<CameraIngestEvent | null>(
    null,
  );
  const [activeExit, setActiveExit] = useState<CameraIngestEvent | null>(null);
  useEffect(() => {
    if (!pendingIngest) return;
    if (pendingIngest.direction === "in") {
      setActiveIngest(pendingIngest);
      return;
    }
    autoExitScanFiredRef.current = false;
    setExitScanPhase("idle");
    setExitVerifyData(null);
    setExitPaymentData(null);
    setActiveExit(pendingIngest);
  }, [pendingIngest]);

  // Khi SSE kết nối xong, fetch phiên xe ra đang chờ RFID (nếu có).
  // Giải quyết trường hợp camera detect trước khi staff mở trang.
  useEffect(() => {
    if (streamStatus !== "open") return;
    // Nếu đã có activeExit rồi thì không cần fetch
    if (activeExit) return;
    apiFetch<{ pending: boolean; event?: CameraIngestEvent }>("/exit/pending")
      .then((res) => {
        if (res.pending && res.event) {
          autoExitScanFiredRef.current = false;
          setExitScanPhase("idle");
          setExitVerifyData(null);
          setExitPaymentData(null);
          setActiveExit(res.event);
        }
      })
      .catch(() => {
        // Không làm gì nếu lỗi — SSE realtime sẽ cập nhật khi có xe mới
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamStatus]);

  // ====== RFID scan ======
  const [scanPhase, setScanPhase] = useState<
    "idle" | "starting" | "waiting" | "success" | "timeout" | "error"
  >("idle");
  const [scanUid, setScanUid] = useState("");
  const [scanError, setScanError] = useState("");
  const scanStartRef = useRef<number>(0);
  const scanIntervalRef = useRef<number | null>(null);
  const activeIngestIdRef = useRef<string | null>(null);
  const autoScanFiredRef = useRef(false);
  const autoExitScanFiredRef = useRef(false);

  // ====== Manual plate (khi scan RFID OK nhưng không có camera ingest) ======
  const [manualPlate, setManualPlate] = useState("");
  const [manualPlateError, setManualPlateError] = useState("");

  // ====== Create session state ======
  const [phase, setPhase] = useState<Phase>("idle");
  const [createMsg, setCreateMsg] = useState("");
  const [createdSession, setCreatedSession] = useState<{
    id: string;
    slot?: string;
    plate?: string;
  } | null>(null);
  const [barrierMsg, setBarrierMsg] = useState("");

  // ====== Exit flow state ======
  const [exitScanPhase, setExitScanPhase] = useState<
    "idle" | "starting" | "waiting" | "success" | "timeout" | "error"
  >("idle");
  const [exitScanUid, setExitScanUid] = useState("");
  const [exitScanError, setExitScanError] = useState("");
  const exitScanStartRef = useRef<number>(0);
  const exitScanIntervalRef = useRef<number | null>(null);
  const [exitVerifyData, setExitVerifyData] = useState<{
    amountDue: number;
    paymentStatus: string;
    isSubscriber: boolean;
    canOpenGate: boolean;
  } | null>(null);
  const [exitPaymentData, setExitPaymentData] = useState<{
    qrCode: string;
    checkoutUrl: string;
    amount: number;
  } | null>(null);
  const [exitPaymentPolling, setExitPaymentPolling] = useState(false);

  const stopScanPolling = useCallback(() => {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  const cancelScan = useCallback(async () => {
    stopScanPolling();
    setScanPhase("idle");
    setScanError("");
    try {
      await bridgeFetch("/api/rfid/scan/cancel", { method: "POST" });
    } catch {
      /* ignore */
    }
  }, [stopScanPolling]);

  // Auto-cancel scan khi staff đóng/xử lý xong event hiện tại.
  useEffect(() => {
    return () => {
      stopScanPolling();
      bridgeFetch("/api/rfid/scan/cancel", { method: "POST" }).catch(
        () => undefined,
      );
    };
  }, [stopScanPolling]);

  const startScan = useCallback(async () => {
    setScanError("");
    setScanUid("");
    setScanPhase("starting");
    try {
      const res = await bridgeFetch("/api/rfid/scan/start", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setScanPhase("error");
        setScanError(data.message || "Không bật được chế độ quét thẻ.");
        return;
      }
      scanStartRef.current = Date.now();
      setScanPhase("waiting");
      stopScanPolling();
      scanIntervalRef.current = window.setInterval(async () => {
        if (Date.now() - scanStartRef.current > SCAN_TIMEOUT_MS) {
          stopScanPolling();
          setScanPhase("timeout");
          await bridgeFetch("/api/rfid/scan/cancel", { method: "POST" }).catch(
            () => undefined,
          );
          return;
        }
        try {
          const poll = await bridgeFetch("/api/rfid/scan/poll");
          if (!poll.ok) {
            stopScanPolling();
            setScanPhase("error");
            setScanError(`Bridge trả ${poll.status}.`);
            return;
          }
          const data = await poll.json();
          if (data.status === "waiting") return;
          // "duplicate" = thẻ đã tồn tại trong hệ thống → vẫn hợp lệ, xử lý như success
          if (data.status === "success" || data.status === "duplicate") {
            stopScanPolling();
            setScanUid(data.uid || "");
            setScanPhase("success");
            await bridgeFetch("/api/rfid/scan/cancel", {
              method: "POST",
            }).catch(() => undefined);
            return;
          }
          if (data.status === "timeout") {
            stopScanPolling();
            setScanPhase("timeout");
            return;
          }
          if (data.status === "error") {
            stopScanPolling();
            setScanPhase("error");
            setScanError(
              data.message || "Thẻ RFID không hợp lệ hoặc đã bị vô hiệu hóa.",
            );
            return;
          }
        } catch {
          // poll lỗi → tiếp tục thử
        }
      }, SCAN_POLL_MS);
    } catch (e) {
      setScanPhase("error");
      setScanError("Không kết nối được bridge service (port 5050).");
    }
  }, [stopScanPolling]);

  // Khi scan thành công + đang có xe chờ → tự động tạo phiên.
  useEffect(() => {
    if (scanPhase !== "success" || !scanUid) return;
    if (!activeIngest) {
      // Không có xe chờ → hiện form nhập biển số thủ công
      setManualPlate("");
      setManualPlateError("");
      return;
    }
    if (!activeIngest.plate) {
      // Camera detect được xe nhưng không đọc được biển số → nhập tay
      setManualPlate("");
      setManualPlateError("");
      return;
    }
    // Nếu session đã được AI service tạo (action="created") → không cần gọi API tạo phiên nữa.
    // Chỉ mở barie (nếu chưa mở) hoặc hiện thông báo thành công.
    if (activeIngest.action === "created" && activeIngest.sessionId) {
      setPhase("done");
      setCreatedSession({
        id: activeIngest.sessionId,
        plate: activeIngest.plate,
      });
      setCreateMsg("Đã tạo phiên qua AI service.");
      setBarrierMsg("Barie đã được mở tự động.");
      return;
    }
    if (activeIngestIdRef.current === activeIngest.id) return;
    activeIngestIdRef.current = activeIngest.id;
    void createSessionAndOpen(scanUid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanPhase, scanUid, activeIngest]);

  // Tự động bắt đầu quét RFID khi camera phát hiện xe vào
  useEffect(() => {
    if (!activeIngest || activeIngest.direction !== "in") return;
    if (activeIngest.action === "created") return;
    if (scanPhase !== "idle") return;
    if (autoScanFiredRef.current) return;
    autoScanFiredRef.current = true;
    void startScan();
  }, [activeIngest, scanPhase, startScan]);

  // Tạo phiên thủ công khi RFID scan OK nhưng không có camera ingest
  const createSessionManual = useCallback(
    async (uid: string, plate: string) => {
      const normalized = plate
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "");
      if (normalized.length < 5) {
        setManualPlateError("Biển số phải có ít nhất 5 ký tự.");
        return;
      }
      setManualPlateError("");
      setPhase("creating");
      setCreateMsg("");
      setBarrierMsg("");
      setCreatedSession(null);

      try {
        const res = await apiFetch("/parking-sessions", {
          method: "POST",
          body: JSON.stringify({
            plate: normalized,
            vehicleType: "Ô tô",
            rfidUid: uid,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPhase("error");
          setCreateMsg(data.message || `Tạo phiên thất bại (${res.status}).`);
          return;
        }
        const session = data.session ?? {};
        setCreatedSession({
          id: session._id || session.id,
          slot: session.slot,
          plate: session.plate,
        });
        setCreateMsg(
          data.isMember
            ? "Biển số thuộc gói thành viên — miễn phí."
            : "Đã tạo phiên cho khách.",
        );
        setPhase("opening");
        const openRes = await bridgeFetch("/gate/in/open", { method: "POST" });
        if (!openRes.ok) {
          setPhase("error");
          setBarrierMsg(
            `Tạo phiên OK nhưng mở barie thất bại (${openRes.status}). Bấm mở tay.`,
          );
          return;
        }
        setBarrierMsg("Đã gửi lệnh mở barie cổng vào.");
        setPhase("done");
      } catch {
        setPhase("error");
        setCreateMsg("Lỗi mạng khi tạo phiên.");
      }
    },
    [],
  );

  const createSessionAndOpen = useCallback(
    async (uid: string) => {
      if (!activeIngest) return;
      setPhase("creating");
      setCreateMsg("");
      setBarrierMsg("");
      setCreatedSession(null);

      try {
        const res = await apiFetch("/parking-sessions", {
          method: "POST",
          body: JSON.stringify({
            plate: activeIngest.plate,
            vehicleType: "Ô tô",
            rfidUid: uid,
            entryDetectedPlate: activeIngest.detectedPlate,
            entryConfidence: activeIngest.confidence,
            entryImageUrl: activeIngest.imagePath,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // 409 = session đã được AI service tạo → coi như thành công, chỉ cần mở barie
          if (res.status === 409) {
            setCreateMsg("Phiên đã được tạo bởi AI service.");
            setPhase("opening");
            const openRes = await bridgeFetch("/gate/in/open", {
              method: "POST",
            });
            if (!openRes.ok) {
              setPhase("error");
              setBarrierMsg(
                `Tạo phiên OK nhưng mở barie thất bại (${openRes.status}). Bấm mở tay.`,
              );
              return;
            }
            setBarrierMsg("Đã gửi lệnh mở barie cổng vào.");
            setPhase("done");
            return;
          }
          setPhase("error");
          setCreateMsg(data.message || `Tạo phiên thất bại (${res.status}).`);
          return;
        }
        const session = data.session ?? {};
        setCreatedSession({
          id: session._id || session.id,
          slot: session.slot,
          plate: session.plate,
        });
        setCreateMsg(
          data.isMember
            ? "Biển số thuộc gói thành viên — miễn phí."
            : "Đã tạo phiên cho khách.",
        );
        setPhase("opening");

        // Mở barie cổng vào qua bridge.
        const openRes = await bridgeFetch("/gate/in/open", { method: "POST" });
        if (!openRes.ok) {
          setPhase("error");
          setBarrierMsg(
            `Tạo phiên OK nhưng mở barie thất bại (${openRes.status}). Bấm mở tay.`,
          );
          return;
        }
        setBarrierMsg("Đã gửi lệnh mở barie cổng vào.");
        setPhase("done");
      } catch (e) {
        setPhase("error");
        setCreateMsg("Lỗi mạng khi tạo phiên.");
      }
    },
    [activeIngest],
  );

  const dismissActive = useCallback(() => {
    setActiveIngest(null);
    setPhase("idle");
    setCreateMsg("");
    setBarrierMsg("");
    setCreatedSession(null);
    setScanUid("");
    setScanPhase("idle");
    setManualPlate("");
    setManualPlateError("");
    activeIngestIdRef.current = null;
    autoScanFiredRef.current = false;
  }, []);

  const manualOpenBarrier = useCallback(async () => {
    try {
      const res = await bridgeFetch("/gate/in/open", { method: "POST" });
      setBarrierMsg(
        res.ok ? "Đã mở barie cổng vào." : `Mở barie thất bại (${res.status}).`,
      );
    } catch {
      setBarrierMsg("Không kết nối được bridge.");
    }
  }, []);

  const openExitBarrier = useCallback(async () => {
    if (!activeExit?.sessionId) return;
    try {
      const res = await apiFetch("/exit/open-gate", {
        method: "POST",
        body: JSON.stringify({ sessionId: activeExit.sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setActiveExit((current) =>
          current ? { ...current, barrierOpened: true } : current,
        );
        // Auto-dismiss ExitCard sau 3 giây
        setTimeout(() => {
          setActiveExit(null);
          setExitScanPhase("idle");
          setExitScanUid("");
          setExitScanError("");
          setExitVerifyData(null);
          setExitPaymentData(null);
          autoExitScanFiredRef.current = false;
        }, 3000);
      } else {
        alert(data.message || "Không mở được barie");
      }
    } catch {
      alert("Lỗi kết nối, vui lòng thử lại");
    }
  }, [activeExit?.sessionId]);

  // ====== Exit RFID scan & verify ======
  const startExitScan = useCallback(async () => {
    if (!activeExit?.sessionId) return;
    setExitScanError("");
    setExitScanUid("");
    setExitScanPhase("starting");
    try {
      const res = await bridgeFetch("/api/rfid/scan/start", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setExitScanPhase("error");
        setExitScanError(data.message || "Không bật được chế độ quét thẻ.");
        return;
      }
      exitScanStartRef.current = Date.now();
      setExitScanPhase("waiting");
      if (exitScanIntervalRef.current !== null) {
        window.clearInterval(exitScanIntervalRef.current);
      }
      exitScanIntervalRef.current = window.setInterval(async () => {
        if (Date.now() - exitScanStartRef.current > SCAN_TIMEOUT_MS) {
          if (exitScanIntervalRef.current !== null) {
            window.clearInterval(exitScanIntervalRef.current);
            exitScanIntervalRef.current = null;
          }
          setExitScanPhase("timeout");
          await bridgeFetch("/api/rfid/scan/cancel", { method: "POST" }).catch(
            () => undefined,
          );
          return;
        }
        try {
          const poll = await bridgeFetch("/api/rfid/scan/poll");
          if (!poll.ok) {
            if (exitScanIntervalRef.current !== null) {
              window.clearInterval(exitScanIntervalRef.current);
              exitScanIntervalRef.current = null;
            }
            setExitScanPhase("error");
            setExitScanError(`Bridge trả ${poll.status}.`);
            return;
          }
          const data = await poll.json();
          if (data.status === "waiting") return;
          if (data.status === "success" || data.status === "duplicate") {
            if (exitScanIntervalRef.current !== null) {
              window.clearInterval(exitScanIntervalRef.current);
              exitScanIntervalRef.current = null;
            }
            setExitScanUid(data.uid || "");
            setExitScanPhase("success");
            await bridgeFetch("/api/rfid/scan/cancel", {
              method: "POST",
            }).catch(() => undefined);
            return;
          }
          if (data.status === "timeout") {
            if (exitScanIntervalRef.current !== null) {
              window.clearInterval(exitScanIntervalRef.current);
              exitScanIntervalRef.current = null;
            }
            setExitScanPhase("timeout");
            return;
          }
          if (data.status === "error") {
            if (exitScanIntervalRef.current !== null) {
              window.clearInterval(exitScanIntervalRef.current);
              exitScanIntervalRef.current = null;
            }
            setExitScanPhase("error");
            setExitScanError(
              data.message || "Thẻ RFID không hợp lệ hoặc đã bị vô hiệu hóa.",
            );
            return;
          }
        } catch {
          // poll lỗi → tiếp tục thử
        }
      }, SCAN_POLL_MS);
    } catch {
      setExitScanPhase("error");
      setExitScanError("Không kết nối được bridge service (port 5050).");
    }
  }, [activeExit?.sessionId]);

  // Tự động bắt đầu quét RFID khi camera phát hiện xe ra
  useEffect(() => {
    if (!activeExit) return;
    if (exitScanPhase !== "idle") return;
    if (autoExitScanFiredRef.current) return;
    autoExitScanFiredRef.current = true;
    void startExitScan();
  }, [activeExit, exitScanPhase, startExitScan]);

  const cancelExitScan = useCallback(async () => {
    if (exitScanIntervalRef.current !== null) {
      window.clearInterval(exitScanIntervalRef.current);
      exitScanIntervalRef.current = null;
    }
    setExitScanPhase("idle");
    setExitScanError("");
    try {
      await bridgeFetch("/api/rfid/scan/cancel", { method: "POST" });
    } catch {
      /* ignore */
    }
  }, []);

  // Verify exit RFID with backend
  const verifyExitRfid = useCallback(
    async (uid: string) => {
      if (!activeExit?.sessionId) return;
      try {
        const res = await apiFetch("/exit/verify", {
          method: "POST",
          body: JSON.stringify({ sessionId: activeExit.sessionId, uid }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.verified) {
          setExitVerifyData({
            amountDue: data.amountDue,
            paymentStatus: data.paymentStatus,
            isSubscriber: data.isSubscriber,
            canOpenGate: data.canOpenGate,
          });
          if (data.amountDue > 0) {
            await createExitPayment(data.amountDue);
          }
        } else {
          setExitScanPhase("error");
          setExitScanError(data.reason || "Xác minh thất bại");
        }
      } catch {
        setExitScanPhase("error");
        setExitScanError("Lỗi kết nối server");
      }
    },
    [activeExit?.sessionId],
  );

  // Create PayOS payment for exit
  const createExitPayment = useCallback(
    async (amount: number) => {
      if (!activeExit?.sessionId) return;
      const sessionId = activeExit.sessionId;
      try {
        const res = await apiFetch(`/transactions/session/${sessionId}`, {
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (data.payos) {
          setExitPaymentData({
            qrCode: data.payos.qrCode,
            checkoutUrl: data.payos.checkoutUrl,
            amount,
          });
          startExitPaymentPoll(sessionId);
        }
      } catch {
        console.error("Failed to create payment");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeExit?.sessionId],
  );

  // Poll exit payment status — nhận sessionId trực tiếp để tránh stale closure
  const startExitPaymentPoll = useCallback((sessionId: string) => {
    setExitPaymentPolling(true);
    const poll = setInterval(async () => {
      try {
        const res = await apiFetch(
          `/public/session/${sessionId}/payment-status`,
        );
        const data = await res.json().catch(() => ({}));
        if (data.paymentStatus === "fully_paid") {
          clearInterval(poll);
          setExitPaymentPolling(false);
          setExitPaymentData(null);
          setExitVerifyData((prev) =>
            prev
              ? { ...prev, paymentStatus: "fully_paid", canOpenGate: true }
              : null,
          );
        }
      } catch {
        // Continue polling
      }
    }, 2000);
    const timeout = setTimeout(() => {
      clearInterval(poll);
      setExitPaymentPolling(false);
    }, 300000);
    // Trả về cleanup để có thể dừng từ ngoài nếu cần
    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
      setExitPaymentPolling(false);
    };
  }, []);

  // Auto-verify exit RFID when scan succeeds
  useEffect(() => {
    if (exitScanPhase !== "success" || !exitScanUid || !activeExit?.sessionId)
      return;
    void verifyExitRfid(exitScanUid);
  }, [exitScanPhase, exitScanUid, activeExit?.sessionId, verifyExitRfid]);

  // Cleanup exit scan on unmount or activeExit change
  useEffect(() => {
    return () => {
      if (exitScanIntervalRef.current !== null) {
        window.clearInterval(exitScanIntervalRef.current);
        exitScanIntervalRef.current = null;
      }
    };
  }, []);

  // ====== Render ======
  const streamIcon = useMemo(() => {
    if (streamStatus === "open")
      return <Wifi size={14} className="text-emerald-500" />;
    if (streamStatus === "connecting")
      return <Loader2 size={14} className="animate-spin text-sky-500" />;
    return <WifiOff size={14} className="text-rose-500" />;
  }, [streamStatus]);

  return (
    <div className="staff-desk">
      <header className="staff-desk__header">
        <div>
          <h1>Bàn nhân viên</h1>
          <p className="staff-desk__subtitle">
            Xem camera cổng vào · nhận biển số tự động · quét thẻ để tạo phiên &
            mở barie
          </p>
        </div>
        <div className="staff-desk__status">
          {streamIcon}
          <span>SSE: {statusLabel(streamStatus)}</span>
        </div>
      </header>

      <div className="staff-desk__gates">
        <section className="staff-desk__gate staff-desk__gate--entry">
          <GateCamera
            title="Cổng vào"
            streamUrl={IN_STREAM_URL}
            direction="in"
          />
          <div className="staff-desk__panel">
            {scanPhase === "success" &&
            scanUid &&
            (!activeIngest || !activeIngest.plate) ? (
              <ManualPlateCard
                scanUid={scanUid}
                manualPlate={manualPlate}
                manualPlateError={manualPlateError}
                phase={phase}
                createMsg={createMsg}
                barrierMsg={barrierMsg}
                createdSession={createdSession}
                onPlateChange={(v) => {
                  setManualPlate(v);
                  setManualPlateError("");
                }}
                onConfirm={() => createSessionManual(scanUid, manualPlate)}
                onDismiss={() => {
                  setScanPhase("idle");
                  setScanUid("");
                  setManualPlate("");
                  setManualPlateError("");
                  setPhase("idle");
                  setCreateMsg("");
                  setBarrierMsg("");
                  setCreatedSession(null);
                  activeIngestIdRef.current = null;
                }}
                onOpenBarrier={manualOpenBarrier}
              />
            ) : !activeIngest ? (
              <WaitingCard
                direction="in"
                scanPhase={scanPhase}
                onStartScan={startScan}
                onCancelScan={cancelScan}
                scanError={scanError}
              />
            ) : (
              <IngestCard
                event={activeIngest}
                phase={phase}
                createMsg={createMsg}
                barrierMsg={barrierMsg}
                createdSession={createdSession}
                onDismiss={dismissActive}
                onOpenBarrier={manualOpenBarrier}
                scanPhase={scanPhase}
                scanUid={scanUid}
                scanError={scanError}
                onStartScan={startScan}
                onCancelScan={cancelScan}
              />
            )}
          </div>
        </section>

        <section className="staff-desk__gate staff-desk__gate--exit">
          <GateCamera
            title="Cổng ra"
            streamUrl={OUT_STREAM_URL}
            direction="out"
          />
          <div className="staff-desk__panel">
            {!activeExit ? (
              <WaitingCard direction="out" />
            ) : (
              <ExitCard
                event={activeExit}
                onDismiss={() => {
                  setActiveExit(null);
                  setExitScanPhase("idle");
                  setExitVerifyData(null);
                  setExitPaymentData(null);
                  autoExitScanFiredRef.current = false;
                  if (exitScanIntervalRef.current !== null) {
                    window.clearInterval(exitScanIntervalRef.current);
                    exitScanIntervalRef.current = null;
                  }
                }}
                onOpenBarrier={openExitBarrier}
                onScanRfid={startExitScan}
                scanPhase={exitScanPhase}
                exitVerifyData={exitVerifyData}
                paymentData={exitPaymentData}
                onOpenGate={
                  exitVerifyData?.canOpenGate ? openExitBarrier : undefined
                }
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function GateCamera({
  title,
  streamUrl,
  direction,
}: {
  title: string;
  streamUrl: string;
  direction: "in" | "out";
}) {
  return (
    <div className="staff-desk__camera">
      <div className="staff-desk__camera-bar">
        <div className="staff-desk__camera-title">
          <Camera size={16} />
          <span>{title}</span>
          <span className={`staff-desk__chip staff-desk__chip--${direction}`}>
            live
          </span>
        </div>
        <span className="staff-desk__hint">MJPEG</span>
      </div>
      <div className="staff-desk__stream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={streamUrl} alt={title} className="staff-desk__stream-img" />
      </div>
    </div>
  );
}

function WaitingCard({
  direction,
  scanPhase,
  onStartScan,
  onCancelScan,
  scanError,
}: {
  direction: "in" | "out";
  scanPhase?: "idle" | "starting" | "waiting" | "success" | "timeout" | "error";
  onStartScan?: () => void;
  onCancelScan?: () => void;
  scanError?: string;
}) {
  const isEntry = direction === "in";
  return (
    <div className="staff-desk__waiting">
      <div className="staff-desk__waiting-icon">
        {isEntry ? (
          <ScanLine size={40} className="animate-pulse" />
        ) : (
          <ArrowUpFromLine size={40} className="animate-pulse" />
        )}
      </div>
      <h2>{isEntry ? "Đang chờ xe vào" : "Đang chờ xe ra"}</h2>
      <p>
        {isEntry
          ? "Camera nhận diện biển số sẽ hiển thị xe cần tạo phiên ở đây."
          : "Camera nhận diện biển số sẽ hiển thị phiên checkout mới nhất ở đây."}
      </p>
      {isEntry && onStartScan && (
        <div className="staff-desk__action" style={{ marginTop: "1rem" }}>
          {scanPhase === "waiting" || scanPhase === "starting" ? (
            <div className="staff-desk__scan-active">
              <div className="staff-desk__scan-pulse">
                <Nfc size={28} className="animate-pulse" />
              </div>
              <p>Đang chờ quẹt thẻ RFID…</p>
              <button className="btn btn-ghost" onClick={onCancelScan}>
                Hủy
              </button>
            </div>
          ) : (
            <>
              <button className="btn btn-primary" onClick={onStartScan}>
                <Nfc size={16} /> Quét thẻ RFID (nhập biển thủ công)
              </button>
              {scanPhase === "timeout" && (
                <p className="staff-desk__hint staff-desk__hint--warn">
                  Hết thời gian chờ quét thẻ.
                </p>
              )}
              {scanPhase === "error" && scanError && (
                <p className="staff-desk__hint staff-desk__hint--danger">
                  <CircleAlert size={14} /> {scanError}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ManualPlateCard({
  scanUid,
  manualPlate,
  manualPlateError,
  phase,
  createMsg,
  barrierMsg,
  createdSession,
  onPlateChange,
  onConfirm,
  onDismiss,
  onOpenBarrier,
}: {
  scanUid: string;
  manualPlate: string;
  manualPlateError: string;
  phase: Phase;
  createMsg: string;
  barrierMsg: string;
  createdSession: { id: string; slot?: string; plate?: string } | null;
  onPlateChange: (v: string) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onOpenBarrier: () => void;
}) {
  return (
    <div className="staff-desk__ingest">
      <div className="staff-desk__ingest-head">
        <div>
          <span className="staff-desk__chip staff-desk__chip--in">
            <Nfc size={12} /> Thẻ RFID
          </span>
          <h2
            className="staff-desk__plate"
            style={{ fontSize: "1rem", fontFamily: "monospace" }}
          >
            {scanUid}
          </h2>
          <p className="staff-desk__plate-sub">
            Camera chưa nhận biển số — nhập thủ công
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onDismiss} aria-label="Hủy">
          <XCircle size={16} />
        </button>
      </div>

      <div className="staff-desk__ingest-img staff-desk__ingest-img--empty">
        <Camera size={32} />
        <span>Chưa có ảnh camera</span>
      </div>

      {phase === "idle" || phase === "error" ? (
        <div className="staff-desk__action">
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              width: "100%",
            }}
          >
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              Biển số xe
            </span>
            <input
              className="input"
              type="text"
              placeholder="VD: 51A12345"
              value={manualPlate}
              onChange={(e) => onPlateChange(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && onConfirm()}
              style={{
                fontFamily: "monospace",
                fontSize: "1.1rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
              autoFocus
            />
            {manualPlateError && (
              <p className="staff-desk__hint staff-desk__hint--danger">
                <CircleAlert size={14} /> {manualPlateError}
              </p>
            )}
          </label>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={manualPlate.trim().length < 5}
          >
            <LogIn size={16} /> Tạo phiên &amp; Mở barie
          </button>
          {(phase as string) === "error" && createMsg && (
            <p className="staff-desk__hint staff-desk__hint--danger">
              <CircleAlert size={14} /> {createMsg}
            </p>
          )}
        </div>
      ) : (
        <div className={`staff-desk__progress staff-desk__progress--${phase}`}>
          {phase === "creating" && (
            <p>
              <Loader2 size={16} className="animate-spin" /> Đang tạo phiên đỗ
              xe…
            </p>
          )}
          {phase === "opening" && (
            <p>
              <Loader2 size={16} className="animate-spin" /> Phiên đã tạo · đang
              mở barie…
            </p>
          )}
          {phase === "done" && (
            <p className="text-emerald-600">
              <CheckCircle2 size={16} /> Hoàn tất
              {createdSession?.slot ? ` · Slot ${createdSession.slot}` : ""}
              {createdSession?.plate ? ` · ${createdSession.plate}` : ""}
            </p>
          )}
          {createMsg && <p className="staff-desk__hint">{createMsg}</p>}
          {barrierMsg && <p className="staff-desk__hint">{barrierMsg}</p>}
        </div>
      )}
    </div>
  );
}

function IngestCard(props: {
  event: CameraIngestEvent;
  phase: Phase;
  createMsg: string;
  barrierMsg: string;
  createdSession: { id: string; slot?: string; plate?: string } | null;
  onDismiss: () => void;
  onOpenBarrier: () => void;
  scanPhase: "idle" | "starting" | "waiting" | "success" | "timeout" | "error";
  scanUid: string;
  scanError: string;
  onStartScan: () => void;
  onCancelScan: () => void;
}) {
  const { event } = props;
  const imgUrl = resolveBridgeImageUrl(event.imagePath);
  const eventIsStale =
    event.action !== "created" &&
    (event.sessionStatus === "Đang gửi" ||
      event.sessionStatus === "Đã hoàn thành");

  return (
    <div className="staff-desk__ingest">
      <div className="staff-desk__ingest-head">
        <div>
          <span className="staff-desk__chip staff-desk__chip--in">
            <LogIn size={12} /> Xe vào
          </span>
          <h2 className="staff-desk__plate">{event.detectedPlate}</h2>
          {event.plate && event.plate !== event.detectedPlate && (
            <p className="staff-desk__plate-sub">
              Khớp với biển đã đăng ký: <strong>{event.plate}</strong>
            </p>
          )}
        </div>
        <button
          className="btn btn-ghost"
          onClick={props.onDismiss}
          aria-label="Bỏ qua"
        >
          <XCircle size={16} />
        </button>
      </div>

      {imgUrl ? (
        <div className="staff-desk__ingest-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt={`Biển số ${event.detectedPlate}`} />
        </div>
      ) : (
        <div className="staff-desk__ingest-img staff-desk__ingest-img--empty">
          <Camera size={32} />
          <span>Không có ảnh crop</span>
        </div>
      )}

      <div className="staff-desk__meta">
        <MetaRow
          icon={<Signal size={14} />}
          label="Độ tin cậy"
          value={
            event.confidence != null
              ? `${Math.round(event.confidence * 100)}%`
              : "—"
          }
        />
        <MetaRow
          icon={<Radio size={14} />}
          label="Loại xe"
          value={
            event.userType === "resident"
              ? "Cư dân"
              : event.userType === "guest"
                ? "Khách vãng lai"
                : "Chưa rõ"
          }
        />
        <MetaRow
          icon={<ArrowDownToLine size={14} />}
          label="Thời gian"
          value={formatTime(event.createdAt)}
        />
        {event.ownerName && (
          <MetaRow
            icon={<CreditCard size={14} />}
            label="Chủ xe"
            value={event.ownerName}
          />
        )}
      </div>

      {eventIsStale && (
        <div className="staff-desk__alert staff-desk__alert--warn">
          <ShieldAlert size={16} />
          <span>
            Biển này đã có phiên <strong>{event.sessionStatus}</strong>. Bỏ qua
            hoặc kiểm tra lại.
          </span>
        </div>
      )}

      {/* Khu vực quét thẻ + xác nhận */}
      {!eventIsStale && (
        <div className="staff-desk__action">
          {props.scanPhase === "waiting" || props.scanPhase === "starting" ? (
            <div className="staff-desk__scan-active">
              <div className="staff-desk__scan-pulse">
                <Nfc size={32} className="animate-pulse" />
              </div>
              <p>Đang chờ nhân viên quẹt thẻ RFID lên đầu đọc cổng vào…</p>
              <button className="btn btn-ghost" onClick={props.onCancelScan}>
                Hủy quét
              </button>
            </div>
          ) : props.scanPhase === "success" && props.scanUid ? (
            <div className="staff-desk__scan-success">
              <CheckCircle2 size={20} className="text-emerald-500" />
              <div>
                <p className="staff-desk__scan-success-title">Đã nhận thẻ</p>
                <code className="staff-desk__scan-uid">{props.scanUid}</code>
              </div>
            </div>
          ) : (
            <div className="staff-desk__scan-cta">
              <button
                className="btn btn-primary btn-lg"
                onClick={props.onStartScan}
              >
                <Nfc size={18} /> Quét thẻ nhân viên
              </button>
              {props.scanPhase === "timeout" && (
                <p className="staff-desk__hint staff-desk__hint--warn">
                  Hết thời gian chờ quét thẻ.
                </p>
              )}
              {props.scanPhase === "error" && props.scanError && (
                <p className="staff-desk__hint staff-desk__hint--danger">
                  <CircleAlert size={14} /> {props.scanError}
                </p>
              )}
            </div>
          )}

          {/* Trạng thái tạo phiên / mở barie */}
          {props.phase !== "idle" && (
            <div
              className={`staff-desk__progress staff-desk__progress--${props.phase}`}
            >
              {props.phase === "creating" && (
                <p>
                  <Loader2 size={16} className="animate-spin" /> Đang tạo phiên
                  đỗ xe…
                </p>
              )}
              {props.phase === "opening" && (
                <p>
                  <Loader2 size={16} className="animate-spin" /> Phiên đã tạo ·
                  đang mở barie…
                </p>
              )}
              {props.phase === "done" && (
                <p className="text-emerald-600">
                  <CheckCircle2 size={16} /> Hoàn tất
                  {props.createdSession?.slot
                    ? ` · Slot ${props.createdSession.slot}`
                    : ""}
                </p>
              )}
              {props.phase === "error" && (
                <p className="text-rose-600">
                  <CircleAlert size={16} />{" "}
                  {props.createMsg || props.barrierMsg || "Có lỗi."}
                </p>
              )}
              {props.createMsg && props.phase !== "error" && (
                <p className="staff-desk__hint">{props.createMsg}</p>
              )}
              {props.barrierMsg && (
                <p className="staff-desk__hint">{props.barrierMsg}</p>
              )}
              {props.phase === "error" && (
                <button className="btn btn-ghost" onClick={props.onOpenBarrier}>
                  <ArrowUpFromLine size={14} /> Thử mở barie lại
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Exit flow state is managed in StaffDeskView component
// This component receives props from parent and triggers callbacks

function ExitCard({
  event,
  onDismiss,
  onOpenBarrier,
  onScanRfid,
  scanPhase,
  paymentData,
  exitVerifyData,
  onOpenGate,
}: {
  event: CameraIngestEvent;
  onDismiss: () => void;
  onOpenBarrier: () => void;
  onScanRfid?: () => void;
  scanPhase?: "idle" | "starting" | "waiting" | "success" | "timeout" | "error";
  paymentData?: {
    qrCode: string;
    checkoutUrl: string;
    amount: number;
  } | null;
  exitVerifyData?: {
    amountDue: number;
    paymentStatus: string;
    isSubscriber: boolean;
    canOpenGate: boolean;
  } | null;
  onOpenGate?: () => void;
}) {
  const imgUrl = resolveBridgeImageUrl(event.imagePath);
  const didCheckout = event.sessionStatus === "Đã hoàn thành";
  const hasPaymentData = paymentData && paymentData.amount > 0;

  // Calculate amount due from verify data or default to 0
  const amountDue = exitVerifyData?.amountDue ?? 0;
  const isSubscriber = exitVerifyData?.isSubscriber ?? false;

  return (
    <div className="staff-desk__ingest">
      <div className="staff-desk__ingest-head">
        <div>
          <span className="staff-desk__chip staff-desk__chip--out">
            <LogIn size={12} /> Xe ra
          </span>
          <h2 className="staff-desk__plate">{event.detectedPlate}</h2>
          <p className="staff-desk__plate-sub">
            {didCheckout
              ? "Phiên đã checkout từ camera."
              : "Đang chờ xác minh RFID"}
          </p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={onDismiss}
          aria-label="Bỏ qua"
        >
          <XCircle size={16} />
        </button>
      </div>

      {imgUrl ? (
        <div className="staff-desk__ingest-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt={`Biển số ${event.detectedPlate}`} />
        </div>
      ) : (
        <div className="staff-desk__ingest-img staff-desk__ingest-img--empty">
          <Camera size={32} />
          <span>Không có ảnh crop</span>
        </div>
      )}

      <div className="staff-desk__meta">
        <MetaRow
          icon={<Signal size={14} />}
          label="Độ tin cậy"
          value={
            event.confidence != null
              ? `${Math.round(event.confidence * 100)}%`
              : "—"
          }
        />
        <MetaRow
          icon={<ArrowUpFromLine size={14} />}
          label="Thời gian"
          value={formatTime(event.createdAt)}
        />
        <MetaRow
          icon={<CreditCard size={14} />}
          label="Phiên"
          value={
            exitVerifyData
              ? isSubscriber
                ? "Thành viên - Miễn phí"
                : `Khách - Còn ${amountDue.toLocaleString("vi-VN")}đ`
              : didCheckout
                ? "Đã checkout"
                : event.fee != null
                  ? `Phí dự kiến: ${event.fee.toLocaleString("vi-VN")}đ`
                  : "Đang tải..."
          }
        />
        <MetaRow
          icon={<Radio size={14} />}
          label="Barie"
          value={event.barrierOpened ? "Đã mở" : "Chưa mở"}
        />
      </div>

      {!didCheckout && (
        <div className="staff-desk__alert staff-desk__alert--warn">
          <ShieldAlert size={16} />
          <span>
            Không tự mở barie. Kiểm tra phiên và thanh toán trước khi cho xe ra.
          </span>
        </div>
      )}

      <div className="staff-desk__action">
        {/* Show QR if payment is needed */}
        {hasPaymentData ? (
          <div className="staff-desk__payment-qr">
            <div className="staff-desk__qr-header">
              <CreditCard size={20} />
              <span>
                Thanh toán {paymentData.amount.toLocaleString("vi-VN")}đ
              </span>
            </div>
            {paymentData.qrCode && (
              <div className="staff-desk__qr-container">
                <img
                  src={`data:image/png;base64,${paymentData.qrCode}`}
                  alt="QR PayOS"
                  className="staff-desk__qr-code"
                />
              </div>
            )}
            <div className="staff-desk__qr-actions">
              {paymentData.checkoutUrl && (
                <button
                  className="btn btn-ghost"
                  onClick={() => window.open(paymentData.checkoutUrl, "_blank")}
                >
                  Mở link thanh toán
                </button>
              )}
            </div>
            <p className="staff-desk__hint">
              Quét QR hoặc mở link để thanh toán.
            </p>
          </div>
        ) : scanPhase === "idle" && !exitVerifyData ? (
          /* Show RFID scan button */
          <button
            className="btn btn-primary btn-lg"
            onClick={onScanRfid}
            disabled={didCheckout || event.barrierOpened}
          >
            <Nfc size={18} /> Quét thẻ RFID
          </button>
        ) : scanPhase === "starting" || scanPhase === "waiting" ? (
          /* Scanning state */
          <div className="staff-desk__scan-active">
            <div className="staff-desk__scan-pulse">
              <Nfc size={28} className="animate-pulse" />
            </div>
            <p>Đang chờ quẹt thẻ…</p>
          </div>
        ) : scanPhase === "error" || scanPhase === "timeout" ? (
          /* Error/timeout - retry */
          <button className="btn btn-primary btn-lg" onClick={onScanRfid}>
            <Nfc size={18} />{" "}
            {scanPhase === "timeout" ? "Hết thời gian — Quét lại" : "Thử lại"}
          </button>
        ) : scanPhase === "success" && !exitVerifyData ? (
          /* Scan OK nhưng đang chờ backend verify trả về */
          <div className="staff-desk__scan-active">
            <div className="staff-desk__scan-pulse">
              <Loader2 size={28} className="animate-spin" />
            </div>
            <p>Đang xác minh thẻ RFID…</p>
          </div>
        ) : (
          /* exitVerifyData đã có — hiện nút mở barie */
          <button
            className="btn btn-primary btn-lg"
            onClick={onOpenGate || onOpenBarrier}
            disabled={
              didCheckout || event.barrierOpened || !exitVerifyData?.canOpenGate
            }
          >
            <ArrowUpFromLine size={18} />{" "}
            {event.barrierOpened
              ? "Barie đã mở"
              : isSubscriber
                ? "Mở barie (Miễn phí)"
                : amountDue <= 0
                  ? "Mở barie"
                  : "Chờ thanh toán"}
          </button>
        )}

        {!didCheckout && !hasPaymentData && (
          <p className="staff-desk__hint staff-desk__hint--warn">
            {scanPhase === "starting" || scanPhase === "waiting"
              ? "Đang chờ quét thẻ RFID..."
              : scanPhase === "error"
                ? "Thẻ không hợp lệ hoặc không khớp — vui lòng quét lại."
                : scanPhase === "timeout"
                  ? "Hết thời gian quét thẻ — vui lòng thử lại."
                  : !exitVerifyData
                    ? "Quét thẻ RFID để xác minh và mở barie."
                    : isSubscriber
                      ? "Thành viên đã xác minh - sẵn sàng mở barie."
                      : amountDue <= 0
                        ? "Xác minh thành công - sẵn sàng mở barie."
                        : "Vui lòng thanh toán trước khi ra."}
          </p>
        )}
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="staff-desk__meta-row">
      <span className="staff-desk__meta-label">
        {icon}
        {label}
      </span>
      <span className="staff-desk__meta-value">{value}</span>
    </div>
  );
}
