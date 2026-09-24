"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  CheckCircle2,
  CircleAlert,
  CircleX,
  CreditCard,
  Loader2,
  LogIn,
  Nfc,
  CalendarCheck,
  Printer,
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

// Thời gian giữ banner "Phiên đã hoàn tất!" trên màn hình cổng ra sau khi
// barie mở, đủ để nhân viên in hóa đơn và xe đi qua.
const EXIT_BANNER_MS = 15000;

// Thời gian giữ thông báo "Đã cho xe vào" sau khi tạo phiên & mở barie cổng
// vào, đủ để xe đi qua rồi tự đóng đón xe tiếp theo.
const ENTRY_BANNER_MS = 15000;

// Camera OCR liên tục tạo ra các log "in" pending mới cho cùng một biển
// (~mỗi khung hình). Khi nhân viên bấm "Bỏ qua", frontend chỉ đóng 1 log
// nên các frame tiếp theo sẽ làm thẻ nhảy lại. Nhớ biển đã bỏ qua trong
// thời gian này để bỏ qua toàn bộ frame lặp của biển đó.
const DISMISS_PLATE_MS = 90_000;

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
  const [entryBridgeAvailable, setEntryBridgeAvailable] = useState(true);
  const [exitBridgeAvailable, setExitBridgeAvailable] = useState(true);
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
  const [entryBlockingSession, setEntryBlockingSession] = useState<{
    plate: string;
    checkInAt?: string;
    slot?: string;
  } | null>(null);
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
  // Mirror của activeIngest cho effect SSE (không đưa state vào deps để tránh
  // xử lý lại event cũ khi staff vừa dismiss).
  const activeIngestRef = useRef<CameraIngestEvent | null>(null);
  useEffect(() => {
    activeIngestRef.current = activeIngest;
  }, [activeIngest]);
  // ID sự kiện chính màn hình này đã xác nhận/hủy — bỏ qua echo SSE do
  // chính action của mình bắn về (tránh xóa thẻ thành công trước 5 giây).
  const selfHandledEntryIdsRef = useRef<Set<string>>(new Set());
  const normPlate = (p?: string | null) =>
    (p || "")
      .trim()
      .toUpperCase()
      .replace(/[\s.\-]+/g, "");
  const activeIngestPlate = normPlate(
    activeIngest?.plate || activeIngest?.detectedPlate,
  );
  /** Biển số nhân viên đã "Bỏ qua" gần đây → bỏ qua frame lặp cùng biển. */
  const dismissedPlatesRef = useRef<Map<string, number>>(new Map());
  const rememberDismissedPlate = useCallback((plate?: string | null) => {
    const normalized = normPlate(plate);
    if (!normalized) return;
    dismissedPlatesRef.current.set(normalized, Date.now() + DISMISS_PLATE_MS);
  }, []);
  const isPlateDismissed = useCallback((plate?: string | null) => {
    const normalized = normPlate(plate);
    if (!normalized) return false;
    const until = dismissedPlatesRef.current.get(normalized);
    if (!until) return false;
    if (Date.now() < until) return true;
    dismissedPlatesRef.current.delete(normalized);
    return false;
  }, []);
  const forgetDismissedPlate = useCallback((plate?: string | null) => {
    const normalized = normPlate(plate);
    if (normalized) dismissedPlatesRef.current.delete(normalized);
  }, []);

  useEffect(() => {
    if (!activeIngestPlate) {
      setEntryBlockingSession(null);
      return;
    }
    let cancelled = false;
    void apiFetch(`/rfid/by-plate/${encodeURIComponent(activeIngestPlate)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (cancelled || !response.ok) return;
        const session = data.activeSession || data.plateActiveSession;
        setEntryBlockingSession(
          session
            ? {
                plate: session.plate || activeIngestPlate,
                checkInAt: session.checkInAt,
                slot: session.slot,
              }
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) setEntryBlockingSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeIngest?.id, activeIngestPlate]);

  useEffect(() => {
    if (!pendingIngest) return;
    // Bỏ qua các frame lặp lại liên tục khi xe đang hiển thị, NHƯNG nếu activeIngest đã bị dismiss về null (xe trước đã vào)
    // thì lập tức nhận ngay xe tiếp theo bất kể ID nào!
    if (
      activeIngest &&
      pendingIngest.id &&
      pendingIngest.id === processedIngestIdRef.current
    ) {
      return;
    }
    processedIngestIdRef.current = pendingIngest.id || "";
    if (pendingIngest.direction === "in") {
      // Barie vừa mở cho xe vào: bỏ qua ingest mới trong grace period (xe đang đi qua cổng)
      // tránh camera bắt lại đuôi/thân xe làm mất màn hình thông báo hoàn thành.
      if (Date.now() - entryGateOpenedAtRef.current < ENTRY_BANNER_MS) {
        return;
      }
      // Echo xác nhận/hủy từ backend (kể cả từ màn hình staff khác): đóng thẻ.
      if (
        pendingIngest.action === "entry_confirmed" ||
        pendingIngest.action === "entry_dismissed"
      ) {
        if (selfHandledEntryIdsRef.current.has(pendingIngest.id)) return;
        rememberDismissedPlate(
          pendingIngest.plate || pendingIngest.detectedPlate,
        );
        if (
          activeIngestRef.current &&
          pendingIngest.id === activeIngestRef.current.id
        ) {
          void dismissActive();
        }
        return;
      }
      const current = activeIngestRef.current;
      // Camera đẩy lặp cùng một xe (mỗi lần OCR là log MỚI với id khác):
      // cập nhật ảnh/confidence/chủ xe nhưng GIỮ nguyên biển số staff đang
      // sửa dở — không reset form đối chiếu.
      if (
        current &&
        normPlate(current.plate || current.detectedPlate) ===
          normPlate(pendingIngest.plate || pendingIngest.detectedPlate)
      ) {
        setActiveIngest((cur) => {
          if (!cur) return pendingIngest;
          if (
            cur.imagePath === pendingIngest.imagePath &&
            cur.confidence === pendingIngest.confidence &&
            cur.ownerName === pendingIngest.ownerName &&
            cur.userType === pendingIngest.userType
          ) {
            return cur;
          }
          return {
            ...cur,
            imagePath: pendingIngest.imagePath,
            confidence: pendingIngest.confidence,
            ownerName: pendingIngest.ownerName,
            userType: pendingIngest.userType,
            metadata: pendingIngest.metadata ?? cur.metadata,
            duplicateSession: Boolean(
              cur.duplicateSession ||
                pendingIngest.duplicateSession ||
                pendingIngest.action === "duplicate",
            ),
            action:
              cur.action === "duplicate" || pendingIngest.action === "duplicate"
                ? "duplicate"
                : pendingIngest.action,
          };
        });
        return;
      }
      // Nhân viên đã "Bỏ qua" biển này gần đây: camera vẫn đẩy frame lặp
      // của cùng xe → bỏ qua, không mở lại thẻ.
      if (isPlateDismissed(pendingIngest.plate || pendingIngest.detectedPlate)) {
        return;
      }
      // Xe mới (biển khác): reset form đối chiếu, seed biển số AI đọc được.
      setEntryBlockingSession(null);
      setActiveIngest(pendingIngest);
      setManualPlate(
        normPlate(pendingIngest.plate || pendingIngest.detectedPlate),
      );
      setManualPlateError("");
      setReviewNote("");
      setPhase("idle");
      setCreateMsg("");
      setBarrierMsg("");
      setCreatedSession(null);
      activeIngestIdRef.current = null;
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
  }, [pendingIngest]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const autoExitScanFiredRef = useRef(false);
  // Timestamp barie cổng vào vừa mở: giữ màn hình thành công cho xe đi qua
  // trước khi cho phép SSE / frame camera mới xóa UI.
  const entryGateOpenedAtRef = useRef<number>(0);
  // Timestamp barie vừa mở: giữ màn hình thành công 5s (cho xe đi qua)
  // trước khi cho phép SSE xóa UI.
  const exitGateOpenedAtRef = useRef<number>(0);
  // Timestamp kết thúc offline: giữ thông báo thành công 5s trước khi SSE
  // đồng bộ trạng thái hoàn tất xóa thẻ xe ra.
  const exitOfflineCompletedAtRef = useRef<number>(0);
  // Ghi chú xác nhận thủ công của phiên mất phần cứng. Giữ qua bước thanh toán
  // để kết thúc phiên ngay sau khi tiền mặt/PayOS đã được ghi nhận.
  const offlineExitReasonRef = useRef("");
  // Timer tự đóng thẻ cổng ra sau khi mở barie — phải clear khi unmount / clearExitUi.
  const exitDismissTimerRef = useRef<number | null>(null);
  // UID đã auto-create phiên cho luồng nhập tay biển số; chống gọi 2 lần.
  const manualAutoCreateRef = useRef("");
  // Biển đang chờ xác nhận ở cổng vào — dùng trong closure của interval poll
  // (không capture được state manualPlate) để đối chiếu với thẻ vừa quét.
  const manualPlateRef = useRef("");
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
  useEffect(() => {
    manualPlateRef.current = manualPlate;
  }, [manualPlate]);

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
    freeMinutes?: number | null;
    totalMinutes?: number | null;
  } | null>(null);
  const [exitPaymentData, setExitPaymentData] = useState<{
    qrCode: string;
    checkoutUrl: string;
    amount: number;
  } | null>(null);
  const [exitPaymentPolling, setExitPaymentPolling] = useState(false);
  // Phiên vừa thu đủ tiền (tiền mặt hoặc PayOS) nhưng CHƯA mở barie. Nhân viên
  // in hóa đơn trước, rồi bấm "Kết thúc phiên mở barie".
  const [exitSettled, setExitSettled] = useState(false);
  const [receiptPrinting, setReceiptPrinting] = useState(false);
  const [receiptPrinted, setReceiptPrinted] = useState(false);
  const [receiptError, setReceiptError] = useState("");
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
    activeSession?: {
      id?: string;
      plate: string;
      checkInAt: string;
      slot?: string;
    } | null;
  } | null>(null);
  const [pendingManualEntryRfid, setPendingManualEntryRfid] = useState(false);
  const [showEntryRfidExceptionForm, setShowEntryRfidExceptionForm] =
    useState(false);
  const [entryRfidExceptionReason, setEntryRfidExceptionReason] = useState("");
  /** Ghi chú giải thích khi staff sửa biển số AI nhận sai (luồng review). */
  const [reviewNote, setReviewNote] = useState("");
  const [exitMismatchError, setExitMismatchError] = useState("");
  const [exitReaderReloading, setExitReaderReloading] = useState(false);

  // Sau khi đọc được UID, tra thẻ trong DB và đối chiếu với biển đang chờ:
  // - Thẻ Member phải gắn ĐÚNG biển của xe đang vào. Nếu quét thẻ Member của
  //   xe khác (vd. xe khách vãng lai quẹt thẻ của khách đăng ký) → chặn ngay,
  //   không cho hiện "Đã nhận thẻ".
  // Trả về "" nếu hợp lệ, hoặc thông báo lỗi để hiển thị.
  const validateScannedCardForEntry = useCallback(
    async (uid: string): Promise<string> => {
      const plate = normPlate(
        manualPlateRef.current ||
          activeIngestRef.current?.plate ||
          activeIngestRef.current?.detectedPlate ||
          "",
      );
      try {
        const res = await apiFetch(`/rfid/by-uid/${encodeURIComponent(uid)}`);
        const data = await res.json().catch(() => ({}));
        if (!data?.ok || !data.card) return "";
        const card = data.card as { cardType?: string; plate?: string };
        if (String(card.cardType).toLowerCase() === "member") {
          const cardPlate = normPlate(card.plate || "");
          if (!plate || !cardPlate || cardPlate !== plate) {
            return `Thẻ RFID bạn vừa quét là thẻ Thành viên của xe ${cardPlate || "khác"}, không dùng được cho xe ${plate || "này"}. Vui lòng dùng thẻ khác.`;
          }
        }
      } catch {
        // Lỗi mạng khi tra thẻ: không chặn cứng, để backend validate lúc tạo phiên.
        return "";
      }
      return "";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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

  // Fallback độc lập bridge: UID staff nhập tay được xác minh qua backend.
  const submitManualUid = useCallback(
    async (uid: string) => {
      const value = uid.trim();
      if (!value) return;
      stopScanPolling();
      setScanError("");
      const mismatch = await validateScannedCardForEntry(value);
      if (mismatch) {
        setScanUid("");
        setScanPhase("error");
        setScanError(mismatch);
        return;
      }
      setScanUid(value);
      setScanPhase("success");
    },
    [stopScanPolling, validateScannedCardForEntry],
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
            await bridgeFetch("/api/rfid/scan/cancel", {
              method: "POST",
              body: JSON.stringify({ direction: entryLaneRef.current }),
            }).catch(() => undefined);
            const uid = data.uid || "";
            const mismatch = await validateScannedCardForEntry(uid);
            if (mismatch) {
              setScanUid("");
              setScanPhase("error");
              setScanError(mismatch);
              return;
            }
            setScanUid(uid);
            setScanPhase("success");
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
  }, [stopScanPolling, validateScannedCardForEntry]);

  // Khi scan RFID thành công mà KHÔNG có xe camera chờ → luồng idle
  // (tra thẻ / auto-create sau khi staff nhập biển ở form chờ).
  // Khi CÓ activeIngest: không tự tạo phiên — staff bấm nút gộp trong
  // IngestCard ("Xác nhận thông tin & Mở barie" → confirmIngestEntry).
  useEffect(() => {
    if (scanPhase !== "success" || !scanUid) return;
    if (activeIngest) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanPhase, scanUid, activeIngest, pendingManualEntryRfid, manualPlate]);

  // RFID không tự quét ngay khi camera nhận diện: nhân viên phải xác nhận
  // biển số đúng trước (nút "Biển số chính xác — quét RFID" trong IngestCard),
  // sau đó lệnh quét mới được bật.

  // Tạo phiên thủ công: idle form / RFID không có plate / sửa biển AI sai
  const createSessionManual = useCallback(
    async (
      uid: string | undefined,
      plate: string,
      opts?: {
        fromIdleForm?: boolean;
        fromIngestCorrection?: boolean;
        manualRfidReason?: string;
        confirmationNote?: string;
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
          manualEntryReason: opts?.confirmationNote
            ? opts.confirmationNote
            : opts?.manualRfidReason
              ? opts.manualRfidReason
              : opts?.fromIngestCorrection
                ? "AI nhận diện sai/không đọc được; staff nhập biển thủ công"
                : "Staff nhập biển thủ công tại cổng vào",
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
          setManualPlate("");
          setActiveIngest(null);
          activeIngestIdRef.current = null;
        }
        let openRes;
        try {
          openRes = await bridgeFetch(`/gate/${entryLaneRef.current}/open`, {
            method: "POST",
          });
        } catch {
          // Mất kết nối bridge (5050 offline): phiên đã tạo thành công trong
          // DB nhưng KHÔNG được giả báo đã mở barie — staff mở tay ngoài bốt.
          setPhase("error");
          setBarrierMsg(
            "Đã tạo phiên nhưng KHÔNG kết nối được bridge — mở barie thủ công ngoài bốt.",
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
        entryGateOpenedAtRef.current = Date.now();
        setBarrierMsg("Đã tạo phiên thủ công — đã mở barie cổng vào.");
        setPhase("done");
        setEntrySuccessNotice(
          `Đã cho xe ${session.plate || normalized} vào bãi thành công. Màn hình sẽ tự động đóng sau ${ENTRY_BANNER_MS / 1000} giây.`,
        );
        // Tự động đóng sau ENTRY_BANNER_MS và quay về màn hình chờ đón xe mới
        window.setTimeout(() => {
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
        }, ENTRY_BANNER_MS);
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
      const blockingSession =
        details.activeSession || details.plateActiveSession;
      if (blockingSession) {
        const checkInTime = blockingSession.checkInAt
          ? new Date(blockingSession.checkInAt).toLocaleString("vi-VN")
          : "";
        setManualEntryError(
          `Xe biển số ${blockingSession.plate || normalized} đang có phiên gửi trong bãi${
            checkInTime ? ` (vào lúc ${checkInTime})` : ""
          } chưa checkout! Không thể tạo phiên mới.`,
        );
      }
      setManualEntryVehicle({
        ownerName: details.vehicle?.ownerName,
        isSubscriber: Boolean(details.isSubscriber),
        cardUid: details.card?.uid,
        activeSession: blockingSession || null,
      });
      setManualPlate(normalized);
      setShowManualEntryForm(false);
      setShowEntryRfidExceptionForm(false);
      // Chưa bật quét RFID ở đây — staff phải bấm "Xác nhận biển số chính xác
      // & Quét RFID ngay" (đã ghi chú) thì bước RFID mới chạy.
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

  const clearExitUi = useCallback(() => {
    setActiveExit(null);
    setExitScanPhase("idle");
    setExitScanUid("");
    setExitScanError("");
    setExitVerifyData(null);
    setExitPaymentData(null);
    setExitMismatch(null);
    setExitMismatchError("");
    setExitSettled(false);
    setReceiptPrinting(false);
    setReceiptPrinted(false);
    setReceiptError("");
    autoExitScanFiredRef.current = false;
    exitGateOpenedAtRef.current = 0;
    exitOfflineCompletedAtRef.current = 0;
    offlineExitReasonRef.current = "";
    exitVerifiedUidRef.current = "";
    if (exitDismissTimerRef.current !== null) {
      window.clearTimeout(exitDismissTimerRef.current);
      exitDismissTimerRef.current = null;
    }
    if (exitScanIntervalRef.current !== null) {
      window.clearInterval(exitScanIntervalRef.current);
      exitScanIntervalRef.current = null;
    }
  }, []);

  // Dọn timer tự đóng thẻ cổng ra khi unmount (tránh gọi clearExitUi sau khi component đã hủy).
  useEffect(() => {
    return () => {
      if (exitDismissTimerRef.current !== null) {
        window.clearTimeout(exitDismissTimerRef.current);
        exitDismissTimerRef.current = null;
      }
    };
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
      // Khi phien da hoan tat: khong goi clearExitUi() ngay lap tuc
      return;
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
    await bridgeFetch("/api/staff-desk/reset-all", {
      method: "POST",
    }).catch(() => undefined);
    clearExitUi();
    window.location.reload();
  }, [activeExit?.sessionId, clearExitUi]);

  const dismissActive = useCallback(async () => {
    stopScanPolling();
    await bridgeFetch("/api/rfid/scan/cancel", {
      method: "POST",
      body: JSON.stringify({ direction: entryLaneRef.current }),
    }).catch(() => undefined);
    await bridgeFetch("/api/staff-desk/reset", {
      method: "POST",
      body: JSON.stringify({ direction: entryLaneRef.current }),
    }).catch(() => undefined);
    entryGateOpenedAtRef.current = 0;
    setActiveIngest(null);
    setEntryBlockingSession(null);
    setPhase("idle");
    setCreateMsg("");
    setBarrierMsg("");
    setEntrySuccessNotice(null);
    setCreatedSession(null);
    setScanUid("");
    setScanPhase("idle");
    setManualPlate("");
    setManualPlateError("");
    setManualEntryPlate("");
    setManualEntryError("");
    setManualEntryVehicle(null);
    setShowManualEntryForm(false);
    setPendingManualEntryRfid(false);
    setShowEntryRfidExceptionForm(false);
    setEntryRfidExceptionReason("");
    activeIngestIdRef.current = null;
  }, [stopScanPolling]);

  // Nút gộp: xác nhận thông tin (tạo phiên qua entry-review) rồi mở barie.
  const confirmIngestEntry = useCallback(async () => {
    if (!activeIngest) return;
    const ingestId = activeIngest.id;
    const normalized = normPlate(manualPlate);
    const detected = normPlate(activeIngest.detectedPlate);
    const corrected = Boolean(detected) && normalized !== detected;
    if (normalized.length < 5) {
      setManualPlateError("Biển số phải có ít nhất 5 ký tự.");
      return;
    }
    if (corrected && reviewNote.trim().length < 8) {
      setManualPlateError(
        "Cần ghi chú giải thích khi sửa biển số AI nhận sai (tối thiểu 8 ký tự).",
      );
      return;
    }
    setManualPlateError("");
    setPhase("creating");
    setCreateMsg("");
    setBarrierMsg("");
    setEntrySuccessNotice(null);
    setCreatedSession(null);
    // Đánh dấu ngay ID này do chính màn hình này xử lý — tránh echo SSE "entry_confirmed"
    // bắn về kích hoạt dismissActive() xóa thẻ trước khi hoàn tất mở barie.
    selfHandledEntryIdsRef.current.add(ingestId);
    rememberDismissedPlate(normalized);
    if (detected) rememberDismissedPlate(detected);
    try {
      const res = await apiFetch(
        `/camera-logs/entry-reviews/${encodeURIComponent(ingestId)}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({
            plate: normalized,
            ...(reviewNote.trim()
              ? { confirmationNote: reviewNote.trim() }
              : {}),
            ...(scanPhase === "success" && scanUid ? { rfidUid: scanUid } : {}),
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase("error");
        setCreateMsg(
          data.message || `Xác nhận thất bại (${res.status}). Không mở barie.`,
        );
        // 409 = sự kiện đã xử lý ở nơi khác/đã đóng → xóa thẻ, chờ xe mới.
        if (res.status === 409 && /đang có phiên.*chưa checkout/i.test(data.message || "")) {
          setActiveIngest((current) =>
            current
              ? { ...current, duplicateSession: true, action: "duplicate" }
              : current,
          );
          return;
        }
        if (res.status === 409) {
          selfHandledEntryIdsRef.current.add(ingestId);
          await dismissActive();
        }
        return;
      }
      const session = (data.session ?? {}) as {
        id?: string;
        _id?: string;
        slot?: string;
        plate?: string;
        entryRfidUnverified?: boolean;
        entryExpectedRfidUid?: string;
      };
      setCreatedSession({
        id: session.id || session._id || "",
        slot: session.slot,
        plate: session.plate || normalized,
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
      entryGateOpenedAtRef.current = Date.now();
      // Phiên đã tạo thành công ở backend → mở barie. Lỗi bridge KHÔNG được
      // giả báo thành công: staff phải mở tay ngoài bốt.
      let openRes;
      try {
        openRes = await bridgeFetch(`/gate/${entryLaneRef.current}/open`, {
          method: "POST",
        });
      } catch {
        setActiveIngest(null);
        activeIngestIdRef.current = null;
        setPhase("error");
        setBarrierMsg(
          "Đã tạo phiên nhưng KHÔNG kết nối được bridge — mở barie thủ công ngoài bốt.",
        );
        return;
      }
      if (!openRes.ok) {
        setActiveIngest(null);
        activeIngestIdRef.current = null;
        setPhase("error");
        setBarrierMsg(
          `Đã tạo phiên nhưng mở barie thất bại (${openRes.status}). Mở tay ngoài bốt.`,
        );
        return;
      }
      entryGateOpenedAtRef.current = Date.now();
      setActiveIngest(null);
      activeIngestIdRef.current = null;
      setBarrierMsg("Đã xác nhận thông tin — mở barie cổng vào.");
      setPhase("done");
      setEntrySuccessNotice(
        `Đã cho xe ${session.plate || normalized} vào bãi thành công. Màn hình sẽ tự động đóng sau ${ENTRY_BANNER_MS / 1000} giây.`,
      );
    } catch {
      setPhase("error");
      setCreateMsg("Lỗi mạng khi xác nhận thông tin xe vào.");
    }
  }, [
    activeIngest,
    dismissActive,
    manualPlate,
    rememberDismissedPlate,
    reviewNote,
    scanPhase,
    scanUid,
  ]);

  // Bỏ qua sự kiện camera (không tạo phiên, không mở barie).
  const dismissEntryReview = useCallback(async () => {
    if (!activeIngest) return;
    const ingestId = activeIngest.id;
    selfHandledEntryIdsRef.current.add(ingestId);
    rememberDismissedPlate(activeIngest.plate || activeIngest.detectedPlate);
    try {
      await apiFetch(
        `/camera-logs/entry-reviews/${encodeURIComponent(ingestId)}/dismiss`,
        { method: "POST" },
      );
    } catch {
      // Vẫn đóng UI local; log còn pending sẽ hiện lại khi reload — staff bấm lại.
    }
    await dismissActive();
    forgetDismissedPlate(activeIngest.plate || activeIngest.detectedPlate);
  }, [activeIngest, dismissActive, forgetDismissedPlate, rememberDismissedPlate]);

  // Khi SSE mở lại (reload/reconnect), khôi phục hàng đợi xe vào chờ xác nhận.
  useEffect(() => {
    if (streamStatus !== "open") return;
    if (activeIngestRef.current) return;
    if (Date.now() - entryGateOpenedAtRef.current < ENTRY_BANNER_MS) return;
    apiFetch("/camera-logs/entry-reviews/pending")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          reviews?: Array<{
            id: string;
            direction: "in";
            plate: string;
            detectedPlate: string;
            confidence?: number;
            rfidUid?: string;
            ownerName?: string;
            userType?: "resident" | "guest" | "unknown";
            imagePath?: string;
            entryReviewState?: string;
            createdAt: string;
            metadata?: Record<string, unknown>;
          }>;
        };
        const review = data.reviews?.[0];
        if (!review || activeIngestRef.current) return;
        // Biển này đã bị nhân viên bỏ qua trong phiên làm việc → không khôi phục.
        if (isPlateDismissed(review.plate || review.detectedPlate)) return;
        setActiveIngest({
          id: review.id,
          direction: "in",
          plate: review.plate || review.detectedPlate || "",
          detectedPlate: review.detectedPlate || "",
          confidence: review.confidence,
          rfidUid: review.rfidUid,
          ownerName: review.ownerName,
          userType: review.userType || "unknown",
          imagePath: review.imagePath,
          barrierOpened: false,
          sessionId: null,
          action: "pending_review",
          entryReviewState: review.entryReviewState || "pending_review",
          createdAt: review.createdAt,
          metadata: review.metadata ?? {},
        });
        setManualPlate(normPlate(review.plate || review.detectedPlate));
      })
      .catch(() => undefined); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamStatus]);

  // Phiên đã tạo xong, kể cả barie mất kết nối và staff phải mở tay, chỉ là
  // thông báo tạm thời. Tự trả cổng vào trạng thái chờ sau ENTRY_BANNER_MS.
  useEffect(() => {
    if (!createdSession || (phase !== "done" && phase !== "error")) return;
    const timer = window.setTimeout(
      () => void dismissActive(),
      ENTRY_BANNER_MS,
    );
    return () => window.clearTimeout(timer);
  }, [createdSession, dismissActive, phase]);

  const manualOpenBarrier = useCallback(async () => {
    try {
      const res = await bridgeFetch(`/gate/${entryLaneRef.current}/open`, {
        method: "POST",
      });
      if (res.ok) {
        entryGateOpenedAtRef.current = Date.now();
      }
      setBarrierMsg(
        res.ok ? "Đã mở barie cổng vào." : `Mở barie thất bại (${res.status}).`,
      );
    } catch {
      setBarrierMsg(
        "Không kết nối được barie. Phiên vẫn hợp lệ; mở barie vật lý theo quy trình và cho xe đi qua sau khi đối chiếu biển số.",
      );
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
    // Chống double-submit: barie đã mở thì không gọi lại / không tạo timer mới.
    if (activeExit.barrierOpened) return;

    // Đánh dấu "đang mở barie" TRƯỚC khi gọi API. SSE (phiên không còn
    // pending) thường về TRƯỚC response của open-gate; nếu không đánh dấu
    // trước, hiệu ứng SSE sẽ xóa UI ngay, làm mất banner "Mở barie thành
    // công" và không kịp chờ 5s.
    exitGateOpenedAtRef.current = Date.now();
    if (exitDismissTimerRef.current !== null) {
      window.clearTimeout(exitDismissTimerRef.current);
      exitDismissTimerRef.current = null;
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
        exitGateOpenedAtRef.current = Date.now();
        setActiveExit((current) =>
          current ? { ...current, barrierOpened: true } : current,
        );
        // Auto-dismiss ExitCard sau 7 giây (banner thành công giữ cho xe đi qua)
        exitDismissTimerRef.current = window.setTimeout(() => {
          exitDismissTimerRef.current = null;
          exitGateOpenedAtRef.current = 0;
          clearExitUi();
        }, EXIT_BANNER_MS);
      } else {
        exitGateOpenedAtRef.current = 0;
        setExitScanPhase("error");
        setExitScanError(
          data.message ||
            "Không mở được barie. Kiểm tra phần cứng rồi thử lại.",
        );
      }
    } catch {
      // Khi mất kết nối bridge (port 5050 offline / mất điện thiết bị):
      // Vẫn cho phép nhân viên hoàn tất phiên đỗ và thanh toán thủ công bình thường
      setExitScanPhase("success");
      setExitScanError("");
      setActiveExit((current) =>
        current ? { ...current, barrierOpened: true } : current,
      );
      // Auto-dismiss ExitCard sau 7 giây kể cả khi bridge offline
      exitDismissTimerRef.current = window.setTimeout(() => {
        exitDismissTimerRef.current = null;
        exitGateOpenedAtRef.current = 0;
        clearExitUi();
      }, EXIT_BANNER_MS);
    }
  }, [
    activeExit?.sessionId,
    activeExit?.barrierOpened,
    activeExit?.action,
    clearExitUi,
  ]);

  const completeOfflineExit = useCallback(
    async (reason: string) => {
      if (!activeExit?.sessionId || activeExit.action === "no_session") return;
      try {
        const response = await apiFetch("/exit/complete-offline", {
          method: "POST",
          body: JSON.stringify({ sessionId: activeExit.sessionId, reason }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          setExitScanError(
            data.message || "Không thể kết thúc phiên thủ công.",
          );
          setExitScanPhase("error");
          return;
        }
        setExitScanPhase("success");
        setExitScanError("");
        exitOfflineCompletedAtRef.current = Date.now();
        setActiveExit((current) =>
          current
            ? {
                ...current,
                sessionStatus: "Đã hoàn thành",
                barrierOpened: true,
              }
            : current,
        );
        if (exitDismissTimerRef.current !== null) {
          window.clearTimeout(exitDismissTimerRef.current);
        }
        // Auto-dismiss sau 5 giây (kể cả hoàn tất offline)
        exitDismissTimerRef.current = window.setTimeout(() => {
          exitDismissTimerRef.current = null;
          clearExitUi();
        }, 5000);
      } catch {
        setExitScanError("Lỗi kết nối server khi kết thúc phiên thủ công.");
        setExitScanPhase("error");
      }
    },
    [activeExit?.sessionId, activeExit?.action, clearExitUi],
  );

  // In biên lai cho phiên vừa thu tiền xong (chưa mở barie). Tải PDF từ
  // backend rồi mở hộp thoại in của trình duyệt qua iframe tạm.
  const printReceipt = useCallback(async () => {
    if (!activeExit?.sessionId || receiptPrinting) return;
    setReceiptPrinting(true);
    setReceiptError("");
    try {
      const res = await apiFetch(
        `/parking-sessions/${activeExit.sessionId}/receipt/pdf`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReceiptError(
          data.message || "Không tải được biên lai. Kiểm tra lại kết nối.",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          // Trình duyệt chặn in tự động: mở tab mới làm phương án dự phòng.
          window.open(url, "_blank");
        }
        window.setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(url);
        }, 60_000);
      };
      document.body.appendChild(iframe);
      setReceiptPrinted(true);
    } catch {
      setReceiptError("Lỗi kết nối server khi tải biên lai.");
    } finally {
      setReceiptPrinting(false);
    }
  }, [activeExit?.sessionId, receiptPrinting]);

  // Sau khi in (hoặc bỏ qua in), kết thúc phiên và mở barie.
  const finishAndOpenGate = useCallback(async () => {
    setExitSettled(false);
    if (offlineExitReasonRef.current) {
      await completeOfflineExit(offlineExitReasonRef.current);
      return;
    }
    await openExitBarrier();
  }, [completeOfflineExit, openExitBarrier]);

  // ====== Exit RFID scan & verify ======
  // Khởi động lại đầu đọc: clear state quét cũ, sync lại thẻ, connect lại
  // serial, rồi bật scan cho direction cổng ra. Khắc phục đầu đọc bị kẹt
  // cache cũ hoặc dùng chung 1 board cho 2 cổng (in/out).
  const reloadExitReader = useCallback(async () => {
    if (exitScanIntervalRef.current !== null) {
      window.clearInterval(exitScanIntervalRef.current);
      exitScanIntervalRef.current = null;
    }
    setExitScanError("");
    setExitScanUid("");
    setExitScanPhase("starting");
    setExitReaderReloading(true);
    try {
      const res = await bridgeFetch("/api/rfid/reader/reload", {
        method: "POST",
        body: JSON.stringify({ direction: exitLaneRef.current }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setExitScanPhase("error");
        setExitScanError(data.message || "Không khởi động lại được đầu đọc.");
        return;
      }
    } catch {
      setExitScanPhase("error");
      setExitScanError("Không kết nối được bridge service (port 5050).");
      return;
    } finally {
      setExitReaderReloading(false);
    }
    // Scan đã được bridge bật trong endpoint reload → chỉ cần poll kết quả.
    exitScanStartRef.current = Date.now();
    setExitScanPhase("waiting");
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
  }, []);

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
    setExitScanUid(value);
    setExitScanPhase("success");
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
            freeMinutes: data.freeMinutes ?? null,
            totalMinutes: data.totalMinutes ?? null,
          });
          setExitPaymentData(null);
          if (!(data.amountDue > 0) && data.canOpenGate) {
            // Phiên miễn phí / thành viên: dừng ở bước in hóa đơn, không
            // tự động mở barie — nhân viên bấm "Kết thúc phiên mở barie".
            setExitSettled(true);
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
    [activeExit?.sessionId],
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
        // Thu tiền xong KHÔNG mở barie ngay: nhân viên in hóa đơn trước,
        // rồi bấm "Kết thúc phiên mở barie".
        setExitSettled(true);
      } catch {
        setExitScanError("Lỗi kết nối khi thu tiền mặt.");
        setExitScanPhase("error");
      }
    },
    [activeExit?.sessionId, activeExit?.action, activeExit?.fee, exitVerifyData?.amountDue],
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
          freeMinutes: data.freeMinutes ?? null,
          totalMinutes: data.totalMinutes ?? null,
        });
        setExitPaymentData(null);
        const fullHardwareOutage =
          exitScanPhase === "error" &&
          /bridge|port\s*5050/i.test(exitScanError);
        if (fullHardwareOutage) {
          await completeOfflineExit(note);
        } else if (!(data.amountDue > 0) && data.canOpenGate) {
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
    async (note: string, completeOffline = false) => {
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
          freeMinutes: data.freeMinutes ?? null,
          totalMinutes: data.totalMinutes ?? null,
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
        if (completeOffline) {
          offlineExitReasonRef.current = note;
        }
        if (completeOffline && !(data.amountDue > 0)) {
          await completeOfflineExit(note);
        } else if (!(data.amountDue > 0) && data.canOpenGate) {
          await openExitBarrier();
        }
      } catch {
        setExitMismatchError("Lỗi kết nối server");
      } finally {
        setExitMismatchPending(false);
      }
    },
    [activeExit?.sessionId, completeOfflineExit, openExitBarrier],
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
            // PayOS xác nhận tiền về: dừng ở bước hóa đơn, chưa mở barie.
            setExitSettled(true);
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
    [completeOfflineExit, openExitBarrier],
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
    <div className="staff-desk">
      <header className="staff-desk__header">
        <div>
          <h1>Bàn nhân viên</h1>
          <p className="staff-desk__subtitle">
            Nhận diện xe vào xe ra · Quét thẻ RFID · Mở barie
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
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setEntrySuccessNotice(null)}
          >
            <XCircle size={16} />
          </button>
        </div>
      ) : null}

      <div className="staff-desk__gates">
        <section className="staff-desk__gate staff-desk__gate--entry">
          <GateCamera
            title="Xe vào"
            streamUrl={`${bridgeBaseUrl}/video_feed/${laneRoles.entryLane}`}
            direction="in"
            onStreamStateChange={(state) =>
              setEntryBridgeAvailable(state === "live")
            }
          />
          <div className="staff-desk__panel">
            {(phase === "done" || phase === "error") && createdSession ? (
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
                <h2>
                  {phase === "error"
                    ? "Đã tạo phiên — mở barie thủ công"
                    : "Đã cho xe vào"}
                </h2>
                <p>
                  Biển <strong>{createdSession.plate || "—"}</strong>
                  {createdSession.slot ? ` · Ô ${createdSession.slot}` : ""}
                </p>
                {createdSession.entryRfidUnverified ? (
                  <p className="staff-desk__entry-rfid-unverified">
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
                  <p className="staff-desk__entry-rfid-confirmed">
                    <Nfc size={14} /> RFID đã gắn: <strong>{scanUid}</strong>
                  </p>
                ) : null}
                {barrierMsg ? (
                  <p className="staff-desk__hint">{barrierMsg}</p>
                ) : null}
                <p className="staff-desk__hint">
                  Thông báo tự đóng sau {ENTRY_BANNER_MS / 1000} giây.
                </p>
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
                    entryGateOpenedAtRef.current = 0;
                    void dismissActive();
                  }}
                >
                  Xong
                </button>
              </div>
            ) : showEntryRfidExceptionForm &&
              pendingManualEntryRfid &&
              !activeIngest ? (
              <div className="staff-desk__waiting staff-desk__waiting--entry staff-desk__manual-rfid-entry">
                <div className="staff-desk__waiting-icon">
                  <Nfc size={36} />
                </div>
                <h2>Xử lý RFID thủ công</h2>
                <p>
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
                  <p className="staff-desk__hint staff-desk__hint--danger">
                    {createMsg}
                  </p>
                ) : null}
                <div className="staff-desk__exit-manual-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
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
                rfidAvailable={entryBridgeAvailable}
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
                  setManualEntryVehicle(null);
                }}
                onManualEntryPlateChange={(v) => {
                  setManualEntryPlate(v.toUpperCase());
                  setManualEntryError("");
                }}
                onManualEntryConfirmationNoteChange={
                  setManualEntryConfirmationNote
                }
                plateConfirmed={pendingManualEntryRfid}
                onCancelPlateConfirm={() => {
                  void cancelScan();
                  setPendingManualEntryRfid(false);
                  setScanPhase("idle");
                  setScanUid("");
                  setShowManualEntryForm(true);
                  setManualEntryError("");
                }}
                onSubmitManualEntry={() => void startManualEntryRfidFlow()}
                onConfirmManualPlate={(plate) => {
                  // Staff xác nhận biển số bằng mắt/ghi chú → chuyển sang bước quét RFID.
                  // Kết quả quét sẽ tự tạo phiên (effect pendingManualEntryRfid).
                  setManualPlate(plate.trim().toUpperCase().replace(/[\s-]+/g, ""));
                  setPendingManualEntryRfid(true);
                  void startScan();
                }}
                onConfirmManualPlateNoRfid={(plate) => {
                  // Bridge offline: không quét RFID được — tạo phiên thủ công
                  // ngay (uid undefined → entryRfidUnverified=true).
                  void createSessionManual(undefined, plate, {
                    fromIdleForm: true,
                    manualRfidReason:
                      "Bridge mất kết nối — staff đối chiếu biển số bằng mắt, không quét RFID",
                  });
                }}
                }}
                phase={phase}
                onOpenVerifiedMember={() =>
                  void createSessionManual(
                    manualEntryVehicle?.cardUid,
                    manualEntryPlate,
                    {
                      fromIdleForm: true,
                      manualRfidReason:
                        "Mở barie xe thành viên đối chiếu thủ công",
                    },
                  )
                }
              />
            ) : (
              <IngestCard
                event={activeIngest}
                blockingSession={entryBlockingSession}
                phase={phase}
                createMsg={createMsg}
                barrierMsg={barrierMsg}
                createdSession={createdSession}
                onDismiss={() => void dismissEntryReview()}
                scanPhase={scanPhase}
                scanUid={scanUid}
                scanError={scanError}
                onStartScan={startScan}
                onCancelScan={cancelScan}
                reviewPlate={manualPlate}
                reviewPlateError={manualPlateError}
                reviewNote={reviewNote}
                onReviewPlateChange={(v) => {
                  setManualPlate(v.toUpperCase());
                  setManualPlateError("");
                }}
                onReviewNoteChange={(v) => {
                  setReviewNote(v);
                  setManualPlateError("");
                }}
                onConfirm={() => void confirmIngestEntry()}
              />
            )}
          </div>
        </section>

        <section className="staff-desk__gate staff-desk__gate--exit">
          <GateCamera
            title="Xe ra"
            streamUrl={`${bridgeBaseUrl}/video_feed/${laneRoles.exitLane}`}
            direction="out"
            onStreamStateChange={(state) =>
              setExitBridgeAvailable(state === "live")
            }
          />
          <div className="staff-desk__panel">
            {!activeExit ? (
              <WaitingCard
                direction="out"
                rfidAvailable={exitBridgeAvailable}
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
                onReloadReader={reloadExitReader}
                readerReloading={exitReaderReloading}
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
                noSessionPlate={manualExitPlate}
                onNoSessionPlateChange={(v) => {
                  setManualExitPlate(v.toUpperCase());
                  setManualExitError("");
                }}
                onNoSessionSubmit={() => void prepareManualExit()}
                noSessionLoading={manualExitLoading}
                noSessionError={manualExitError}
                settled={exitSettled}
                receiptPrinting={receiptPrinting}
                receiptPrinted={receiptPrinted}
                receiptError={receiptError}
                onPrintReceipt={() => void printReceipt()}
                onFinishAndOpenGate={() => void finishAndOpenGate()}
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
  onStreamStateChange,
}: {
  title: string;
  streamUrl: string;
  direction: "in" | "out";
  onStreamStateChange?: (state: "live" | "offline") => void;
}) {
  const [streamState, setStreamState] = useState<
    "loading" | "live" | "offline"
  >("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const reloadStream = () => {
    setStreamState("loading");
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="staff-desk__camera">
      <div className="staff-desk__camera-bar">
        <div className="staff-desk__camera-title">
          <Camera size={16} />
          <span>{title}</span>
          <span className={`staff-desk__chip staff-desk__chip--${direction}`}>
            {streamState === "live"
              ? "live"
              : streamState === "offline"
                ? "mất kết nối"
                : "đang kết nối"}
          </span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={reloadStream}>
          <RefreshCcw size={14} /> Tải lại
        </button>
      </div>
      <div className="staff-desk__stream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={reloadKey}
          src={streamUrl}
          alt={title}
          className="staff-desk__stream-img"
          onLoad={() => {
            setStreamState("live");
            onStreamStateChange?.("live");
          }}
          onError={() => {
            setStreamState("offline");
            onStreamStateChange?.("offline");
          }}
        />
        {streamState === "offline" ? (
          <div className="staff-desk__stream-offline">
            Camera không kết nối. Vẫn nhập biển số thủ công để xử lý xe vào/ra.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WaitingCard({
  direction,
  scanPhase,
  onStartScan,
  onCancelScan,
  rfidAvailable = true,
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
  onConfirmManualPlate,
  onConfirmManualPlateNoRfid,
  plateConfirmed,
  onCancelPlateConfirm,
  phase,
}: {
  direction: "in" | "out";
  scanPhase?: "idle" | "starting" | "waiting" | "success" | "timeout" | "error";
  onStartScan?: () => void;
  onCancelScan?: () => void;
  rfidAvailable?: boolean;
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
    activeSession?: {
      id?: string;
      plate: string;
      checkInAt: string;
      slot?: string;
    } | null;
  } | null;
  onToggleManualEntryForm?: () => void;
  onManualEntryPlateChange?: (value: string) => void;
  onSubmitManualEntry?: () => void;
  onOpenVerifiedMember?: () => void;
  onConfirmManualPlate?: (plate: string) => void;
  onConfirmManualPlateNoRfid?: (plate: string) => void;
  plateConfirmed?: boolean;
  onCancelPlateConfirm?: () => void;
  phase?: string;
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

  const bridgeOfflineAlert = !rfidAvailable ? (
    <div
      className="staff-desk__alert staff-desk__alert--warn"
      role="alert"
      style={{
        width: "100%",
        maxWidth: 420,
        margin: "0 0 0.75rem",
        textAlign: "left",
      }}
    >
      <CircleAlert
        size={20}
        style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }}
      />
      <div>
        <strong
          style={{ color: "#dc2626", display: "block", marginBottom: 2 }}
        >
          Mất kết nối thiết bị
        </strong>
        <span
          style={{ fontSize: "0.85rem", color: "#374151", lineHeight: 1.4 }}
        >
          Hiện tại camera, barie và RFID đều mất kết nối. Hãy nhập thủ công biển
          số bằng tay để cho khách {isEntry ? "vào" : "ra"} bãi, barie sẽ mở thủ
          công ngoài bốt.
        </span>
      </div>
    </div>
  ) : null;

  // Entry manual form: simple confirm plate screen (wireframe)
  if (isEntry && showManualForm) {
    return (
      <div className="staff-desk__waiting staff-desk__waiting--entry staff-desk__waiting--manual-confirm">
        {bridgeOfflineAlert}
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
      {bridgeOfflineAlert}
      <p>
        Nếu camera không thể nhận diện biển số hãy dùng nút nhập thủ công biển
        số xe
      </p>

      {isEntry && manualEntryPlate && !showManualForm && !plateConfirmed ? (
        <div className="staff-desk__manual-vehicle-details">
          <strong>Thông tin biển số {manualEntryPlate}</strong>
          {manualEntryVehicle?.ownerName ? (
            <span>Chủ xe: {manualEntryVehicle.ownerName}</span>
          ) : (
            <span>Chủ xe: Khách vãng lai (chưa có hồ sơ đăng ký)</span>
          )}
          {manualEntryVehicle?.isSubscriber ? (
            <span>Gói thành viên đang hiệu lực</span>
          ) : manualEntryVehicle?.cardUid ? (
            <span style={{ color: "#b91c1c", fontWeight: 600 }}>
              Gói đăng ký: Đã hết hạn
            </span>
          ) : null}
          {manualEntryVehicle?.cardUid ? (
            <span>RFID Member: {manualEntryVehicle.cardUid}</span>
          ) : null}
        </div>
      ) : null}

      {isEntry && manualEntryPlate && !showManualForm && !plateConfirmed ? (
        <div style={{ width: "100%", maxWidth: 396, margin: "0.75rem auto 0" }}>
          <label
            className="staff-desk__exit-manual-label"
            htmlFor="manual-entry-confirmation-note"
          >
            Ghi chú xác nhận
          </label>
          <textarea
            id="manual-entry-confirmation-note"
            className="staff-desk__exit-manual-input"
            value={manualEntryConfirmationNote || ""}
            onChange={(event) =>
              onManualEntryConfirmationNoteChange?.(event.target.value)
            }
            placeholder="VD: Đã đối chiếu biển số xe thực tế, thông tin chính xác"
            rows={3}
          />
        </div>
      ) : null}
      {isEntry &&
      manualEntryPlate &&
      !showManualForm &&
      (manualEntryVehicle?.activeSession || manualError) ? (
        <div
          className="staff-desk__alert staff-desk__alert--warn"
          role="alert"
          style={{
            width: "100%",
            maxWidth: 420,
            margin: "0.5rem auto",
            textAlign: "left",
          }}
        >
          <CircleAlert
            size={20}
            style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }}
          />
          <div>
            <strong
              style={{ color: "#dc2626", display: "block", marginBottom: 2 }}
            >
              Xe đang có phiên gửi trong bãi (chưa checkout)
            </strong>
            <span
              style={{ fontSize: "0.85rem", color: "#374151", lineHeight: 1.4 }}
            >
              {manualError ||
                `Biển số ${manualEntryPlate} chưa checkout khỏi bãi (vào lúc ${
                  manualEntryVehicle?.activeSession?.checkInAt
                    ? new Date(
                        manualEntryVehicle.activeSession.checkInAt,
                      ).toLocaleString("vi-VN")
                    : ""
                }). Không thể tạo phiên mới và không mở barie.`}
            </span>
          </div>
        </div>
      ) : null}

      {isEntry && !showManualForm && !manualEntryPlate && manualError ? (
        <p
          className="staff-desk__hint staff-desk__hint--danger"
          style={{ maxWidth: 360, margin: "0.5rem auto" }}
        >
          <CircleAlert size={16} /> {manualError}
        </p>
      ) : null}

      <div
        className="staff-desk__exit-idle-actions"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "100%",
          maxWidth: 360,
          margin: "0 auto",
        }}
      >
        {/* Nút xử lý thủ công nhanh: xác nhận biển số chính xác & quét RFID */}
        {isEntry && manualEntryPlate && !showManualForm && !plateConfirmed ? (
          manualEntryVehicle?.activeSession ? (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{
                width: "100%",
                justifyContent: "center",
                background: "#ef4444",
                borderColor: "#dc2626",
                opacity: 0.75,
                cursor: "not-allowed",
                fontWeight: 700,
              }}
              disabled
              title="Xe đang có phiên gửi trong bãi chưa checkout"
            >
              <CircleAlert size={18} />
              Đang có phiên gửi — Không thể cho vào
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{
                width: "100%",
                justifyContent: "center",
                background: "#16a34a",
                borderColor: "#15803d",
                fontWeight: 700,
              }}
              disabled={Boolean(manualLoading) || phase === "creating"}
              onClick={() => {
                if (!manualEntryPlate) return;
                if (rfidAvailable) {
                  onConfirmManualPlate?.(manualEntryPlate);
                } else {
                  // Bridge offline: không quét được RFID — xác nhận mắt thường
                  // rồi tạo phiên luôn (entryRfidUnverified trong payload).
                  onConfirmManualPlateNoRfid?.(manualEntryPlate);
                }
              }}
            >
              {phase === "creating" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              {rfidAvailable
                ? "Xác nhận biển số chính xác & Quét RFID ngay"
                : "Xác nhận biển số chính xác & Cho xe vào"}
            </button>
          )
        ) : null}

        {isEntry &&
        manualEntryVehicle?.cardUid &&
        !showManualForm &&
        !plateConfirmed &&
        !manualEntryVehicle?.activeSession ? (
          <button
            type="button"
            className="btn btn-ghost staff-desk__exit-manual-btn"
            onClick={onOpenVerifiedMember}
            disabled={Boolean(manualLoading)}
          >
            Mở barie cho xe thành viên
          </button>
        ) : null}
        {!showManualForm && !(isEntry && plateConfirmed) ? (
          <button
            type="button"
            className="btn btn-primary staff-desk__exit-manual-btn"
            onClick={onToggleManual}
          >
            {manualEntryPlate
              ? "Nhập lại thông tin biển số xe"
              : "Nhập thủ công biển số xe"}
          </button>
        ) : isEntry && plateConfirmed ? (
          <button
            type="button"
            className="btn btn-ghost staff-desk__plate-reedit"
            onClick={() => onCancelPlateConfirm?.()}
          >
            Nhập lại thông tin biển số xe
          </button>
        ) : (
          <form
            className="staff-desk__exit-manual-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitManual?.();
            }}
          >
            <label
              className="staff-desk__exit-manual-label"
              htmlFor={plateInputId}
            >
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
              <p
                className="staff-desk__hint staff-desk__hint--danger staff-desk__hint--large"
              >
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
                    <Loader2 size={16} className="animate-spin" />{" "}
                    {loadingLabel}
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

      {/* Ẩn hoàn toàn khu vực RFID ở cổng vào khi không kết nối được thiết bị bridge (tránh hiện Đang chờ quẹt thẻ RFID thừa thãi).
          Khi đã nhập biển nhưng chưa bấm xác nhận cũng ẩn — chỉ hiện bước RFID sau khi staff xác nhận. */}
      {isEntry &&
      onStartScan &&
      rfidAvailable &&
      !showManualForm &&
      !(manualEntryPlate && !plateConfirmed) &&
      !scanError?.includes("bridge") &&
      scanPhase !== "error" ? (
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
              {scanPhase === "timeout" && onManualUid ? (
                <ManualUidInput onSubmit={onManualUid} />
              ) : null}
              {scanPhase === "timeout" && (
                <p className="staff-desk__hint staff-desk__hint--warn">
                  Hết thời gian chờ quét thẻ.
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
        className="btn btn-ghost"
        onClick={() => setOpen(true)}
      >
        <CreditCard size={16} /> Nhập UID thủ công
      </button>
    );
  }
  return (
    <form
      className="staff-desk__exit-manual-form"
      onSubmit={(e) => {
        e.preventDefault();
        const value = uid.trim();
        if (!value) return;
        onSubmit(value);
      }}
    >
      <label
        className="staff-desk__exit-manual-label"
        htmlFor="manual-uid-input"
      >
        UID thẻ RFID
      </label>
      <input
        id="manual-uid-input"
        className="staff-desk__exit-manual-input"
        value={uid}
        onChange={(e) => setUid(e.target.value)}
        placeholder="VD: 60A99999 hoặc 04AABB12"
        autoFocus
        autoComplete="off"
      />
      <div className="staff-desk__exit-manual-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!uid.trim()}
        >
          <CheckCircle2 size={16} /> Xác nhận
        </button>
        <button
          type="button"
          className="btn btn-ghost"
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
        <div
          className="staff-desk__rfid-conflict"
          role="status"
          style={{ marginTop: "0.5rem" }}
        >
          {cardInfo.card ? (
            <>
              <div className="staff-desk__rfid-conflict-title">
                <Nfc size={15} />
                {cardInfo.card.cardType === "member"
                  ? "Thẻ Member"
                  : "Thẻ Guest"}{" "}
                · {cardInfo.card.status}
              </div>
              <div className="staff-desk__rfid-conflict-grid">
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
              <LogIn size={16} />{" "}
              {plateConfirmed ? "Xác nhận & Mở barie" : "Tạo phiên & Mở barie"}
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
  blockingSession?: { plate: string; checkInAt?: string; slot?: string } | null;
  phase: Phase;
  createMsg: string;
  barrierMsg: string;
  createdSession: { id: string; slot?: string; plate?: string } | null;
  onDismiss: () => void;
  scanPhase: "idle" | "starting" | "waiting" | "success" | "timeout" | "error";
  scanUid: string;
  scanError: string;
  onStartScan: () => void;
  onCancelScan: () => void;
  reviewPlate: string;
  reviewPlateError: string;
  reviewNote: string;
  onReviewPlateChange: (value: string) => void;
  onReviewNoteChange: (value: string) => void;
  onConfirm: () => void;
}) {
  const { event } = props;
  const imgUrl = resolveBridgeImageUrl(event.imagePath);
  const expectedRfidUid =
    typeof event.metadata?.expectedRfidUid === "string"
      ? event.metadata.expectedRfidUid
      : "";
  // Thẻ Member khách đã mua đứt cho biển số này (kể cả khi gói đăng ký đã
  // hết hạn) — hiện UID để nhân viên đối chiếu thẻ vật lý của khách.
  const purchasedCardUid =
    typeof event.metadata?.purchasedCardUid === "string"
      ? event.metadata.purchasedCardUid
      : "";
  const linkedRfidUid = purchasedCardUid || expectedRfidUid;
  const displayUserType =
    event.userType === "resident" || Boolean(event.metadata?.isSubscriber)
      ? "resident"
      : event.userType;
  // Gói đăng ký gắn với biển số: còn hiệu lực / hết hạn / không có.
  const subscriptionLabel = event.metadata?.isSubscriber
    ? "Còn hiệu lực"
    : typeof event.metadata?.subscriptionStatus === "string" &&
        event.metadata.subscriptionStatus
      ? "Hết hạn"
      : "Không có";
  const duplicateSession =
    event.duplicateSession === true ||
    event.action === "duplicate" ||
    Boolean(props.blockingSession);
  const duplicateCheckInAt = props.blockingSession?.checkInAt
    ? new Date(props.blockingSession.checkInAt).toLocaleString("vi-VN")
    : "";
  const eventIsStale =
    event.sessionStatus === "Đang gửi" ||
    event.sessionStatus === "Đã hoàn thành";
  const norm = (p: string) =>
    p
      .trim()
      .toUpperCase()
      .replace(/[\s.\-]+/g, "");
  const detected = norm(event.detectedPlate || event.plate || "");
  const edited = norm(props.reviewPlate || "");
  const aiPlateMissing = !detected;
  const plateCorrected =
    Boolean(detected) && edited.length >= 5 && edited !== detected;
  const rfidConflict = parseRfidConflict(props.scanError);
  const busy = props.phase === "creating" || props.phase === "opening";
  // Đang có lỗi thẻ RFID (thẻ member sai xe...) thì CHƯA cho tạo phiên/mở
  // barie: nhân viên phải quét lại đúng thẻ hoặc hủy quét trước.
  const scanBlocked = props.scanPhase === "error" && !!props.scanError;
  const canConfirm =
    edited.length >= 5 &&
    (!plateCorrected || props.reviewNote.trim().length >= 8) &&
    !busy &&
    !scanBlocked;

  // Sau khi AI đọc biển, hỏi nhân viên xác nhận biển đúng chưa TRƯỚC khi
  // bật quét RFID: "ask" → hỏi, "confirmed" → biển đúng, đang quét thẻ,
  // "edit" → sai, nhập lại biển.
  const [plateStep, setPlateStep] = useState<"ask" | "confirmed" | "edit">(
    detected ? "ask" : "edit",
  );
  const ingestEventId = event.id || detected;
  useEffect(() => {
    setPlateStep(detected ? "ask" : "edit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingestEventId]);
  const showAsk = plateStep === "ask" && !busy && !eventIsStale;
  // Chỉ hiện nút "Tạo phiên & Mở barie" sau khi mọi bước kiểm tra đã xong:
  // biển số đã được xác nhận (không còn đang hỏi/nhập lại) VÀ không còn bước
  // quét RFID nào đang chờ, đang lỗi hay đang chờ nhân viên bấm quét.
  const rfidPending =
    !showAsk &&
    (props.scanPhase === "starting" ||
      props.scanPhase === "waiting" ||
      props.scanPhase === "error" ||
      props.scanPhase === "timeout");
  const showConfirmButton = !showAsk && !rfidPending;

  // Sau khi AI đọc biển, hỏi nhân viên xác nhận biển đúng chưa TRƯỚC khi
  // bật quét RFID: "ask" → hỏi, "confirmed" → biển đúng, đang quét thẻ,
  // "edit" → sai, nhập lại biển.
  const [plateStep, setPlateStep] = useState<"ask" | "confirmed" | "edit">(
    detected ? "ask" : "edit",
  );
  const ingestEventId = event.id || detected;
  useEffect(() => {
    setPlateStep(detected ? "ask" : "edit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingestEventId]);
  const showAsk = plateStep === "ask" && !busy && !eventIsStale;

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
              AI chưa đọc được biển — nhập biển số bên dưới
            </p>
          ) : null}
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={props.onDismiss}
          aria-label={
            duplicateSession || eventIsStale || props.scanError
              ? "Đóng cảnh báo"
              : "Bỏ qua"
          }
          title={
            duplicateSession || eventIsStale || props.scanError
              ? "Đóng cảnh báo"
              : "Bỏ qua"
          }
        >
          <CircleX size={16} />
        </button>
      </div>

      {imgUrl ? (
        <div className="staff-desk__ingest-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgUrl}
            alt={`Biển số ${event.detectedPlate || "chưa rõ"}`}
          />
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
            typeof event.metadata?.vehicleBrand === "string" &&
            event.metadata.vehicleBrand
              ? typeof event.metadata?.vehicleModel === "string" &&
                event.metadata.vehicleModel
                ? `${event.metadata.vehicleBrand} ${event.metadata.vehicleModel}`
                : event.metadata.vehicleBrand
              : displayUserType === "resident"
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
        <MetaRow
          icon={<Nfc size={14} />}
          label="Thẻ RFID gắn với biển số"
          value={linkedRfidUid || "RFID không gắn sẵn"}
        />
        <MetaRow
          icon={<CalendarCheck size={14} />}
          label="Gói đăng ký"
          value={subscriptionLabel}
        />
        {(event.ownerName || displayUserType === "resident") && (
          <MetaRow
            icon={<CreditCard size={14} />}
            label="Chủ xe"
            value={event.ownerName || "Chưa xác định"}
          />
        )}
      </div>

      {duplicateSession ? (
        <div className="staff-desk__alert staff-desk__alert--warn" role="alert">
          <CircleAlert size={18} />
          <div>
            <strong>Từ chối cho xe vào: xe đang có phiên gửi trong bãi</strong>
            <span>
              Biển {props.blockingSession?.plate || event.plate || event.detectedPlate}
              {duplicateCheckInAt ? ` đã vào lúc ${duplicateCheckInAt}` : ""} chưa
              checkout. Không cho phép quét RFID, tạo phiên mới hoặc mở barie cổng vào.
            </span>
          </div>
        </div>
      ) : eventIsStale ? (
        <div className="staff-desk__alert staff-desk__alert--warn" role="alert">
          <CircleAlert size={18} />
          <span>Phiên xe này đã được xử lý. Chờ xe tiếp theo.</span>
        </div>
      ) : null}

      {/* Khu vực quét thẻ + xác nhận / nhập biển thủ công */}
      {!eventIsStale && !duplicateSession && (
        <div className="staff-desk__action">
          <form
            className="staff-desk__ingest-manual"
            onSubmit={(e) => {
              e.preventDefault();
              if (canConfirm) props.onConfirm();
            }}
          >
            {showAsk ? (
              <div className="staff-desk__plate-ask">
                <p className="staff-desk__plate-ask-question">
                  Biển số AI nhận diện
                </p>
                <p className="staff-desk__plate-ask-value">
                  {event.detectedPlate || event.plate}
                </p>
                <p className="staff-desk__plate-ask-hint">
                  Nhân viên đối chiếu với biển thật trước cổng — đã chính xác
                  chưa?
                </p>
                <div className="staff-desk__plate-ask-buttons">
                  <button
                    type="button"
                    className="btn staff-desk__plate-ask-btn staff-desk__plate-ask-btn--ok"
                    onClick={() => {
                      setPlateStep("confirmed");
                      props.onStartScan();
                    }}
                  >
                    <Nfc size={17} />
                    Biển số chính xác
                    <span>quét RFID ngay</span>
                  </button>
                  <button
                    type="button"
                    className="btn staff-desk__plate-ask-btn staff-desk__plate-ask-btn--warn"
                    onClick={() => setPlateStep("edit")}
                  >
                    <CircleAlert size={17} />
                    Sai thông tin
                    <span>nhập lại biển số</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="staff-desk__ingest-manual-title">
                  {aiPlateMissing
                    ? "Nhập biển số xe thủ công"
                    : plateStep === "confirmed"
                      ? linkedRfidUid
                        ? <>
                            Biển số {props.reviewPlate} — quẹt thẻ RFID
                            <code className="staff-desk__ingest-uid">
                              {linkedRfidUid}
                            </code>
                            của khách vào đầu đọc
                          </>
                        : `Biển số ${props.reviewPlate} — quẹt thẻ RFID của khách vào đầu đọc`
                      : "Đối chiếu biển số AI nhận diện"}
                </p>
                {plateStep !== "edit" && !aiPlateMissing ? null : (
                  <>
                    <input
                      className="staff-desk__manual-confirm-input"
                      value={props.reviewPlate}
                      onChange={(e) =>
                        props.onReviewPlateChange(e.target.value.toUpperCase())
                      }
                      placeholder="30A34567"
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      disabled={busy}
                    />
                    {props.reviewPlateError ? (
                      <p className="staff-desk__hint staff-desk__hint--danger">
                        <CircleAlert size={14} /> {props.reviewPlateError}
                      </p>
                    ) : null}
                  </>
                )}
                {plateStep === "confirmed" ? (
                  <button
                    type="button"
                    className="btn btn-ghost staff-desk__plate-reedit"
                    onClick={() => setPlateStep("edit")}
                  >
                    Sai biển số — nhập lại
                  </button>
                ) : null}
                {plateCorrected ? (
                  <>
                    <textarea
                      className="staff-desk__manual-confirm-input"
                      value={props.reviewNote}
                      onChange={(e) => props.onReviewNoteChange(e.target.value)}
                      placeholder="Giải thích lý do sửa biển số (tối thiểu 8 ký tự)…"
                      rows={2}
                      disabled={busy}
                    />
                    {props.reviewNote.trim().length < 8 ? (
                      <p className="staff-desk__hint staff-desk__hint--warn">
                        Cần ghi chú lý do sửa biển số trước khi xác nhận.
                      </p>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
            {/* Trạng thái thẻ RFID (chỉ hiện sau khi đã xác nhận biển số) */}
            {!showAsk &&
              (props.scanPhase === "success" && props.scanUid ? (
              <div className="staff-desk__scan-success">
                <CheckCircle2 size={20} className="text-emerald-500" />
                <div>
                  <p className="staff-desk__scan-success-title">Đã nhận thẻ</p>
                  <code className="staff-desk__scan-uid">{props.scanUid}</code>
                </div>
              </div>
            ) : (props.scanPhase === "waiting" ||
                props.scanPhase === "starting") &&
              !props.scanError?.includes("bridge") ? (
              <div className="staff-desk__scan-active">
                <div className="staff-desk__scan-pulse">
                  <Nfc size={32} className="animate-pulse" />
                </div>
                <p>Đang chờ nhân viên quẹt thẻ RFID lên đầu đọc cổng vào…</p>
                <button
                  className="btn btn-ghost"
                  onClick={props.onCancelScan}
                  disabled={busy}
                >
                  Hủy quét
                </button>
              </div>
            ) : (
              <div className="staff-desk__scan-cta">
                <button
                  className="btn btn-ghost"
                  onClick={props.onStartScan}
                  disabled={busy}
                >
                  <Nfc size={16} />{" "}
                  {props.scanPhase === "error"
                    ? "Quét lại RFID"
                    : "Quét thẻ RFID (tùy chọn)"}
                </button>
                {props.scanPhase === "timeout" && (
                  <p className="staff-desk__hint staff-desk__hint--warn">
                    Hết thời gian chờ quét thẻ.
                  </p>
                )}
                {props.scanPhase === "error" &&
                  props.scanError &&
                  (rfidConflict ? (
                    <div className="staff-desk__rfid-conflict" role="alert">
                      <div className="staff-desk__rfid-conflict-title">
                        <CircleAlert size={15} /> Không thể cấp RFID Guest cho
                        xe này
                      </div>
                      <div className="staff-desk__rfid-conflict-grid">
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
                        <strong>{rfidConflict.assignedPlate}</strong>, nên không
                        thể cấp tiếp cho xe{" "}
                        <strong>{rfidConflict.attemptedPlate}</strong>.
                      </p>
                    </div>
                  ) : (
                    <div
                      className="staff-desk__scan-error"
                      role="alert"
                      aria-live="assertive"
                    >
                      <CircleAlert
                        size={22}
                        className="shrink-0 text-red-600"
                      />
                      <p className="staff-desk__scan-error-text">
                        {props.scanError}
                      </p>
                    </div>
                  ))}
              </div>
            ))}
            {showConfirmButton && !showAsk && (
              <div className="staff-desk__exit-manual-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!canConfirm}
              >
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Đang xử lý…
                  </>
                ) : (
                  <>
                    <LogIn size={16} /> Tạo phiên ngay &amp; Mở barie
                  </>
                )}
              </button>
              {scanBlocked ? (
                <p className="staff-desk__hint staff-desk__hint--warn">
                  Đang có lỗi thẻ RFID — quét lại đúng thẻ hoặc hủy quét trước
                  khi mở barie.
                </p>
              ) : null}
              </div>
            )}
          </form>

          {/* Trạng thái xác nhận thông tin / mở barie */}
          {props.phase !== "idle" ? (
            <div
              className={`staff-desk__progress staff-desk__progress--${props.phase}`}
            >
              {props.phase === "creating" && (
                <p>
                  <Loader2 size={16} className="animate-spin" /> Đang xác nhận
                  thông tin & tạo phiên đỗ xe…
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
              {props.createMsg && props.phase !== "error" ? (
                <p className="staff-desk__hint">{props.createMsg}</p>
              ) : null}
              {props.barrierMsg && props.phase !== "error" ? (
                <p className="staff-desk__hint">{props.barrierMsg}</p>
              ) : null}
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
      <figure className="staff-desk__evidence">
        <button
          type="button"
          className="staff-desk__evidence-button"
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
          className="staff-desk__image-modal"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="staff-desk__image-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="staff-desk__image-modal-close"
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
    <div className="staff-desk__evidence staff-desk__exit-crop--empty">
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
  onReloadReader,
  readerReloading,
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
  noSessionPlate,
  onNoSessionPlateChange,
  onNoSessionSubmit,
  noSessionLoading,
  noSessionError,
  settled,
  receiptPrinting,
  receiptPrinted,
  receiptError,
  onPrintReceipt,
  onFinishAndOpenGate,
}: {
  event: CameraIngestEvent;
  onDismiss: () => void;
  onOpenBarrier: () => void;
  onScanRfid?: () => void;
  onReloadReader?: () => void;
  readerReloading?: boolean;
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
    freeMinutes?: number | null;
    totalMinutes?: number | null;
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
  onManualMissingEntryRfid?: (note: string, completeOffline?: boolean) => void;
  onPayCash?: (receivedAmount: number) => void;
  onPayPayos?: () => void;
  scanUid?: string;
  noSessionPlate?: string;
  onNoSessionPlateChange?: (value: string) => void;
  onNoSessionSubmit?: () => void;
  noSessionLoading?: boolean;
  noSessionError?: string;
  settled?: boolean;
  receiptPrinting?: boolean;
  receiptPrinted?: boolean;
  receiptError?: string;
  onPrintReceipt?: () => void;
  onFinishAndOpenGate?: () => void;
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
  const fullHardwareOutage = /bridge|port\s*5050/i.test(gateError || "");
  // Thẻ thay thế (đổi thẻ mới khi thẻ cũ hỏng/mất). Khi có giá trị này, xe
  // đang dùng thẻ mới thay cho thẻ đã quét lúc vào → hiển thị để nhân viên biết.
  const replacementCardUid =
    typeof event.metadata?.replacementCardUid === "string"
      ? event.metadata.replacementCardUid
      : "";
  // UID thẻ khách cần quẹt lúc ra: thẻ thay thế nếu đổi thẻ, ngược lại thẻ lúc vào.
  const expectedExitRfidUid = replacementCardUid || entryRfidUid || "";
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
  // Gói đăng ký của thành viên đã hết hạn/hủy (từ metadata phiên xe ra) —
  // không còn miễn phí, staff phải thu phí phiên.
  const subscriptionStatus =
    typeof event.metadata?.subscriptionStatus === "string"
      ? (event.metadata.subscriptionStatus as string)
      : "";
  // Tên gói + ngày hết hạn (cả gói còn hạn lẫn hết hạn) để staff đối chiếu.
  const subscriptionPlan =
    typeof event.metadata?.subscriptionPlan === "string"
      ? (event.metadata.subscriptionPlan as string)
      : "";
  const subscriptionEndDate = event.metadata?.subscriptionEndDate as
    | string
    | null;
  const subscriptionLapsed =
    customerType === "member" &&
    subscriptionStatus !== "" &&
    subscriptionStatus !== "active";
  const displayOwnerName = event.ownerName || "—";
  const vehicleTypeLabel =
    typeof event.metadata?.vehicleBrand === "string" &&
    event.metadata.vehicleBrand
      ? typeof event.metadata?.vehicleModel === "string" &&
        event.metadata.vehicleModel
        ? `${event.metadata.vehicleBrand} ${event.metadata.vehicleModel}`
        : event.metadata.vehicleBrand
      : customerType === "member"
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
      return "Khách có gói đăng ký";
    }
    // Gói đã hết hạn/hủy: vẫn là thành viên nhưng phải thu phí phiên.
    if (subscriptionLapsed) {
      return "Gói đăng ký hết hạn";
    }
    if (customerType === "member") {
      return "Khách có gói đăng ký";
    }
    // "Miễn phí theo quy định" chỉ khi thời gian ra thực sự nằm trong khoảng
    // miễn phí admin cài (totalMinutes <= freeMinutes) — từ verify hoặc metadata
    // pending-exit (bridge offline chưa qua verify).
    const freeWin =
      exitVerifyData?.freeMinutes != null &&
      exitVerifyData.totalMinutes != null
        ? {
            free: exitVerifyData.freeMinutes,
            total: exitVerifyData.totalMinutes,
          }
        : typeof event.metadata?.freeMinutes === "number" &&
            typeof event.metadata?.totalMinutes === "number"
          ? {
              free: event.metadata.freeMinutes as number,
              total: event.metadata.totalMinutes as number,
            }
          : null;
    if (
      freeWin &&
      freeWin.free > 0 &&
      freeWin.total <= freeWin.free &&
      amountDue <= 0
    ) {
      return "Miễn phí theo quy định";
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
    paymentLabel === "Gói đăng ký hết hạn"
      ? "warn"
      : paymentLabel === "Khách có gói đăng ký"
        ? "member"
        : paymentLabel === "Đã thanh toán" || paymentLabel.includes("Miễn phí")
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
      return expectedExitRfidUid
        ? `Hãy đặt thẻ RFID ${expectedExitRfidUid} của khách vào đầu đọc`
        : "Hãy đặt thẻ RFID của khách vào đầu đọc";
    }
    if (scanPhase === "success" && !exitVerifyData)
      return "Đang xác minh thẻ RFID…";
    if (scanPhase === "error") return "Thẻ không hợp lệ — quét lại";
    if (scanPhase === "timeout") return "Hết thời gian — quét lại thẻ RFID";
    if (exitVerifyData?.canOpenGate) return "Thẻ hợp lệ — có thể mở barie";
    return expectedExitRfidUid
      ? `Hãy đặt thẻ RFID ${expectedExitRfidUid} của khách vào đầu đọc`
      : "Hãy đặt thẻ RFID của khách vào đầu đọc";
  })();

  // Camera đọc biển không khớp phiên đang gửi. Không được cho luồng RFID,
  // thanh toán hoặc xác nhận thủ công chạy khi backend chưa xác định session.
  if (noSession) {
    const detected = event.detectedPlate || event.plate || "";
    return (
      <div className="staff-desk__exit-console">
        <div className="staff-desk__exit-top">
          <div className="staff-desk__exit-title-row">
            <div>
              <p className="staff-desk__exit-kicker">Xe ra</p>
              <h2 className="staff-desk__exit-plate">{detected || "—"}</h2>
            </div>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={onDismiss}
              aria-label="Đóng cảnh báo"
            >
              <XCircle size={16} />
            </button>
          </div>
          <div
            className="staff-desk__alert staff-desk__alert--danger staff-desk__alert--large"
            role="alert"
          >
            <CircleAlert size={22} />
            <div>
              <strong>
                Không tìm thấy phiên đang gửi cho biển số {detected || "này"}
              </strong>
              <span>Nếu nhận diện sai hãy nhập bằng tay lại thông tin biển số xe</span>
            </div>
          </div>

          <form
            className="staff-desk__exit-manual-form"
            onSubmit={(e) => {
              e.preventDefault();
              onNoSessionSubmit?.();
            }}
          >
            <label
              className="staff-desk__exit-manual-label"
              htmlFor="no-session-exit-plate"
            >
              Nhập biển số xe thủ công
            </label>
            <input
              id="no-session-exit-plate"
              className="staff-desk__exit-manual-input"
              value={noSessionPlate || detected}
              onChange={(e) => onNoSessionPlateChange?.(e.target.value)}
              placeholder="VD: 30A12345"
              autoComplete="off"
            />
            {noSessionError ? (
              <p className="staff-desk__hint staff-desk__hint--danger staff-desk__hint--large">
                {noSessionError}
              </p>
            ) : null}
            <div className="staff-desk__exit-manual-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={Boolean(noSessionLoading)}
              >
                {noSessionLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Đang tra…
                  </>
                ) : (
                  "Nhập bằng tay biển số xe"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-desk__exit-console">
      {event.barrierOpened &&
        !fullHardwareOutage &&
        !exitRfidManuallyVerified && (
          <div className="staff-desk__gate-success" role="status">
            <CheckCircle2 size={22} />
            <div>
              <strong>Mở barie thành công</strong>
              <span>Đang chờ xe đi qua — đóng lại sau 5 giây…</span>
            </div>
          </div>
        )}
      <div className="staff-desk__exit-top">
        <div className="staff-desk__exit-title-row">
          <div>
            <p className="staff-desk__exit-kicker">
              Xe ra -{" "}
              {customerType === "member"
                ? event.metadata?.quotaType === "member"
                  ? "Thành Viên"
                  : "Thành Viên (chưa có gói)"
                : "Khách Vãng Lai"}
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
          <div className="staff-desk__evidence-grid">
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
              <span className="staff-desk__exit-label">Gói đăng ký</span>
              <strong
                className={
                  "staff-desk__exit-status staff-desk__exit-status--" +
                  (isSubscriber ? "ok" : subscriptionLapsed ? "warn" : "muted")
                }
              >
                {subscriptionPlan
                  ? `${subscriptionPlan} — ${subscriptionEndDate ? "còn hạn đến " + formatDateTime(subscriptionEndDate) : ""}`.trim()
                  : subscriptionLapsed
                    ? `Hết hạn${subscriptionEndDate ? " " + formatDateTime(subscriptionEndDate) : ""}`
                    : "Không có"}
              </strong>
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
              <span className="staff-desk__exit-label">
                Trạng thái thanh toán
              </span>
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
              <span className="staff-desk__exit-label">
                UID Thẻ RFID Lúc Vào
              </span>
              <strong className="staff-desk__exit-status staff-desk__exit-status--muted">
                {entryRfidUid
                  ? entryRfidIsExpected
                    ? `${entryRfidUid} (chưa xác minh)`
                    : entryRfidUid
                  : "Chưa đọc"}
              </strong>
            </div>
            {replacementCardUid && replacementCardUid !== entryRfidUid ? (
              <div className="staff-desk__exit-field">
                <span className="staff-desk__exit-label">
                  Thẻ thay thế (đã đổi)
                </span>
                <strong className="staff-desk__exit-status staff-desk__exit-status--muted">
                  {replacementCardUid}
                </strong>
              </div>
            ) : null}
            <div className="staff-desk__exit-field">
              <span className="staff-desk__exit-label">
                UID Thẻ RFID Lúc Ra
              </span>
              <strong className="staff-desk__exit-status staff-desk__exit-status--muted">
                {scanUid ||
                  (exitRfidManuallyVerified
                    ? "Xác nhận thủ công"
                    : "Chưa quẹt thẻ")}
              </strong>
            </div>
            {exitRfidManuallyVerified ? (
              <div className="staff-desk__exit-field staff-desk__exit-field--full">
                <span className="staff-desk__exit-label">
                  Ghi chú xử lý RFID
                </span>
                <strong className="staff-desk__exit-status staff-desk__exit-status--muted">
                  {exitRfidManualNote || "Đã xác nhận thủ công do RFID lỗi."}
                </strong>
              </div>
            ) : null}
            {entryWasManual ? (
              <div className="staff-desk__exit-field staff-desk__exit-field--full">
                <span className="staff-desk__exit-label">Ngoại lệ lúc vào</span>
                <strong className="staff-desk__exit-status staff-desk__exit-status--warn">
                  Nhập tay biển số
                </strong>
                <span className="staff-desk__entry-exception-note">
                  {manualEntryReason ||
                    "Nhân viên đã nhập biển số thủ công khi xe vào."}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!mismatch ? (
        <div className="staff-desk__exit-rfid">
          <div
            className={`staff-desk__exit-rfid-card${
              fullHardwareOutage
                ? " staff-desk__exit-rfid-card--hardware-outage"
                : ""
            }`}
          >
            {/* Nút xử lý thủ công nhanh — CHỈ khi mất kết nối hoàn toàn với bridge
                (lỗi timeout/quét thất bại thường thì không hiện, tránh loạn màn hình) */}
            {fullHardwareOutage &&
            !exitVerifyData &&
            !hasPaymentData &&
            !didCheckout ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: "14px 16px",
                  background: "rgba(59, 130, 246, 0.08)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: "#1e40af",
                    marginBottom: 10,
                    fontWeight: 600,
                  }}
                >
                  Chế độ xử lý thủ công (phần cứng mất kết nối / không quẹt thẻ)
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    background: "#2563eb",
                    fontWeight: 700,
                  }}
                  disabled={mismatchPending}
                  onClick={() =>
                    onManualMissingEntryRfid?.(
                      "Đã đối chiếu chính xác biển số thủ công",
                      true,
                    )
                  }
                >
                  {mismatchPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  Xác nhận đã đối chiếu chính xác biển số
                </button>
              </div>
            ) : null}

            {/* Nếu mất kết nối bridge hoặc đã xác nhận thủ công thì ẩn hoàn toàn dòng nhắc 'Thẻ không hợp lệ — quét lại' */}
            {fullHardwareOutage ||
            exitRfidManuallyVerified ||
            Boolean(exitRfidManualNote) ? null : (
              <p className="staff-desk__exit-rfid-prompt">{rfidPrompt}</p>
            )}

            {noSession ? (
              <div className="staff-desk__alert staff-desk__alert--danger">
                <CircleAlert size={18} />
                <span>Không tìm thấy phiên đang gửi cho biển số này.</span>
              </div>
            ) : null}

            {gateError && !didCheckout ? (
              <div
                className="staff-desk__alert staff-desk__alert--danger"
                role="alert"
              >
                <CircleAlert size={18} />
                <span>{gateError}</span>
                {!fullHardwareOutage ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onOpenGate || onOpenBarrier}
                  >
                    <RefreshCcw size={16} /> Thử lại
                  </button>
                ) : null}
              </div>
            ) : null}

            {canHandleMissingEntryRfid &&
            !exitVerifyData &&
            !hasPaymentData &&
            !fullHardwareOutage ? (
              <div className="staff-desk__manual-rfid">
                <p>
                  Không có UID RFID lúc vào. Nhân viên có thể xác nhận thủ công
                  sau khi kiểm tra xe và biển số.
                </p>
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
                      onChange={(event) =>
                        setManualRfidNote(event.target.value)
                      }
                      placeholder={
                        fullHardwareOutage
                          ? "Xác nhận đã kiểm tra biển số xe khớp luồng vào (tối thiểu 8 ký tự)"
                          : "Ghi rõ lý do xác nhận thủ công (tối thiểu 8 ký tự)"
                      }
                    />
                    <div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={mismatchPending}
                        onClick={() =>
                          onManualMissingEntryRfid?.(
                            manualRfidNote.trim(),
                            fullHardwareOutage,
                          )
                        }
                      >
                        {mismatchPending ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : null}
                        {fullHardwareOutage
                          ? "Xác nhận biển số khớp"
                          : "Xác nhận thủ công"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setShowManualRfidForm(false)}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {settled ? (
              <div
                className="staff-desk__alert staff-desk__alert--success"
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    color: "#15803d",
                  }}
                >
                  <CheckCircle2 size={22} />
                  <span>Đã thu tiền — chờ in biên lai</span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "#166534" }}>
                  In biên lai cho khách, sau đó bấm "Kết thúc phiên, mở barie"
                  để xe ra.
                </div>
                {receiptError ? (
                  <div style={{ fontSize: "0.8rem", color: "#b91c1c" }}>
                    {receiptError}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onPrintReceipt}
                    disabled={!onPrintReceipt || receiptPrinting}
                  >
                    <Printer size={16} />
                    {receiptPrinting
                      ? "Đang tải biên lai…"
                      : receiptPrinted
                        ? "In lại biên lai"
                        : "In biên lai"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onFinishAndOpenGate}
                    disabled={!onFinishAndOpenGate}
                  >
                    Kết thúc phiên, mở barie
                  </button>
                </div>
              </div>
            ) : didCheckout || event.barrierOpened ? (
              <div
                className="staff-desk__alert staff-desk__alert--success"
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    color: "#15803d",
                  }}
                >
                  <CheckCircle2 size={22} />
                  <span>Phiên đã hoàn tất!</span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "#166534" }}>
                  Xe đã thanh toán và hoàn tất xuất bến. Màn hình sẽ tự động
                  đóng sau 5 giây để đón lượt xe mới.
                </div>{" "}
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
                    <span>
                      Phí cần thu: {amountDue.toLocaleString("vi-VN")}đ
                    </span>
                    <div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!onPayCash}
                        onClick={() => onPayCash?.(amountDue)}
                      >
                        Xác nhận đã thu đủ tiền mặt
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
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
                <div className="staff-desk__cash-form">
                  <strong>Thu tiền mặt</strong>
                  <span>Phí cần thu: {amountDue.toLocaleString("vi-VN")}đ</span>
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!onPayCash}
                      onClick={() => onPayCash?.(amountDue)}
                    >
                      Xác nhận đã thu đủ tiền mặt
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowCashForm(false)}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="staff-desk__qr-box">
                  <p className="staff-desk__qr-amount">
                    {(paymentData?.amount || amountDue).toLocaleString("vi-VN")}
                    đ
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
            ) : (scanPhase === "starting" || scanPhase === "waiting") &&
              !fullHardwareOutage ? (
              entryRfidUid ? (
                <div className="staff-desk__exit-rfid-waiting">
                  <div className="staff-desk__scan-pulse">
                    <Nfc size={32} className="animate-pulse" />
                  </div>
                  <span>Đang chờ quét thẻ…</span>
                  {onReloadReader ? (
                    <button
                      className="btn btn-primary btn-lg"
                      disabled={readerReloading}
                      onClick={() => void onReloadReader()}
                    >
                      <RefreshCcw size={18} className={readerReloading ? "animate-spin" : ""} />
                      {readerReloading ? "Đang khởi động lại…" : "Khởi động lại đầu đọc"}
                    </button>
                  ) : null}
                  {onManualMissingEntryRfid && entryRfidUid ? (
                    <div className="staff-desk__manual-rfid-form">
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
                        className="btn btn-ghost btn-lg"
                        disabled={false}
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
            ) : (scanPhase === "error" || scanPhase === "timeout") &&
              !fullHardwareOutage ? (
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
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={onScanRfid}
                  >
                    <Nfc size={18} /> Quét lại thẻ RFID
                  </button>
                ) : null}
                {onReloadReader ? (
                  <button
                    className="btn btn-ghost btn-lg"
                    disabled={readerReloading}
                    onClick={() => void onReloadReader()}
                  >
                    <RefreshCcw size={18} className={readerReloading ? "animate-spin" : ""} />
                    {readerReloading ? "Đang khởi động lại…" : "Khởi động lại đầu đọc"}
                  </button>
                ) : null}
                {entryRfidUid && onManualMissingEntryRfid ? (
                  <div className="staff-desk__manual-rfid-form">
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
                      className="btn btn-ghost btn-lg"
                      disabled={
                        manualRfidNote.trim().length < 8 ||
                        !onManualMissingEntryRfid
                      }
                      onClick={() =>
                        onManualMissingEntryRfid(manualRfidNote.trim())
                      }
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
            ) : exitVerifyData && !fullHardwareOutage ? (
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
