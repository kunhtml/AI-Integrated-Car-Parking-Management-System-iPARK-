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
  Radio,
  RefreshCcw,
  ScanLine,
  ShieldAlert,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";

import { QRCodeSVG } from "qrcode.react";
import { apiFetch, bridgeFetch } from "@/lib/client-api";
import { bridgeBaseUrl } from "@/lib/client-api";
import {
  CameraIngestEvent,
  CameraStreamStatus,
  resolveBridgeImageUrl,
  useCameraIngestEvents,
} from "@/features/staff-desk/use-camera-events";
import {
  ExitMismatch,
  ExitMismatchPanel,
} from "@/features/staff-desk/exit-mismatch-panel";

type Phase = "idle" | "creating" | "opening" | "done" | "error";

const SCAN_POLL_MS = 1000;

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN");
}

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("vi-VN");
}

function parseRfidConflict(message: string) {
  const match = message.match(
    /^RFID Guest UID (.+?) đã được cấp cho xe (.+?) lúc (.+?)\. Thẻ đang gắn với phiên này nên không thể cấp tiếp cho xe (.+?)\.$/,
  );
  if (!match) return null;
  return { uid: match[1], assignedPlate: match[2], checkInAt: match[3], attemptedPlate: match[4] };
}

function statusLabel(s: CameraStreamStatus) {
  if (s === "open") return "Đã kết nối";
  if (s === "connecting") return "Đang kết nối…";
  if (s === "error") return "Mất kết nối (đang thử lại)";
  return "Đã đóng";
}

