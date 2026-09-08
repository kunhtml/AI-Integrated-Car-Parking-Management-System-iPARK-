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
import { logger } from "@/lib/logger";
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
  return {
    uid: match[1],
    assignedPlate: match[2],
    checkInAt: match[3],
    attemptedPlate: match[4],
  };
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
  const [laneRoles, setLaneRoles] = useState({
    entryLane: "in" as "in" | "out",
    exitLane: "out" as "in" | "out",
  });
  useEffect(() => {
    apiFetch("/devices/lane-roles")
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (
          (data.entryLane === "in" || data.entryLane === "out") &&
          (data.exitLane === "in" || data.exitLane === "out")
        ) {
          entryLaneRef.current = data.entryLane;
          exitLaneRef.current = data.exitLane;
          setLaneRoles(data);
        }
      })
      .catch(() => undefined);
  }, []);
  // ====== Camera ingest realtime (SSE) ======
  const {
    latest: pendingIngest,
    latestExitState,
    status: streamStatus,
  } = useCameraIngestEvents();
  const [activeIngest, setActiveIngest] = useState<CameraIngestEvent | null>(
    null,
  );
  const [activeExit, setActiveExit] = useState<CameraIngestEvent | null>(null);
  // Mirror của `activeExit` để effect xử lý SSE không đọc trực tiếp từ state
  // (đưa `activeExit` vào deps sẽ vòng lặp vì chính effect này ghi state đó).
  const activeExitRef = useRef<CameraIngestEvent | null>(null);
  useEffect(() => {
    activeExitRef.current = activeExit;
  }, [activeExit]);
  /** Session IDs staff closed manually; skip restore from /exit/pending in this UI session. */
  const dismissedExitSessionIdsRef = useRef<Set<string>>(new Set());
  // ID của lần `pendingIngest` cuối cùng đã xử lý. AI service phát lại
  // `camera.ingest` cho CÙNG một xe liên tục (mỗi khung hình OCR ~25ms),
  // mỗi lần là một object mới → nếu cập nhật state theo mọi lần thì vòng
  // lặp `setState → re-render → effect chạy lại` làm tràn depth và remount
  // liên tục, lại bắn auto-scan RFID spam `POST /api/rfid/scan/start`.
  // Chỉ xử lý khi đây là event THẬT SỰ mới (id khác), còn lặp cùng id thì bỏ qua.
  const processedIngestIdRef = useRef<string>("");
  useEffect(() => {
    if (!pendingIngest) return;
    // Bỏ qua các frame lặp lại của cùng một event đã vào state.
    if (pendingIngest.id && pendingIngest.id === processedIngestIdRef.current) {
      return;
    }
    processedIngestIdRef.current = pendingIngest.id || "";
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
    const currentExit = activeExitRef.current;
    // Barie vừa mở cho xe ra: bỏ qua ingest mới trong 5s grace. Xe đang
    // đi qua khu vực camera nên vẫn có thể bị nhận diện lại, và ingest đó
    // sẽ thay activeExit làm mất banner "Mở barie thành công".
    if (
      currentExit?.barrierOpened &&
      Date.now() - exitGateOpenedAtRef.current < 5000
    ) {
      return;
    }
    // Re-push theo chu kỳ cho CÙNG phiên đang hiển thị: cập nhật ảnh/fee
    // nhưng GIỮ nguyên trạng thái quét/thanh toán/barie đã mở của staff
    // (khác phiên mới thì reset như bình thường).
    if (currentExit?.sessionId && currentExit.sessionId === sid) {
      setActiveExit((current) => {
        if (!current) return pendingIngest;
        const merged = {
          ...pendingIngest,
          barrierOpened: current.barrierOpened,
        };
        // Nếu không có gì thay đổi (cùng event, cùng trạng thái/ảnh/fee) →
        // trả về `current` để React bỏ qua, tránh tạo object mới mỗi chu kỳ
        // re-push làm tràn update depth.
        if (
          current.id === merged.id &&
          current.barrierOpened === merged.barrierOpened &&
          current.fee === merged.fee &&
          current.imagePath === merged.imagePath &&
          current.exitState === merged.exitState &&
          current.sessionStatus === merged.sessionStatus
        ) {
          return current;
        }
        return merged;
      });
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
      }); // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Timestamp barie vừa mở: giữ màn hình thành công 5s (cho xe đi qua)
  // trước khi cho phép SSE xóa UI.
  const exitGateOpenedAtRef = useRef<number>(0);
  // UID đã auto-create phiên cho luồng nhập tay biển số; chống gọi 2 lần.
  const manualAutoCreateRef = useRef("");
  // Thông tin thẻ tra được theo UID (luồng quét thẻ trước, nhập/đối chiếu biển sau).
  const [scannedCardInfo, setScannedCardInfo] = useState<{
    card: {
      uid: string;
      cardType: string;
      status: string;
      ownerName: string;
      plate: string;
    } | null;
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
  const [entrySuccessNotice, setEntrySuccessNotice] = useState<string | null>(
    null,
  );

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
  const [showEntryRfidExceptionForm, setShowEntryRfidExceptionForm] =
    useState(false);
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
      await bridgeFetch("/api/rfid/scan/cancel", {
        method: "POST",
        body: JSON.stringify({ direction: entryLaneRef.current }),
      });
    } catch {
      /* ignore */
    }
  }, [stopScanPolling]);

  // Fallback khi đầu đọc thật không phản hồi: cho staff nhập UID bằng tay rồi
  // POST vào bridge để bơm thẳng vào scanner state.
  const submitManualUid = useCallback(
    async (uid: string) => {
      const value = uid.trim();
      if (!value) return;
      stopScanPolling();
      setScanError("");
      try {
        const res = await bridgeFetch("/api/rfid/scan/record", {
          method: "POST",
          body: JSON.stringify({
            uid: value,
            direction: entryLaneRef.current,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setScanPhase("error");
          setScanError(data.error || "Không ghi nhận được UID.");
          return;
        }
        setScanUid(value);
        setScanPhase("success");
      } catch (err) {
        setScanPhase("error");
        setScanError("Không kết nối được bridge service (port 5050).");
      }
    },
    [stopScanPolling],
  );

  // Auto-cancel scan khi staff đóng/xử lý xong event hiện tại.
  useEffect(() => {
    return () => {
      stopScanPolling();
      bridgeFetch("/api/rfid/scan/cancel", {
        method: "POST",
        body: JSON.stringify({ direction: entryLaneRef.current }),
      }).catch(() => undefined);
    };
  }, [stopScanPolling]);

  const startScan = useCallback(async () => {
    setScanError("");
    setScanUid("");
    setScannedCardInfo(null);
    setScanPhase("starting");
    try {
      const res = await bridgeFetch("/api/rfid/scan/start", {
        method: "POST",
        body: JSON.stringify({ direction: entryLaneRef.current }),
      });
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
          const poll = await bridgeFetch(
            `/api/rfid/scan/poll?direction=${entryLaneRef.current}`,
          );
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
            const res = await apiFetch(
              `/rfid/by-uid/${encodeURIComponent(scanUid)}`,
            );
            const data = await res.json().catch(() => ({}));
            if (data.ok) {
              setScannedCardInfo(data);
              if (data.card?.cardType === "member" && data.card.plate) {
                setManualPlate(
                  String(data.card.plate)
                    .trim()
                    .toUpperCase()
                    .replace(/[\s-]+/g, ""),
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
  }, [
    scanPhase,
    scanUid,
    activeIngest,
    showIngestManualEntry,
    pendingManualEntryRfid,
    manualPlate,
  ]);

  // Tự động bắt đầu quét RFID khi camera phát hiện xe vào
  useEffect(() => {
    if (!activeIngest || activeIngest.direction !== "in") return;
    // Camera có thể đã tạo session trước, nhưng vẫn phải mở scanner để
    // xác thực/gắn thẻ RFID cho chính xe vừa được nhận diện. Chỉ bỏ qua khi
    // event đã chứa UID RFID thật từ trước.
    if (activeIngest.rfidUid) return;
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
      opts?: {
        fromIdleForm?: boolean;
        fromIngestCorrection?: boolean;
        manualRfidReason?: string;
      },
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
            ? /camera/i.test(opts.manualRfidReason)
              ? opts.manualRfidReason
              : `Camera lỗi, ${opts.manualRfidReason}`
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
        let openRes;
        try {
          openRes = await bridgeFetch(`/gate/${entryLaneRef.current}/open`, {
            method: "POST",
          });
        } catch {
          // Bridge (5050) không phản hồi (CORS/mạng). Phiên ĐÃ tạo OK ở bước
          // trên — chỉ mở barie thất bại, không được báo "lỗi mạng khi tạo phiên".
          setPhase("error");
          setBarrierMsg(
            "Tạo phiên OK nhưng không mở được barie (lỗi kết nối bridge). Bấm mở tay.",
          );
          return;
        }
        if (!openRes.ok) {
          setPhase("error");
          setBarrierMsg(
            `Tạo phiên OK nhưng mở barie thất bại (${openRes.status}). Bấm mở tay.`,
          );
          return;
        }
        setBarrierMsg("Đã tạo phiên thủ công — đã mở barie cổng vào.");
        setPhase("done");
        setEntrySuccessNotice(
          `Đã cho xe ${session.plate || normalized} vào bãi thành công.`,
        );
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
    const normalized = manualEntryPlate
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "");
    if (normalized.length < 5) {
      setManualEntryError("Biển số phải có ít nhất 5 ký tự.");
      return;
    }
    setManualEntryError("");
    setManualEntryLoading(true);
    try {
      const response = await apiFetch(
        `/rfid/by-plate/${encodeURIComponent(normalized)}`,
      );
      const details = await response.json().catch(() => ({}));
      if (!response.ok) {
        setManualEntryError(
          details.message || "Không thể tra cứu thông tin biển số.",
        );
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
        let openRes;
        try {
          openRes = await bridgeFetch(`/gate/${entryLaneRef.current}/open`, {
            method: "POST",
          });
        } catch {
          // Bridge (5050) không phản hồi (CORS/mạng). Phiên ĐÃ tạo OK ở bước
          // trên — chỉ mở barie thất bại, không được báo "lỗi mạng khi tạo phiên".
          setPhase("error");
          setBarrierMsg(
            "Tạo phiên OK nhưng không mở được barie (lỗi kết nối bridge). Bấm mở tay.",
          );
          return;
        }
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
    exitGateOpenedAtRef.current = 0;
    exitVerifiedUidRef.current = "";
    if (exitScanIntervalRef.current !== null) {
      window.clearInterval(exitScanIntervalRef.current);
      exitScanIntervalRef.current = null;
    }
  }, []);

  // Đồng bộ các bàn nhân viên: xóa thẻ xe ra ngay khi một bàn khác hoàn tất
  // hoặc hủy attempt ra của cùng phiên. Không phụ thuộc cache trình duyệt.
  useEffect(() => {
    if (!latestExitState || !activeExit?.sessionId) return;
    if (latestExitState.sessionId !== activeExit.sessionId) return;
    const stillPending =
      latestExitState.status === "Đang gửi" &&
      ["waiting_rfid", "waiting_manual_verification"].includes(
        latestExitState.exitState || "",
      );
    if (!stillPending) {
      // Barie đã mở: timer 5s trong openExitBarrier sẽ đóng UI. Không xóa ở
      // đây để giữ thông báo "Mở barie thành công". SSE này thường về TRƯỚC
      // khi response của openExitBarrier set được trạng thái, nên dùng CẢ
      // flag barrierOpened lẫn timestamp (được đặt TRƯỚC khi gọi API).
      if (activeExit.barrierOpened) return;
      if (
        exitGateOpenedAtRef.current &&
        Date.now() - exitGateOpenedAtRef.current < 5000
      ) {
        return;
      }
      clearExitUi();
    }
  }, [
    activeExit?.sessionId,
    activeExit?.barrierOpened,
    clearExitUi,
    latestExitState,
  ]);

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
    setEntrySuccessNotice(null);
    setCreatedSession(null);
    setScanUid("");
    setScanPhase("idle");
    setManualPlate("");
    setManualPlateError("");
    setShowIngestManualEntry(false);
    activeIngestIdRef.current = null;
    autoScanFiredRef.current = false;
  }, []);

  // Giữ kết quả thành công đủ lâu để staff nhìn thấy, rồi trả cổng vào về
  // trạng thái chờ cho xe kế tiếp. Không áp dụng khi tạo phiên còn lỗi/dở dang.
  useEffect(() => {
    if (phase !== "done" || !createdSession) return;
    const timer = window.setTimeout(dismissActive, 3000);
    return () => window.clearTimeout(timer);
  }, [createdSession, dismissActive, phase]);

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
      const res = await bridgeFetch(`/gate/${entryLaneRef.current}/open`, {
        method: "POST",
      });
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
    // Đánh dấu "đang mở barie" TRƯỚC khi gọi API. SSE (phiên không còn
    // pending) thường về TRƯỚC response của open-gate; nếu không đánh dấu
    // trước, hiệu ứng SSE sẽ xóa UI ngay, làm mất banner "Mở barie thành
    // công" và không kịp chờ 5s.
    exitGateOpenedAtRef.current = Date.now();
    try {
      const res = await apiFetch("/exit/open-gate", {
        method: "POST",
        body: JSON.stringify({ sessionId: activeExit.sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setExitScanPhase("success");
        setExitScanError("");
        exitGateOpenedAtRef.current = Date.now();
        setActiveExit((current) =>
          current ? { ...current, barrierOpened: true } : current,
        );
        // Auto-dismiss ExitCard sau 5 giây (banner thành công giữ cho xe đi qua)
        window.setTimeout(() => {
          exitGateOpenedAtRef.current = 0;
          clearExitUi();
        }, 5000);
      } else {
        exitGateOpenedAtRef.current = 0;
        setExitScanPhase("error");
        setExitScanError(
          data.message ||
            "Không mở được barie. Kiểm tra phần cứng rồi thử lại.",
        );
      }
    } catch {
      exitGateOpenedAtRef.current = 0;
      setExitScanPhase("error");
      setExitScanError("Lỗi kết nối bridge. Kiểm tra phần cứng rồi thử lại.");
    }
  }, [activeExit?.sessionId, clearExitUi]);

  // ====== Exit RFID scan & verify ======
  const startExitScan = useCallback(async () => {
    if (!activeExit?.sessionId || activeExit.action === "no_session") {
      setExitScanError("Chưa tìm thấy phiên đang gửi cho biển số này.");
      setExitScanPhase("error");
      return;
    }
    exitVerifiedUidRef.current = ""; // cho phép verify lại ở lần quét mới
    setExitScanError("");
    setExitScanUid("");
    setExitScanPhase("starting");
    try {
      const res = await bridgeFetch("/api/rfid/scan/start", {
        method: "POST",
        body: JSON.stringify({ direction: exitLaneRef.current }),
      });
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
          const poll = await bridgeFetch(
            `/api/rfid/scan/poll?direction=${exitLaneRef.current}`,
          );
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

  const submitManualExitUid = useCallback(async (uid: string) => {
    const value = uid.trim();
    if (!value) return;
    if (exitScanIntervalRef.current !== null) {
      window.clearInterval(exitScanIntervalRef.current);
      exitScanIntervalRef.current = null;
    }
    exitVerifiedUidRef.current = ""; // UID nhập tay: cho phép verify
    setExitScanError("");
    try {
      const res = await bridgeFetch("/api/rfid/scan/record", {
        method: "POST",
        body: JSON.stringify({ uid: value, direction: exitLaneRef.current }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setExitScanPhase("error");
        setExitScanError(data.error || "Không ghi nhận được UID.");
        return;
      }
      setExitScanUid(value);
      setExitScanPhase("success");
    } catch {
      setExitScanPhase("error");
      setExitScanError("Không kết nối được bridge service (port 5050).");
    }
  }, []);

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
      await bridgeFetch("/api/rfid/scan/cancel", {
        method: "POST",
        body: JSON.stringify({ direction: exitLaneRef.current }),
      });
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
        logger.error("Failed to create payment");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeExit?.sessionId],
  );

  const payExitCash = useCallback(
    async (receivedAmount: number) => {
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
    },
    [
      activeExit?.sessionId,
      activeExit?.action,
      activeExit?.fee,
      exitVerifyData?.amountDue,
      openExitBarrier,
    ],
  );

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
      setExitScanError(
        "Đã từ chối. Barrier giữ đóng. Yêu cầu đúng thẻ hoặc xử lý lại.",
      );
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
          setExitMismatchError(
            data.message || "Không xử lý được lệch định danh.",
          );
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
  const startExitPaymentPoll = useCallback(
    (sessionId: string) => {
      setExitPaymentPolling(true);

      const checkPayment = async () => {
        try {
          const res = await apiFetch(
            `/public/session/${sessionId}/payment-status`,
          );
          const data = await res.json().catch(() => ({}));
          if (
            data.paymentStatus === "fully_paid" ||
            data.transaction?.status === "paid"
          ) {
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
    },
    [openExitBarrier],
  );

  // Auto-verify exit RFID when scan succeeds. Guard chống gọi verify 2 lần
  // cho cùng UID (re-render / poll lặp) — verify thứ 2 trước đây bị backend
  // từ chối vì exitState đã đổi sang rfid_verified.
  const exitVerifiedUidRef = useRef("");
  useEffect(() => {
    if (exitScanPhase !== "success" || !exitScanUid || !activeExit?.sessionId)
      return;
    if (exitVerifiedUidRef.current === exitScanUid) return;
    exitVerifiedUidRef.current = exitScanUid;
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
    <div className="staff-desk min-h-[calc(100vh-72px)] bg-[#f3f6fa] px-[clamp(18px,3vw,42px)] pt-7 pb-11 text-[#172033]">
      <header className="mx-auto mb-[22px] flex w-full max-w-[1600px] items-end justify-between gap-5">
        <div>
          <h1 className="m-0 text-[clamp(22px,2.2vw,30px)] leading-[1.1] text-[#172033]">Bàn nhân viên</h1>
          <p className="mt-1.5 mb-0 max-w-[620px] text-[13px] leading-[1.5] text-[#667085]">
            Xem camera cổng vào · nhận biển số tự động · quét thẻ để tạo phiên &
            mở barie
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#e5e9f0] bg-white px-3 py-2 text-xs text-[#667085]">
          {streamIcon}
          <span>SSE: {statusLabel(streamStatus)}</span>
        </div>
      </header>

      {entrySuccessNotice ? (
        <div className="mb-[18px] flex items-center gap-[9px] rounded-[var(--radius,8px)] border border-[#86efac] bg-[#f0fdf4] px-3.5 py-[11px] font-semibold text-[#166534]" role="status">
          <CheckCircle2 size={18} />
          <span>{entrySuccessNotice}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setEntrySuccessNotice(null)}
            className="ml-auto min-h-0 bg-transparent p-0.5 text-inherit"
          >
            <XCircle size={16} />
          </button>
        </div>
      ) : null}

      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-2 gap-5 max-[1100px]:grid-cols-1">
        <section className="flex min-w-0 flex-col gap-3.5">
          <GateCamera
            title="Cổng vào"
            iconClass="text-[#079669]"
            streamUrl={`${bridgeBaseUrl}/video_feed/${laneRoles.entryLane}`}
            direction="in"
          />
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-[#c9d4e3] bg-[#e8edf3] shadow-[0_2px_8px_rgba(23,32,51,0.04)]">
            {phase === "done" && createdSession && !activeIngest ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-none bg-[#e8edf3] px-[18px] pt-6 pb-7 text-center">
                <div
                  className="mb-3.5 grid h-[72px] w-[72px] place-items-center rounded-full border bg-white"
                  style={{
                    color: "#15803d",
                    borderColor: "#bbf7d0",
                    background: "#f0fdf4",
                  }}
                >
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="m-0 text-lg tracking-normal text-[#172033]">Đã cho xe vào</h2>
                <p className="mx-0 mt-2 mb-0 max-w-[320px] text-[13px] leading-[1.55] text-[#667085]">
                  Biển <strong>{createdSession.plate || "—"}</strong>
                  {createdSession.slot ? ` · Ô ${createdSession.slot}` : ""}
                </p>
                {createdSession.entryRfidUnverified ? (
                  <p className="mt-2 mb-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#92400e]">
                    <CircleAlert size={14} />{" "}
                    {createdSession.entryExpectedRfidUid ? (
                      <>
                        RFID Member ({createdSession.entryExpectedRfidUid}) chưa
                        xác minh — đã xử lý thủ công
                      </>
                    ) : (
                      "RFID chưa xác minh — đã xử lý thủ công"
                    )}
                  </p>
                ) : scanUid ? (
                  <p className="mt-2 mb-0 inline-flex items-center gap-1.5 text-[13px] text-[#166534]">
                    <Nfc size={14} /> RFID đã gắn: <strong>{scanUid}</strong>
                  </p>
                ) : null}
                {barrierMsg ? (
                  <p className="text-xs leading-[1.45] text-[#667085]">{barrierMsg}</p>
                ) : null}
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
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
            ) : showEntryRfidExceptionForm &&
              pendingManualEntryRfid &&
              !activeIngest ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 bg-[#e8edf3] px-[18px] pt-6 pb-7 text-center">
                <div className="mb-3.5 grid h-[72px] w-[72px] place-items-center rounded-full border border-[#dbe3ee] bg-white text-[#64748b]">
                  <Nfc size={36} />
                </div>
                <h2 className="m-0 text-lg tracking-normal text-[#172033]">Xử lý RFID thủ công</h2>
                <p className="mx-0 mt-2 mb-0 max-w-[320px] text-[13px] leading-[1.55] text-[#667085]">
                  Biển số <strong>{manualPlate}</strong> đã được xác nhận. Nhập
                  lý do trước khi cho xe vào.
                </p>
                <textarea
                  rows={3}
                  value={entryRfidExceptionReason}
                  onChange={(event) =>
                    setEntryRfidExceptionReason(event.target.value)
                  }
                  placeholder="VD: Đầu đọc RFID không nhận thẻ; đã kiểm tra xe và biển số bằng mắt"
                />
                {phase === "error" && createMsg ? (
                  <p className="flex items-center gap-[5px] text-xs leading-[1.45] text-[#dc4a4a]">
                    {createMsg}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
                    disabled={
                      entryRfidExceptionReason.trim().length < 8 ||
                      /đang có phiên|chưa checkout/i.test(
                        entryRfidExceptionReason,
                      )
                    }
                    onClick={() =>
                      void createSessionManual(undefined, manualPlate, {
                        manualRfidReason: entryRfidExceptionReason.trim(),
                      })
                    }
                  >
                    Xác nhận cho xe vào
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
                    onClick={() => {
                      setShowEntryRfidExceptionForm(false);
                      void startScan();
                    }}
                  >
                    Quét lại RFID
                  </button>
                </div>
              </div>
            ) : scanPhase === "success" && scanUid && !activeIngest ? (
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
                  void (async () => {
                    // Hủy phiên scan cũ trước khi mở phiên mới; nếu không,
                    // bridge có thể vẫn giữ trạng thái conflict/đang quét.
                    await bridgeFetch("/api/rfid/scan/cancel", {
                      method: "POST",
                      body: JSON.stringify({
                        direction: entryLaneRef.current,
                      }),
                    }).catch(() => undefined);
                    await startScan();
                  })();
                }}
                cardInfo={scannedCardInfo}
              />
            ) : !activeIngest ? (
              <WaitingCard
                direction="in"
                scanPhase={scanPhase}
                onStartScan={startScan}
                onCancelScan={cancelScan}
                onManualRfidFailure={
                  pendingManualEntryRfid ? handleEntryRfidException : undefined
                }
                onManualUid={submitManualUid}
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
                onOpenVerifiedMember={() =>
                  void createSessionManual(
                    manualEntryVehicle?.cardUid,
                    manualEntryPlate,
                  )
                }
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

        <section className="flex min-w-0 flex-col gap-3.5">
          <GateCamera
            title="Cổng ra"
            iconClass="text-[#c4650a]"
            streamUrl={`${bridgeBaseUrl}/video_feed/${laneRoles.exitLane}`}
            direction="out"
          />
          <div className="min-w-0 flex-1 rounded-xl border border-[#e5e9f0] bg-white p-5 shadow-[0_2px_8px_rgba(23,32,51,0.04)]">
            {!activeExit ? (
              <WaitingCard
                direction="out"
                scanPhase={exitScanPhase}
                onStartScan={startExitScan}
                onManualUid={submitManualExitUid}
                scanError={exitScanError}
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
                gateError={exitScanPhase === "error" ? exitScanError : ""}
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
  iconClass,
}: {
  title: string;
  streamUrl: string;
  direction: "in" | "out";
  iconClass?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e9f0] bg-white shadow-[0_2px_8px_rgba(23,32,51,0.04)]">
      <div className="flex min-h-[54px] items-center justify-between gap-3 border-b border-[#e5e9f0] px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Camera size={16} className={iconClass} />
          <span>{title}</span>
          <span
            className={`inline-flex items-center gap-1 rounded-[5px] px-[7px] py-[3px] text-[10px] font-extrabold uppercase tracking-[0.06em] ${
              direction === "in"
                ? "bg-[#e9f8f2] text-[#079669]"
                : "bg-[#eef2f7] text-[#667085]"
            }`}
          >
            live
          </span>
        </div>
        <span className="text-xs leading-[1.45] text-[#667085]">MJPEG</span>
      </div>
      <div className="relative aspect-video w-full overflow-hidden bg-[#0b1220]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={streamUrl} alt={title} className="absolute inset-0 block h-full w-full bg-[#0b1220] object-cover object-center" />
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
  onManualUid,
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
  onManualUid?: (uid: string) => void;
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
  manualEntryVehicle?: {
    ownerName?: string;
    isSubscriber?: boolean;
    cardUid?: string;
  } | null;
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
  const onToggleManual = isEntry
    ? onToggleManualEntryForm
    : onToggleManualExitForm;
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
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-5 bg-[#e8edf3] px-6 py-10 text-center">
        <p className="m-0 max-w-[360px] text-base font-medium leading-[1.55] text-[#334155]">
          Vui lòng nhập chính xác biển số xe hiện tại ở cổng chờ
        </p>
        <form
          className="flex w-[min(320px,100%)] flex-col items-center gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitManual?.();
          }}
        >
          <input
            id={plateInputId}
            className="w-full min-h-[52px] rounded-lg border border-[#cbd5e1] bg-white px-4 py-3 text-center font-mono text-xl font-bold uppercase tracking-[0.12em] text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.04)] placeholder:font-semibold placeholder:tracking-[0.12em] placeholder:text-[#94a3b8] focus:outline-2 focus:outline-[#93c5fd] focus:border-[#60a5fa]"
            value={manualPlateValue || ""}
            onChange={(e) => onManualPlateChange?.(e.target.value)}
            placeholder="30A34567"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {manualError ? (
            <p className="flex items-center gap-[5px] text-xs leading-[1.45] text-[#dc4a4a]">
              {manualError}
            </p>
          ) : null}
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55 w-full"
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
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55 w-full"
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
      className="flex min-h-[320px] flex-col items-center justify-center gap-2 bg-[#e8edf3] px-[18px] pt-6 pb-7 text-center"
    >
      <div className="mb-3.5 grid h-[72px] w-[72px] place-items-center rounded-full border border-[#dbe3ee] bg-white text-[#64748b]">
        {isEntry ? (
          <ScanLine size={40} className="animate-pulse" />
        ) : (
          <ArrowUpFromLine size={40} className="animate-pulse" />
        )}
      </div>
      <h2 className="m-0 text-lg tracking-normal text-[#172033]">
        {isEntry ? "Đang chờ xe vào" : "Đang chờ xe ra"}
      </h2>
      <p className="mx-0 mt-2 mb-0 max-w-[320px] text-[13px] leading-[1.55] text-[#667085]">
        Nếu camera không thể nhận diện biển số hãy dùng nút nhập thủ công biển
        số xe
      </p>

      {isEntry && manualEntryPlate && !showManualForm ? (
        <div className="mx-auto my-3 w-full max-w-[360px] rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff] px-3.5 py-3 text-left text-[#1e3a5f]">
          <strong>Thông tin biển số {manualEntryPlate}</strong>
          {manualEntryVehicle?.ownerName ? (
            <span>Chủ xe: {manualEntryVehicle.ownerName}</span>
          ) : (
            <span>Chủ xe: Khách vãng lai (chưa có hồ sơ đăng ký)</span>
          )}
          {manualEntryVehicle?.isSubscriber ? (
            <span>Gói thành viên đang hiệu lực</span>
          ) : null}
          {manualEntryVehicle?.cardUid ? (
            <span>RFID Member: {manualEntryVehicle.cardUid}</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex w-[min(420px,100%)] flex-col items-stretch gap-3">
        {isEntry && manualEntryVehicle?.cardUid && !showManualForm ? (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55 min-h-12 w-full font-bold"
            onClick={onOpenVerifiedMember}
            disabled={Boolean(manualLoading)}
          >
            Mở barie cho xe thành viên
          </button>
        ) : null}
        {!showManualForm ? (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55 min-h-12 w-full font-bold"
            onClick={onToggleManual}
          >
            Nhập thủ công biển số xe
          </button>
        ) : (
          <form
            className="flex flex-col gap-2.5 rounded-xl border border-[#dbe3ee] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitManual?.();
            }}
          >
            <label
              className="text-[0.85rem] font-semibold text-[#334155]"
              htmlFor={plateInputId}
            >
              Biển số xe
            </label>
            <input
              id={plateInputId}
              className="min-h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 py-2.5 font-mono text-[1.05rem] font-bold uppercase tracking-[0.06em]"
              value={manualPlateValue || ""}
              onChange={(e) => onManualPlateChange?.(e.target.value)}
              placeholder="VD: 30A12345"
              autoFocus
              autoComplete="off"
            />
            {manualError ? (
              <p className="flex items-center gap-[5px] text-xs leading-[1.45] text-[#dc4a4a]">
                {manualError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2.5">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
                disabled={Boolean(manualLoading)}
              >
                {manualLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />{" "}
                    {loadingLabel}
                  </>
                ) : (
                  submitLabel
                )}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
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
        <div className="grid gap-2.5 pt-1" style={{ marginTop: "0.75rem" }}>
          {scanPhase === "waiting" || scanPhase === "starting" ? (
            <div className="grid justify-items-center gap-3 rounded-lg border border-[#bed4ff] bg-[#f1f6ff] p-[18px] text-center">
              <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-[#dbe9ff] text-[#2563eb]">
                <Nfc size={28} className="animate-pulse" />
              </div>
              <p>Đang chờ quẹt thẻ RFID…</p>
              <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55" onClick={onCancelScan}>
                Hủy
              </button>
              {onManualRfidFailure ? (
                <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55" onClick={onManualRfidFailure}>
                  RFID không đọc được
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55" onClick={onStartScan}>
                <Nfc size={16} /> Quét thẻ RFID
              </button>
              {onManualRfidFailure ? (
                <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55" onClick={onManualRfidFailure}>
                  RFID không đọc được
                </button>
              ) : null}
              {(scanPhase === "timeout" || scanPhase === "error") &&
              onManualUid ? (
                <ManualUidInput onSubmit={onManualUid} />
              ) : null}
              {scanPhase === "timeout" && (
                <p className="text-xs leading-[1.45] text-[#a16207]">
                  Hết thời gian chờ quét thẻ.
                </p>
              )}
              {scanPhase === "error" && scanError && (
                <p className="flex items-center gap-[5px] text-xs leading-[1.45] text-[#dc4a4a]">
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

function ManualUidInput({ onSubmit }: { onSubmit: (uid: string) => void }) {
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState("");
  if (!open) {
    return (
      <button
        type="button"
        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
        onClick={() => setOpen(true)}
      >
        <CreditCard size={16} /> Nhập UID thủ công
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2.5 rounded-xl border border-[#dbe3ee] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      onSubmit={(e) => {
        e.preventDefault();
        const value = uid.trim();
        if (!value) return;
        onSubmit(value);
      }}
    >
      <label
        className="text-[0.85rem] font-semibold text-[#334155]"
        htmlFor="manual-uid-input"
      >
        UID thẻ RFID
      </label>
      <input
        id="manual-uid-input"
        className="min-h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 py-2.5 font-mono text-[1.05rem] font-bold uppercase tracking-[0.06em]"
        value={uid}
        onChange={(e) => setUid(e.target.value)}
        placeholder="VD: 60A99999 hoặc 04AABB12"
        autoFocus
        autoComplete="off"
      />
      <div className="flex flex-wrap gap-2.5">
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
          disabled={!uid.trim()}
        >
          <CheckCircle2 size={16} /> Xác nhận
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
          onClick={() => {
            setOpen(false);
            setUid("");
          }}
        >
          Hủy
        </button>
      </div>
    </form>
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
    card: {
      uid: string;
      cardType: string;
      status: string;
      ownerName: string;
      plate: string;
    } | null;
    vehicle: { ownerName: string; plate: string; status: string } | null;
    isSubscriber: boolean;
    subscription: { planName: string; endDate: string } | null;
    activeSession: { plate: string; checkInAt: string } | null;
    plateActiveSession: { plate: string; checkInAt: string } | null;
  } | null;
}) {
  const blockingSession =
    cardInfo?.activeSession ?? cardInfo?.plateActiveSession;
  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1 rounded-[5px] bg-[#e9f8f2] px-[7px] py-[3px] text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#079669]">
            <Nfc size={12} /> Thẻ RFID
          </span>
          <h2
            className="m-0 font-mono font-extrabold tracking-[0.04em] text-[#172033]"
            style={{ fontSize: "1rem", fontFamily: "monospace" }}
          >
            {scanUid}
          </h2>
          <p className="m-0 mt-1.5 text-xs text-[#667085]">
            {cardInfo?.card
              ? "Thẻ đã tra cứu — đối chiếu biển số với xe tại cổng rồi xác nhận"
              : plateConfirmed
                ? "RFID đã đọc — xác nhận để tạo phiên và mở barie"
                : "Camera chưa nhận biển số — nhập thủ công"}
          </p>
        </div>
        <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55" onClick={onDismiss} aria-label="Hủy">
          <XCircle size={16} />
        </button>
      </div>

      <div className="grid min-h-[110px] place-items-center gap-2 overflow-hidden rounded-lg border border-[#e5e9f0] bg-[#edf1f5] text-xs text-[#98a2b3]">
        <Camera size={32} />
        <span>Chưa có ảnh camera</span>
      </div>

      {cardInfo ? (
        <div
          className="mt-2.5 grid gap-2.5 rounded-[9px] border border-[#fecaca] bg-[#fff7f7] p-3 text-[#991b1b]"
          role="status"
          style={{ marginTop: "0.5rem" }}
        >
          {cardInfo.card ? (
            <>
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Nfc size={15} />
                {cardInfo.card.cardType === "member"
                  ? "Thẻ Member"
                  : "Thẻ Guest"}{" "}
                · {cardInfo.card.status}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span>UID</span>
                  <strong>{cardInfo.card.uid}</strong>
                </div>
                {cardInfo.card.plate || cardInfo.vehicle?.plate ? (
                  <div>
                    <span>Biển đăng ký</span>
                    <strong>
                      {cardInfo.vehicle?.plate || cardInfo.card.plate}
                    </strong>
                  </div>
                ) : null}
                {cardInfo.vehicle?.ownerName || cardInfo.card.ownerName ? (
                  <div>
                    <span>Chủ xe</span>
                    <strong>
                      {cardInfo.vehicle?.ownerName || cardInfo.card.ownerName}
                    </strong>
                  </div>
                ) : null}
                {cardInfo.subscription ? (
                  <div>
                    <span>Gói thành viên</span>
                    <strong>
                      {cardInfo.subscription.planName} (đến{" "}
                      {new Date(
                        cardInfo.subscription.endDate,
                      ).toLocaleDateString("vi-VN")}
                      )
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
                  Thẻ đang gắn phiên của xe{" "}
                  <strong>{cardInfo.activeSession.plate}</strong> (vào{" "}
                  {new Date(cardInfo.activeSession.checkInAt).toLocaleString(
                    "vi-VN",
                  )}
                  ) — không thể cấp cho xe mới.
                </p>
              ) : null}
              {cardInfo.plateActiveSession ? (
                <p style={{ color: "#dc2626" }}>
                  Xe <strong>{cardInfo.plateActiveSession.plate}</strong> vẫn
                  còn phiên đang gửi (vào{" "}
                  {new Date(
                    cardInfo.plateActiveSession.checkInAt,
                  ).toLocaleString("vi-VN")}
                  ) — cho xe ra trước khi vào lại.
                </p>
              ) : null}
            </>
          ) : (
            <p>Không tìm thấy thẻ này trong hệ thống.</p>
          )}
        </div>
      ) : null}

      {phase === "idle" || phase === "error" ? (
        <div className="grid gap-2.5 pt-1">
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
              <p className="flex items-center gap-[5px] text-xs leading-[1.45] text-[#dc4a4a]">
                <CircleAlert size={14} /> {manualPlateError}
              </p>
            )}
          </label>
          {plateConfirmed && phase === "error" ? (
            <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55" onClick={onRescan}>
              <Nfc size={16} /> Quét lại RFID
            </button>
          ) : blockingSession ? (
            <>
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
                disabled
                title="Biển/thẻ này đang có phiên gửi xe chưa kết thúc"
              >
                <LogIn size={16} /> Đang có phiên — không thể tạo
              </button>
              <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55" onClick={onRescan}>
                <Nfc size={16} /> Quét lại RFID
              </button>
            </>
          ) : (
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
              onClick={onConfirm}
              disabled={manualPlate.trim().length < 5}
            >
              <LogIn size={16} />{" "}
              {plateConfirmed ? "Xác nhận & Mở barie" : "Tạo phiên & Mở barie"}
            </button>
          )}
          {(phase as string) === "error" && createMsg && (
            <p className="flex items-center gap-[5px] text-xs leading-[1.45] text-[#dc4a4a]">
              <CircleAlert size={14} /> {createMsg}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-[7px] border-t border-[#e5e9f0] p-3 text-xs">
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
          {createMsg && <p className="text-xs leading-[1.45] text-[#667085]">{createMsg}</p>}
          {barrierMsg && <p className="text-xs leading-[1.45] text-[#667085]">{barrierMsg}</p>}
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
  const expectedRfidUid =
    typeof event.metadata?.expectedRfidUid === "string"
      ? event.metadata.expectedRfidUid
      : "";
  const displayUserType =
    event.userType === "resident" || Boolean(event.metadata?.isSubscriber)
      ? "resident"
      : event.userType;
  const duplicateSession =
    event.duplicateSession === true || event.action === "duplicate";
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
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1 rounded-[5px] bg-[#e9f8f2] px-[7px] py-[3px] text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#079669]">
            <LogIn size={12} /> Xe vào
          </span>
          <h2 className="m-0 font-mono font-extrabold tracking-[0.04em] text-[#172033]">
            {event.detectedPlate || event.plate || "Chưa nhận diện biển"}
          </h2>
          {event.plate && event.plate !== event.detectedPlate && (
            <p className="m-0 mt-1.5 text-xs text-[#667085]">
              Khớp với biển đã đăng ký: <strong>{event.plate}</strong>
            </p>
          )}
          {aiPlateMissing ? (
            <p className="m-0 mt-1.5 text-xs font-semibold text-[#a16207]">
              AI chưa đọc được biển — nhập thủ công bên dưới
            </p>
          ) : null}
        </div>
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
          onClick={props.onDismiss}
          aria-label="Bỏ qua"
        >
          <XCircle size={16} />
        </button>
      </div>

      {imgUrl ? (
        <div className="grid min-h-[110px] place-items-center overflow-hidden rounded-lg border border-[#e5e9f0] bg-[#edf1f5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgUrl}
            alt={`Biển số ${event.detectedPlate || "chưa rõ"}`}
          />
        </div>
      ) : (
        <div className="grid min-h-[110px] place-items-center gap-2 overflow-hidden rounded-lg border border-[#e5e9f0] bg-[#edf1f5] text-xs text-[#98a2b3]">
          <Camera size={32} />
          <span>Không có ảnh crop</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
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
          <MetaRow
            icon={<Nfc size={14} />}
            label="RFID Member dự kiến"
            value={expectedRfidUid}
          />
        )}
        {(event.ownerName || displayUserType === "resident") && (
          <MetaRow
            icon={<CreditCard size={14} />}
            label="Chủ xe"
            value={event.ownerName || "Chưa xác định"}
          />
        )}
      </div>

      {duplicateSession ? (
        <div className="flex items-start gap-2 rounded-[7px] border border-[#f4d79a] bg-[#fff8e8] px-3 py-2.5 text-xs leading-[1.45] text-[#8a5a08]" role="alert">
          <CircleAlert size={18} />
          <div>
            <strong>Xe đang có phiên gửi trong bãi</strong>
            <span>
              Biển {event.plate || event.detectedPlate} chưa checkout. Không tạo
              phiên mới và không mở barie cổng vào.
            </span>
          </div>
        </div>
      ) : eventIsStale ? (
        <div className="flex items-start gap-2 rounded-[7px] border border-[#f4d79a] bg-[#fff8e8] px-3 py-2.5 text-xs leading-[1.45] text-[#8a5a08]" role="alert">
          <CircleAlert size={18} />
          <span>Phiên xe này đã được xử lý. Chờ xe tiếp theo.</span>
        </div>
      ) : null}

      {/* Khu vực quét thẻ + xác nhận / nhập biển thủ công */}
      {!eventIsStale && !duplicateSession && (
        <div className="grid gap-2.5 pt-1">
          {showManual ? (
            <form
              className="grid gap-2.5 rounded-[var(--radius,8px)] border border-[#e5e9f0] bg-white p-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (canConfirmManual) props.onConfirmManualEntry?.();
              }}
            >
              <p className="m-0 text-sm font-semibold text-[#172033]">
                {aiPlateMissing
                  ? "Nhập biển số xe thủ công"
                  : "Sửa biển số AI nhận sai"}
              </p>
              <input
                className="w-full min-h-[52px] rounded-lg border border-[#cbd5e1] bg-white px-4 py-3 text-center font-mono text-xl font-bold uppercase tracking-[0.12em] text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.04)] placeholder:font-semibold placeholder:tracking-[0.12em] placeholder:text-[#94a3b8] focus:outline-2 focus:outline-[#93c5fd] focus:border-[#60a5fa]"
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
                <p className="flex items-center gap-[5px] text-xs leading-[1.45] text-[#dc4a4a]">
                  <CircleAlert size={14} /> {props.manualPlateError}
                </p>
              ) : null}
              {props.scanPhase === "success" && props.scanUid ? (
                <p className="text-xs leading-[1.45] text-[#667085]">
                  RFID: <code>{props.scanUid}</code>
                </p>
              ) : (
                <p className="text-xs leading-[1.45] text-[#a16207]">
                  Có thể xác nhận không cần RFID (ghi nhận chưa quẹt thẻ).
                </p>
              )}
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
                  disabled={!canConfirmManual}
                >
                  {props.phase === "creating" || props.phase === "opening" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Đang xử lý…
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
                    className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
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
              {props.scanPhase === "waiting" ||
              props.scanPhase === "starting" ? (
                <div className="grid justify-items-center gap-3 rounded-lg border border-[#bed4ff] bg-[#f1f6ff] p-[18px] text-center">
                  <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-[#dbe9ff] text-[#2563eb]">
                    <Nfc size={32} className="animate-pulse" />
                  </div>
                  <p>Đang chờ nhân viên quẹt thẻ RFID lên đầu đọc cổng vào…</p>
                  <button
                    className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
                    onClick={props.onCancelScan}
                  >
                    Hủy quét
                  </button>
                </div>
              ) : props.scanPhase === "success" && props.scanUid ? (
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-lg border border-[#b9e8d5] bg-[#effbf6] p-3">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <div>
                    <p className="m-0 mb-[3px] text-xs font-bold text-[#079669]">
                      Đã nhận thẻ
                    </p>
                    <code className="text-xs text-[#172033]">
                      {props.scanUid}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  <button
                    className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55 btn-lg"
                    onClick={props.onStartScan}
                  >
                    <Nfc size={18} />{" "}
                    {props.scanPhase === "error"
                      ? "Quét lại RFID"
                      : "Quét thẻ nhân viên"}
                  </button>
                  {props.scanPhase === "timeout" && (
                    <p className="text-xs leading-[1.45] text-[#a16207]">
                      Hết thời gian chờ quét thẻ.
                    </p>
                  )}
                  {props.scanPhase === "error" &&
                    props.scanError &&
                    (rfidConflict ? (
                      <div className="mt-2.5 grid gap-2.5 rounded-[9px] border border-[#fecaca] bg-[#fff7f7] p-3 text-[#991b1b]" role="alert">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold">
                          <CircleAlert size={15} /> Không thể cấp RFID Guest cho
                          xe này
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span>UID RFID</span>
                            <strong>{rfidConflict.uid}</strong>
                          </div>
                          <div>
                            <span>Đã cấp cho xe</span>
                            <strong>{rfidConflict.assignedPlate}</strong>
                          </div>
                          <div>
                            <span>Thời gian vào</span>
                            <strong>{rfidConflict.checkInAt}</strong>
                          </div>
                        </div>
                        <p>
                          Thẻ đang gắn với phiên của xe{" "}
                          <strong>{rfidConflict.assignedPlate}</strong>, nên
                          không thể cấp tiếp cho xe{" "}
                          <strong>{rfidConflict.attemptedPlate}</strong>.
                        </p>
                      </div>
                    ) : (
                      <p className="flex items-center gap-[5px] text-xs leading-[1.45] text-[#dc4a4a]">
                        <CircleAlert size={14} /> {props.scanError}
                      </p>
                    ))}
                </div>
              )}

              {props.phase === "idle" || props.phase === "error" ? (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55 min-h-12 w-full font-bold"
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
              className="grid gap-[7px] border-t border-[#e5e9f0] p-3 text-xs"
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
                <p className="text-xs leading-[1.45] text-[#667085]">{props.createMsg}</p>
              )}
              {props.barrierMsg && (
                <p className="text-xs leading-[1.45] text-[#667085]">{props.barrierMsg}</p>
              )}
              {props.phase === "error" && (
                <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55" onClick={props.onStartScan}>
                  <RefreshCcw size={14} /> Quét lại RFID
                </button>
              )}
            </div>
          )}
          {props.phase !== "idle" &&
          showManual &&
          props.phase !== "creating" &&
          props.phase !== "opening" ? (
            <div
              className="grid gap-[7px] border-t border-[#e5e9f0] p-3 text-xs"
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
                <p className="text-xs leading-[1.45] text-[#667085]">{props.barrierMsg}</p>
              )}
              {props.phase === "error" && (
                <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55" onClick={props.onStartScan}>
                  <RefreshCcw size={14} /> Quét lại RFID
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

function EvidenceImage({
  label,
  imageUrl,
  alt,
}: {
  label: string;
  imageUrl: string | null;
  alt: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return imageUrl ? (
    <>
      <figure className="relative min-h-[140px] m-0 overflow-hidden rounded-[10px] border border-[#dbe3ee] bg-white">
        <button
          type="button"
          className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
          onClick={() => setOpen(true)}
          aria-label={`Phóng to ${label.toLowerCase()}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={alt} />
        </button>
        <figcaption>{label}</figcaption>
      </figure>
      {open ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-[rgb(15_23_42/82%)] p-6"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="relative max-h-[92vh] w-[min(96vw,1200px)] overflow-auto rounded-[14px] bg-white p-3 shadow-[0_25px_70px_rgb(0_0_0/35%)]"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-5 right-5 z-[1] grid h-9 w-9 place-items-center rounded-full border-0 bg-[rgb(15_23_42/55%)] p-0 text-white"
              onClick={() => setOpen(false)}
              aria-label="Đóng ảnh"
            >
              <XCircle size={22} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={alt} />
            <p>{label}</p>
          </div>
        </div>
      ) : null}
    </>
  ) : (
    <div className="relative m-0 flex min-h-[140px] flex-col gap-2 overflow-hidden rounded-[10px] border border-[#dbe3ee] bg-white text-[#64748b]">
      <Camera size={28} />
      <span>{label}: chưa có ảnh</span>
    </div>
  );
}

function ExitCard({
  event,
  onDismiss,
  onOpenBarrier,
  onScanRfid,
  scanPhase,
  gateError,
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
  gateError?: string;
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
  const entryImgUrl = resolveBridgeImageUrl(event.entryImagePath);
  const didCheckout = event.sessionStatus === "Đã hoàn thành";
  const noSession = event.action === "no_session" || !event.sessionId;
  const hasPaymentData = Boolean(paymentData && paymentData.amount > 0);
  const entryRfidUid =
    typeof event.metadata?.entryRfidUid === "string"
      ? event.metadata.entryRfidUid
      : event.rfidUid || scanUid;
  const entryRfidIsExpected = event.metadata?.entryRfidExpected === true;
  // Thẻ thay thế (đổi thẻ mới khi thẻ cũ hỏng/mất). Khi có giá trị này, xe
  // đang dùng thẻ mới thay cho thẻ đã quét lúc vào → hiển thị để nhân viên biết.
  const replacementCardUid =
    typeof event.metadata?.replacementCardUid === "string"
      ? event.metadata.replacementCardUid
      : "";
  const exitRfidManualNote =
    typeof event.metadata?.exitRfidManualNote === "string"
      ? event.metadata.exitRfidManualNote
      : "";
  const exitRfidManuallyVerified =
    event.metadata?.exitRfidManualVerified === true;
  const entryWasManual = event.metadata?.entrySource === "manual";
  const manualEntryReason =
    typeof event.metadata?.manualEntryReason === "string"
      ? event.metadata.manualEntryReason
      : "";
  const [showManualRfidForm, setShowManualRfidForm] = useState(false);
  const [showCashForm, setShowCashForm] = useState(false);
  const [manualRfidNote, setManualRfidNote] = useState("");
  // Older camera events may not include `entryRfidUnverified`; the absence of
  // an entry UID itself is the authoritative condition for manual review.
  const canHandleMissingEntryRfid =
    !entryRfidUid && !didCheckout && !event.barrierOpened;

  const amountDue = exitVerifyData?.amountDue ?? event.fee ?? 0;
  const isSubscriber = exitVerifyData?.isSubscriber ?? false;
  const customerType =
    event.metadata?.customerType === "member" || event.userType === "resident"
      ? "member"
      : "guest";
  const displayOwnerName = event.ownerName || "—";
  const vehicleTypeLabel =
    customerType === "member"
      ? event.metadata?.quotaType === "member"
        ? "Thành viên"
        : "Thành viên (chưa có gói)"
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
    // `amountDue` là số dư sau thanh toán, không phải tổng phí phiên. Sau
    // khi thu tiền nó về 0 nhưng phí đã thu vẫn phải hiện đúng để staff đối chiếu.
    if (isSubscriber) return "0đ (thành viên)";
    if (event.fee != null)
      return Number(event.fee).toLocaleString("vi-VN") + "đ";
    if (exitVerifyData) return amountDue.toLocaleString("vi-VN") + "đ";
    if (didCheckout) return "Đã checkout";
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
    if (scanPhase === "success" && !exitVerifyData)
      return "Đang xác minh thẻ RFID…";
    if (scanPhase === "error") return "Thẻ không hợp lệ — quét lại";
    if (scanPhase === "timeout") return "Hết thời gian — quét lại thẻ RFID";
    if (exitVerifyData?.canOpenGate) return "Thẻ hợp lệ — có thể mở barie";
    return "Hãy đặt thẻ RFID của khách vào đầu đọc";
  })();

  // Camera đọc biển không khớp phiên đang gửi. Không được cho luồng RFID,
  // thanh toán hoặc xác nhận thủ công chạy khi backend chưa xác định session.
  if (noSession) {
    return (
      <div className="flex min-h-full flex-col bg-[#e8edf3]">
        <div className="flex flex-col gap-4 px-[18px] pt-[18px] pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 mb-1 text-[0.95rem] font-semibold text-[#334155]">Xe ra</p>
              <h2 className="m-0 font-mono text-[clamp(1.75rem,2.4vw,2.4rem)] font-extrabold leading-[1.1] tracking-[0.08em] text-[#0f172a]">
                {event.detectedPlate || event.plate || "—"}
              </h2>
            </div>
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
              type="button"
              onClick={onDismiss}
              aria-label="Đóng cảnh báo"
            >
              <XCircle size={16} />
            </button>
          </div>
          <div className="flex items-start gap-2 rounded-[7px] border border-[#f4d79a] bg-[#fff8e8] px-3 py-2.5 text-xs leading-[1.45] text-[#8a5a08]" role="alert">
            <CircleAlert size={18} />
            <div>
              <strong>Không tìm thấy phiên đang gửi cho biển số này</strong>
              <span>
                Không quét RFID, không thu tiền và không mở barie. Đóng cảnh
                báo rồi nhập biển đúng thủ công nếu camera đọc sai.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#e8edf3]">
      {event.barrierOpened && (
        <div className="flex items-center gap-2.5 border-b border-[#9bd8ad] bg-[#ecfdf3] px-3.5 py-3 text-[#167044]" role="status">
          <CheckCircle2 size={22} />
          <div>
            <strong>Mở barie thành công</strong>
            <span>Đang chờ xe đi qua — đóng lại sau 5 giây…</span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4 px-[18px] pt-[18px] pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 mb-1 text-[0.95rem] font-semibold text-[#334155]">
              Xe ra -{" "}
              {customerType === "member"
                ? event.metadata?.quotaType === "member"
                  ? "Thành Viên"
                  : "Thành Viên (chưa có gói)"
                : "Khách Vãng Lai"}
            </p>
            <h2 className="m-0 font-mono text-[clamp(1.75rem,2.4vw,2.4rem)] font-extrabold leading-[1.1] tracking-[0.08em] text-[#0f172a]">
              {event.detectedPlate || event.plate || "—"}
            </h2>
          </div>
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
            type="button"
            onClick={onDismiss}
            aria-label="Bỏ qua"
            title="Bỏ qua xe hiện tại"
          >
            <XCircle size={16} />
          </button>
        </div>

        {mismatch &&
        onRetryMismatch &&
        onRejectMismatch &&
        onResolveMismatch ? (
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
          <div className="grid grid-cols-2 gap-3">
            <EvidenceImage
              label="Ảnh lúc vào"
              imageUrl={entryImgUrl}
              alt={"Ảnh camera xe vào " + (event.plate || "")}
            />
            <EvidenceImage
              label="Ảnh lúc ra"
              imageUrl={imgUrl}
              alt={"Ảnh camera xe ra " + (event.detectedPlate || "")}
            />
          </div>
        ) : null}

        {!mismatch ? (
          <div className="grid grid-cols-3 gap-x-4 gap-y-3.5 pt-1 max-[900px]:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
              <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">ID PHIÊN</span>
              <strong>{event.sessionId || "—"}</strong>
            </div>
            <div className="flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
              <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">Thời gian vào</span>
              <strong>{formatDateTime(event.checkInAt)}</strong>
            </div>
            <div className="flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
              <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">Thời gian ra</span>
              <strong>{formatDateTime(event.createdAt)}</strong>
            </div>
            <div className="flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
              <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">Loại xe</span>
              <strong>{vehicleTypeLabel}</strong>
            </div>
            <div className="flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
              <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">Tên chủ xe</span>
              <strong>{displayOwnerName}</strong>
            </div>
            <div className="flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
              <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">Phí phiên gửi xe</span>
              <strong>{feeLabel}</strong>
            </div>
            <div className="flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
              <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">Trạng thái barie</span>
              <strong
                className={
                  barrierTone === "warn"
                    ? "text-[0.9rem] font-bold text-[#b45309]"
                    : "font-mono text-[0.9rem] font-bold text-[#334155]"
                }
              >
                {barrierStatus}
              </strong>
            </div>
            <div className="flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
              <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">
                Trạng thái thanh toán
              </span>
              <strong
                className={
                  paymentTone === "ok"
                    ? "text-[0.9rem] font-bold text-[#334155]"
                    : paymentTone === "warn"
                      ? "text-[0.9rem] font-bold text-[#b45309]"
                      : "font-mono text-[0.9rem] font-bold text-[#334155]"
                }
              >
                {paymentLabel}
              </strong>
            </div>
            <div className="flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
              <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">
                UID Thẻ RFID Lúc Vào
              </span>
              <strong className="font-mono text-[0.9rem] font-bold text-[#334155]">
                {entryRfidUid
                  ? entryRfidIsExpected
                    ? `${entryRfidUid} (chưa xác minh)`
                    : entryRfidUid
                  : "Chưa đọc"}
              </strong>
            </div>
            {replacementCardUid && replacementCardUid !== entryRfidUid ? (
              <div className="flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
                <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">
                  Thẻ thay thế (đã đổi)
                </span>
                <strong className="font-mono text-[0.9rem] font-bold text-[#334155]">
                  {replacementCardUid}
                </strong>
              </div>
            ) : null}
            <div className="flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
              <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">
                UID Thẻ RFID Lúc Ra
              </span>
              <strong className="font-mono text-[0.9rem] font-bold text-[#334155]">
                {scanUid ||
                  (exitRfidManuallyVerified
                    ? "Xác nhận thủ công"
                    : "Chưa quẹt thẻ")}
              </strong>
            </div>
            {exitRfidManuallyVerified ? (
              <div className="col-span-full flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
                <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">
                  Ghi chú xử lý RFID
                </span>
                <strong className="font-mono text-[0.9rem] font-bold text-[#334155]">
                  {exitRfidManualNote || "Đã xác nhận thủ công do RFID lỗi."}
                </strong>
              </div>
            ) : null}
            {entryWasManual ? (
              <div className="col-span-full flex min-w-0 flex-col gap-1 [&>strong]:text-[0.95rem] [&>strong]:font-bold [&>strong]:text-[#0f172a] [&>strong]:[overflow-wrap:anywhere]">
                <span className="text-[0.78rem] font-semibold tracking-[0.01em] text-[#475569]">Ngoại lệ lúc vào</span>
                <strong className="text-[0.9rem] font-bold text-[#b45309]">
                  Nhập tay biển số
                </strong>
                <span className="text-[0.84rem] font-medium leading-[1.4] text-[#92400e]">
                  {manualEntryReason ||
                    "Nhân viên đã nhập biển số thủ công khi xe vào."}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!mismatch ? (
        <div className="mt-auto border-t border-[#d5dee9] bg-[#e8edf3] px-[18px] pt-3 pb-[18px]">
          <div className="flex flex-col items-center gap-3.5 rounded-xl border border-[#dbe3ee] bg-white px-4 py-[18px] text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {!entryRfidUid &&
            (exitRfidManuallyVerified || Boolean(exitRfidManualNote)) &&
            (event.fee ?? 0) <= 0 ? (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55 btn-lg"
                onClick={onOpenGate || onOpenBarrier}
                disabled={didCheckout || event.barrierOpened}
              >
                <ArrowUpFromLine size={18} /> Mở barie
              </button>
            ) : exitRfidManuallyVerified && needsPaymentChoice ? null : (
              <p className="m-0 text-base font-semibold text-[#1e293b]">{rfidPrompt}</p>
            )}

            {noSession ? (
              <div className="flex items-start gap-2 rounded-[7px] border border-[#f0b4b4] bg-[#fef2f2] px-3 py-2.5 text-xs leading-[1.45] text-[#9f1239]">
                <CircleAlert size={18} />
                <span>Không tìm thấy phiên đang gửi cho biển số này.</span>
              </div>
            ) : null}

            {gateError ? (
              <div
                className="flex items-start gap-2 rounded-[7px] border border-[#f0b4b4] bg-[#fef2f2] px-3 py-2.5 text-xs leading-[1.45] text-[#9f1239]"
                role="alert"
              >
                <CircleAlert size={18} />
                <span>{gateError}</span>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
                  onClick={onOpenGate || onOpenBarrier}
                >
                  <RefreshCcw size={16} /> Thử lại
                </button>
              </div>
            ) : null}

            {canHandleMissingEntryRfid && !exitVerifyData && !hasPaymentData ? (
              <div className="my-3.5 rounded-[var(--radius,8px)] border border-[#f7d99b] bg-[#fffbeb] p-3">
                <p>
                  Không có UID RFID lúc vào. Nhân viên có thể xác nhận thủ công
                  sau khi kiểm tra xe và biển số.
                </p>
                {!showManualRfidForm ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
                    onClick={() => setShowManualRfidForm(true)}
                  >
                    Xử lý thủ công
                  </button>
                ) : (
                  <div className="grid gap-2">
                    <textarea
                      rows={2}
                      value={manualRfidNote}
                      onChange={(event) =>
                        setManualRfidNote(event.target.value)
                      }
                      placeholder="Ghi rõ lý do xác nhận thủ công (tối thiểu 8 ký tự)"
                    />
                    <div>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
                        disabled={
                          mismatchPending || manualRfidNote.trim().length < 8
                        }
                        onClick={() =>
                          onManualMissingEntryRfid?.(manualRfidNote.trim())
                        }
                      >
                        {mismatchPending ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : null}
                        Xác nhận thủ công
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
                        onClick={() => setShowManualRfidForm(false)}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {didCheckout || event.barrierOpened ? (
              <div className="flex items-start gap-2 rounded-[7px] border border-[#9bd8ad] bg-[#ecfdf3] px-3 py-2.5 text-xs leading-[1.45] text-[#167044]">
                <CheckCircle2 size={18} />
                <span>
                  {event.barrierOpened
                    ? "Barie đã mở — xe có thể ra."
                    : "Phiên đã hoàn tất."}
                </span>
              </div>
            ) : needsPaymentChoice ? (
              <>
                <div className="flex w-full flex-col items-center gap-3.5">
                  <p className="m-0 text-center text-[0.98rem] font-semibold text-[#334155]">
                    Khách cần thanh toán bằng hình thức nào
                  </p>
                  <div className="grid w-full grid-cols-2 gap-3 max-[520px]:grid-cols-1">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55 min-h-11 border-[#cbd5e1] bg-white font-semibold text-[#0f172a]"
                      onClick={() => setShowCashForm(true)}
                      disabled={!onPayCash}
                    >
                      Thanh Toán Tiền Mặt
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55 min-h-11 border-[#cbd5e1] bg-white font-semibold text-[#0f172a]"
                      onClick={onPayPayos}
                      disabled={!onPayPayos}
                    >
                      Thanh Toán Qua PAYOS
                    </button>
                  </div>
                </div>
                {showCashForm ? (
                  <div className="mx-auto mt-3.5 grid w-[min(100%,360px)] gap-2 rounded-[0.65rem] border border-[#bfdbfe] bg-[#f8fbff] p-3.5 text-left">
                    <strong>Thu tiền mặt</strong>
                    <span>
                      Phí cần thu: {amountDue.toLocaleString("vi-VN")}đ
                    </span>
                    <div>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
                        disabled={!onPayCash}
                        onClick={() => onPayCash?.(amountDue)}
                      >
                        Xác nhận đã thu đủ tiền mặt
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
                        onClick={() => setShowCashForm(false)}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : hasPaymentData ? (
              showCashForm ? (
                <div className="mx-auto mt-3.5 grid w-[min(100%,360px)] gap-2 rounded-[0.65rem] border border-[#bfdbfe] bg-[#f8fbff] p-3.5 text-left">
                  <strong>Thu tiền mặt</strong>
                  <span>Phí cần thu: {amountDue.toLocaleString("vi-VN")}đ</span>
                  <div>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
                      disabled={!onPayCash}
                      onClick={() => onPayCash?.(amountDue)}
                    >
                      Xác nhận đã thu đủ tiền mặt
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
                      onClick={() => setShowCashForm(false)}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex w-full flex-col items-center gap-2.5">
                  <p className="m-0 text-2xl font-extrabold tracking-tight text-[#0f172a]">
                    {(paymentData?.amount || amountDue).toLocaleString("vi-VN")}
                    đ
                  </p>
                  {paymentData?.qrCode ? (
                    <div className="grid place-items-center rounded-xl border border-[#e5e9f0] bg-white p-3">
                      <QRCodeSVG
                        value={paymentData.qrCode}
                        size={200}
                        level="M"
                        marginSize={2}
                        className="h-[200px] w-[200px]"
                        aria-label="Mã QR thanh toán PayOS"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-wrap justify-center gap-2">
                    {paymentData?.checkoutUrl ? (
                      <button
                        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55"
                        onClick={() =>
                          window.open(paymentData.checkoutUrl, "_blank")
                        }
                      >
                        Mở link thanh toán
                      </button>
                    ) : null}
                    {onPayCash ? (
                      <button
                        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55"
                        onClick={() => setShowCashForm(true)}
                      >
                        Đổi sang tiền mặt
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs leading-[1.45] text-[#667085]">Đang chờ thanh toán PayOS…</p>
                </div>
              )
            ) : scanPhase === "starting" || scanPhase === "waiting" ? (
              entryRfidUid ? (
                <div className="flex w-full flex-col items-center gap-3 text-[0.9rem] text-[#475569]">
                  <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-[#dbe9ff] text-[#2563eb]">
                    <Nfc size={32} className="animate-pulse" />
                  </div>
                  <span>Đang chờ quét thẻ…</span>
                  {onManualMissingEntryRfid && entryRfidUid ? (
                    <div className="grid gap-2">
                      <label htmlFor="manual-rfid-note-waiting">
                        Đầu đọc không hoạt động?
                      </label>
                      <textarea
                        id="manual-rfid-note-waiting"
                        value={manualRfidNote}
                        onChange={(event) =>
                          setManualRfidNote(event.target.value)
                        }
                        rows={2}
                        placeholder="Nhập lý do xử lý thủ công (tối thiểu 8 ký tự)"
                      />
                      <button
                        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55 btn-lg"
                        disabled={manualRfidNote.trim().length < 8}
                        onClick={() =>
                          onManualMissingEntryRfid(manualRfidNote.trim())
                        }
                      >
                        Xử lý thủ công lỗi RFID
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null
            ) : scanPhase === "error" || scanPhase === "timeout" ? (
              <div className="flex w-full flex-col items-center gap-3 text-[0.9rem] text-[#475569]">
                <div className="flex items-start gap-2 rounded-[7px] border border-[#f0b4b4] bg-[#fef2f2] px-3 py-2.5 text-xs leading-[1.45] text-[#9f1239]">
                  <XCircle size={18} />
                  <span>
                    {scanPhase === "timeout"
                      ? "Hết thời gian quét thẻ."
                      : "Thẻ không hợp lệ hoặc không khớp."}
                  </span>
                </div>
                {onScanRfid ? (
                  <button
                    className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55 btn-lg"
                    onClick={onScanRfid}
                  >
                    <Nfc size={18} /> Quét lại thẻ RFID
                  </button>
                ) : null}
                {
                  <div className="grid gap-2">
                    <label htmlFor="manual-rfid-note">
                      Lý do xử lý thủ công
                    </label>
                    <textarea
                      id="manual-rfid-note"
                      value={manualRfidNote}
                      onChange={(event) =>
                        setManualRfidNote(event.target.value)
                      }
                      placeholder="Ví dụ: Đầu đọc RFID không nhận thẻ..."
                      rows={3}
                    />
                    <button
                      className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55 btn-lg"
                      disabled={
                        manualRfidNote.trim().length < 8 ||
                        !onManualMissingEntryRfid
                      }
                      onClick={() =>
                        onManualMissingEntryRfid?.(manualRfidNote.trim())
                      }
                    >
                      Xử lý thủ công lỗi RFID
                    </button>
                  </div>
                }
              </div>
            ) : scanPhase === "success" && !exitVerifyData ? (
              <div className="flex w-full flex-col items-center gap-3 text-[0.9rem] text-[#475569]">
                <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-[#dbe9ff] text-[#2563eb]">
                  <Loader2 size={32} className="animate-spin" />
                </div>
                <span>Đang xác minh thẻ RFID…</span>
              </div>
            ) : exitVerifyData ? (
              <div className="flex w-full flex-col gap-3">
                <div className="flex items-start gap-2 rounded-[7px] border border-[#9bd8ad] bg-[#ecfdf3] px-3 py-2.5 text-xs leading-[1.45] text-[#167044]">
                  <CheckCircle2 size={18} />
                  <span>
                    {isSubscriber
                      ? "Thành viên đã xác minh — sẵn sàng mở barie."
                      : "Xác minh thành công — sẵn sàng mở barie."}
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-2.5">
                  <button
                    className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55 btn-lg"
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
                    <button className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed bg-transparent border-[var(--border)] text-[var(--fg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-55" onClick={onScanRfid}>
                      <Nfc size={16} /> Quét thẻ khác
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col items-center gap-3 text-[0.9rem] text-[#475569]">
                <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-[#dbe9ff] text-[#2563eb]">
                  <Nfc size={32} />
                </div>
                <span>Đang chờ quét thẻ…</span>
                {onScanRfid ? (
                  <button
                    className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius,8px)] border text-[13px] font-medium min-h-[34px] px-3 transition-colors cursor-pointer disabled:cursor-not-allowed border-transparent bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] disabled:opacity-55 btn-lg"
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
    <div className="grid min-w-0 gap-[5px] rounded-[7px] border border-[#e5e9f0] bg-[#f6f8fb] p-[9px]">
      <span className="flex items-center gap-[5px] text-[11px] text-[#667085]">
        {icon}
        {label}
      </span>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-[#172033]">{value}</span>
    </div>
  );
}
