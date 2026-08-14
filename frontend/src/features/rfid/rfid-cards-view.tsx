"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CreditCard,
  History,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldBan,
  ShieldCheck,
  AlertTriangle,
  X,
} from "lucide-react";

import type { RfidCard, RfidScanLog, RfidCardStatus } from "@/types";
import * as rfidApi from "./rfid-api";
import { RfidCardTable } from "./components/RfidCardTable";

const STATUS_LABELS: Partial<Record<RfidCardStatus, string>> = {
  available: "Sẵn sàng",
  "in-use": "Đang sử dụng",
  lost: "Mất",
  blocked: "Đã khóa",
};

const SCAN_ACTION_LABELS: Record<string, string> = {
  entry: "Xe vào",
  exit: "Xe ra",
  assign: "Gán thẻ",
  return: "Trả thẻ",
  block: "Khóa",
  unblock: "Mở khóa",
  "report-lost": "Báo mất",
};

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

function validateCardId(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Mã thẻ RFID là bắt buộc.";
  if (v.length < 3) return "Mã thẻ phải có ít nhất 3 ký tự.";
  if (v.length > 50) return "Mã thẻ không được quá 50 ký tự.";
  return undefined;
}

type ConfirmAction = {
  type: "block" | "report-lost" | "unblock";
  card: RfidCard;
};

type Assignment = { id: string; uid: string; cardId: string; cardType: "guest" | "member"; status: string; ownerName: string; plate: string; sessionId?: string; sessionStatus: string; updatedAt?: string };
type TabType = "cards" | "assignments" | "scan-logs";