export function StaffDeskView() {
  const entryLaneRef = useRef<"in" | "out">("in");
  const exitLaneRef = useRef<"in" | "out">("out");
  const [laneRoles, setLaneRoles] = useState({ entryLane: "in" as "in" | "out", exitLane: "out" as "in" | "out" });
  useEffect(() => {
    apiFetch("/devices/lane-roles").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      if ((data.entryLane === "in" || data.entryLane === "out") && (data.exitLane === "in" || data.exitLane === "out")) {
        entryLaneRef.current = data.entryLane;
        exitLaneRef.current = data.exitLane;
        setLaneRoles(data);
      }
    }).catch(() => undefined);
  }, []);
  // ====== Camera ingest realtime (SSE) ======
  const { latest: pendingIngest, status: streamStatus } =
    useCameraIngestEvents();
  const [activeIngest, setActiveIngest] = useState<CameraIngestEvent | null>(
    null,
  );
  const [activeExit, setActiveExit] = useState<CameraIngestEvent | null>(null);
  /** Session IDs staff closed manually; skip restore from /exit/pending in this UI session. */
  const dismissedExitSessionIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!pendingIngest) return;
    if (pendingIngest.direction === "in") {
      setActiveIngest(pendingIngest);
      setShowIngestManualEntry(false);
      setManualPlate("");
      setManualPlateError("");
      return;
    }
    const sid = pendingIngest.sessionId || "";
    if (sid && dismissedExitSessionIdsRef.current.has(sid)) {
      return;
    }
    autoExitScanFiredRef.current = false;
    setExitScanPhase("idle");
    setExitVerifyData(null);
    setExitPaymentData(null);
    setExitMismatch(null);
    setActiveExit(pendingIngest);
  }, [pendingIngest]);

  // Khi SSE kết nối xong, fetch phiên xe ra đang chờ RFID (nếu có).
  // Giải quyết trường hợp camera detect trước khi staff mở trang.
  useEffect(() => {
    if (streamStatus !== "open") return;
    // Nếu đã có activeExit rồi thì không cần fetch
    if (activeExit) return;
    apiFetch("/exit/pending")
      .then(async (response) => {
        if (!response.ok) return;
        const res = (await response.json()) as {
          pending: boolean;
          event?: CameraIngestEvent;
        };
        if (res.pending && res.event) {
          const sid = res.event.sessionId || "";
          if (sid && dismissedExitSessionIdsRef.current.has(sid)) {
            return;
          }
          autoExitScanFiredRef.current = false;
          setExitScanPhase("idle");
          setExitVerifyData(null);
          setExitPaymentData(null);
          setExitMismatch(null);
          setActiveExit(res.event);
        }
      })
      .catch(() => {
        // Không làm gì nếu lỗi — SSE realtime sẽ cập nhật khi có xe mới
      });    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // UID đã auto-create phiên cho luồng nhập tay biển số; chống gọi 2 lần.
  const manualAutoCreateRef = useRef("");
  // Thông tin thẻ tra được theo UID (luồng quét thẻ trước, nhập/đối chiếu biển sau).
  const [scannedCardInfo, setScannedCardInfo] = useState<{
    card: { uid: string; cardType: string; status: string; ownerName: string; plate: string } | null;
    vehicle: { ownerName: string; plate: string; status: string } | null;
    isSubscriber: boolean;
    subscription: { planName: string; endDate: string } | null;
    activeSession: { plate: string; checkInAt: string } | null;
    plateActiveSession: { plate: string; checkInAt: string } | null;
  } | null>(null);

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
    entryRfidUnverified?: boolean;
    entryExpectedRfidUid?: string;
  } | null>(null);
  const [barrierMsg, setBarrierMsg] = useState("");
  const [entrySuccessNotice, setEntrySuccessNotice] = useState<string | null>(null);

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
  const [exitMismatch, setExitMismatch] = useState<ExitMismatch | null>(null);
  const [exitMismatchPending, setExitMismatchPending] = useState(false);
  const [manualExitPlate, setManualExitPlate] = useState("");
  const [manualExitError, setManualExitError] = useState("");
  const [manualExitLoading, setManualExitLoading] = useState(false);
  const [showManualExitForm, setShowManualExitForm] = useState(false);
  const [showManualEntryForm, setShowManualEntryForm] = useState(false);
  const [manualEntryPlate, setManualEntryPlate] = useState("");
  const [manualEntryError, setManualEntryError] = useState("");
  const [manualEntryLoading, setManualEntryLoading] = useState(false);
  const [manualEntryVehicle, setManualEntryVehicle] = useState<{
    ownerName?: string;
    isSubscriber?: boolean;
    cardUid?: string;
  } | null>(null);
  const [pendingManualEntryRfid, setPendingManualEntryRfid] = useState(false);
  const [showEntryRfidExceptionForm, setShowEntryRfidExceptionForm] = useState(false);
  const [entryRfidExceptionReason, setEntryRfidExceptionReason] = useState("");
  /** Sửa/nhập lại biển khi AI nhận sai hoặc không đọc được trên event camera. */
  const [showIngestManualEntry, setShowIngestManualEntry] = useState(false);
  const [exitMismatchError, setExitMismatchError] = useState("");

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
      await bridgeFetch("/api/rfid/scan/cancel", { method: "POST", body: JSON.stringify({ direction: entryLaneRef.current }) });
    } catch {
      /* ignore */
    }
  }, [stopScanPolling]);

  // Auto-cancel scan khi staff đóng/xử lý xong event hiện tại.
  useEffect(() => {
    return () => {
      stopScanPolling();
      bridgeFetch("/api/rfid/scan/cancel", { method: "POST", body: JSON.stringify({ direction: entryLaneRef.current }) }).catch(
        () => undefined,
      );
    };
  }, [stopScanPolling]);

  const startScan = useCallback(async () => {
    setScanError("");
    setScanUid("");
    setScannedCardInfo(null);
    setScanPhase("starting");
    try {
      const res = await bridgeFetch("/api/rfid/scan/start", { method: "POST", body: JSON.stringify({ direction: entryLaneRef.current }) });
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
        try {
          const poll = await bridgeFetch(`/api/rfid/scan/poll?direction=${entryLaneRef.current}`);
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
              body: JSON.stringify({ direction: entryLaneRef.current }),
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
      // With a manually entered plate, keep it for the staff's final confirmation.
      if (!pendingManualEntryRfid) {
        setManualPlate("");
        setManualPlateError("");
        // Quét thẻ trước → tra thông tin thẻ/xe/gói để staff đối chiếu biển số.
        void (async () => {
          try {
            const res = await apiFetch(`/rfid/by-uid/${encodeURIComponent(scanUid)}`);
            const data = await res.json().catch(() => ({}));
            if (data.ok) {
              setScannedCardInfo(data);
              if (data.card?.cardType === "member" && data.card.plate) {
                setManualPlate(
                  String(data.card.plate).trim().toUpperCase().replace(/[\s-]+/g, ""),
                );
              }
            } else {
              setScannedCardInfo(null);
            }
          } catch {
            setScannedCardInfo(null);
          }
        })();
        return;
      }
      // Nhập tay biển số + quét thẻ OK → tự tạo phiên ngay, không cần bấm xác nhận.
      if (manualPlate && manualAutoCreateRef.current !== scanUid) {
        manualAutoCreateRef.current = scanUid;
        void createSessionManual(scanUid, manualPlate);
      }
      return;
    }
    if (!activeIngest.plate || showIngestManualEntry) {
      // Camera không đọc được / staff đang sửa biển AI sai → nhập tay
      if (!showIngestManualEntry) {
        setManualPlate("");
        setManualPlateError("");
      }
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
  }, [scanPhase, scanUid, activeIngest, showIngestManualEntry, pendingManualEntryRfid, manualPlate]);

  // Tự động bắt đầu quét RFID khi camera phát hiện xe vào
  useEffect(() => {
    if (!activeIngest || activeIngest.direction !== "in") return;
    if (activeIngest.action === "created") return;
    if (scanPhase !== "idle") return;
    if (autoScanFiredRef.current) return;
    autoScanFiredRef.current = true;
    void startScan();
  }, [activeIngest, scanPhase, startScan]);

  // Tạo phiên thủ công: idle form / RFID không có plate / sửa biển AI sai
  const createSessionManual = useCallback(
    async (
      uid: string | undefined,
      plate: string,
      opts?: { fromIdleForm?: boolean; fromIngestCorrection?: boolean; manualRfidReason?: string },
    ) => {
      const normalized = plate
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "");
      const setErr = (msg: string) => {
        if (opts?.fromIdleForm) setManualEntryError(msg);
        else setManualPlateError(msg);
      };
      if (normalized.length < 5) {
        setErr("Biển số phải có ít nhất 5 ký tự.");
        return;
      }
      if (opts?.fromIdleForm) {
        setManualEntryError("");
        setManualEntryLoading(true);
      } else {
        setManualPlateError("");
      }
      setPhase("creating");
      setCreateMsg("");
      setBarrierMsg("");
      setEntrySuccessNotice(null);
      setCreatedSession(null);

      try {
        const hasCameraImage = Boolean(activeIngest?.imagePath);
        const payload: Record<string, unknown> = {
          plate: normalized,
          vehicleType: "Ô tô",
          entrySource: "manual",
          entryPhotoStatus: hasCameraImage
            ? "photo_captured"
            : "camera_unavailable",
          manualEntryReason: opts?.manualRfidReason
            ? (/camera/i.test(opts.manualRfidReason)
              ? opts.manualRfidReason
              : `Camera lỗi, ${opts.manualRfidReason}`)
            : opts?.fromIngestCorrection
            ? "Camera lỗi, AI nhận diện sai/không đọc được; staff nhập biển thủ công"
            : "Camera lỗi, không nhận diện được; staff nhập biển thủ công",
          visualConfirmed: true,
          entryRfidUnverified: !uid,
        };
        if (uid) payload.rfidUid = uid;
        if (activeIngest?.detectedPlate) {
          payload.entryDetectedPlate = activeIngest.detectedPlate;
        }
        if (typeof activeIngest?.confidence === "number") {
          payload.entryConfidence = activeIngest.confidence;
        }
        if (activeIngest?.imagePath) {
          payload.entryImageUrl = activeIngest.imagePath;
        }

        const res = await apiFetch("/parking-sessions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPhase("error");
          const msg = data.message || `Tạo phiên thất bại (${res.status}).`;
          setCreateMsg(msg);
          if (opts?.fromIdleForm) setManualEntryError(msg);
          return;
        }
        const session = data.session ?? {};
        setCreatedSession({
          id: session._id || session.id,
          slot: session.slot,
          plate: session.plate,
          entryRfidUnverified: Boolean(session.entryRfidUnverified),
          entryExpectedRfidUid: session.entryExpectedRfidUid,
        });
        setCreateMsg(
          data.isMember
            ? "Biển số thuộc gói thành viên — miễn phí."
            : data.memberRfidManual
              ? "Đã xác định xe Member từ hồ sơ; RFID được xử lý thủ công."
            : "Đã tạo phiên cho khách.",
        );
        setPhase("opening");
        if (opts?.fromIdleForm) {
          setShowManualEntryForm(false);
          setManualEntryPlate("");
        }
        if (opts?.fromIngestCorrection || activeIngest) {
          setShowIngestManualEntry(false);
          setManualPlate("");
          setActiveIngest(null);
          activeIngestIdRef.current = null;
          autoScanFiredRef.current = false;
        }
        const openRes = await bridgeFetch(`/gate/${entryLaneRef.current}/open`, { method: "POST" });
        if (!openRes.ok) {
          setPhase("error");
          setBarrierMsg(
            `Tạo phiên OK nhưng mở barie thất bại (${openRes.status}). Bấm mở tay.`,
          );
          return;
        }
        setBarrierMsg("Đã tạo phiên thủ công — đã mở barie cổng vào.");
        setPhase("done");
        setEntrySuccessNotice(`Đã cho xe ${session.plate || normalized} vào bãi thành công.`);
        setPendingManualEntryRfid(false);
        setShowEntryRfidExceptionForm(false);
        setEntryRfidExceptionReason("");
      } catch {
        setPhase("error");
        const msg = "Lỗi mạng khi tạo phiên.";
        setCreateMsg(msg);
        if (opts?.fromIdleForm) setManualEntryError(msg);
      } finally {
        if (opts?.fromIdleForm) setManualEntryLoading(false);
      }
    },
    [activeIngest],
  );

  const startManualEntryRfidFlow = useCallback(async () => {
    const normalized = manualEntryPlate.trim().toUpperCase().replace(/[\s-]+/g, "");
    if (normalized.length < 5) {
      setManualEntryError("Biển số phải có ít nhất 5 ký tự.");
      return;
    }
    setManualEntryError("");
    setManualEntryLoading(true);
    try {
      const response = await apiFetch(`/rfid/by-plate/${encodeURIComponent(normalized)}`);
      const details = await response.json().catch(() => ({}));
      if (!response.ok) {
        setManualEntryError(details.message || "Không thể tra cứu thông tin biển số.");
        return;
      }
      setManualEntryVehicle({
        ownerName: details.vehicle?.ownerName,
        isSubscriber: Boolean(details.isSubscriber),
        cardUid: details.card?.uid,
      });
      setManualPlate(normalized);
      setShowManualEntryForm(false);
      setShowEntryRfidExceptionForm(false);
      setPendingManualEntryRfid(true);
      // The member still presents the physical card at the gate; scan it to
      // verify the UID before creating the session and opening the barrier.
      await startScan();
    } catch {
      setManualEntryError("Không thể tra cứu thông tin biển số.");
    } finally {
      setManualEntryLoading(false);
    }
  }, [manualEntryPlate, startScan, createSessionManual]);

  const handleEntryRfidException = useCallback(() => {
    void cancelScan();
    setShowEntryRfidExceptionForm(true);
  }, [cancelScan]);

  const createSessionAndOpen = useCallback(
    async (uid: string) => {
      if (!activeIngest) return;
      setPhase("creating");
      setCreateMsg("");
      setBarrierMsg("");
      setEntrySuccessNotice(null);
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
          // Không được mở barie khi API không tạo/xác nhận phiên.
          // 409 cũng được dùng cho RFID Member sai biển số, thẻ không hợp lệ
          // hoặc bãi hết chỗ; mọi nhánh lỗi phải dừng tại đây.
          setPhase("error");
          setCreateMsg(data.message || `Tạo phiên thất bại (${res.status}).`);
          return;
        }
        const session = data.session ?? {};
        setCreatedSession({
          id: session._id || session.id,
          slot: session.slot,
          plate: session.plate,
          entryRfidUnverified: Boolean(session.entryRfidUnverified),
        });
        setCreateMsg(
          data.isMember
            ? "Biển số thuộc gói thành viên — miễn phí."
            : "Đã tạo phiên cho khách.",
        );
        setPhase("opening");

        // Mở barie cổng vào qua bridge.
        const openRes = await bridgeFetch(`/gate/${entryLaneRef.current}/open`, { method: "POST" });
        if (!openRes.ok) {
          setPhase("error");
          setBarrierMsg(
            `Tạo phiên OK nhưng mở barie thất bại (${openRes.status}). Bấm mở tay.`,
          );
          return;
        }
        setBarrierMsg("Thẻ RFID hợp lệ — đã mở barie cổng vào.");
        setPhase("done");
      } catch (e) {
        setPhase("error");
        setCreateMsg("Lỗi mạng khi tạo phiên.");
      }
    },
    [activeIngest],
  );

  const clearExitUi = useCallback(() => {
    setActiveExit(null);
    setExitScanPhase("idle");
    setExitScanUid("");
    setExitScanError("");
    setExitVerifyData(null);
    setExitPaymentData(null);
    setExitMismatch(null);
    setExitMismatchError("");
    autoExitScanFiredRef.current = false;
    if (exitScanIntervalRef.current !== null) {
      window.clearInterval(exitScanIntervalRef.current);
      exitScanIntervalRef.current = null;
    }
  }, []);

  const dismissActiveExit = useCallback(async () => {
    const sessionId = activeExit?.sessionId || "";
    if (sessionId) {
      dismissedExitSessionIdsRef.current.add(sessionId);
      try {
        await apiFetch("/exit/dismiss", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });
      } catch {
        // Vẫn đóng UI local; session có thể restore nếu API lỗi — staff thử lại.
      }
    }
    clearExitUi();
  }, [activeExit?.sessionId, clearExitUi]);

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
    setShowIngestManualEntry(false);
    activeIngestIdRef.current = null;
    autoScanFiredRef.current = false;
  }, []);

  const openIngestManualEntry = useCallback(() => {
    const seed =
      (activeIngest?.detectedPlate || activeIngest?.plate || "")
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "") || "";
    setManualPlate(seed);
    setManualPlateError("");
    setShowIngestManualEntry(true);
    // Chặn auto-create với biển AI sai nếu RFID đã quẹt
    activeIngestIdRef.current = activeIngest?.id || null;
  }, [activeIngest]);

  const cancelIngestManualEntry = useCallback(() => {
    setShowIngestManualEntry(false);
    setManualPlate("");
    setManualPlateError("");
    // Cho phép auto-create lại nếu staff hủy sửa và đã có RFID + plate AI
    if (activeIngest?.plate && scanPhase === "success" && scanUid) {
      activeIngestIdRef.current = null;
    }
  }, [activeIngest?.plate, scanPhase, scanUid]);

  const manualOpenBarrier = useCallback(async () => {
    try {
      const res = await bridgeFetch(`/gate/${entryLaneRef.current}/open`, { method: "POST" });
      setBarrierMsg(
        res.ok ? "Đã mở barie cổng vào." : `Mở barie thất bại (${res.status}).`,
      );
    } catch {
      setBarrierMsg("Không kết nối được bridge.");
    }
  }, []);

  const prepareManualExit = useCallback(async () => {
    const plate = manualExitPlate.trim().toUpperCase();
    if (!plate || plate.length < 5) {
      setManualExitError("Vui lòng nhập biển số xe (ít nhất 5 ký tự).");
      return;
    }
    setManualExitLoading(true);
    setManualExitError("");
    try {
      const res = await apiFetch("/exit/prepare-manual", {
        method: "POST",
        body: JSON.stringify({ plate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.event) {
        setManualExitError(
          data.message || "Không tìm thấy phiên đang gửi cho biển số này.",
        );
        return;
      }
      autoExitScanFiredRef.current = false;
      setExitScanPhase("idle");
      setExitScanUid("");
      setExitScanError("");
      setExitVerifyData(null);
      setExitPaymentData(null);
      setExitMismatch(null);
      const restoredId = (data.event as CameraIngestEvent).sessionId || "";
      if (restoredId) dismissedExitSessionIdsRef.current.delete(restoredId);
      setActiveExit(data.event as CameraIngestEvent);
      setShowManualExitForm(false);
      setManualExitPlate("");
    } catch {
      setManualExitError("Lỗi kết nối server. Vui lòng thử lại.");
    } finally {
      setManualExitLoading(false);
    }
  }, [manualExitPlate]);

  const openExitBarrier = useCallback(async () => {
    if (!activeExit?.sessionId || activeExit.action === "no_session") {
      setExitScanError("Chưa tìm thấy phiên đang gửi cho biển số này.");
      setExitScanPhase("error");
      return;
    }
    try {
      const res = await apiFetch("/exit/open-gate", {
        method: "POST",
        body: JSON.stringify({ sessionId: activeExit.sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setExitScanPhase("success");
        setExitScanError("");
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
    if (!activeExit?.sessionId || activeExit.action === "no_session") {
      setExitScanError("Chưa tìm thấy phiên đang gửi cho biển số này.");
      setExitScanPhase("error");
      return;
    }
    setExitScanError("");
    setExitScanUid("");
    setExitScanPhase("starting");
    try {
      const res = await bridgeFetch("/api/rfid/scan/start", { method: "POST", body: JSON.stringify({ direction: exitLaneRef.current }) });
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
        try {
          const poll = await bridgeFetch(`/api/rfid/scan/poll?direction=${exitLaneRef.current}`);
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
              body: JSON.stringify({ direction: exitLaneRef.current }),
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
            if (data.uid) {
              setExitScanUid(data.uid);
              setExitScanPhase("success");
            } else {
              setExitScanPhase("error");
              setExitScanError(
                data.message || "Thẻ RFID không hợp lệ hoặc đã bị vô hiệu hóa.",
              );
            }
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
      await bridgeFetch("/api/rfid/scan/cancel", { method: "POST", body: JSON.stringify({ direction: exitLaneRef.current }) });
    } catch {
      /* ignore */
    }
  }, []);

  // Verify exit RFID with backend
  const verifyExitRfid = useCallback(
    async (uid: string) => {
      if (!activeExit?.sessionId || activeExit.action === "no_session") {
      setExitScanError("Chưa tìm thấy phiên đang gửi cho biển số này.");
      setExitScanPhase("error");
      return;
    }
      try {
        const res = await apiFetch("/exit/verify", {
          method: "POST",
          body: JSON.stringify({ sessionId: activeExit.sessionId, uid }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.verified) {
          setExitMismatch(null);
          setExitVerifyData({
            amountDue: data.amountDue,
            paymentStatus: data.paymentStatus,
            isSubscriber: data.isSubscriber,
            canOpenGate: data.canOpenGate,
          });
          setExitPaymentData(null);
          if (!(data.amountDue > 0) && data.canOpenGate) {
            await openExitBarrier();
          }
        } else if (data.exception) {
          setExitMismatch(data as ExitMismatch);
          setExitScanPhase("error");
          setExitScanUid("");
          setExitScanError("");
          autoExitScanFiredRef.current = true;
        } else {
          setExitScanPhase("error");
          setExitScanError(data.reason || "Xác minh thất bại");
        }
      } catch {
        setExitScanPhase("error");
        setExitScanError("Lỗi kết nối server");
      }
    },
    [activeExit?.sessionId, openExitBarrier],
  );

  // Create PayOS payment for exit
  const createExitPayment = useCallback(
    async (amount: number) => {
      if (!activeExit?.sessionId || activeExit.action === "no_session") {
      setExitScanError("Chưa tìm thấy phiên đang gửi cho biển số này.");
      setExitScanPhase("error");
      return;
    }
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

  const payExitCash = useCallback(async (receivedAmount: number) => {
    if (!activeExit?.sessionId || activeExit.action === "no_session") {
      setExitScanError("Chưa tìm thấy phiên đang gửi cho biển số này.");
      setExitScanPhase("error");
      return;
    }
    const amount = exitVerifyData?.amountDue ?? activeExit.fee ?? 0;
    if (!Number.isFinite(receivedAmount) || receivedAmount < amount) {
      setExitScanError("Số tiền khách đưa chưa đủ số tiền cần thanh toán.");
      setExitScanPhase("error");
      return;
    }
    try {
      const res = await apiFetch(
        `/transactions/session/${activeExit.sessionId}/cash`,
        {
          method: "POST",
          body: JSON.stringify({
            // Backend records the exact fee; the excess is cash change, not revenue.
            amount: amount > 0 ? amount : undefined,
            note: "Thu tiền mặt tại bàn nhân viên cổng ra",
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExitScanError(data.message || "Thu tiền mặt thất bại.");
        setExitScanPhase("error");
        return;
      }
      setExitPaymentData(null);
      setExitVerifyData((prev) =>
        prev
          ? {
              ...prev,
              amountDue: 0,
              paymentStatus: data.sessionPaymentStatus || "fully_paid",
              canOpenGate: true,
            }
          : {
              amountDue: 0,
              paymentStatus: data.sessionPaymentStatus || "fully_paid",
              isSubscriber: false,
              canOpenGate: true,
          },
      );
      // Payment is persisted first. The gate endpoint reloads the session and
      // enforces verification/payment guards before authorizing the barrier.
      await openExitBarrier();
    } catch {
      setExitScanError("Lỗi kết nối khi thu tiền mặt.");
      setExitScanPhase("error");
    }
  }, [
    activeExit?.sessionId,
    activeExit?.action,
    activeExit?.fee,
    exitVerifyData?.amountDue,
    openExitBarrier,
  ]);

  const retryExitScan = useCallback(() => {
    setExitMismatch(null);
    setExitMismatchError("");
    autoExitScanFiredRef.current = false;
    void startExitScan();
  }, [startExitScan]);

  const rejectExitMismatch = useCallback(async () => {
    if (!exitMismatch?.sessionId) return;
    setExitMismatchPending(true);
    setExitMismatchError("");
    try {
      const res = await apiFetch("/exit/resolve-mismatch", {
        method: "POST",
        body: JSON.stringify({
          sessionId: exitMismatch.sessionId,
          action: "reject",
          verificationNote: "Từ chối cho xe ra do sai lệch định danh",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExitMismatchError(data.message || "Không từ chối được.");
        return;
      }
      setExitMismatch(null);
      setExitScanPhase("error");
      setExitScanError("Đã từ chối. Barrier giữ đóng. Yêu cầu đúng thẻ hoặc xử lý lại.");
    } catch {
      setExitMismatchError("Lỗi kết nối server");
    } finally {
      setExitMismatchPending(false);
    }
  }, [exitMismatch?.sessionId]);

  const resolveExitMismatch = useCallback(
    async (action: string, manualPlate: string, note: string) => {
      if (!exitMismatch?.sessionId) return;
      setExitMismatchPending(true);
      setExitMismatchError("");
      try {
        const res = await apiFetch("/exit/resolve-mismatch", {
          method: "POST",
          body: JSON.stringify({
            sessionId: exitMismatch.sessionId,
            action,
            manualPlate,
            verificationNote: note,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.verified) {
          setExitMismatchError(data.message || "Không xử lý được lệch định danh.");
          return;
        }
        setExitMismatch(null);
        setExitVerifyData({
            amountDue: data.amountDue,
            paymentStatus: data.paymentStatus,
            isSubscriber: data.isSubscriber,
            canOpenGate: data.canOpenGate,
          });
          setExitPaymentData(null);
          if (!(data.amountDue > 0) && data.canOpenGate) {
            await openExitBarrier();
          }
      } catch {
        setExitMismatchError("Lỗi kết nối server");
      } finally {
        setExitMismatchPending(false);
      }
    },
    [exitMismatch?.sessionId, createExitPayment, openExitBarrier],
  );

  const resolveMissingEntryRfid = useCallback(
    async (note: string) => {
      if (!activeExit?.sessionId) return;
      setExitMismatchPending(true);
      setExitMismatchError("");
      try {
        const res = await apiFetch("/exit/resolve-mismatch", {
          method: "POST",
          body: JSON.stringify({
            sessionId: activeExit.sessionId,
            action: "manual_missing_entry_rfid",
            verificationNote: note,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.verified) {
          setExitMismatchError(data.message || "Không thể xác nhận thủ công.");
          return;
        }
        setExitVerifyData({
          amountDue: data.amountDue,
          paymentStatus: data.paymentStatus,
          isSubscriber: data.isSubscriber,
          canOpenGate: data.canOpenGate,
        });
        setExitPaymentData(null);
        setActiveExit((current) =>
          current
            ? {
                ...current,
                metadata: {
                  ...(current.metadata ?? {}),
                  exitRfidManualVerified: true,
                  exitRfidManualNote: note,
                },
              }
            : current,
        );
        if (!(data.amountDue > 0) && data.canOpenGate) {
          await openExitBarrier();
        }
      } catch {
        setExitMismatchError("Lỗi kết nối server");
      } finally {
        setExitMismatchPending(false);
      }
    },
    [activeExit?.sessionId, openExitBarrier],
  );

  // Poll exit payment status — nhận sessionId trực tiếp để tránh stale closure
  const startExitPaymentPoll = useCallback((sessionId: string) => {
    setExitPaymentPolling(true);

    const checkPayment = async () => {
      try {
        const res = await apiFetch(
          `/public/session/${sessionId}/payment-status`,
        );
        const data = await res.json().catch(() => ({}));
        if (data.paymentStatus === "fully_paid" || data.transaction?.status === "paid") {
          setExitPaymentPolling(false);
          setExitPaymentData(null);
          setExitVerifyData((prev) =>
            prev
              ? { ...prev, paymentStatus: "fully_paid", canOpenGate: true }
              : null,
          );
          await openExitBarrier();
          return true;
        }
      } catch {
        // Continue polling
      }
      return false;
    };

    void checkPayment();
    const poll = setInterval(async () => {
      if (await checkPayment()) clearInterval(poll);
    }, 2000);
    const timeout = setTimeout(() => {
      clearInterval(poll);
      setExitPaymentPolling(false);
    }, 300000);

    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
      setExitPaymentPolling(false);
    };
  }, [openExitBarrier]);

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

      {entrySuccessNotice ? (
        <div className="staff-desk__entry-success" role="status">
          <CheckCircle2 size={18} />
          <span>{entrySuccessNotice}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setEntrySuccessNotice(null)}>
            <XCircle size={16} />
          </button>
        </div>
      ) : null}

      <div className="staff-desk__gates">
        <section className="staff-desk__gate staff-desk__gate--entry">
          <GateCamera
            title="Cổng vào"
            streamUrl={`${bridgeBaseUrl}/video_feed/${laneRoles.entryLane}`}
            direction="in"
          />
          <div className="staff-desk__panel">
            {phase === "done" && createdSession && !activeIngest ? (
              <div className="staff-desk__waiting staff-desk__waiting--entry">
                <div
                  className="staff-desk__waiting-icon"
                  style={{
                    color: "#15803d",
                    borderColor: "#bbf7d0",
                    background: "#f0fdf4",
                  }}
                >
                  <CheckCircle2 size={40} />
                </div>
                <h2>Đã cho xe vào</h2>
                <p>
                  Biển <strong>{createdSession.plate || "—"}</strong>
                  {createdSession.slot ? ` · Ô ${createdSession.slot}` : ""}
                </p>
                {createdSession.entryRfidUnverified ? (
                  <p className="staff-desk__entry-rfid-unverified">
                    <CircleAlert size={14} /> {createdSession.entryExpectedRfidUid
                      ? <>RFID Member ({createdSession.entryExpectedRfidUid}) chưa xác minh — đã xử lý thủ công</>
                      : "RFID chưa xác minh — đã xử lý thủ công"}
                  </p>
                ) : scanUid ? (
                  <p className="staff-desk__entry-rfid-confirmed">
                    <Nfc size={14} /> RFID đã gắn: <strong>{scanUid}</strong>
                  </p>
                ) : null}
                {barrierMsg ? (
                  <p className="staff-desk__hint">{barrierMsg}</p>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: "1rem" }}
                  onClick={() => {
                    setPhase("idle");
                    setCreatedSession(null);
                    setCreateMsg("");
                    setBarrierMsg("");
                    setEntrySuccessNotice(null);
                    setShowManualEntryForm(false);
                    setManualEntryPlate("");
                    setManualEntryError("");
                    setManualEntryVehicle(null);
                    setPendingManualEntryRfid(false);
                    setScanPhase("idle");
                    setScanUid("");
                    autoScanFiredRef.current = false;
                  }}
                >
                  Xong
                </button>
              </div>
            ) : showEntryRfidExceptionForm && pendingManualEntryRfid && !activeIngest ? (
              <div className="staff-desk__waiting staff-desk__waiting--entry staff-desk__manual-rfid-entry">
                <div className="staff-desk__waiting-icon"><Nfc size={36} /></div>
                <h2>Xử lý RFID thủ công</h2>
                <p>Biển số <strong>{manualPlate}</strong> đã được xác nhận. Nhập lý do trước khi cho xe vào.</p>
                <textarea
                  rows={3}
                  value={entryRfidExceptionReason}
                  onChange={(event) => setEntryRfidExceptionReason(event.target.value)}
                  placeholder="VD: Đầu đọc RFID không nhận thẻ; đã kiểm tra xe và biển số bằng mắt"
                />
                {phase === "error" && createMsg ? (
                  <p className="staff-desk__hint staff-desk__hint--danger">{createMsg}</p>
                ) : null}
                <div className="staff-desk__exit-manual-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={entryRfidExceptionReason.trim().length < 8 || /đang có phiên|chưa checkout/i.test(entryRfidExceptionReason)}
                    onClick={() => void createSessionManual(undefined, manualPlate, { manualRfidReason: entryRfidExceptionReason.trim() })}
                  >
                    Xác nhận cho xe vào
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setShowEntryRfidExceptionForm(false);
                      void startScan();
                    }}
                  >
                    Quét lại RFID
                  </button>
                </div>
              </div>
            ) : scanPhase === "success" &&
            scanUid &&
            !activeIngest ? (
              <ManualPlateCard
                scanUid={scanUid}
                manualPlate={manualPlate}
                manualPlateError={manualPlateError}
                phase={phase}
                createMsg={createMsg}
                barrierMsg={barrierMsg}
                createdSession={createdSession}
                plateConfirmed={pendingManualEntryRfid}
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
                  setShowIngestManualEntry(false);
                  setPhase("idle");
                  setCreateMsg("");
                  setBarrierMsg("");
                  setCreatedSession(null);
                  setPendingManualEntryRfid(false);
                  activeIngestIdRef.current = null;
                }}
                onOpenBarrier={manualOpenBarrier}
                onRescan={() => {
                  setPhase("idle");
                  setCreateMsg("");
                  setScanUid("");
                  setScanPhase("idle");
                  setScannedCardInfo(null);
                  void startScan();
                }}
                cardInfo={scannedCardInfo}
              />
            ) : !activeIngest ? (
              <WaitingCard
                direction="in"
                scanPhase={scanPhase}
                onStartScan={startScan}
                onCancelScan={cancelScan}
                onManualRfidFailure={pendingManualEntryRfid ? handleEntryRfidException : undefined}
                scanError={scanError}
                showManualEntryForm={showManualEntryForm}
                manualEntryPlate={manualEntryPlate}
                manualEntryError={manualEntryError}
                manualEntryLoading={manualEntryLoading}
                manualEntryVehicle={manualEntryVehicle}
                onToggleManualEntryForm={() => {
                  setShowManualEntryForm((v) => !v);
                  setManualEntryError("");
                }}
                onManualEntryPlateChange={(v) => {
                  setManualEntryPlate(v.toUpperCase());
                  setManualEntryError("");
                }}
                onSubmitManualEntry={() => void startManualEntryRfidFlow()}
                onOpenVerifiedMember={() => void createSessionManual(manualEntryVehicle?.cardUid, manualEntryPlate)}
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
                showManualEntry={showIngestManualEntry || !activeIngest.plate}
                manualPlate={manualPlate}
                manualPlateError={manualPlateError}
                onOpenManualEntry={openIngestManualEntry}
                onCancelManualEntry={cancelIngestManualEntry}
                onManualPlateChange={(v) => {
                  setManualPlate(v.toUpperCase());
                  setManualPlateError("");
                }}
                onConfirmManualEntry={() =>
                  void createSessionManual(
                    scanPhase === "success" ? scanUid || undefined : undefined,
                    manualPlate,
                    { fromIngestCorrection: true },
                  )
                }
              />
            )}
          </div>
        </section>

        <section className="staff-desk__gate staff-desk__gate--exit">
          <GateCamera
            title="Cổng ra"
            streamUrl={`${bridgeBaseUrl}/video_feed/${laneRoles.exitLane}`}
            direction="out"
          />
          <div className="staff-desk__panel">
            {!activeExit ? (
              <WaitingCard
                direction="out"
                showManualExitForm={showManualExitForm}
                manualExitPlate={manualExitPlate}
                manualExitError={manualExitError}
                manualExitLoading={manualExitLoading}
                onToggleManualExitForm={() => {
                  setShowManualExitForm((v) => !v);
                  setManualExitError("");
                }}
                onManualExitPlateChange={(v) => {
                  setManualExitPlate(v.toUpperCase());
                  setManualExitError("");
                }}
                onSubmitManualExit={() => void prepareManualExit()}
              />
            ) : (
              <ExitCard
                event={activeExit}
                mismatch={exitMismatch}
                mismatchPending={exitMismatchPending}
                mismatchError={exitMismatchError}
                onRetryMismatch={retryExitScan}
                onRejectMismatch={() => void rejectExitMismatch()}
                onResolveMismatch={resolveExitMismatch}
                onManualMissingEntryRfid={resolveMissingEntryRfid}
                onDismiss={() => {
                  void dismissActiveExit();
                }}
                onOpenBarrier={openExitBarrier}
                onScanRfid={startExitScan}
                scanPhase={exitScanPhase}
                exitVerifyData={exitVerifyData}
                paymentData={exitPaymentData}
                onOpenGate={
                  exitVerifyData?.canOpenGate ? openExitBarrier : undefined
                }
                onPayCash={(receivedAmount) => void payExitCash(receivedAmount)}
                onPayPayos={() =>
                  void createExitPayment(
                    exitVerifyData?.amountDue ?? activeExit?.fee ?? 0,
                  )
                }
                scanUid={exitScanUid}
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
  onManualRfidFailure,
  scanError,
  showManualExitForm,
  manualExitPlate,
  manualExitError,
  manualExitLoading,
  onToggleManualExitForm,
  onManualExitPlateChange,
  onSubmitManualExit,
  showManualEntryForm,
  manualEntryPlate,
  manualEntryError,
  manualEntryLoading,
  manualEntryVehicle,
  onToggleManualEntryForm,
  onManualEntryPlateChange,
  onSubmitManualEntry,
  onOpenVerifiedMember,
}: {
  direction: "in" | "out";
  scanPhase?: "idle" | "starting" | "waiting" | "success" | "timeout" | "error";
  onStartScan?: () => void;
  onCancelScan?: () => void;
  onManualRfidFailure?: () => void;
  scanError?: string;
  showManualExitForm?: boolean;
  manualExitPlate?: string;
  manualExitError?: string;
  manualExitLoading?: boolean;
  onToggleManualExitForm?: () => void;
  onManualExitPlateChange?: (value: string) => void;
  onSubmitManualExit?: () => void;
  showManualEntryForm?: boolean;
  manualEntryPlate?: string;
  manualEntryError?: string;
  manualEntryLoading?: boolean;
  manualEntryVehicle?: { ownerName?: string; isSubscriber?: boolean; cardUid?: string } | null;
  onToggleManualEntryForm?: () => void;
  onManualEntryPlateChange?: (value: string) => void;
  onSubmitManualEntry?: () => void;
  onOpenVerifiedMember?: () => void;
}) {
  const isEntry = direction === "in";
  const showManualForm = isEntry ? showManualEntryForm : showManualExitForm;
  const manualPlateValue = isEntry ? manualEntryPlate : manualExitPlate;
  const manualError = isEntry ? manualEntryError : manualExitError;
  const manualLoading = isEntry ? manualEntryLoading : manualExitLoading;
  const onToggleManual = isEntry ? onToggleManualEntryForm : onToggleManualExitForm;
  const onManualPlateChange = isEntry
    ? onManualEntryPlateChange
    : onManualExitPlateChange;
  const onSubmitManual = isEntry ? onSubmitManualEntry : onSubmitManualExit;
  const plateInputId = isEntry ? "manual-entry-plate" : "manual-exit-plate";
  const submitLabel = isEntry ? "Xác Nhận" : "Xác nhận biển số";
  const loadingLabel = isEntry ? "Đang tạo…" : "Đang tra…";

  // Entry manual form: simple confirm plate screen (wireframe)
  if (isEntry && showManualForm) {
    return (
      <div className="staff-desk__waiting staff-desk__waiting--entry staff-desk__waiting--manual-confirm">
        <p className="staff-desk__manual-confirm-title">
          Vui lòng nhập chính xác biển số xe hiện tại ở cổng chờ
        </p>
        <form
          className="staff-desk__manual-confirm-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitManual?.();
          }}
        >
          <input
            id={plateInputId}
            className="staff-desk__manual-confirm-input"
            value={manualPlateValue || ""}
            onChange={(e) => onManualPlateChange?.(e.target.value)}
            placeholder="30A34567"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {manualError ? (
            <p className="staff-desk__hint staff-desk__hint--danger">
              {manualError}
            </p>
          ) : null}
          <button
            type="submit"
            className="btn btn-primary staff-desk__manual-confirm-submit"
            disabled={Boolean(manualLoading)}
          >
            {manualLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> {loadingLabel}
              </>
            ) : (
              "Xác Nhận"
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost staff-desk__manual-confirm-cancel"
            onClick={onToggleManual}
            disabled={Boolean(manualLoading)}
          >
            Quay lại
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      className={
        "staff-desk__waiting" +
        (isEntry ? " staff-desk__waiting--entry" : " staff-desk__waiting--exit")
      }
    >
      <div className="staff-desk__waiting-icon">
        {isEntry ? (
          <ScanLine size={40} className="animate-pulse" />
        ) : (
          <ArrowUpFromLine size={40} className="animate-pulse" />
        )}
      </div>
      <h2>{isEntry ? "Đang chờ xe vào" : "Đang chờ xe ra"}</h2>
      <p>
        Nếu camera không thể nhận diện biển số hãy dùng nút nhập thủ công biển số xe
      </p>

      {isEntry && manualEntryPlate && !showManualForm ? (
        <div className="staff-desk__manual-vehicle-details">
          <strong>Thông tin biển số {manualEntryPlate}</strong>
          {manualEntryVehicle?.ownerName ? (
            <span>Chủ xe: {manualEntryVehicle.ownerName}</span>
          ) : (
            <span>Chủ xe: Khách vãng lai (chưa có hồ sơ đăng ký)</span>
          )}
          {manualEntryVehicle?.isSubscriber ? <span>Gói thành viên đang hiệu lực</span> : null}
          {manualEntryVehicle?.cardUid ? <span>RFID Member: {manualEntryVehicle.cardUid}</span> : null}
        </div>
      ) : null}

      <div className="staff-desk__exit-idle-actions">
        {isEntry && manualEntryVehicle?.cardUid && !showManualForm ? (
          <button type="button" className="btn btn-primary staff-desk__exit-manual-btn" onClick={onOpenVerifiedMember} disabled={Boolean(manualLoading)}>
            Mở barie cho xe thành viên
          </button>
        ) : null}
        {!showManualForm ? (
          <button
            type="button"
            className="btn btn-primary staff-desk__exit-manual-btn"
            onClick={onToggleManual}
          >
            Nhập thủ công biển số xe
          </button>
        ) : (
          <form
            className="staff-desk__exit-manual-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitManual?.();
            }}
          >
            <label className="staff-desk__exit-manual-label" htmlFor={plateInputId}>
              Biển số xe
            </label>
            <input
              id={plateInputId}
              className="staff-desk__exit-manual-input"
              value={manualPlateValue || ""}
              onChange={(e) => onManualPlateChange?.(e.target.value)}
              placeholder="VD: 30A12345"
              autoFocus
              autoComplete="off"
            />
            {manualError ? (
              <p className="staff-desk__hint staff-desk__hint--danger">
                {manualError}
              </p>
            ) : null}
            <div className="staff-desk__exit-manual-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={Boolean(manualLoading)}
              >
                {manualLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> {loadingLabel}
                  </>
                ) : (
                  submitLabel
                )}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onToggleManual}
                disabled={Boolean(manualLoading)}
              >
                Hủy
              </button>
            </div>
          </form>
        )}
      </div>

      {isEntry && onStartScan && !showManualForm ? (
        <div className="staff-desk__action" style={{ marginTop: "0.75rem" }}>
          {scanPhase === "waiting" || scanPhase === "starting" ? (
            <div className="staff-desk__scan-active">
              <div className="staff-desk__scan-pulse">
                <Nfc size={28} className="animate-pulse" />
              </div>
              <p>Đang chờ quẹt thẻ RFID…</p>
              <button className="btn btn-ghost" onClick={onCancelScan}>
                Hủy
              </button>
              {onManualRfidFailure ? (
                <button className="btn btn-ghost" onClick={onManualRfidFailure}>
                  RFID không đọc được
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={onStartScan}>
                <Nfc size={16} /> Quét thẻ RFID
              </button>
              {onManualRfidFailure ? (
                <button className="btn btn-ghost" onClick={onManualRfidFailure}>
                  RFID không đọc được
                </button>
              ) : null}
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
      ) : null}
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
  plateConfirmed = false,
  onPlateChange,
  onConfirm,
  onDismiss,
  onOpenBarrier,
  onRescan,
  cardInfo,
}: {
  scanUid: string;
  manualPlate: string;
  manualPlateError: string;
  phase: Phase;
  createMsg: string;
  barrierMsg: string;
  createdSession: { id: string; slot?: string; plate?: string } | null;
  plateConfirmed?: boolean;
  onPlateChange: (v: string) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onOpenBarrier: () => void;
  onRescan: () => void;
  cardInfo?: {
    card: { uid: string; cardType: string; status: string; ownerName: string; plate: string } | null;
    vehicle: { ownerName: string; plate: string; status: string } | null;
    isSubscriber: boolean;
    subscription: { planName: string; endDate: string } | null;
    activeSession: { plate: string; checkInAt: string } | null;
    plateActiveSession: { plate: string; checkInAt: string } | null;
  } | null;
}) {
  const blockingSession = cardInfo?.activeSession ?? cardInfo?.plateActiveSession;
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
            {cardInfo?.card
              ? "Thẻ đã tra cứu — đối chiếu biển số với xe tại cổng rồi xác nhận"
              : plateConfirmed
                ? "RFID đã đọc — xác nhận để tạo phiên và mở barie"
                : "Camera chưa nhận biển số — nhập thủ công"}
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

      {cardInfo ? (
        <div className="staff-desk__rfid-conflict" role="status" style={{ marginTop: "0.5rem" }}>
          {cardInfo.card ? (
            <>
              <div className="staff-desk__rfid-conflict-title">
                <Nfc size={15} />
                {cardInfo.card.cardType === "member" ? "Thẻ Member" : "Thẻ Guest"} ·{" "}
                {cardInfo.card.status}
              </div>
              <div className="staff-desk__rfid-conflict-grid">
                <div>
                  <span>UID</span>
                  <strong>{cardInfo.card.uid}</strong>
                </div>
                {cardInfo.card.plate || cardInfo.vehicle?.plate ? (
                  <div>
                    <span>Biển đăng ký</span>
                    <strong>{cardInfo.vehicle?.plate || cardInfo.card.plate}</strong>
                  </div>
                ) : null}
                {cardInfo.vehicle?.ownerName || cardInfo.card.ownerName ? (
                  <div>
                    <span>Chủ xe</span>
                    <strong>{cardInfo.vehicle?.ownerName || cardInfo.card.ownerName}</strong>
                  </div>
                ) : null}
                {cardInfo.subscription ? (
                  <div>
                    <span>Gói thành viên</span>
                    <strong>
                      {cardInfo.subscription.planName} (đến{" "}
                      {new Date(cardInfo.subscription.endDate).toLocaleDateString("vi-VN")})
                    </strong>
                  </div>
                ) : (
                  <div>
                    <span>Gói thành viên</span>
                    <strong>{cardInfo.isSubscriber ? "Có" : "Không"}</strong>
                  </div>
                )}
              </div>
              {cardInfo.activeSession ? (
                <p style={{ color: "#dc2626" }}>
                  Thẻ đang gắn phiên của xe <strong>{cardInfo.activeSession.plate}</strong> (vào{" "}
                  {new Date(cardInfo.activeSession.checkInAt).toLocaleString("vi-VN")}) — không thể
                  cấp cho xe mới.
                </p>
              ) : null}
              {cardInfo.plateActiveSession ? (
                <p style={{ color: "#dc2626" }}>
                  Xe <strong>{cardInfo.plateActiveSession.plate}</strong> vẫn còn phiên đang gửi (vào{" "}
                  {new Date(cardInfo.plateActiveSession.checkInAt).toLocaleString("vi-VN")}) — cho xe
                  ra trước khi vào lại.
                </p>
              ) : null}
            </>
          ) : (
            <p>Không tìm thấy thẻ này trong hệ thống.</p>
          )}
        </div>
      ) : null}

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
              readOnly={plateConfirmed}
            />
            {manualPlateError && (
              <p className="staff-desk__hint staff-desk__hint--danger">
                <CircleAlert size={14} /> {manualPlateError}
              </p>
            )}
          </label>
          {plateConfirmed && phase === "error" ? (
            <button className="btn btn-primary" onClick={onRescan}>
              <Nfc size={16} /> Quét lại RFID
            </button>
          ) : blockingSession ? (
            <>
              <button
                className="btn btn-primary"
                disabled
                title="Biển/thẻ này đang có phiên gửi xe chưa kết thúc"
              >
                <LogIn size={16} /> Đang có phiên — không thể tạo
              </button>
              <button className="btn btn-ghost" onClick={onRescan}>
                <Nfc size={16} /> Quét lại RFID
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={onConfirm}
              disabled={manualPlate.trim().length < 5}
            >
              <LogIn size={16} /> {plateConfirmed ? "Xác nhận & Mở barie" : "Tạo phiên & Mở barie"}
            </button>
          )}
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
  showManualEntry?: boolean;
  manualPlate?: string;
  manualPlateError?: string;
  onOpenManualEntry?: () => void;
  onCancelManualEntry?: () => void;
  onManualPlateChange?: (value: string) => void;
  onConfirmManualEntry?: () => void;
}) {
  const { event } = props;
  const imgUrl = resolveBridgeImageUrl(event.imagePath);
  const expectedRfidUid = typeof event.metadata?.expectedRfidUid === "string" ? event.metadata.expectedRfidUid : "";
  const displayUserType = event.userType === "resident" || Boolean(event.metadata?.isSubscriber) ? "resident" : event.userType;
  const duplicateSession = event.duplicateSession === true || event.action === "duplicate";
  const eventIsStale =
    event.action !== "created" &&
    (event.sessionStatus === "Đang gửi" ||
      event.sessionStatus === "Đã hoàn thành");
  const aiPlateMissing = !event.plate;
  const showManual = Boolean(props.showManualEntry) || aiPlateMissing;
  const rfidConflict = parseRfidConflict(props.scanError);
  const canConfirmManual =
    (props.manualPlate || "").trim().replace(/[\s-]+/g, "").length >= 5 &&
    props.phase !== "creating" &&
    props.phase !== "opening";

  return (
    <div className="staff-desk__ingest">
      <div className="staff-desk__ingest-head">
        <div>
          <span className="staff-desk__chip staff-desk__chip--in">
            <LogIn size={12} /> Xe vào
          </span>
          <h2 className="staff-desk__plate">
            {event.detectedPlate || event.plate || "Chưa nhận diện biển"}
          </h2>
          {event.plate && event.plate !== event.detectedPlate && (
            <p className="staff-desk__plate-sub">
              Khớp với biển đã đăng ký: <strong>{event.plate}</strong>
            </p>
          )}
          {aiPlateMissing ? (
            <p className="staff-desk__plate-sub staff-desk__hint--warn">
              AI chưa đọc được biển — nhập thủ công bên dưới
            </p>
          ) : null}
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
          <img src={imgUrl} alt={`Biển số ${event.detectedPlate || "chưa rõ"}`} />
        </div>
      ) : (
        <div className="staff-desk__ingest-img staff-desk__ingest-img--empty">
          <Camera size={32} />
          <span>Không có ảnh crop</span>
        </div>
      )}

      <div className="staff-desk__meta">
        <MetaRow
          icon={<Radio size={14} />}
          label="Loại xe"
          value={
            displayUserType === "resident"
              ? "Cư dân"
              : displayUserType === "guest"
                ? "Khách vãng lai"
                : "Chưa rõ"
          }
        />
        <MetaRow
          icon={<ArrowDownToLine size={14} />}
          label="Thời gian"
          value={formatTime(event.createdAt)}
        />
        {expectedRfidUid && (
          <MetaRow icon={<Nfc size={14} />} label="RFID Member dự kiến" value={expectedRfidUid} />
        )}
        {(event.ownerName || displayUserType === "resident") && (
          <MetaRow
            icon={<CreditCard size={14} />}
            label="Chủ xe"
            value={event.ownerName || "Chưa xác định"}
          />
        )}
      </div>

      {/* Khu vực quét thẻ + xác nhận / nhập biển thủ công */}
      {!eventIsStale && !duplicateSession && (
        <div className="staff-desk__action">
          {showManual ? (
            <form
              className="staff-desk__ingest-manual"
              onSubmit={(e) => {
                e.preventDefault();
                if (canConfirmManual) props.onConfirmManualEntry?.();
              }}
            >
              <p className="staff-desk__ingest-manual-title">
                {aiPlateMissing
                  ? "Nhập biển số xe thủ công"
                  : "Sửa biển số AI nhận sai"}
              </p>
              <input
                className="staff-desk__manual-confirm-input"
                value={props.manualPlate || ""}
                onChange={(e) =>
                  props.onManualPlateChange?.(e.target.value.toUpperCase())
                }
                placeholder="30A34567"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                disabled={
                  props.phase === "creating" || props.phase === "opening"
                }
              />
              {props.manualPlateError ? (
                <p className="staff-desk__hint staff-desk__hint--danger">
                  <CircleAlert size={14} /> {props.manualPlateError}
                </p>
              ) : null}
              {props.scanPhase === "success" && props.scanUid ? (
                <p className="staff-desk__hint">
                  RFID: <code>{props.scanUid}</code>
                </p>
              ) : (
                <p className="staff-desk__hint staff-desk__hint--warn">
                  Có thể xác nhận không cần RFID (ghi nhận chưa quẹt thẻ).
                </p>
              )}
              <div className="staff-desk__exit-manual-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!canConfirmManual}
                >
                  {props.phase === "creating" || props.phase === "opening" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Đang
                      xử lý…
                    </>
                  ) : (
                    <>
                      <LogIn size={16} /> Xác Nhận
                    </>
                  )}
                </button>
                {!aiPlateMissing ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={props.onCancelManualEntry}
                    disabled={
                      props.phase === "creating" || props.phase === "opening"
                    }
                  >
                    Hủy
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <>
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
                    <Nfc size={18} /> {props.scanPhase === "error" ? "Quét lại RFID" : "Quét thẻ nhân viên"}
                  </button>
                  {props.scanPhase === "timeout" && (
                    <p className="staff-desk__hint staff-desk__hint--warn">
                      Hết thời gian chờ quét thẻ.
                    </p>
                  )}
                  {props.scanPhase === "error" && props.scanError && (
                    rfidConflict ? (
                      <div className="staff-desk__rfid-conflict" role="alert">
                        <div className="staff-desk__rfid-conflict-title"><CircleAlert size={15} /> Không thể cấp RFID Guest cho xe này</div>
                        <div className="staff-desk__rfid-conflict-grid">
                          <div><span>UID RFID</span><strong>{rfidConflict.uid}</strong></div>
                          <div><span>Đã cấp cho xe</span><strong>{rfidConflict.assignedPlate}</strong></div>
                          <div><span>Thời gian vào</span><strong>{rfidConflict.checkInAt}</strong></div>
                        </div>
                        <p>Thẻ đang gắn với phiên của xe <strong>{rfidConflict.assignedPlate}</strong>, nên không thể cấp tiếp cho xe <strong>{rfidConflict.attemptedPlate}</strong>.</p>
                      </div>
                    ) : (
                      <p className="staff-desk__hint staff-desk__hint--danger"><CircleAlert size={14} /> {props.scanError}</p>
                    )
                  )}
                </div>
              )}

              {props.phase === "idle" || props.phase === "error" ? (
                <button
                  type="button"
                  className="btn btn-ghost staff-desk__exit-manual-btn"
                  onClick={props.onOpenManualEntry}
                  style={{ marginTop: "0.5rem" }}
                >
                  Nhập thủ công biển số xe
                </button>
              ) : null}
            </>
          )}

          {/* Trạng thái tạo phiên / mở barie */}
          {props.phase !== "idle" && !showManual && (
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
                  {props.createdSession?.plate
                    ? ` · ${props.createdSession.plate}`
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
          {props.phase !== "idle" && showManual && props.phase !== "creating" && props.phase !== "opening" ? (
            <div
              className={`staff-desk__progress staff-desk__progress--${props.phase}`}
            >
              {props.phase === "done" && (
                <p className="text-emerald-600">
                  <CheckCircle2 size={16} /> Hoàn tất
                  {props.createdSession?.plate
                    ? ` · ${props.createdSession.plate}`
                    : ""}
                </p>
              )}
              {props.phase === "error" && (
                <p className="text-rose-600">
                  <CircleAlert size={16} />{" "}
                  {props.createMsg || props.barrierMsg || "Có lỗi."}
                </p>
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
          ) : null}
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
  mismatch,
  mismatchPending,
  mismatchError,
  onRetryMismatch,
  onRejectMismatch,
  onResolveMismatch,
  onManualMissingEntryRfid,
  onPayCash,
  onPayPayos,
  scanUid,
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
  mismatch?: ExitMismatch | null;
  mismatchPending?: boolean;
  mismatchError?: string;
  onRetryMismatch?: () => void;
  onRejectMismatch?: () => void;
  onResolveMismatch?: (
    action: string,
    manualPlate: string,
    note: string,
  ) => void;
  onManualMissingEntryRfid?: (note: string) => void;
  onPayCash?: (receivedAmount: number) => void;
  onPayPayos?: () => void;
  scanUid?: string;
}) {
  const imgUrl = resolveBridgeImageUrl(event.imagePath);
  const didCheckout = event.sessionStatus === "Đã hoàn thành";
  const noSession = event.action === "no_session";
  const hasPaymentData = Boolean(paymentData && paymentData.amount > 0);
  const entryRfidUid =
    typeof event.metadata?.entryRfidUid === "string"
      ? event.metadata.entryRfidUid
      : event.rfidUid || scanUid;
  const entryRfidIsExpected = event.metadata?.entryRfidExpected === true;
  const exitRfidManualNote =
    typeof event.metadata?.exitRfidManualNote === "string"
      ? event.metadata.exitRfidManualNote
      : "";
  const exitRfidManuallyVerified =
    event.metadata?.exitRfidManualVerified === true;
  const [showManualRfidForm, setShowManualRfidForm] = useState(false);
  const [showCashForm, setShowCashForm] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [manualRfidNote, setManualRfidNote] = useState("");
  // Older camera events may not include `entryRfidUnverified`; the absence of
  // an entry UID itself is the authoritative condition for manual review.
  const canHandleMissingEntryRfid =
    !entryRfidUid && !didCheckout && !event.barrierOpened;

  const amountDue = exitVerifyData?.amountDue ?? event.fee ?? 0;
  const receivedAmount = Number(cashReceived.replace(/[^0-9]/g, "")) || 0;
  const cashChange = Math.max(0, receivedAmount - amountDue);
  const isSubscriber = exitVerifyData?.isSubscriber ?? false;
  const customerType =
    event.metadata?.customerType === "member" || event.userType === "resident"
      ? "member"
      : "guest";
  const displayOwnerName = event.ownerName || "—";
  const vehicleTypeLabel =
    typeof event.metadata?.vehicleType === "string" && event.metadata.vehicleType
      ? String(event.metadata.vehicleType)
      : customerType === "member"
        ? "Thành viên"
        : "Khách vãng lai";

  const barrierStatus = event.barrierOpened
    ? "Đang mở"
    : didCheckout
      ? "Đã mở"
      : "Đang đóng";

  const paymentLabel = (() => {
    const normalize = (value?: string | null) =>
      String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const statusFrom = (value?: string | null) => {
      const ps = normalize(value);
      if (!ps) return null;
      if (
        ps.includes("unpaid") ||
        ps.includes("pending") ||
        ps.includes("chua") ||
        ps.includes("partial")
      ) {
        return "Chưa thanh toán";
      }
      if (
        ps.includes("fully_paid") ||
        ps.includes("paid") ||
        ps.includes("da thanh toan") ||
        ps.includes("complete")
      ) {
        return "Đã thanh toán";
      }
      return null;
    };

    if (didCheckout) return "Đã thanh toán";
    // A valid member package has no payable balance, even if the legacy
    // session status was not updated from `unpaid`.
    // Owning an RFID card does not grant a free package; only an active
    // subscription should be labeled as free.
    if (isSubscriber) {
      return "Miễn phí (thành viên)";
    }

    const fromVerify = statusFrom(exitVerifyData?.paymentStatus);
    if (fromVerify) return fromVerify;

    const fromSession = statusFrom(event.sessionPaymentStatus);
    if (fromSession) return fromSession;

    if (typeof amountDue === "number") {
      if (amountDue > 0) return "Chưa thanh toán";
      if (amountDue === 0 && (exitVerifyData || event.fee != null)) {
        return "Đã thanh toán";
      }
    }

    return "—";
  })();

  const feeLabel = (() => {
    if (exitVerifyData) {
      if (isSubscriber) return "0đ (thành viên)";
      return amountDue.toLocaleString("vi-VN") + "đ";
    }
    if (didCheckout) return "Đã checkout";
    if (event.fee != null) return Number(event.fee).toLocaleString("vi-VN") + "đ";
    return "—";
  })();

  const paymentTone =
    paymentLabel === "Đã thanh toán" || paymentLabel.includes("Miễn phí")
      ? "ok"
      : paymentLabel === "Chưa thanh toán"
        ? "warn"
        : "muted";
  const barrierTone = barrierStatus === "Đang đóng" ? "warn" : "ok";

  const needsPaymentChoice =
    Boolean(exitVerifyData) &&
    !isSubscriber &&
    amountDue > 0 &&
    !exitVerifyData?.canOpenGate &&
    !hasPaymentData &&
    !didCheckout &&
    !event.barrierOpened &&
    !noSession &&
    !mismatch;

  const rfidPrompt = (() => {
    if (mismatch) return "Cần xử lý sai lệch trước khi quẹt thẻ";
    if (didCheckout || event.barrierOpened) return "Xe đã được cho ra";
    if (needsPaymentChoice) return "Quét Thẻ RFID Thành Công";
    if (hasPaymentData) return "Thanh toán qua PAYOS";
    if (scanPhase === "starting" || scanPhase === "waiting") {
      return "Hãy đặt thẻ RFID của khách vào đầu đọc";
    }
    if (scanPhase === "success" && !exitVerifyData) return "Đang xác minh thẻ RFID…";
    if (scanPhase === "error") return "Thẻ không hợp lệ — quét lại";
    if (scanPhase === "timeout") return "Hết thời gian — quét lại thẻ RFID";
    if (exitVerifyData?.canOpenGate) return "Thẻ hợp lệ — có thể mở barie";
    return "Hãy đặt thẻ RFID của khách vào đầu đọc";
  })();

  return (
    <div className="staff-desk__exit-console">
      <div className="staff-desk__exit-top">
        <div className="staff-desk__exit-title-row">
          <div>
            <p className="staff-desk__exit-kicker">
              Xe ra - {customerType === "member" ? "Thành Viên" : "Khách Vãng Lai"}
            </p>
            <h2 className="staff-desk__exit-plate">
              {event.detectedPlate || event.plate || "—"}
            </h2>
          </div>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={onDismiss}
            aria-label="Bỏ qua"
            title="Bỏ qua xe hiện tại"
          >
            <XCircle size={16} />
          </button>
        </div>

        {mismatch && onRetryMismatch && onRejectMismatch && onResolveMismatch ? (
          <ExitMismatchPanel
            mismatch={mismatch}
            pending={Boolean(mismatchPending)}
            error={mismatchError || ""}
            onRetry={onRetryMismatch}
            onReject={onRejectMismatch}
            onResolve={onResolveMismatch}
          />
        ) : null}

        {!mismatch ? (
          imgUrl ? (
            <div className="staff-desk__exit-crop">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl}
                alt={"Biển số " + (event.detectedPlate || "")}
              />
            </div>
          ) : (
            <div className="staff-desk__exit-crop staff-desk__exit-crop--empty">
              <Camera size={28} />
              <span>Hình ảnh crop biển số xe</span>
            </div>
          )
        ) : null}

        {!mismatch ? (
          <div className="staff-desk__exit-grid">
            <div className="staff-desk__exit-field">
              <span className="staff-desk__exit-label">ID PHIÊN</span>
              <strong>{event.sessionId || "—"}</strong>
            </div>
            <div className="staff-desk__exit-field">
              <span className="staff-desk__exit-label">Thời gian vào</span>
              <strong>{formatDateTime(event.checkInAt)}</strong>
            </div>
            <div className="staff-desk__exit-field">
              <span className="staff-desk__exit-label">Thời gian ra</span>
              <strong>{formatDateTime(event.createdAt)}</strong>
            </div>
            <div className="staff-desk__exit-field">
              <span className="staff-desk__exit-label">Loại xe</span>
              <strong>{vehicleTypeLabel}</strong>
            </div>
            <div className="staff-desk__exit-field">
              <span className="staff-desk__exit-label">Tên chủ xe</span>
              <strong>{displayOwnerName}</strong>
            </div>
            <div className="staff-desk__exit-field">
              <span className="staff-desk__exit-label">Phí phiên gửi xe</span>
              <strong>{feeLabel}</strong>
            </div>
            <div className="staff-desk__exit-field">
              <span className="staff-desk__exit-label">Trạng thái barie</span>
              <strong
                className={
                  "staff-desk__exit-status staff-desk__exit-status--" +
                  barrierTone
                }
              >
                {barrierStatus}
              </strong>
            </div>
            <div className="staff-desk__exit-field">
              <span className="staff-desk__exit-label">Trạng thái thanh toán</span>
              <strong
                className={
                  "staff-desk__exit-status staff-desk__exit-status--" +
                  paymentTone
                }
              >
                {paymentLabel}
              </strong>
            </div>
            <div className="staff-desk__exit-field">
              <span className="staff-desk__exit-label">UID Thẻ RFID Lúc Vào</span>
              <strong className="staff-desk__exit-status staff-desk__exit-status--muted">
                {entryRfidUid
                  ? entryRfidIsExpected
                    ? `${entryRfidUid} (chưa xác minh)`
                    : entryRfidUid
                  : "Chưa đọc"}
              </strong>
            </div>
            <div className="staff-desk__exit-field">
              <span className="staff-desk__exit-label">UID Thẻ RFID Lúc Ra</span>
              <strong className="staff-desk__exit-status staff-desk__exit-status--muted">
                {scanUid || (exitRfidManuallyVerified ? "Xác nhận thủ công" : "Chưa quẹt thẻ")}
              </strong>
            </div>
            {exitRfidManuallyVerified ? (
              <div className="staff-desk__exit-field staff-desk__exit-field--full">
                <span className="staff-desk__exit-label">Ghi chú xử lý RFID</span>
                <strong className="staff-desk__exit-status staff-desk__exit-status--muted">
                  {exitRfidManualNote || "Đã xác nhận thủ công do RFID lỗi."}
                </strong>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!mismatch ? (
        <div className="staff-desk__exit-rfid">
          <div className="staff-desk__exit-rfid-card">
            {!entryRfidUid && (exitRfidManuallyVerified || Boolean(exitRfidManualNote)) && (event.fee ?? 0) <= 0 ? (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={onOpenGate || onOpenBarrier}
                disabled={didCheckout || event.barrierOpened}
              >
                <ArrowUpFromLine size={18} /> Mở barie
              </button>
            ) : exitRfidManuallyVerified && needsPaymentChoice ? null : (
              <p className="staff-desk__exit-rfid-prompt">{rfidPrompt}</p>
            )}

            {noSession ? (
              <div className="staff-desk__alert staff-desk__alert--danger">
                <CircleAlert size={18} />
                <span>Không tìm thấy phiên đang gửi cho biển số này.</span>
              </div>
            ) : null}

            {canHandleMissingEntryRfid && !exitVerifyData && !hasPaymentData ? (
              <div className="staff-desk__manual-rfid">
                <p>Không có UID RFID lúc vào. Nhân viên có thể xác nhận thủ công sau khi kiểm tra xe và biển số.</p>
                {!showManualRfidForm ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowManualRfidForm(true)}
                  >
                    Xử lý thủ công
                  </button>
                ) : (
                  <div className="staff-desk__manual-rfid-form">
                    <textarea
                      rows={2}
                      value={manualRfidNote}
                      onChange={(event) => setManualRfidNote(event.target.value)}
                      placeholder="Ghi rõ lý do xác nhận thủ công (tối thiểu 8 ký tự)"
                    />
                    <div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={mismatchPending || manualRfidNote.trim().length < 8}
                        onClick={() => onManualMissingEntryRfid?.(manualRfidNote.trim())}
                      >
                        {mismatchPending ? <Loader2 size={16} className="animate-spin" /> : null}
                        Xác nhận thủ công
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setShowManualRfidForm(false)}>
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {didCheckout || event.barrierOpened ? (
              <div className="staff-desk__alert staff-desk__alert--success">
                <CheckCircle2 size={18} />
                <span>
                  {event.barrierOpened
                    ? "Barie đã mở — xe có thể ra."
                    : "Phiên đã hoàn tất."}
                </span>
              </div>
            ) : needsPaymentChoice ? (
              <>
              <div className="staff-desk__exit-pay-choice">
                <p className="staff-desk__exit-pay-question">
                  Khách cần thanh toán bằng hình thức nào
                </p>
                <div className="staff-desk__exit-pay-buttons">
                  <button
                    type="button"
                    className="btn btn-ghost staff-desk__exit-pay-btn"
                    onClick={() => setShowCashForm(true)}
                    disabled={!onPayCash}
                  >
                    Thanh Toán Tiền Mặt
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost staff-desk__exit-pay-btn"
                    onClick={onPayPayos}
                    disabled={!onPayPayos}
                  >
                    Thanh Toán Qua PAYOS
                  </button>
                </div>
              </div>
              {showCashForm ? (
                <div className="staff-desk__cash-form">
                  <strong>Thu tiền mặt</strong>
                  <span>Phí cần thu: {amountDue.toLocaleString("vi-VN")}đ</span>
                  <label htmlFor="cash-received">Khách đưa</label>
                  <input
                    id="cash-received"
                    inputMode="numeric"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder="VD: 50000"
                    autoFocus
                  />
                  {receivedAmount >= amountDue ? (
                    <span>Tiền thừa trả khách: {cashChange.toLocaleString("vi-VN")}đ</span>
                  ) : cashReceived ? (
                    <span className="staff-desk__cash-form-error">Số tiền khách đưa chưa đủ.</span>
                  ) : null}
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!onPayCash || receivedAmount < amountDue}
                      onClick={() => onPayCash?.(receivedAmount)}
                    >
                      Xác nhận đã thu tiền
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowCashForm(false)}>
                      Hủy
                    </button>
                  </div>
                </div>
              ) : null}
              </>
            ) : hasPaymentData ? (
              showCashForm ? (
                <div className="staff-desk__cash-form">
                  <strong>Thu tiền mặt</strong>
                  <span>Phí cần thu: {amountDue.toLocaleString("vi-VN")}đ</span>
                  <label htmlFor="cash-received-payos">Khách đưa</label>
                  <input
                    id="cash-received-payos"
                    inputMode="numeric"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder="VD: 50000"
                    autoFocus
                  />
                  {receivedAmount >= amountDue ? (
                    <span>Tiền thừa trả khách: {cashChange.toLocaleString("vi-VN")}đ</span>
                  ) : cashReceived ? (
                    <span className="staff-desk__cash-form-error">Số tiền khách đưa chưa đủ.</span>
                  ) : null}
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!onPayCash || receivedAmount < amountDue}
                      onClick={() => onPayCash?.(receivedAmount)}
                    >
                      Xác nhận đã thu tiền
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowCashForm(false)}>
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
              <div className="staff-desk__qr-box">
                <p className="staff-desk__qr-amount">
                  {(paymentData?.amount || amountDue).toLocaleString("vi-VN")}đ
                </p>
                {paymentData?.qrCode ? (
                  <div className="staff-desk__qr-frame">
                    <QRCodeSVG
                      value={paymentData.qrCode}
                      size={200}
                      level="M"
                      marginSize={2}
                      className="staff-desk__qr-code"
                      aria-label="Mã QR thanh toán PayOS"
                    />
                  </div>
                ) : null}
                <div className="staff-desk__qr-actions">
                  {paymentData?.checkoutUrl ? (
                    <button
                      className="btn btn-ghost"
                      onClick={() =>
                        window.open(paymentData.checkoutUrl, "_blank")
                      }
                    >
                      Mở link thanh toán
                    </button>
                  ) : null}
                  {onPayCash ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowCashForm(true)}
                    >
                      Đổi sang tiền mặt
                    </button>
                  ) : null}
                </div>
                <p className="staff-desk__hint">Đang chờ thanh toán PayOS…</p>
              </div>
              )
            ) : scanPhase === "starting" || scanPhase === "waiting" ? (
              entryRfidUid ? <div className="staff-desk__exit-rfid-waiting">
                <div className="staff-desk__scan-pulse">
                  <Nfc size={32} className="animate-pulse" />
                </div>
                <span>Đang chờ quét thẻ…</span>
                {onManualMissingEntryRfid && entryRfidUid ? (
                  <div className="staff-desk__manual-rfid-form">
                    <label htmlFor="manual-rfid-note-waiting">Đầu đọc không hoạt động?</label>
                    <textarea id="manual-rfid-note-waiting" value={manualRfidNote} onChange={(event) => setManualRfidNote(event.target.value)} rows={2} placeholder="Nhập lý do xử lý thủ công (tối thiểu 8 ký tự)" />
                    <button className="btn btn-ghost btn-lg" disabled={manualRfidNote.trim().length < 8} onClick={() => onManualMissingEntryRfid(manualRfidNote.trim())}>
                      Xử lý thủ công lỗi RFID
                    </button>
                  </div>
                ) : null}
              </div> : null
            ) : scanPhase === "error" || scanPhase === "timeout" ? (
              <div className="staff-desk__exit-rfid-waiting">
                <div className="staff-desk__alert staff-desk__alert--danger">
                  <XCircle size={18} />
                  <span>
                    {scanPhase === "timeout"
                      ? "Hết thời gian quét thẻ."
                      : "Thẻ không hợp lệ hoặc không khớp."}
                  </span>
                </div>
                {onScanRfid ? (
                  <button className="btn btn-primary btn-lg" onClick={onScanRfid}>
                    <Nfc size={18} /> Quét lại thẻ RFID
                  </button>
                ) : null}
                {onOpenBarrier ? (
                  <div className="staff-desk__manual-rfid-form">
                    <label htmlFor="manual-rfid-note">Lý do xử lý thủ công</label>
                    <textarea
                      id="manual-rfid-note"
                      value={manualRfidNote}
                      onChange={(event) => setManualRfidNote(event.target.value)}
                      placeholder="Ví dụ: Đầu đọc RFID không nhận thẻ..."
                      rows={3}
                    />
                    <button
                      className="btn btn-ghost btn-lg"
                      disabled={manualRfidNote.trim().length < 8 || !onManualMissingEntryRfid}
                      onClick={() => onManualMissingEntryRfid?.(manualRfidNote.trim())}
                    >
                      Xử lý thủ công lỗi RFID
                    </button>
                  </div>
                ) : null}
              </div>
            ) : scanPhase === "success" && !exitVerifyData ? (
              <div className="staff-desk__exit-rfid-waiting">
                <div className="staff-desk__scan-pulse">
                  <Loader2 size={32} className="animate-spin" />
                </div>
                <span>Đang xác minh thẻ RFID…</span>
              </div>
            ) : exitVerifyData ? (
              <div className="staff-desk__exit-rfid-actions">
                <div className="staff-desk__alert staff-desk__alert--success">
                  <CheckCircle2 size={18} />
                  <span>
                    {isSubscriber
                      ? "Thành viên đã xác minh — sẵn sàng mở barie."
                      : "Xác minh thành công — sẵn sàng mở barie."}
                  </span>
                </div>
                <div className="staff-desk__exit-rfid-buttons">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={onOpenGate || onOpenBarrier}
                    disabled={
                      didCheckout ||
                      event.barrierOpened ||
                      !exitVerifyData?.canOpenGate
                    }
                  >
                    <ArrowUpFromLine size={18} />{" "}
                    {event.barrierOpened
                      ? "Barie đã mở"
                      : isSubscriber
                        ? "Mở barie (Miễn phí)"
                        : "Mở barie"}
                  </button>
                  {onScanRfid ? (
                    <button className="btn btn-ghost" onClick={onScanRfid}>
                      <Nfc size={16} /> Quét thẻ khác
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="staff-desk__exit-rfid-waiting">
                <div className="staff-desk__scan-pulse">
                  <Nfc size={32} />
                </div>
                <span>Đang chờ quét thẻ…</span>
                {onScanRfid ? (
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={onScanRfid}
                    disabled={noSession || didCheckout || event.barrierOpened}
                  >
                    <Nfc size={18} /> Quét thẻ RFID
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
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
