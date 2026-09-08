"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Car,
  CheckCircle2,
  CircleDot,
  Clock,
  Filter,
  Eye,
  LayoutGrid,
  ParkingSquare,
  Search,
  X,
  Settings2,
  Trash2,
  UserRound,
  UsersRound,
  Wrench,
  RotateCcw,
} from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import { currency } from "@/lib/constants";
import type {
  FeeBreakdown,
  ParkingSession,
  ParkingSlot,
  PricingConfig,
  SlotStatus,
} from "@/types";

type QuotaType = "member" | "walk_in";
type SlotWithQuota = ParkingSlot & { quotaType?: QuotaType };

type PoolConfig = {
  key: QuotaType;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof UsersRound;
};

const POOLS: PoolConfig[] = [
  {
    key: "member",
    label: "Khu ưu tiên thành viên",
    shortLabel: "Thành viên",
    description:
      "Chỉ cấp cho xe có gói đăng ký đang hiệu lực. Không dùng chung quota với khách vãng lai.",
    icon: UsersRound,
  },
  {
    key: "walk_in",
    label: "Khu khách vãng lai",
    shortLabel: "Vãng lai",
    description:
      "Dành cho xe không có gói đăng ký. Hệ thống chỉ cấp slot trong quota vãng lai.",
    icon: UserRound,
  },
];

const statusLabel: Record<SlotStatus, string> = {
  empty: "Sẵn sàng cấp",
  occupied: "Đang sử dụng",
  reserved: "Đã giữ chỗ",
  maintenance: "Bảo trì",
};

function slotQuota(slot: SlotWithQuota): QuotaType {
  if (slot.quotaType === "member" || slot.accessPolicy === "resident")
    return "member";
  return "walk_in";
}

function poolSlots(slots: ParkingSlot[], pool: QuotaType) {
  return slots.filter((slot) => slotQuota(slot as SlotWithQuota) === pool);
}

function PoolMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className={`quota-slot-metric ${tone ?? "default"}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

// --- Helper cho modal chi tiết phiên ---
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} phút`;
}

function completedDuration(checkIn: string, checkOut?: string): string | null {
  if (!checkOut) return null;
  const [inHour, inMinute] = checkIn.split(":").map(Number);
  const [outHour, outMinute] = checkOut.split(":").map(Number);
  if (![inHour, inMinute, outHour, outMinute].every(Number.isFinite))
    return null;
  let minutes = outHour * 60 + outMinute - (inHour * 60 + inMinute);
  if (minutes < 0) minutes += 24 * 60;
  return formatDuration(minutes);
}

function LiveMinutes({
  checkIn,
  checkInAt,
}: {
  checkIn: string;
  checkInAt?: string;
}) {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    function calc() {
      const now = new Date();
      const checkInDate = checkInAt ? new Date(checkInAt) : new Date();
      if (!checkInAt || Number.isNaN(checkInDate.getTime())) {
        const [h, m] = checkIn.split(":").map(Number);
        checkInDate.setHours(h, m, 0, 0);
        if (checkInDate > now) checkInDate.setDate(checkInDate.getDate() - 1);
      }
      const diff = Math.floor((now.getTime() - checkInDate.getTime()) / 60000);
      setMinutes(Math.max(0, diff));
    }
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [checkIn, checkInAt]);

  return (
    <span className="session-live-min">
      <Clock size={12} />
      {formatDuration(minutes)}
    </span>
  );
}

/**
 * Tính phí tạm tính theo cấu hình hệ thống (pricingConfigState) — giống logic
 * `calculateParkingFee` ở backend, để hiển thị giá trực tiếp cho phiên đang
 * gửi mà không cần checkout. Mỗi chu kỳ 24 giờ tính một lần, từ lúc xe vào bãi.
 */