export function RfidCardsView() {
  const [activeTab, setActiveTab] = useState<TabType>("cards");
  const [cards, setCards] = useState<RfidCard[]>([]);
  const [scanLogs, setScanLogs] = useState<RfidScanLog[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchCardId, setSearchCardId] = useState("");
  const [scanLogAction, setScanLogAction] = useState<string>("");

  // Register form
  const [regCardId, setRegCardId] = useState("");
  const [regNotes, setRegNotes] = useState("");
  const [regErrors, setRegErrors] = useState<{ cardId?: string }>({});
  const [regPending, setRegPending] = useState(false);

  // Confirm dialog
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [blockReason, setBlockReason] = useState("");

  // Card history
  const [historyCardId, setHistoryCardId] = useState<string | null>(null);
  const [historyLogs, setHistoryLogs] = useState<RfidScanLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ─── Load cards ───
  const loadCards = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await rfidApi.fetchRfidCards({
        status: statusFilter || undefined,
        limit: 200,
      });
      if (!res.ok) {
        setError("Không tải được danh sách thẻ RFID.");
        return;
      }
      const data = await res.json();
      setCards(data.cards || []);
    } catch {
      setError("Không kết nối được API.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rfidApi.fetchRfidAssignments();
      if (!res.ok) { setError("Không tải được trạng thái gắn thẻ."); return; }
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch { setError("Không kết nối được API."); }
    finally { setLoading(false); }
  }, []);

  // ─── Load scan logs ───
  const loadScanLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rfidApi.fetchRfidScanLogs({
        action: scanLogAction || undefined,
        limit: 200,
      });
      if (!res.ok) {
        setError("Không tải được lịch sử quét.");
        return;
      }
      const data = await res.json();
      setScanLogs(data.logs || []);
    } catch {
      setError("Không kết nối được API.");
    } finally {
      setLoading(false);
    }
  }, [scanLogAction]);

  useEffect(() => {
    if (activeTab === "assignments") void loadAssignments();
    if (activeTab === "scan-logs") void loadScanLogs();
  }, [activeTab, loadAssignments, loadScanLogs]);

  // ─── Register ───
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const err = validateCardId(regCardId);
    setRegErrors({ cardId: err });
    if (err) return;

    setRegPending(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await rfidApi.registerRfidCard({
        cardId: regCardId.trim(),
        notes: regNotes.trim() || undefined,
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Đã đăng ký thẻ ${regCardId.trim().toUpperCase()}.`);
        setRegCardId("");
        setRegNotes("");
        setRegErrors({});
        void loadCards();
      } else {
        setError(data.message || "Không đăng ký được thẻ.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setRegPending(false);
    }
  }

  // ─── Confirm action ───
  async function handleConfirmAction() {
    if (!confirm) return;
    setActionPending(true);
    setError("");
    setSuccessMsg("");
    try {
      let res: Response;
      if (confirm.type === "block") {
        res = await rfidApi.updateRfidCardStatus(confirm.card.id, {
          status: "blocked",
          blockedReason: blockReason || undefined,
        });
      } else if (confirm.type === "report-lost") {
        res = await rfidApi.reportLostCard(confirm.card.id);
      } else {
        res = await rfidApi.unblockCard(confirm.card.id);
      }
      if (res.ok) {
        const msg =
          confirm.type === "block"
            ? `Đã khóa thẻ ${confirm.card.cardId}.`
            : confirm.type === "report-lost"
              ? `Đã báo mất thẻ ${confirm.card.cardId}.`
              : `Đã mở khóa thẻ ${confirm.card.cardId}.`;
        setSuccessMsg(msg);
        setConfirm(null);
        setBlockReason("");
        void loadCards();
      } else {
        const data = await res.json();
        setError(data.message || "Thao tác thất bại.");
      }
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setActionPending(false);
    }
  }

  // ─── Card history ───
  async function openHistory(card: RfidCard) {
    setHistoryCardId(card.cardId ?? card.uid);
    setHistoryLoading(true);
    try {
      // API /:id/history expects MongoDB ObjectId, not cardId string
      const res = await rfidApi.fetchRfidCardHistory(card.id);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.scans || data.logs || []);
      }
    } catch {
      /* silent */
    } finally {
      setHistoryLoading(false);
    }
  }

  // ─── Computed ───
  const stats = useMemo(() => {
    const total = cards.length;
    const available = cards.filter((c) => c.status === "available").length;
    const inUse = cards.filter((c) => c.status === "in-use").length;
    const lostBlocked = cards.filter(
      (c) => c.status === "lost" || c.status === "blocked",
    ).length;
    return { total, available, inUse, lostBlocked };
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (!searchCardId.trim()) return cards;
    const q = searchCardId.trim().toLowerCase();
    return cards.filter((c) => (c.cardId ?? c.uid).toLowerCase().includes(q));
  }, [cards, searchCardId]);

  // ─── Render ───
  return (
    <section className="content-grid">
      {/* ───── Header panel ───── */}
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Quản lý RFID</p>
            <h2>Thẻ RFID cho khách vãng lai</h2>
          </div>
          <CreditCard size={22} />
        </div>
        <p className="muted-text">
          Quản lý thẻ RFID phát cho khách vãng lai. Theo dõi trạng thái,
          khóa/mở khóa, báo mất thẻ và xem lịch sử quét.
        </p>
        <div className="metric-grid compact">
          <div className="metric-card">
            <span>Tổng thẻ</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="metric-card">
            <span>Sẵn sàng</span>
            <strong>{stats.available}</strong>
          </div>
          <div className="metric-card">
            <span>Đang dùng</span>
            <strong>{stats.inUse}</strong>
          </div>
          <div className="metric-card">
            <span>Mất / Khóa</span>
            <strong>{stats.lostBlocked}</strong>
          </div>
        </div>
      </div>

      {/* ───── Register panel ───── */}
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Thao tác</p>
            <h2>Đăng ký thẻ mới</h2>
          </div>
          <MapPin size={22} />
        </div>
        <form className="stack-form" noValidate onSubmit={handleRegister}>
          <label>
            Mã thẻ RFID
            <input
              maxLength={50}
              onBlur={(e) => {
                setRegErrors({ cardId: validateCardId(e.target.value) });
              }}
              onChange={(e) => {
                setRegCardId(e.target.value);
                if (regErrors.cardId) setRegErrors({ cardId: undefined });
              }}
              placeholder="VD: RFID-009"
              required
              type="text"
              value={regCardId}
            />
            {regErrors.cardId && (
              <span className="field-error">
                <AlertCircle size={13} />
                {regErrors.cardId}
              </span>
            )}
          </label>
          <label>
            Ghi chú
            <input
              maxLength={255}
              onChange={(e) => setRegNotes(e.target.value)}
              placeholder="Tùy chọn..."
              type="text"
              value={regNotes}
            />
          </label>
          <button className="full-button" disabled={regPending} type="submit">
            {regPending ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <CreditCard size={18} />
            )}
            {regPending ? "Đang lưu…" : "Đăng ký thẻ"}
          </button>
        </form>
      </div>

      {/* ───── Cards / Logs tabs ───── */}
      <div className="panel wide">
        <div className="panel-heading">
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              className={activeTab === "cards" ? "active" : ""}
              onClick={() => setActiveTab("cards")}
              type="button"
            >
              <CreditCard size={14} /> Danh sách thẻ
            </button>
            <button
              className={activeTab === "scan-logs" ? "active" : ""}
              onClick={() => setActiveTab("scan-logs")}
              type="button"
            >
              <History size={14} /> Lịch sử quét
            </button>
          </div>
'          <span className="muted-cell">
            {activeTab === "cards"
              ? `${filteredCards.length} thẻ`
              : activeTab === "assignments"
                ? `${assignments.length} thẻ`
                : `${scanLogs.length} bản ghi`}
          </span>'
        </div>

        {error && <p className="muted-text error">{error}</p>}
        {successMsg && <p className="muted-text success">{successMsg}</p>}

        {/* ── Cards tab ── */}
        {activeTab === "cards" && (
          <>
            <div className="filter-row">
              <div style={{ position: "relative" }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: "0.5rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    opacity: 0.5,
                  }}
                />
                <input
                  onChange={(e) => setSearchCardId(e.target.value)}
                  placeholder="Tìm mã thẻ…"
                  style={{ paddingLeft: "2rem" }}
                  type="text"
                  value={searchCardId}
                />
              </div>
              <select
                aria-label="Lọc theo trạng thái"
                onChange={(e) => setStatusFilter(e.target.value)}
                value={statusFilter}
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <button
                className="ghost-button"
                disabled={loading}
                onClick={() => void loadCards()}
                type="button"
              >
                <RefreshCw className={loading ? "spin" : ""} size={14} /> Làm mới
              </button>
            </div>
            <RfidCardTable
              cards={filteredCards}
              loading={loading}
              onViewHistory={openHistory}
              onBlock={(card) => {
                setBlockReason("");
                setConfirm({ type: "block", card });
              }}
              onReportLost={(card) => setConfirm({ type: "report-lost", card })}
              onUnblock={(card) => setConfirm({ type: "unblock", card })}
            />
          </>
        )}

'        {activeTab === "assignments" && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Thẻ</th><th>Loại</th><th>Khách / chủ xe</th><th>Biển số hiện tại</th><th>Trạng thái phiên</th><th>Cập nhật</th></tr></thead>
              <tbody>
                {assignments.map((item) => <tr key={item.id}>
                  <td><strong>{item.cardId}</strong><div className="muted-cell">UID: {item.uid}</div></td>
                  <td><span className={`badge ${item.cardType === "member" ? "success" : "warning"}`}>{item.cardType === "member" ? "Member" : "Guest"}</span></td>
                  <td>{item.ownerName || "Guest"}</td>
                  <td>{item.plate || <span className="muted-cell">Không gắn xe</span>}</td>
                  <td><span className={`badge ${item.sessionId ? "success" : ""}`}>{item.cardType === "member" ? "Bán đứt / cố định" : item.sessionStatus}</span></td>
                  <td>{fmt(item.updatedAt)}</td>
                </tr>)}
                {!assignments.length && <tr><td colSpan={6} className="muted-cell">{loading ? "Đang tải…" : "Chưa có thẻ."}</td></tr>}
              </tbody>
            </table>
          </div>
        )}

'        {/* ── Scan logs tab ── */}
        {activeTab === "scan-logs" && (
          <>
            <div className="filter-row">
              <select
                aria-label="Lọc theo hành động"
                onChange={(e) => setScanLogAction(e.target.value)}
                value={scanLogAction}
              >
                <option value="">Tất cả hành động</option>
                {Object.entries(SCAN_ACTION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <button
                className="ghost-button"
                disabled={loading}
                onClick={() => void loadScanLogs()}
                type="button"
              >
                <RefreshCw className={loading ? "spin" : ""} size={14} /> Làm mới
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Mã thẻ</th>
                    <th>Hành động</th>
                    <th>Trạng thái</th>
                    <th>Biển số</th>
                    <th>Lý do lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  {scanLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{fmt(log.createdAt)}</td>
                      <td><strong>{log.cardId}</strong></td>
                      <td>{SCAN_ACTION_LABELS[log.action] || log.action}</td>
                      <td>
                        <span className={log.status === "success" ? "badge success" : "badge warning"}>
                          {log.status}
                        </span>
                      </td>
                      <td>{log.plateDetected || <span className="muted-cell">—</span>}</td>
                      <td>{log.failureReason || <span className="muted-cell">—</span>}</td>
                    </tr>
                  ))}
                  {scanLogs.length === 0 && (
                    <tr>
                      <td className="muted-cell" colSpan={6}>
                        {loading ? "Đang tải…" : "Chưa có lịch sử quét."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ───── Card History panel ───── */}
      {historyCardId && (
        <div className="panel wide">
          <div className="panel-heading">
            <div>
              <p>Lịch sử thẻ</p>
              <h2>{historyCardId}</h2>
            </div>
            <button
              className="ghost-button"
              onClick={() => { setHistoryCardId(null); setHistoryLogs([]); }}
              type="button"
            >
              <X size={14} /> Đóng
            </button>
          </div>
          {historyLoading ? (
            <p className="muted-text">
              <Loader2 className="spin" size={16} /> Đang tải lịch sử…
            </p>
          ) : historyLogs.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Hành động</th>
                    <th>Trạng thái</th>
                    <th>Biển số</th>
                    <th>Lý do lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{fmt(log.createdAt)}</td>
                      <td>{SCAN_ACTION_LABELS[log.action] || log.action}</td>
                      <td>
                        <span className={log.status === "success" ? "badge success" : "badge warning"}>
                          {log.status}
                        </span>
                      </td>
                      <td>{log.plateDetected || <span className="muted-cell">—</span>}</td>
                      <td>{log.failureReason || <span className="muted-cell">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-text">Chưa có lịch sử cho thẻ này.</p>
          )}
        </div>
      )}

      {/* ───── Confirm modal ───── */}
      {confirm && (
        <div
          className="modal-overlay"
          onClick={() => !actionPending && setConfirm(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              {confirm.type === "block" && <ShieldBan className="text-danger" size={24} />}
              {confirm.type === "report-lost" && <AlertTriangle className="text-warning" size={24} />}
              {confirm.type === "unblock" && <ShieldCheck className="text-success" size={24} />}
              <h3>
                {confirm.type === "block"
                  ? "Khóa thẻ RFID"
                  : confirm.type === "report-lost"
                    ? "Báo mất thẻ RFID"
                    : "Mở khóa thẻ RFID"}
              </h3>
            </div>
            <p className="modal-body">
              {confirm.type === "block" && (
                <>Bạn có muốn khóa thẻ <strong>{confirm.card.cardId}</strong> không?</>
              )}
              {confirm.type === "report-lost" && (
                <>
                  Bạn có chắc muốn báo mất thẻ <strong>{confirm.card.cardId}</strong> không?
                  <br />
                  Thẻ sẽ chuyển sang trạng thái <strong>Mất</strong>.
                </>
              )}
              {confirm.type === "unblock" && (
                <>
                  Mở khóa / khôi phục thẻ <strong>{confirm.card.cardId}</strong> về trạng thái{" "}
                  <strong>Sẵn sàng</strong>?
                </>
              )}
            </p>
            {confirm.type === "block" && (
              <div style={{ padding: "0 1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                  Lý do khóa (tùy chọn)
                </label>
                <input
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Nhập lý do..."
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #e2e8f0)" }}
                  type="text"
                  value={blockReason}
                />
              </div>
            )}
            <div className="modal-footer">
              <button
                className="secondary-button"
                disabled={actionPending}
                onClick={() => setConfirm(null)}
                type="button"
              >
                Hủy
              </button>
              <button
                className={confirm.type === "unblock" ? "success-button" : "danger-button"}
                disabled={actionPending}
                onClick={() => void handleConfirmAction()}
                type="button"
              >
                {actionPending ? (
                  <Loader2 className="spin" size={16} />
                ) : confirm.type === "block" ? (
                  <ShieldBan size={16} />
                ) : confirm.type === "report-lost" ? (
                  <AlertTriangle size={16} />
                ) : (
                  <ShieldCheck size={16} />
                )}
                {actionPending
                  ? "Đang xử lý…"
                  : confirm.type === "block"
                    ? "Khóa thẻ"
                    : confirm.type === "report-lost"
                      ? "Báo mất"
                      : "Mở khóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
