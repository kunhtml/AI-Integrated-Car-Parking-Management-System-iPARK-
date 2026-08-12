"use client";

import { useMemo, useState } from "react";
import {
  Car,
  CheckCircle2,
  CircleDot,
  Filter,
  LayoutGrid,
  ParkingSquare,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  Wrench,
  RotateCcw,
} from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import type { ParkingSlot, SlotAccessPolicy, SlotStatus } from "@/types";

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

function SlotTile({ slot, zoneName, isAdmin, onUpdateStatus, onDelete, onPolicy }: {
  slot: ParkingSlot;
  zoneName: string;
  isAdmin: boolean;
  onUpdateStatus: (id: string, status: SlotStatus) => void;
  onDelete: (id: string) => void;
  onPolicy: (id: string, policy: SlotAccessPolicy) => void;
}) {
  const quota = slotQuota(slot as SlotWithQuota);
  const canManage = isAdmin && slot.status !== "occupied" && slot.status !== "reserved";
  return (
    <article className={`quota-slot-tile ${quota} ${slot.status}`}>
      <div className="quota-slot-tile-head">
        <div>
          <span className="quota-slot-code">{slot.slotCode}</span>
          <span className="quota-slot-zone">{zoneName}</span>
        </div>
        <span className={`quota-status ${slot.status}`}>{slot.status === "occupied" ? <Car size={13} /> : slot.status === "empty" ? <CheckCircle2 size={13} /> : <CircleDot size={13} />}{statusLabel[slot.status]}</span>
      </div>
      <div className="quota-slot-tile-body">
        {slot.status === "occupied" ? <><Car size={24} /><strong>{slot.currentPlate || "Đang có xe"}</strong></> : slot.status === "maintenance" ? <><Wrench size={24} /><span>Không cấp phát</span></> : <><ParkingSquare size={24} /><span>{slot.status === "reserved" ? "Chờ xe vào" : "Có thể cấp phát"}</span></>}
      </div>
      {isAdmin && (
        <div className="quota-slot-tile-foot">
          <select aria-label={`Phân nhóm ${slot.slotCode}`} value={quota === "member" ? "resident" : "guest"} onChange={(event) => onPolicy(slot.id, event.target.value as SlotAccessPolicy)} disabled={slot.status === "occupied"}>
            <option value="resident">Thành viên</option>
            <option value="guest">Vãng lai</option>
          </select>
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
  const { currentUser, zoneList, slotList, createSlot, updateSlotStatus, deleteSlot, updateSlotAccessPolicy } = useParkingApp();
  const [activePool, setActivePool] = useState<QuotaType | "all">("all");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<SlotStatus | "">("");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const isAdmin = currentUser?.role === "admin";

  const summary = useMemo(() => {
    return POOLS.map((pool) => {
      const slots = poolSlots(slotList, pool.key);
      const available = slots.filter((slot) => slot.status === "empty").length;
      const active = slots.filter((slot) => slot.status === "occupied" || slot.status === "reserved").length;
      return { ...pool, slots, total: slots.length, available, active, unavailable: slots.length - available - active };
    });
  }, [slotList]);

  const visibleSlots = useMemo(() => slotList.filter((slot) => {
    const quota = slotQuota(slot as SlotWithQuota);
    if (activePool !== "all" && quota !== activePool) return false;
    if (selectedZone && slot.zoneId !== selectedZone) return false;
    if (selectedStatus && slot.status !== selectedStatus) return false;
    return !query || `${slot.slotCode} ${slot.currentPlate ?? ""}`.toLowerCase().includes(query.toLowerCase());
  }), [slotList, activePool, selectedZone, selectedStatus, query]);

  const filteredSlots = visibleSlots;

  return (
    <section className="quota-slots-page">
      <header className="quota-slots-hero">
        <div className="quota-slots-hero-copy"><div className="quota-slots-eyebrow"><ParkingSquare size={15} /> Vận hành bãi đỗ</div><h1>Quản lý quota chỗ đỗ</h1><p>Hai pool độc lập giúp xe thành viên và xe vãng lai luôn được cấp đúng khu vực, không lấy chéo quota.</p></div>
        {isAdmin && <button type="button" className="quota-create-button" onClick={() => setShowCreate((value) => !value)}><Plus size={17} /> {showCreate ? "Đóng tạo slot" : "Tạo slot mới"}</button>}
      </header>

      <div className="quota-pool-overview">
        {summary.map((pool) => { const Icon = pool.icon; const active = activePool === pool.key; return <button key={pool.key} type="button" onClick={() => setActivePool(active ? "all" : pool.key)} className={`quota-pool-card ${pool.key} ${active ? "selected" : ""}`}><div className="quota-pool-card-head"><span className="quota-pool-icon"><Icon size={20} /></span><div><strong>{pool.label}</strong><small>{pool.description}</small></div></div><div className="quota-metrics"><PoolMetric label="tổng slot" value={pool.total} /><PoolMetric label="còn cấp được" value={pool.available} tone="success" /><PoolMetric label="đang dùng/giữ" value={pool.active} tone="warning" /></div><div className="quota-capacity"><span style={{ width: `${pool.total ? Math.round((pool.available / pool.total) * 100) : 0}%` }} /></div></button>; })}
      </div>

      {showCreate && isAdmin && <form className="quota-create-form" onSubmit={(event) => { void createSlot(event); setShowCreate(false); }}><div><h2>Thêm slot vào quota</h2><p>Chọn đúng nhóm để slot mới được đưa vào pool cấp phát tương ứng.</p></div><label>Mã slot<input required name="slotCode" placeholder="Ví dụ: M-A01 hoặc W-B01" /></label><label>Khu vực<select required name="zoneId" defaultValue=""><option value="" disabled>Chọn khu vực</option>{zoneList.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label><label>Nhóm quota<select name="accessPolicy" defaultValue="guest"><option value="resident">Thành viên</option><option value="guest">Vãng lai</option></select></label><label>Ghi chú<input name="notes" placeholder="Tùy chọn" /></label><button type="submit"><Plus size={16} /> Tạo slot</button></form>}

      <div className="quota-control-bar"><div className="quota-pool-tabs"><button type="button" onClick={() => setActivePool("all")} className={activePool === "all" ? "active" : ""}>Tất cả slot</button>{POOLS.map((pool) => <button type="button" key={pool.key} onClick={() => setActivePool(pool.key)} className={activePool === pool.key ? "active" : ""}>{pool.shortLabel}</button>)}</div><div className="quota-filters"><label className="quota-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã slot hoặc biển số" /></label><label><Filter size={15} /><select value={selectedZone} onChange={(event) => setSelectedZone(event.target.value)}><option value="">Tất cả khu</option>{zoneList.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label><select aria-label="Lọc trạng thái" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as SlotStatus | "")}><option value="">Mọi trạng thái</option><option value="empty">Sẵn sàng cấp</option><option value="occupied">Đang sử dụng</option><option value="reserved">Đã giữ chỗ</option><option value="maintenance">Bảo trì</option></select></div></div>

      <div className="quota-legend"><span><i className="member" /> Slot thành viên</span><span><i className="walk-in" /> Slot vãng lai</span><span><CheckCircle2 size={14} /> Sẵn sàng cấp</span><span><Car size={14} /> Có xe đỗ</span></div>
      <section className="quota-slot-unified">
        <header className="quota-slot-unified-head">
          <div><span className="quota-group-icon"><LayoutGrid size={18} /></span><div><h2>Tất cả slot</h2><p>Danh sách slot quản lý chung; loại quota hiển thị ngay trên từng thẻ.</p></div></div>
          <span>{filteredSlots.length} slot hiển thị</span>
        </header>
        <div className="quota-slot-grid">
          {filteredSlots.map((slot) => <SlotTile key={slot.id} slot={slot} zoneName={zoneList.find((zone) => zone.id === slot.zoneId)?.name ?? slot.zoneName ?? "Chưa gán khu"} isAdmin={Boolean(isAdmin)} onUpdateStatus={(id, status) => void updateSlotStatus(id, status)} onDelete={(id) => void deleteSlot(id)} onPolicy={(id, policy) => void updateSlotAccessPolicy(id, policy)} />)}
          {filteredSlots.length === 0 && <div className="quota-empty"><LayoutGrid size={30} /><span>Chưa có slot phù hợp với bộ lọc.</span></div>}
        </div>
      </section>
    </section>
  );
}

