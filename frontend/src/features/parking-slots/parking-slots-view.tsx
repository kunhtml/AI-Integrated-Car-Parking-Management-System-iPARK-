"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Car,
  CheckCircle2,
  CircleDot,
  Filter,
  LayoutGrid,
  ParkingSquare,
  Search,
  Settings2,
  Trash2,
  UserRound,
  UsersRound,
  Wrench,
  RotateCcw,
} from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import type { ParkingSlot, SlotStatus } from "@/types";

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
    description: "Chỉ cấp cho xe có gói đăng ký đang hiệu lực. Không dùng chung quota với khách vãng lai.",
    icon: UsersRound,
  },
  {
    key: "walk_in",
    label: "Khu khách vãng lai",
    shortLabel: "Vãng lai",
    description: "Dành cho xe không có gói đăng ký. Hệ thống chỉ cấp slot trong quota vãng lai.",
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
  if (slot.quotaType === "member" || slot.accessPolicy === "resident") return "member";
  return "walk_in";
}

function poolSlots(slots: ParkingSlot[], pool: QuotaType) {
  return slots.filter((slot) => slotQuota(slot as SlotWithQuota) === pool);
}

function PoolMetric({ label, value, tone }: { label: string; value: number; tone?: "default" | "success" | "warning" }) {
  return (
    <div className={`quota-slot-metric ${tone ?? "default"}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SlotTile({ slot, displayNumber, isAdmin, onUpdateStatus, onDelete }: {
  slot: ParkingSlot;
  displayNumber: number;
  isAdmin: boolean;
  onUpdateStatus: (id: string, status: SlotStatus) => void;
  onDelete: (id: string) => void;
}) {
  const quota = slotQuota(slot as SlotWithQuota);
  const canManage = isAdmin && slot.status !== "occupied" && slot.status !== "reserved";
  return (
    <article className={`quota-slot-tile ${quota} ${slot.status}`}>
      <div className="quota-slot-tile-head">
        <div>
          <span className="quota-slot-code">{displayNumber}</span>
        </div>
        <span className={`quota-status ${slot.status}`}>{slot.status === "occupied" ? <Car size={13} /> : slot.status === "empty" ? <CheckCircle2 size={13} /> : <CircleDot size={13} />}{statusLabel[slot.status]}</span>
      </div>
      <div className="quota-slot-tile-body">
        {slot.status === "occupied" ? <><Car size={24} /><strong>{slot.currentPlate || "Đang có xe"}</strong></> : slot.status === "maintenance" ? <><Wrench size={24} /><span>Không cấp phát</span></> : <><ParkingSquare size={24} /><span>{slot.status === "reserved" ? "Chờ xe vào" : "Có thể cấp phát"}</span></>}
      </div>
      {isAdmin && (
        <div className="quota-slot-tile-foot">
            {canManage && <div className="quota-slot-actions">
            <button type="button" title={slot.status === "maintenance" ? "Mở lại" : "Đặt bảo trì"} onClick={() => onUpdateStatus(slot.id, slot.status === "maintenance" ? "empty" : "maintenance")}>{slot.status === "maintenance" ? <RotateCcw size={14} /> : <Wrench size={14} />}</button>
            <button type="button" title="Xóa slot" className="danger" onClick={() => onDelete(slot.id)}><Trash2 size={14} /></button>
          </div>}
        </div>
      )}
    </article>
  );
}

export function ParkingSlotsView() {
  const { currentUser, slotList, updateSlotStatus, deleteSlot, capacityConfig, loadCapacityConfig, updateGlobalCapacity } = useParkingApp();
  const [activePool, setActivePool] = useState<QuotaType | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<SlotStatus | "">("");
  const [query, setQuery] = useState("");
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
    () => slotList.filter((slot) => slot.status === "occupied" || slot.status === "reserved").length,
    [slotList],
  );

  const summary = useMemo(() => {
    return POOLS.map((pool) => {
      const slots = poolSlots(slotList, pool.key);
      const available = slots.filter((slot) => slot.status === "empty").length;
      const active = slots.filter((slot) => slot.status === "occupied" || slot.status === "reserved").length;
      return { ...pool, slots, total: slots.length, available, active, unavailable: slots.length - available - active };
    });
  }, [slotList]);

  const visibleSlots = useMemo(() => slotList
    .filter((slot) => {
      const quota = slotQuota(slot as SlotWithQuota);
      if (activePool !== "all" && quota !== activePool) return false;
      if (selectedStatus && slot.status !== selectedStatus) return false;
      return !query || `${slot.slotCode} ${slot.currentPlate ?? ""}`.toLowerCase().includes(query.toLowerCase());
    })
    .sort((left, right) => left.slotCode.localeCompare(right.slotCode, undefined, { numeric: true })),
  [slotList, activePool, selectedStatus, query]);

  const slotNumbers = new Map([...slotList].sort((a, b) => a.slotCode.localeCompare(b.slotCode, undefined, { numeric: true })).map((slot, index) => [slot.id, index + 1]));
  const filteredSlots = visibleSlots;

  const openCapacitySettings = async () => {
    setCapacityError(null);
    setCapacityDraft(String(Math.max(capacityConfig?.globalCapacity ?? 1, 1)));
    setShowCapacitySettings(true);

    try {
      const data = await loadCapacityConfig();
      const configuredCapacity = data?.config?.globalCapacity ?? capacityConfig?.globalCapacity ?? slotList.length;
      setCapacityDraft(String(Math.max(configuredCapacity, 1)));
    } catch {
      setCapacityError("Không tải được cấu hình hiện tại. Bạn vẫn có thể nhập sức chứa mới để lưu.");
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
      setCapacityError(`Không thể đặt dưới ${minimumCapacity} slot vì đang có ${minimumCapacity} slot có xe hoặc được giữ chỗ.`);
      return;
    }

    setCapacityError(null);
    setIsSavingCapacity(true);
    const updated = await updateGlobalCapacity({ globalCapacity: nextCapacity });
    setIsSavingCapacity(false);
    if (!updated) {
      setCapacityError("Không thể cập nhật sức chứa. Vui lòng kiểm tra lại cấu hình zone.");
      return;
    }

    setShowCapacitySettings(false);
  };

  return (
    <section className="quota-slots-page">
      <header className="quota-slots-hero">
        <div className="quota-slots-hero-copy"><div className="quota-slots-eyebrow"><ParkingSquare size={15} /> Vận hành bãi đỗ</div><h1>Quản lý quota chỗ đỗ</h1><p>Hai pool độc lập giúp xe thành viên và xe vãng lai luôn được cấp đúng khu vực, không lấy chéo quota.</p></div>
        {isAdmin && <div className="quota-hero-actions">
          <button type="button" className="quota-capacity-button" onClick={() => { void openCapacitySettings(); }}>
            <Settings2 size={17} /> Sức chứa
          </button>
        </div>}
      </header>

      {showCapacitySettings && isAdmin && <form className="quota-capacity-form" onSubmit={saveCapacity}>
        <div>
          <h2>Tổng sức chứa bãi xe</h2>
          <p>Khi tăng sức chứa, hệ thống tự tạo slot còn thiếu. Khi giảm, hệ thống tự xóa slot trống dư.</p>
        </div>
        <label>
          Số slot tối đa
          <input type="number" min={Math.max(minimumCapacity, 1)} step="1" value={capacityDraft} onChange={(event) => setCapacityDraft(event.target.value)} required />
        </label>
        <button type="submit" disabled={isSavingCapacity}>
          <Settings2 size={16} /> {isSavingCapacity ? "Đang lưu..." : "Lưu sức chứa"}
        </button>
        <p className="quota-capacity-hint">Đang hiển thị: <strong>{slotList.length}</strong> / <strong>{maxCapacity || "-"}</strong> slot. Tối thiểu: <strong>{minimumCapacity}</strong> slot đang có xe/được giữ chỗ.</p>
        {capacityError && <p className="quota-capacity-error" role="alert">{capacityError}</p>}
      </form>}

      <div className="quota-pool-overview">
        {summary.map((pool) => { const Icon = pool.icon; const active = activePool === pool.key; return <button key={pool.key} type="button" onClick={() => setActivePool(active ? "all" : pool.key)} className={`quota-pool-card ${pool.key} ${active ? "selected" : ""}`}><div className="quota-pool-card-head"><span className="quota-pool-icon"><Icon size={20} /></span><div><strong>{pool.label}</strong><small>{pool.description}</small></div></div><div className="quota-metrics"><PoolMetric label="tổng slot" value={pool.total} /><PoolMetric label="còn cấp được" value={pool.available} tone="success" /><PoolMetric label="đang dùng/giữ" value={pool.active} tone="warning" /></div><div className="quota-capacity"><span style={{ width: `${pool.total ? Math.round((pool.available / pool.total) * 100) : 0}%` }} /></div></button>; })}
      </div>

      <div className="quota-control-bar"><div className="quota-pool-tabs"><button type="button" onClick={() => setActivePool("all")} className={activePool === "all" ? "active" : ""}>Tất cả slot</button>{POOLS.map((pool) => <button type="button" key={pool.key} onClick={() => setActivePool(pool.key)} className={activePool === pool.key ? "active" : ""}>{pool.shortLabel}</button>)}</div><div className="quota-filters"><label className="quota-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã slot hoặc biển số" /></label><select aria-label="Lọc trạng thái" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as SlotStatus | "")}><option value="">Mọi trạng thái</option><option value="empty">Sẵn sàng cấp</option><option value="occupied">Đang sử dụng</option><option value="reserved">Đã giữ chỗ</option><option value="maintenance">Bảo trì</option></select></div></div>

      <div className="quota-legend"><span><i className="member" /> Slot thành viên</span><span><i className="walk-in" /> Slot vãng lai</span><span><CheckCircle2 size={14} /> Sẵn sàng cấp</span><span><Car size={14} /> Có xe đỗ</span></div>
      <section className="quota-slot-unified">
        <header className="quota-slot-unified-head">
          <div><span className="quota-group-icon"><LayoutGrid size={18} /></span><div><h2>Tất cả slot</h2><p>Danh sách slot quản lý chung; loại quota hiển thị ngay trên từng thẻ.</p></div></div>
          <span>{filteredSlots.length} slot hiển thị</span>
        </header>
        <div className="quota-slot-grid">
          {filteredSlots.map((slot) => <SlotTile key={slot.id} slot={slot} displayNumber={slotNumbers.get(slot.id) ?? 0} isAdmin={Boolean(isAdmin)} onUpdateStatus={(id, status) => void updateSlotStatus(id, status)} onDelete={(id) => void deleteSlot(id)} />)}
          {filteredSlots.length === 0 && <div className="quota-empty"><LayoutGrid size={30} /><span>Chưa có slot phù hợp với bộ lọc.</span></div>}
        </div>
      </section>
    </section>
  );
}

