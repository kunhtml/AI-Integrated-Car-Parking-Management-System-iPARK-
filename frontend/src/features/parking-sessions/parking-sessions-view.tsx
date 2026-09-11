"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CarFront,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
  ArrowUpRight,
  RadioTower,
} from "lucide-react";

import { apiFetch } from "@/lib/client-api";
import type { ParkingSession } from "@/types";

type ExceptionEvidence = Record<string, unknown>;

type SessionWithExceptions = ParkingSession & {
  isOverstayed?: boolean;
  exceptionType?: string;
  exceptionEvidence?: ExceptionEvidence;
  entryRfidUnverified?: boolean;
};

type Filter = "all" | "active" | "exception";

function exceptionEvidenceLabel(evidence?: ExceptionEvidence) {
  if (!evidence) return undefined;

  const labels = [
    ["Biển vào", evidence.entryPlate],
    ["Biển ra", evidence.exitPlate],
    ["UID kỳ vọng", evidence.expectedUid],
    ["UID vừa quẹt", evidence.scannedUid],
    ["Biển gắn với thẻ", evidence.cardBoundPlate],
  ]
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(([label, value]) => `${label}: ${String(value)}`);

  return labels.length > 0
    ? labels.join(" · ")
    : "Có dữ liệu ngoại lệ cần rà soát";
}

function isException(session: SessionWithExceptions) {
  return Boolean(
    session.exceptionType ||
    session.exceptionEvidence ||
    session.matchStatus === "Không khớp" ||
    session.verificationStatus === "Chờ duyệt" ||
    session.isOverstayed ||
    session.manualEntryReason ||
    session.manualExitReason ||
    session.entryRfidUnverified,
  );
}

function statusLabel(session: SessionWithExceptions) {
  if (isException(session)) return "Ngoại lệ";
  return session.status === "Đang gửi" ? "Đang hoạt động" : session.status;
}

function timeLabel(session: SessionWithExceptions) {
  return session.checkInAt
    ? new Date(session.checkInAt).toLocaleString("vi-VN")
    : `${session.checkInDate} ${session.checkIn}`;
}

function shortId(id: string) {
  return `#${id.slice(-8).toUpperCase()}`;
}

