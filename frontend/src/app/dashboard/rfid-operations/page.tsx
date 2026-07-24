"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle,
  History,
  KeyRound,
  Loader2,
  MapPin,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { RoleGuard } from "@/components/layout/role-guard";
import { apiFetch } from "@/lib/client-api";
import {
  assignRfidCard,
  confirmRfidExit,
  returnRfidCard,
} from "@/features/rfid/rfid-api";
import type { RfidScanLog } from "@/types";
import { RfidScanLogTable } from "@/features/rfid/components/RfidScanLogTable";

function fmt(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type ScanResult = {
  valid: boolean;
  message?: string;
  card?: { cardId: string; status: string; id?: string };
  session?: {
    _id?: string;
    id?: string;
    plate?: string;
    plateNumber?: string;
    slot?: string;
    checkInAt?: string;
  };
  mismatch?: boolean;
  plateDetected?: string;
};

function sessionIdOf(session?: ScanResult["session"]) {
  return session?._id || session?.id || "";
}

/* ─── Mismatch Panel ─── */
function MismatchPanel({
  result,
  plateDetected,
  onConfirmed,
  onRejected,
}: {
  result: ScanResult;
  plateDetected?: string;
  onConfirmed: () => void;
  onRejected: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");

  const entryPlate = result.session?.plate || result.session?.plateNumber || "—";
  const exitPlate = plateDetected || result.plateDetected || "—";
  const sessionId = sessionIdOf(result.session);

  const handleAction = useCallback(
    async (action: "confirm" | "reject") => {
      if (!sessionId) return;
      setActing(true);
      setActionError("");
      try {
        const res = await confirmRfidExit({
          cardId: result.card?.cardId || "",
          sessionId,
          action,
        });
        const data = await res.json();
        if (res.ok) {
          if (action === "confirm") onConfirmed();
          else onRejected();
        } else {
          setActionError(data.message || "Thao tác thất bại.");
        }
      } catch {
        setActionError("Lỗi kết nối.");
      } finally {
        setActing(false);
      }
    },
    [result, sessionId, onConfirmed, onRejected],
  );

  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: "0.5rem",
        border: "2px solid var(--color-warning, #f59e0b)",
        background: "rgba(245,158,11,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <ShieldAlert size={20} style={{ color: "var(--color-warning, #f59e0b)" }} />
        <strong style={{ color: "var(--color-warning, #f59e0b)" }}>
          CROSS-CHECK MISMATCH
        </strong>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
        <div>
          <span className="muted-text">Thẻ:</span>{" "}
          <strong>{result.card?.cardId}</strong>
        </div>
        <div>
          <span className="muted-text">Phiên:</span>{" "}
          <strong>{sessionId.slice(-6).toUpperCase() || "—"}</strong>
        </div>
        <div>
          <span className="muted-text">Biển số vào:</span>{" "}
          <strong style={{ color: "var(--color-success, #22c55e)" }}>{entryPlate}</strong>
        </div>
        <div>
          <span className="muted-text">Biển số ra:</span>{" "}
          <strong style={{ color: "var(--color-error, #ef4444)" }}>{exitPlate} ← KHÔNG KHỚP</strong>
        </div>
      </div>

      {result.session?.checkInAt && (
        <p style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}>
          <span className="muted-text">Vào lúc:</span> {fmt(result.session.checkInAt)}
        </p>
      )}

      {actionError && (
        <div className="muted-text error" style={{ marginBottom: "0.5rem" }}>
          <AlertCircle size={14} /> {actionError}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          className="small-button"
          disabled={acting}
          onClick={() => void handleAction("reject")}
          type="button"
          style={{ flex: 1 }}
        >
          {acting ? <Loader2 className="spin" size={14} /> : <XCircle size={14} />}
          Từ chối
        </button>
        <button
          className="small-button success"
          disabled={acting}
          onClick={() => void handleAction("confirm")}
          type="button"
          style={{ flex: 1 }}
        >
          {acting ? <Loader2 className="spin" size={14} /> : <ShieldCheck size={14} />}
          Xác nhận ra
        </button>
      </div>
    </div>
  );
}

/* ─── Scanner Panel ─── */
function ScannerPanel({
  title,
  icon,
  scanFn,
  accentClass,
  defaultGate,
}: {
  title: string;
  icon: React.ReactNode;
  scanFn: (body: {
    cardId: string;
    gate: "entry" | "exit";
    plateDetected?: string;
  }) => Promise<Response>;
  accentClass: string;
  defaultGate: "entry" | "exit";
}) {
  const [cardId, setCardId] = useState("");
  const [gate, setGate] = useState<"entry" | "exit">(defaultGate);
  const [plateDetected, setPlateDetected] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [lastPlateDetected, setLastPlateDetected] = useState("");

  const handleScan = useCallback(async () => {
    if (!cardId.trim()) {
      setError("Vui lòng nhập mã thẻ.");
      return;
    }
    setPending(true);
    setError("");
    setResult(null);
    const plate = plateDetected.trim();
    try {
      const res = await scanFn({
        cardId: cardId.trim(),
        gate,
        plateDetected: plate || undefined,
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ...data, plateDetected: plate || data.plateDetected });
        setLastPlateDetected(plate);
        setCardId("");
        setPlateDetected("");
      } else {
        setError(data.message || "Lỗi quét thẻ.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setPending(false);
    }
  }, [cardId, gate, plateDetected, scanFn]);

  const handleMismatchConfirmed = useCallback(() => {
    setResult(null);
    setError("");
    setLastPlateDetected("");
  }, []);

  const handleMismatchRejected = useCallback(() => {
    setResult(null);
    setError("");
    setLastPlateDetected("");
  }, []);

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p>{title}</p>
          <h2>{icon}</h2>
        </div>
      </div>

      <div className="stack-form">
        <label>
          Mã thẻ RFID
          <input
            autoFocus
            onChange={(e) => {
              setCardId(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleScan();
            }}
            placeholder="Nhập hoặc quét mã thẻ..."
            type="text"
            value={cardId}
          />
        </label>
        <label>
          Cổng
          <select
            disabled
            onChange={(e) => setGate(e.target.value as "entry" | "exit")}
            value={gate}
          >
            <option value="entry">Cổng vào (entry)</option>
            <option value="exit">Cổng ra (exit)</option>
          </select>
        </label>
        <label>
          Biển số xe (tùy chọn)
          <input
            onChange={(e) => setPlateDetected(e.target.value)}
            placeholder="VD: 51A-123.45"
            type="text"
            value={plateDetected}
          />
        </label>

        {error && (
          <div className="muted-text error">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* ── Mismatch panel ── */}
        {result?.mismatch && (
          <MismatchPanel
            result={result}
            plateDetected={lastPlateDetected || result.plateDetected}
            onConfirmed={handleMismatchConfirmed}
            onRejected={handleMismatchRejected}
          />
        )}

        {/* ── Normal result ── */}
        {result && !result.mismatch && (
          <div
            className={result.valid ? "success-box" : "error-box"}
            style={{
              padding: "0.75rem",
              borderRadius: "0.5rem",
              border: `1px solid ${result.valid ? "var(--color-success, #22c55e)" : "var(--color-error, #ef4444)"}`,
              background: result.valid
                ? "rgba(34,197,94,0.05)"
                : "rgba(239,68,68,0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {result.valid ? (
                <CheckCircle size={18} className="text-success" />
              ) : (
                <AlertCircle size={18} className="text-danger" />
              )}
              <strong>{result.message || (result.valid ? "Hợp lệ" : "Không hợp lệ")}</strong>
            </div>
            {result.card && (
              <p style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}>
                Thẻ: {result.card.cardId} | Trạng thái: {result.card.status}
              </p>
            )}
            {result.session && (
              <p style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}>
                Phiếu: {result.session.plate || result.session.plateNumber} | Slot:{" "}
                {result.session.slot}
              </p>
            )}
          </div>
        )}

        <button
          className={`full-button ${accentClass}`}
          disabled={pending}
          onClick={() => void handleScan()}
          type="button"
        >
          {pending ? (
            <Loader2 className="spin" size={18} />
          ) : (
            <ScanLine size={18} />
          )}
          {pending ? "Đang quét…" : "Quét thẻ"}
        </button>
      </div>
    </div>
  );
}

/* ─── Assign Card Panel ─── */
function AssignCardPanel({ onDone }: { onDone: () => void }) {
  const [cardId, setCardId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [gate, setGate] = useState("entry");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleAssign = useCallback(async () => {
    if (!cardId.trim() || !sessionId.trim()) {
      setError("Vui lòng nhập mã thẻ và mã phiên.");
      return;
    }
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const res = await assignRfidCard({
        cardId: cardId.trim(),
        sessionId: sessionId.trim(),
        gate: gate as any,
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Gán thẻ ${data.card?.cardId || cardId.trim()} thành công cho phiên ${sessionId.trim().slice(-6).toUpperCase()}`);
        setCardId("");
        setSessionId("");
        onDone();
      } else {
        setError(data.message || "Gán thẻ thất bại.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setPending(false);
    }
  }, [cardId, sessionId, gate, onDone]);

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p>Gán thẻ cho phiên</p>
          <h2>
            <KeyRound size={28} /> Gán thẻ RFID
          </h2>
        </div>
      </div>
      <div className="stack-form">
        <label>
          Mã thẻ RFID
          <input
            onChange={(e) => {
              setCardId(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAssign();
            }}
            placeholder="Nhập mã thẻ..."
            type="text"
            value={cardId}
          />
        </label>
        <label>
          Mã phiên gửi xe
          <input
            onChange={(e) => {
              setSessionId(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAssign();
            }}
            placeholder="Nhập mã phiên (ObjectId)..."
            type="text"
            value={sessionId}
          />
        </label>
        <label>
          Cổng
          <select onChange={(e) => setGate(e.target.value)} value={gate}>
            <option value="entry">Cổng vào</option>
            <option value="exit">Cổng ra</option>
          </select>
        </label>

        {error && (
          <div className="muted-text error">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {success && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--color-success, #22c55e)",
              background: "rgba(34,197,94,0.06)",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <CheckCircle size={14} className="text-success" /> {success}
          </div>
        )}

        <button
          className="full-button success"
          disabled={pending}
          onClick={() => void handleAssign()}
          type="button"
        >
          {pending ? (
            <Loader2 className="spin" size={18} />
          ) : (
            <ArrowDownToLine size={18} />
          )}
          {pending ? "Đang gán…" : "Gán thẻ"}
        </button>
      </div>
    </div>
  );
}

/* ─── Return Card Panel ─── */
function ReturnCardPanel({ onDone }: { onDone: () => void }) {
  const [cardId, setCardId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleReturn = useCallback(async () => {
    if (!cardId.trim() || !sessionId.trim()) {
      setError("Vui lòng nhập mã thẻ và mã phiên.");
      return;
    }
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const res = await returnRfidCard({
        cardId: cardId.trim(),
        sessionId: sessionId.trim(),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Trả thẻ ${data.card?.cardId || cardId.trim()} thành công.`);
        setCardId("");
        setSessionId("");
        onDone();
      } else {
        setError(data.message || "Trả thẻ thất bại.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setPending(false);
    }
  }, [cardId, sessionId, onDone]);

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p>Trả thẻ từ phiên</p>
          <h2>
            <ArrowUpFromLine size={28} /> Trả thẻ RFID
          </h2>
        </div>
      </div>
      <div className="stack-form">
        <label>
          Mã thẻ RFID
          <input
            onChange={(e) => {
              setCardId(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleReturn();
            }}
            placeholder="Nhập mã thẻ..."
            type="text"
            value={cardId}
          />
        </label>
        <label>
          Mã phiên gửi xe
          <input
            onChange={(e) => {
              setSessionId(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleReturn();
            }}
            placeholder="Nhập mã phiên (ObjectId)..."
            type="text"
            value={sessionId}
          />
        </label>

        {error && (
          <div className="muted-text error">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {success && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--color-success, #22c55e)",
              background: "rgba(34,197,94,0.06)",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <CheckCircle size={14} className="text-success" /> {success}
          </div>
        )}

        <button
          className="full-button warning"
          disabled={pending}
          onClick={() => void handleReturn()}
          type="button"
        >
          {pending ? (
            <Loader2 className="spin" size={18} />
          ) : (
            <ArrowUpFromLine size={18} />
          )}
          {pending ? "Đang trả…" : "Trả thẻ"}
        </button>
      </div>
    </div>
  );
}

/* ─── Active Sessions with RFID ─── */
type ActiveSession = {
  id: string;
  plate?: string;
  owner?: string;
  slot?: string;
  checkIn?: string;
  rfidCardId?: string | null;
  rfidAssignedAt?: string | null;
  rfidReturnedAt?: string | null;
  status?: string;
};

function ActiveSessionsPanel() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/parking-sessions?status=Đang+gửi&limit=50");
      const data = await res.json();
      if (res.ok) {
        const list = (data.sessions || data || []) as ActiveSession[];
        setSessions(list);
      } else {
        setError(data.message || "Không thể tải danh sách.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return (
    <div className="panel wide">
      <div className="panel-heading">
        <div>
          <p>Phiên đang gửi có RFID</p>
          <h2>
            <MapPin size={28} /> Phiên đang hoạt động
          </h2>
        </div>
        <button
          className="ghost-button"
          onClick={() => void loadSessions()}
          type="button"
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {loading && (
        <div style={{ padding: "1rem", textAlign: "center" }}>
          <Loader2 className="spin" size={20} /> Đang tải...
        </div>
      )}
      {error && (
        <div className="muted-text error" style={{ padding: "0.75rem" }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <p className="muted-text" style={{ padding: "1rem" }}>
          Không có phiên gửi xe nào đang hoạt động.
        </p>
      )}

      {!loading && sessions.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã phiên</th>
                <th>Biển số</th>
                <th>Slot</th>
                <th>Vào lúc</th>
                <th>Thẻ RFID</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="muted-cell">{s.id.slice(-6).toUpperCase()}</td>
                  <td>{s.plate || "—"}</td>
                  <td>{s.slot || "—"}</td>
                  <td className="muted-cell">{s.checkIn || "—"}</td>
                  <td>
                    {s.rfidCardId ? (
                      <span className="badge success">{s.rfidCardId}</span>
                    ) : (
                      <span className="badge info">Chưa gán</span>
                    )}
                  </td>
                  <td>
                    {s.rfidReturnedAt ? (
                      <span className="badge info">Đã trả thẻ</span>
                    ) : s.rfidCardId ? (
                      <span className="badge success">Đang dùng thẻ</span>
                    ) : (
                      <span className="badge warning">Chưa gán thẻ</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RfidOperationsContent() {
  const [recentLogs, setRecentLogs] = useState<RfidScanLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadRecentLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await apiFetch("/rfid-cards/scan-logs?page=1&limit=10");
      const data = await res.json();
      if (res.ok) setRecentLogs(data.logs || []);
    } catch {
      // silent
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const scanEntry = useCallback(
    (body: { cardId: string; gate: "entry" | "exit"; plateDetected?: string }) =>
      apiFetch("/rfid-cards/scan/entry", {
        method: "POST",
        body: JSON.stringify({ ...body, gate: "entry" }),
      }),
    [],
  );

  const scanExit = useCallback(
    (body: { cardId: string; gate: "entry" | "exit"; plateDetected?: string }) =>
      apiFetch("/rfid-cards/scan/exit", {
        method: "POST",
        body: JSON.stringify({ ...body, gate: "exit" }),
      }),
    [],
  );

  return (
    <section className="content-grid">
      {/* ───── Left: Scanner panels ───── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Vận hành RFID</p>
              <h2>
                <ScanLine size={28} /> Quét thẻ RFID
              </h2>
            </div>
            <button
              className="ghost-button"
              onClick={() => void loadRecentLogs()}
              type="button"
            >
              <RefreshCw size={14} /> Làm mới
            </button>
          </div>
          <p className="muted-text">
            Nhập mã thẻ RFID và nhấn quét để xử lý xe vào/ra.
          </p>
        </div>
        <ScannerPanel
          accentClass="success"
          defaultGate="entry"
          icon={<MapPin size={28} />}
          scanFn={scanEntry}
          title="Xe vào"
        />
        <ScannerPanel
          accentClass="warning"
          defaultGate="exit"
          icon={<MapPin size={28} />}
          scanFn={scanExit}
          title="Xe ra"
        />

        {/* ── Assign / Return panels ── */}
        <AssignCardPanel onDone={() => void loadRecentLogs()} />
        <ReturnCardPanel onDone={() => void loadRecentLogs()} />
      </div>

      {/* ───── Right: Recent scan logs + Active sessions ───── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div className="panel wide">
          <div className="panel-heading">
            <div>
              <p>Lịch sử quét gần đây</p>
              <h2>
                <History size={28} /> Quét gần đây
              </h2>
            </div>
          </div>
          <RfidScanLogTable loading={loadingLogs} logs={recentLogs} />
        </div>

        <ActiveSessionsPanel />
      </div>
    </section>
  );
}

export default function RfidOperationsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff"]}>
      <RfidOperationsContent />
    </RoleGuard>
  );
}