function calculateLiveFee(
  checkInAt: Date,
  now: Date,
  config: PricingConfig,
): FeeBreakdown {
  const dayRate = config.dayRate ?? 5000;
  const nightRate = config.nightRate ?? 10000;
  const dayStartHour = config.dayStartHour ?? 6;
  const nightStartHour = config.nightStartHour ?? 22;

  const totalMinutes = Math.max(
    0,
    Math.ceil((now.getTime() - checkInAt.getTime()) / 60000),
  );
  const freeMinutes = config.gracePeriod ?? 20;
  const exitHour = now.getHours() + now.getMinutes() / 60;
  const rateType: "day" | "night" =
    exitHour >= dayStartHour && exitHour < nightStartHour ? "day" : "night";
  const fee = rateType === "day" ? dayRate : nightRate;
  const billingDays =
    totalMinutes <= freeMinutes ? 0 : Math.ceil(totalMinutes / (24 * 60));

  const dailyBreakdown: NonNullable<FeeBreakdown["dailyBreakdown"]> = [];
  for (let dayIndex = 0; dayIndex < billingDays; dayIndex++) {
    const billingEnd = new Date(
      Math.min(
        checkInAt.getTime() + (dayIndex + 1) * 24 * 60 * 60 * 1000,
        now.getTime(),
      ),
    );
    dailyBreakdown.push({
      dayIndex,
      date: `${billingEnd.getFullYear()}-${String(
        billingEnd.getMonth() + 1,
      ).padStart(2, "0")}-${String(billingEnd.getDate()).padStart(2, "0")}`,
      rateType,
      fee,
      checkOutHour: exitHour,
    });
  }

  const totalFee =
    totalMinutes <= freeMinutes
      ? 0
      : dailyBreakdown.reduce((sum, d) => sum + d.fee, 0);

  return {
    totalMinutes,
    freeMinutes,
    billableMinutes: Math.max(0, totalMinutes - freeMinutes),
    billableHours: 0,
    hourlyRate: 0,
    parkingFee: totalFee,
    overdueFine: 0,
    totalFee,
    dailyBreakdown,
  };
}

function renderFee(
  session: ParkingSession,
  slot?: ParkingSlot,
  pricingConfig?: PricingConfig,
) {
  const isSubscriber = slot?.quotaType === "member";
  const isRegisteredNoSub =
    (slot?.customerType === "member" && slot?.quotaType !== "member") ||
    (slot?.isRegisteredMember && slot?.customerType !== "member") ||
    false;
  if (session.paymentMethod === "subscription" && !isSubscriber) {
    // Không có gói hiệu lực → tính phí theo lượt, không miễn phí.
    return (
      <>
        <strong className="fee-pending">
          {isRegisteredNoSub ? "Tính theo lượt" : "Chưa thanh toán"}
        </strong>
        <span className="fee-meta">Tính phí theo lượt khi checkout</span>
      </>
    );
  }
  if (session.paymentMethod === "subscription") {
    return <span className="fee-meta">Đã bao gồm trong gói thành viên</span>;
  }
  if (session.feeBreakdown) {
    return (
      <>
        <strong>{currency.format(session.fee)}</strong>
        <span className="fee-meta">
          {session.feeBreakdown.totalMinutes} phút ·{" "}
          {session.feeBreakdown.billableHours}h tính phí
        </span>
      </>
    );
  }
  if (session.status === "Đang gửi") {
    const checkInAt = session.checkInAt ? new Date(session.checkInAt) : null;
    if (checkInAt && pricingConfig) {
      const live = calculateLiveFee(checkInAt, new Date(), pricingConfig);
      return (
        <>
          <strong>{currency.format(live.totalFee)}</strong>
          <span className="fee-meta fee-pending">
            phí tạm tính · {live.totalMinutes} phút
            {live.totalMinutes > live.freeMinutes
              ? ` · ${live.dailyBreakdown?.length ?? 1} ngày`
              : ""}
          </span>
        </>
      );
    }
    return (
      <>
        <strong className="fee-pending">Chưa tính</strong>
        <span className="fee-meta">Sẽ tính khi checkout</span>
      </>
    );
  }
  if (session.status === "Đã hoàn thành") {
    return session.fee > 0 ? (
      <strong>{currency.format(session.fee)}</strong>
    ) : (
      <strong className="fee-pending">0 ₫</strong>
    );
  }
  return <span className="muted">—</span>;
}