export function ParkingSessionsView() {
  const [sessions, setSessions] = useState<SessionWithExceptions[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [matchFilter, setMatchFilter] = useState("all");
  const [selected, setSelected] = useState<SessionWithExceptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/parking-sessions?limit=100");
      if (!response.ok) throw new Error("Không thể tải danh sách phiên đỗ xe.");
      const data = await response.json();
      setSessions(data.sessions ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải dữ liệu.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
    const interval = window.setInterval(() => void loadSessions(), 60_000);
    return () => window.clearInterval(interval);
  }, [loadSessions]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sessions.filter((session) => {
      const exception = isException(session);
      if (filter === "active" && (session.status !== "Đang gửi" || exception))
        return false;
      if (filter === "exception" && !exception) return false;
      if (matchFilter === "matched" && session.matchStatus !== "Khớp")
        return false;
      if (matchFilter === "mismatch" && session.matchStatus !== "Không khớp")
        return false;
      if (matchFilter === "unknown" && session.matchStatus !== "Chưa checkout")
        return false;
      if (
        query &&
        !`${session.plate} ${session.id} ${session.owner} ${session.rfidCardId ?? ""}`
          .toLowerCase()
          .includes(query)
      )
        return false;
      return session.status === "Đang gửi" || exception;
    });
  }, [filter, matchFilter, search, sessions]);

  const counts = useMemo(
    () => ({
      active: sessions.filter(
        (session) => session.status === "Đang gửi" && !isException(session),
      ).length,
      exceptions: sessions.filter(isException).length,
      pending: sessions.filter(
        (session) => session.verificationStatus === "Chờ duyệt",
      ).length,
    }),
    [sessions],
  );

  const exceptionReasons = useMemo(() => {
    const reasons = new Map<string, number>();
    sessions.filter(isException).forEach((session) => {
      const reason =
        session.exceptionType ||
        exceptionEvidenceLabel(session.exceptionEvidence) ||
        session.manualEntryReason ||
        session.manualExitReason ||
        (session.isOverstayed ? "Quá thời gian" : "Cần rà soát");
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    });
    return Array.from(reasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [sessions]);

  return (
    <main className="uc19-page" aria-labelledby="uc19-title">
      <header className="uc19-hero">
        <div>
          <div className="uc19-kicker">
            <span className="live-indicator" /> TRUNG TÂM ĐIỀU HÀNH BÃI XE
          </div>
          <h1 id="uc19-title">
            Phiên đang hoạt động <span>& ngoại lệ</span>
          </h1>
          <p>
            Theo dõi hoạt động trong bãi và xử lý nhanh các phiên cần Parking
            Manager rà soát.
          </p>
        </div>
        <button
          type="button"
          className="uc19-refresh"
          onClick={() => void loadSessions()}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} />{" "}
          {loading ? "Đang đồng bộ" : "Đồng bộ dữ liệu"}
        </button>
      </header>

      <section className="uc19-metrics" aria-label="Tổng quan UC19">
        <div className="uc19-metric active">
          <div className="uc19-metric-icon">
            <CarFront size={19} />
          </div>
          <div>
            <strong>{counts.active}</strong>
            <span>Phiên đang hoạt động</span>
          </div>
          <small>
            <ArrowUpRight size={13} /> Live
          </small>
        </div>
        <div className="uc19-metric exception">
          <div className="uc19-metric-icon">
            <AlertTriangle size={19} />
          </div>
          <div>
            <strong>{counts.exceptions}</strong>
            <span>Phiên có ngoại lệ</span>
          </div>
          <small>Rà soát</small>
        </div>
        <div className="uc19-metric review">
          <div className="uc19-metric-icon">
            <ShieldAlert size={19} />
          </div>
          <div>
            <strong>{counts.pending}</strong>
            <span>Chờ xác minh</span>
          </div>
          <small>Ưu tiên</small>
        </div>
      </section>

      <section className="uc19-workspace">
        <div className="uc19-toolbar">
          <label className="uc19-search">
            <Search size={16} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm biển số, mã phiên, chủ xe hoặc RFID..."
              aria-label="Tìm phiên"
            />
          </label>
          <div className="uc19-filter-label">
            <SlidersHorizontal size={15} /> Bộ lọc:
          </div>
          <select
            className="uc19-select"
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
            aria-label="Lọc loại phiên"
          >
            <option value="all">Tất cả active & ngoại lệ</option>
            <option value="active">Chỉ đang hoạt động</option>
            <option value="exception">Chỉ ngoại lệ</option>
          </select>
          <select
            className="uc19-select"
            value={matchFilter}
            onChange={(event) => setMatchFilter(event.target.value)}
            aria-label="Lọc đối chiếu RFID biển số"
          >
            <option value="all">Tất cả kết quả đối chiếu</option>
            <option value="matched">RFID khớp biển số</option>
            <option value="mismatch">RFID không khớp</option>
            <option value="unknown">Chưa checkout</option>
          </select>
        </div>

        {error && (
          <div className="uc19-error">
            {error}{" "}
            <button
              type="button"
              className="small-button"
              onClick={() => void loadSessions()}
            >
              Thử lại
            </button>
          </div>
        )}
        <div className="uc19-table-heading">
          <div>
            <h2>Phiên cần theo dõi</h2>
            <p>{visible.length} phiên trong phạm vi hiện tại</p>
          </div>
          <span className="uc19-live-chip">
            <RadioTower size={13} /> Cập nhật mỗi 60 giây
          </span>
        </div>
        {loading ? (
          <div className="uc19-loading">
            <div />
            <div />
            <div />
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <CarFront size={42} />
            <h3>Không có phiên phù hợp</h3>
            <p>Thử thay đổi từ khóa hoặc bộ lọc.</p>
          </div>
        ) : (
          <div className="uc19-table-wrap">
            <table className="uc19-table">
              <thead>
                <tr>
                  <th>Phiên / biển số</th>
                  <th>RFID & đối chiếu</th>
                  <th>Thời gian vào</th>
                  <th>Trạng thái</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {visible.map((session) => {
                  const exception = isException(session);
                  return (
                    <tr
                      key={session.id}
                      className={
                        selected?.id === session.id ? "is-selected" : ""
                      }
                      onClick={() => setSelected(session)}
                    >
                      <td>
                        <strong>{session.plate || "Chưa nhận diện"}</strong>
                        <div className="muted-text">
                          {shortId(session.id)} ·{" "}
                          {session.owner || "Không rõ chủ xe"}
                        </div>
                      </td>
                      <td>
                        <div className="uc19-rfid">
                          <RadioTower size={13} />{" "}
                          {session.rfidCardId ||
                            session.entryRfidUid ||
                            "Chưa có RFID"}
                        </div>
                        <span
                          className={`uc19-match ${session.matchStatus === "Không khớp" ? "mismatch" : session.matchStatus === "Khớp" ? "matched" : "unknown"}`}
                        >
                          {session.matchStatus || "Chưa có kết quả"}
                        </span>
                      </td>
                      <td>
                        <span className="uc19-time">
                          <Clock3 size={13} /> {timeLabel(session)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`uc19-status ${exception ? "exception" : "active"}`}
                        >
                          {exception ? (
                            <AlertTriangle size={11} />
                          ) : (
                            <CheckCircle2 size={11} />
                          )}{" "}
                          {statusLabel(session)}
                        </span>
                        {session.exceptionType && (
                          <div className="muted-text">
                            {session.exceptionType}
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="uc19-detail-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(session);
                          }}
                        >
                          Chi tiết <ArrowUpRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside
        className="uc19-reason-strip"
        aria-label="Các loại ngoại lệ phổ biến"
      >
        <div>
          <strong>Điểm cần chú ý</strong>
          <span>Nhóm ngoại lệ đang xuất hiện nhiều nhất</span>
        </div>
        {exceptionReasons.length === 0 ? (
          <span className="muted-text">Chưa có dữ liệu ngoại lệ</span>
        ) : (
          exceptionReasons.map(([reason, count]) => (
            <span className="uc19-reason" key={reason}>
              <AlertTriangle size={13} /> {reason} <b>{count}</b>
            </span>
          ))
        )}
      </aside>

      {selected && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <section
            className="modal-card uc19-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="uc19-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">
                <div>
                  <p className="eyebrow">
                    Session detail · {shortId(selected.id)}
                  </p>
                  <h2 id="uc19-detail-title">
                    {selected.plate || "Chưa nhận diện"}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelected(null)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>
            <div className="uc19-detail-status">
              <span
                className={`uc19-status ${isException(selected) ? "exception" : "active"}`}
              >
                {isException(selected) ? (
                  <AlertTriangle size={12} />
                ) : (
                  <CheckCircle2 size={12} />
                )}{" "}
                {statusLabel(selected)}
              </span>
              <span>{timeLabel(selected)}</span>
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Chủ xe</dt>
                <dd>{selected.owner || "Không rõ"}</dd>
              </div>
              <div>
                <dt>RFID</dt>
                <dd>
                  {selected.rfidCardId || selected.entryRfidUid || "Không có"}
                </dd>
              </div>
              <div>
                <dt>Kết quả đối chiếu</dt>
                <dd>{selected.matchStatus || "Chưa có"}</dd>
              </div>
              <div>
                <dt>Trạng thái xác minh</dt>
                <dd>{selected.verificationStatus || "Không cần"}</dd>
              </div>
              <div>
                <dt>Biển số camera vào</dt>
                <dd>
                  {selected.entryDetectedPlate ||
                    (selected.entrySource === "manual" || selected.manualPlate
                      ? "Không nhận diện được tự động"
                      : "Không nhận diện")}
                  {selected.entrySource === "manual" || selected.manualPlate ? (
                    <span className="manual-entry-note">
                      {" "}
                      (Đã nhập thủ công:{" "}
                      {selected.manualPlate || selected.plate})
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Biển số camera ra</dt>
                <dd>{selected.exitDetectedPlate || "Chưa có"}</dd>
              </div>
            </dl>
            <div className="exception-note">
              <strong>Thông tin ngoại lệ</strong>
              <p>
                {selected.exceptionType ||
                  exceptionEvidenceLabel(selected.exceptionEvidence) ||
                  selected.manualEntryReason ||
                  selected.manualExitReason ||
                  ("Phiên gửi xe"
                    : "Không phát hiện ngoại lệ cụ thể.")}
              </p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