function paymentMethodLabel(
  paymentMethod?: string,
  paymentStatus?: string,
  slot?: ParkingSlot,
) {
  const isSubscriber = slot?.quotaType === "member";
  const isRegisteredNoSub =
    (slot?.customerType === "member" && slot?.quotaType !== "member") ||
    (slot?.isRegisteredMember && slot?.customerType !== "member") ||
    false;
  if (paymentMethod === "subscription" && !isSubscriber) {
    return isRegisteredNoSub
      ? "Thanh toán theo lượt (chưa có gói tháng)"
      : "Thanh toán theo lượt khách vãng lai";
  }
  if (paymentMethod === "payos") return "Thanh toán PayOS";
  if (paymentMethod === "cash") return "Thanh toán tiền mặt";
  if (paymentMethod === "subscription") return "Theo gói thành viên";
  if (paymentStatus === "fully_paid")
    return "Đã thanh toán (chưa xác định phương thức)";
  return "Chưa thanh toán";
}

function SlotTile({
  slot,
  displayNumber,
  isAdmin,
  onUpdateStatus,
  onDelete,
  onOpenDetail,
}: {
  slot: ParkingSlot;
  displayNumber: number;
  isAdmin: boolean;
  onUpdateStatus: (id: string, status: SlotStatus) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (slot: ParkingSlot) => void;
}) {
  const quota = slotQuota(slot as SlotWithQuota);
  const canManage =
    isAdmin && slot.status !== "occupied" && slot.status !== "reserved";
  const memberWithoutPackage =
    slot.customerType === "member" && slot.quotaType !== "member";
  const customerLabel = memberWithoutPackage
    ? "Khách Thành Viên (chưa mua gói tháng)"
    : slot.customerType === "member"
      ? "Khách Thành Viên (Không Có Gói)"
      : slot.isRegisteredMember
        ? "Khách Thành Viên (chưa mua gói tháng)"
        : "Khách Vãng Lai";
  const customerColor = memberWithoutPackage
    ? { background: "#f3e8ff", color: "#7c3aed" }
    : slot.customerType === "member"
      ? { background: "#eaf2ff", color: "#2563a9" }
      : slot.isRegisteredMember
        ? { background: "#f3e8ff", color: "#7c3aed" }
        : { background: "#fff5de", color: "#b76e08" };
  return (
    <article
      className={`quota-slot-tile ${quota} ${slot.status}`}
      onClick={() => onOpenDetail(slot)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(slot);
        }
      }}
      style={{ cursor: "pointer" }}
    >
      <div className="quota-slot-tile-head">
        <div>
          <span className="quota-slot-code">{displayNumber}</span>
        </div>
        <span className={`quota-status ${slot.status}`}>
          {slot.status === "occupied" ? (
            <Car size={13} />
          ) : slot.status === "empty" ? (
            <CheckCircle2 size={13} />
          ) : (
            <CircleDot size={13} />
          )}
          {statusLabel[slot.status]}
        </span>
      </div>
      <div className="quota-slot-tile-body">
        {slot.status === "occupied" ? (
          <>
            <Car size={24} />
            <strong>{slot.currentPlate || "Đang có xe"}</strong>
            {slot.customerType && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.5,
                  whiteSpace: "nowrap",
                  background: customerColor.background,
                  color: customerColor.color,
                }}
              >
                {customerLabel}
              </span>
            )}
            {slot.ownerName && (
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#64748b",
                  lineHeight: 1.5,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {slot.ownerName}
              </span>
            )}
          </>
        ) : slot.status === "maintenance" ? (
          <>
            <Wrench size={24} />
            <span>Không cấp phát</span>
          </>
        ) : (
          <>
            <ParkingSquare size={24} />
            <span>
              {slot.status === "reserved" ? "Chờ xe vào" : "Có thể cấp phát"}
            </span>
          </>
        )}
      </div>
      {isAdmin && (
        <div className="quota-slot-tile-foot">
          {canManage && (
            <div className="quota-slot-actions">
              <button
                type="button"
                title={slot.status === "maintenance" ? "Mở lại" : "Đặt bảo trì"}
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdateStatus(
                    slot.id,
                    slot.status === "maintenance" ? "empty" : "maintenance",
                  );
                }}
              >
                {slot.status === "maintenance" ? (
                  <RotateCcw size={14} />
                ) : (
                  <Wrench size={14} />
                )}
              </button>
              <button
                type="button"
                title="Xóa slot"
                className="danger"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(slot.id);
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function ParkingSlotsView() {
  const {
    currentUser,
    slotList,
    sessions,
    updateSlotStatus,
    deleteSlot,
    capacityConfig,
    loadCapacityConfig,
    updateGlobalCapacity,
    pricingConfigState,
  } = useParkingApp();
  const [activePool, setActivePool] = useState<QuotaType | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<SlotStatus | "">("");
  const [query, setQuery] = useState("");
  const [detailSlot, setDetailSlot] = useState<ParkingSlot | null>(null);
  const [showCapacitySettings, setShowCapacitySettings] = useState(false);
  const [capacityDraft, setCapacityDraft] = useState("");
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [isSavingCapacity, setIsSavingCapacity] = useState(false);
  const isAdmin = currentUser?.role === "admin";
  const maxCapacity = capacityConfig?.globalCapacity ?? 0;
  useEffect(() => {
    if (isAdmin) void loadCapacityConfig();
  }, [isAdmin]);

  const minimumCapacity = useMemo(
    () =>
      slotList.filter(
        (slot) => slot.status === "occupied" || slot.status === "reserved",
      ).length,
    [slotList],
  );

  const summary = useMemo(() => {
    return POOLS.map((pool) => {
      const slots = poolSlots(slotList, pool.key);
      const available = slots.filter((slot) => slot.status === "empty").length;
      const active = slots.filter(
        (slot) => slot.status === "occupied" || slot.status === "reserved",
      ).length;
      return {
        ...pool,
        slots,
        total: slots.length,
        available,
        active,
        unavailable: slots.length - available - active,
      };
    });
  }, [slotList]);

  const visibleSlots = useMemo(
    () =>
      slotList
        .filter((slot) => {
          const quota = slotQuota(slot as SlotWithQuota);
          if (activePool !== "all" && quota !== activePool) return false;
          if (selectedStatus && slot.status !== selectedStatus) return false;
          return (
            !query ||
            `${slot.slotCode} ${slot.currentPlate ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase())
          );
        })
        .sort((left, right) =>
          left.slotCode.localeCompare(right.slotCode, undefined, {
            numeric: true,
          }),
        ),
    [slotList, activePool, selectedStatus, query],
  );

  const slotNumbers = new Map(
    [...slotList]
      .sort((a, b) =>
        a.slotCode.localeCompare(b.slotCode, undefined, { numeric: true }),
      )
      .map((slot, index) => [slot.id, index + 1]),
  );
  const filteredSlots = visibleSlots;

  const detailSession = useMemo(() => {
    if (!detailSlot?.currentSessionId) return null;
    return (
      sessions.find((session) => session.id === detailSlot.currentSessionId) ??
      null
    );
  }, [detailSlot, sessions]);

  const openCapacitySettings = async () => {
    setCapacityError(null);
    setCapacityDraft(String(Math.max(capacityConfig?.globalCapacity ?? 1, 1)));
    setShowCapacitySettings(true);

    try {
      const data = await loadCapacityConfig();
      const configuredCapacity =
        data?.config?.globalCapacity ??
        capacityConfig?.globalCapacity ??
        slotList.length;
      setCapacityDraft(String(Math.max(configuredCapacity, 1)));
    } catch {
      setCapacityError(
        "Không tải được cấu hình hiện tại. Bạn vẫn có thể nhập sức chứa mới để lưu.",
      );
    }
  };

  const saveCapacity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextCapacity = Number(capacityDraft);
    if (!Number.isInteger(nextCapacity) || nextCapacity < 1) {
      setCapacityError("Tổng sức chứa phải là số nguyên lớn hơn 0.");
      return;
    }
    if (nextCapacity < minimumCapacity) {
      setCapacityError(
        `Không thể đặt dưới ${minimumCapacity} slot vì đang có ${minimumCapacity} slot có xe hoặc được giữ chỗ.`,
      );
      return;
    }

    setCapacityError(null);
    setIsSavingCapacity(true);
    const updated = await updateGlobalCapacity({
      globalCapacity: nextCapacity,
    });
    setIsSavingCapacity(false);
    if (!updated) {
      setCapacityError(
        "Không thể cập nhật sức chứa. Vui lòng kiểm tra lại cấu hình zone.",
      );
      return;
    }

    setShowCapacitySettings(false);
  };

  return (
    <section className="quota-slots-page">
      <header className="quota-slots-hero">
        <div className="quota-slots-hero-copy">
          <div className="quota-slots-eyebrow">
            <ParkingSquare size={15} /> Vận hành bãi đỗ
          </div>
          <h1>Quản lý quota chỗ đỗ</h1>
          <p>
            Hai pool độc lập giúp xe thành viên và xe vãng lai luôn được cấp
            đúng khu vực, không lấy chéo quota.
          </p>
        </div>
        {isAdmin && (
          <div className="quota-hero-actions">
            <button
              type="button"
              className="quota-capacity-button"
              onClick={() => {
                void openCapacitySettings();
              }}
            >
              <Settings2 size={17} /> Sức chứa
            </button>
          </div>
        )}
      </header>

      {showCapacitySettings && isAdmin && (
        <form className="quota-capacity-form" onSubmit={saveCapacity}>
          <div>
            <h2>Tổng sức chứa bãi xe</h2>
            <p>
              Khi tăng sức chứa, hệ thống tự tạo slot còn thiếu. Khi giảm, hệ
              thống tự xóa slot trống dư.
            </p>
          </div>
          <label>
            Số slot tối đa
            <input
              type="number"
              min={Math.max(minimumCapacity, 1)}
              step="1"
              value={capacityDraft}
              onChange={(event) => setCapacityDraft(event.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={isSavingCapacity}>
            <Settings2 size={16} />{" "}
            {isSavingCapacity ? "Đang lưu..." : "Lưu sức chứa"}
          </button>
          <p className="quota-capacity-hint">
            Đang hiển thị: <strong>{slotList.length}</strong> /{" "}
            <strong>{maxCapacity || "-"}</strong> slot. Tối thiểu:{" "}
            <strong>{minimumCapacity}</strong> slot đang có xe/được giữ chỗ.
          </p>
          {capacityError && (
            <p className="quota-capacity-error" role="alert">
              {capacityError}
            </p>
          )}
        </form>
      )}

      <div className="quota-pool-overview">
        {summary.map((pool) => {
          const Icon = pool.icon;
          const active = activePool === pool.key;
          return (
            <button
              key={pool.key}
              type="button"
              onClick={() => setActivePool(active ? "all" : pool.key)}
              className={`quota-pool-card ${pool.key} ${active ? "selected" : ""}`}
            >
              <div className="quota-pool-card-head">
                <span className="quota-pool-icon">
                  <Icon size={20} />
                </span>
                <div>
                  <strong>{pool.label}</strong>
                  <small>{pool.description}</small>
                </div>
              </div>
              <div className="quota-metrics">
                <PoolMetric label="tổng slot" value={pool.total} />
                <PoolMetric
                  label="còn cấp được"
                  value={pool.available}
                  tone="success"
                />
                <PoolMetric
                  label="đang dùng/giữ"
                  value={pool.active}
                  tone="warning"
                />
              </div>
              <div className="quota-capacity">
                <span
                  style={{
                    width: `${pool.total ? Math.round((pool.available / pool.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="quota-control-bar">
        <div className="quota-pool-tabs">
          <button
            type="button"
            onClick={() => setActivePool("all")}
            className={activePool === "all" ? "active" : ""}
          >
            Tất cả slot
          </button>
          {POOLS.map((pool) => (
            <button
              type="button"
              key={pool.key}
              onClick={() => setActivePool(pool.key)}
              className={activePool === pool.key ? "active" : ""}
            >
              {pool.shortLabel}
            </button>
          ))}
        </div>
        <div className="quota-filters">
          <label className="quota-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã slot hoặc biển số"
            />
          </label>
          <select
            aria-label="Lọc trạng thái"
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(event.target.value as SlotStatus | "")
            }
          >
            <option value="">Mọi trạng thái</option>
            <option value="empty">Sẵn sàng cấp</option>
            <option value="occupied">Đang sử dụng</option>
            <option value="reserved">Đã giữ chỗ</option>
            <option value="maintenance">Bảo trì</option>
          </select>
        </div>
      </div>

      <div className="quota-legend">
        <span>
          <i className="member" /> Slot thành viên
        </span>
        <span>
          <i className="walk-in" /> Slot vãng lai
        </span>
        <span>
          <CheckCircle2 size={14} /> Sẵn sàng cấp
        </span>
        <span>
          <Car size={14} /> Có xe đỗ
        </span>
      </div>
      <section className="quota-slot-unified">
        <header className="quota-slot-unified-head">
          <div>
            <span className="quota-group-icon">
              <LayoutGrid size={18} />
            </span>
            <div>
              <h2>Tất cả slot</h2>
              <p>
                Danh sách slot quản lý chung; loại quota hiển thị ngay trên từng
                thẻ.
              </p>
            </div>
          </div>
          <span>{filteredSlots.length} slot hiển thị</span>
        </header>
        <div className="quota-slot-grid">
          {filteredSlots.map((slot) => (
            <SlotTile
              key={slot.id}
              slot={slot}
              displayNumber={slotNumbers.get(slot.id) ?? 0}
              isAdmin={Boolean(isAdmin)}
              onUpdateStatus={(id, status) => void updateSlotStatus(id, status)}
              onDelete={(id) => void deleteSlot(id)}
              onOpenDetail={setDetailSlot}
            />
          ))}
          {filteredSlots.length === 0 && (
            <div className="quota-empty">
              <LayoutGrid size={30} />
              <span>Chưa có slot phù hợp với bộ lọc.</span>
            </div>
          )}
        </div>
      </section>

      {detailSlot && (
        <div
          className="modal-overlay"
          role="presentation"
          
        >
          <section
            className="modal-card session-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="slot-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">
                <Eye size={18} aria-hidden />
                <div>
                  <p className="muted-text">
                    {detailSession
                      ? "Chi tiết phiên đỗ xe"
                      : `Slot ${detailSlot.slotCode}`}
                  </p>
                  <h3 id="slot-detail-title">
                    {detailSession?.plate ||
                      detailSlot.currentPlate ||
                      detailSlot.slotCode}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setDetailSlot(null)}
                aria-label="Đóng chi tiết phiên"
              >
                <X size={18} />
              </button>
            </div>

            <div className="session-detail-grid">
              <div>
                <span>Mã phiên</span>
                <strong>
                  {detailSession
                    ? `#${detailSession.id.slice(-8).toUpperCase()}`
                    : detailSlot.currentSessionId
                      ? `#${detailSlot.currentSessionId.slice(-8).toUpperCase()}`
                      : "—"}
                </strong>
              </div>
              <div>
                <span>Chủ xe</span>
                <strong>
                  {detailSession?.owner ||
                    detailSlot.ownerName ||
                    "Khách vãng lai"}
                </strong>
              </div>
              <div>
                <span>Loại khách</span>
                <strong>
                  {detailSlot.customerType === "member" &&
                  detailSlot.quotaType !== "member"
                    ? "Khách Thành Viên (chưa mua gói tháng)"
                    : detailSlot.customerType === "member"
                      ? "Khách Thành Viên (Không Có Gói)"
                      : detailSlot.isRegisteredMember
                        ? "Khách Thành Viên (chưa mua gói tháng)"
                        : "Khách Vãng Lai"}
                </strong>
              </div>
              <div>
                <span>Trạng thái slot</span>
                <strong>{statusLabel[detailSlot.status]}</strong>
              </div>
              <div>
                <span>Vị trí</span>
                <strong>
                  {detailSlot.slotCode +
                    (detailSlot.zoneName ? ` · ${detailSlot.zoneName}` : "")}
                </strong>
              </div>
              {detailSession && (
                <>
                  <div>
                    <span>UID RFID lúc vào</span>
                    <strong>
                      {detailSession.entryRfidUid ||
                        detailSession.rfidCardId ||
                        "Chưa ghi nhận"}
                    </strong>
                  </div>
                  <div>
                    <span>UID RFID lúc ra</span>
                    <strong>
                      {detailSession.exitRfidUid || "Chưa ghi nhận"}
                    </strong>
                  </div>
                  <div>
                    <span>Thời gian vào</span>
                    <strong>
                      {detailSession.checkInDate} {detailSession.checkIn}
                    </strong>
                  </div>
                  <div>
                    <span>Thời gian ra</span>
                    <strong>
                      {detailSession.checkOut
                        ? `${detailSession.checkOutDate ?? ""} ${detailSession.checkOut}`.trim()
                        : "Chưa ra bãi"}
                    </strong>
                  </div>
                  <div>
                    <span>Thời lượng</span>
                    <strong>
                      {detailSession.status === "Đang gửi" ? (
                        <LiveMinutes
                          checkIn={detailSession.checkIn}
                          checkInAt={detailSession.checkInAt}
                        />
                      ) : (
                        (completedDuration(
                          detailSession.checkIn,
                          detailSession.checkOut,
                        ) ?? "—")
                      )}
                    </strong>
                  </div>
                </>
              )}
              {!detailSession && (
                <div>
                  <span>Ghi chú</span>
                  <strong>Không tìm thấy bản ghi phiên đầy đủ.</strong>
                </div>
              )}
            </div>

            {detailSession && (
              <div className="session-detail-status">
                <div>
                  <span>Trạng thái</span>
                  <strong>{detailSession.status}</strong>
                </div>
                <div>
                  <span>Thanh toán</span>
                  <strong>
                    {(() => {
                      const isSubscriber = detailSlot.quotaType === "member";
                      if (
                        detailSession.paymentStatus === "fully_paid" &&
                        !isSubscriber &&
                        detailSession.paymentMethod === "subscription"
                      ) {
                        // Legacy/mislabeled: khách không có gói nhưng bị gắn trạng thái miễn phí.
                        return "Chưa thanh toán (theo lượt)";
                      }
                      if (detailSession.paymentStatus === "fully_paid")
                        return "Đã thanh toán";
                      if (detailSession.paymentStatus === "partial_paid")
                        return "Một phần";
                      if (detailSession.paymentStatus === "unpaid")
                        return "Chưa thanh toán";
                      return "—";
                    })()}
                  </strong>
                </div>
                <div>
                  <span>Phương thức</span>
                  <strong>
                    {paymentMethodLabel(
                      detailSession.paymentMethod,
                      detailSession.paymentStatus,
                      detailSlot,
                    )}
                  </strong>
                </div>
                <div>
                  <span>
                    Phí {detailSession.status === "Đang gửi" ? "tạm tính" : ""}
                  </span>
                  {renderFee(detailSession, detailSlot, pricingConfigState)}
                </div>
              </div>
            )}

            {detailSession &&
              (detailSession.manualEntryReason ||
                detailSession.manualExitReason) && (
                <div className="session-detail-notes">
                  <h4>Ghi chú xử lý thủ công</h4>
                  {detailSession.manualEntryReason && (
                    <p>
                      <strong>Vào thủ công:</strong>{" "}
                      {detailSession.manualEntryReason}
                    </p>
                  )}
                  {detailSession.manualExitReason && (
                    <p>
                      <strong>
                        {detailSession.status === "Đang gửi"
                          ? "Lần thử ra thủ công (chưa checkout):"
                          : "Ra thủ công:"}
                      </strong>{" "}
                      {detailSession.manualExitReason}
                    </p>
                  )}
                </div>
              )}
          </section>
        </div>
      )}
    </section>
  );
}
