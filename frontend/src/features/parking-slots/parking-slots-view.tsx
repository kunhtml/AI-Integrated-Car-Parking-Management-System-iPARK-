"use client";

import { useState, useCallback } from "react";
import { ParkingSquare, Wrench, RotateCcw, Trash2, Plus, Car, CheckCircle, Clock, Search, Filter, Home, Users, Layers } from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import type { ParkingSlot, SlotAccessPolicy, SlotStatus } from "@/types";

const STATUS_CONFIG: Record<SlotStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  empty: {
    label: "Trống",
    bg: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
    text: "#059669",
    border: "#6ee7b7",
    icon: <CheckCircle size={16} />,
  },
  occupied: {
    label: "Có xe",
    bg: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    text: "#d97706",
    border: "#fcd34d",
    icon: <Car size={16} />,
  },
  reserved: {
    label: "Đặt trước",
    bg: "linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)",
    text: "#2563eb",
    border: "#93c5fd",
    icon: <Clock size={16} />,
  },
  maintenance: {
    label: "Bảo trì",
    bg: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
    text: "#6b7280",
    border: "#d1d5db",
    icon: <Wrench size={16} />,
  },
};

const ACCESS_POLICY_OPTIONS: {
  value: SlotAccessPolicy;
  label: string;
  shortLabel: string;
  color: string;
  activeBg: string;
  activeText: string;
  hint: string;
}[] = [
  {
    value: "resident",
    label: "Cư dân",
    shortLabel: "Cư dân",
    color: "#2563eb",
    activeBg: "#dbeafe",
    activeText: "#1d4ed8",
    hint: "Chỉ cư dân có gói active được đậu",
  },
  {
    value: "shared",
    label: "Chung",
    shortLabel: "Chung",
    color: "#7c3aed",
    activeBg: "#ede9fe",
    activeText: "#6d28d9",
    hint: "Ưu tiên cư dân, khi rảnh khách vẫn đậu được",
  },
  {
    value: "guest",
    label: "Vãng lai",
    shortLabel: "Khách",
    color: "#ea580c",
    activeBg: "#ffedd5",
    activeText: "#c2410c",
    hint: "Chỉ dành cho khách vãng lai",
  },
];

function SlotCard({ slot, onMaintenance, onFree, onDelete, onChangeAccessPolicy, isAdmin }: {
  slot: ParkingSlot;
  onMaintenance: (id: string) => void;
  onFree: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeAccessPolicy: (id: string, policy: SlotAccessPolicy) => void;
  isAdmin: boolean;
}) {
  const statusConfig = STATUS_CONFIG[slot.status];
  const policy = (slot.accessPolicy ?? "shared") as SlotAccessPolicy;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`parking-slot-card ${slot.status} ${hovered ? "hovered" : ""}`}
      style={{
        "--slot-bg": statusConfig.bg,
        "--slot-text": statusConfig.text,
        "--slot-border": statusConfig.border,
      } as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="slot-header">
        <div className="slot-code">{slot.slotCode}</div>
        <div className="slot-parking-icon">
          <ParkingSquare size={14} />
        </div>
      </div>

      <div className="slot-vehicle-area">
        {slot.status === "empty" && (
          <div className="slot-empty-visual">
            <div className="slot-outline">
              <Car size={32} strokeWidth={1.5} />
            </div>
            <span className="slot-empty-text">Chỗ trống</span>
          </div>
        )}
        {slot.status === "occupied" && (
          <div className="slot-occupied-visual">
            <div className="car-3d">
              <div className="car-body"></div>
              <div className="car-window"></div>
              <div className="car-wheel car-wheel-1"></div>
              <div className="car-wheel car-wheel-2"></div>
            </div>
            <div className="vehicle-info">
              <span className="vehicle-plate">{slot.currentPlate || "—"}</span>
            </div>
          </div>
        )}
        {slot.status === "reserved" && (
          <div className="slot-reserved-visual">
            <div className="reserved-icon">
              <Clock size={28} strokeWidth={1.5} />
            </div>
            <span className="reserved-text">Đặt trước</span>
          </div>
        )}
        {slot.status === "maintenance" && (
          <div className="slot-maintenance-visual">
            <div className="maintenance-gear">
              <Wrench size={28} />
            </div>
            <span className="maintenance-text">Đang bảo trì</span>
          </div>
        )}
      </div>

      <div className="slot-status-area">
        <div className="slot-status-badge" style={{ background: statusConfig.bg, color: statusConfig.text, borderColor: statusConfig.border }}>
          {statusConfig.icon}
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {/* Phân loại cư dân / vãng lai / chung — chỉ hiển thị khi admin.
          Có thể đổi trực tiếp từ các nút radio inline. */}
      {isAdmin && (
        <div className="slot-access-policy" role="radiogroup" aria-label="Phân loại chỗ đỗ">
          {ACCESS_POLICY_OPTIONS.map((opt) => {
            const active = policy === opt.value;
            return (
              <button
                aria-checked={active}
                className={`slot-policy-pill ${active ? "active" : ""}`}
                key={opt.value}
                onClick={(e) => {
                  e.stopPropagation();
                  if (active) return;
                  onChangeAccessPolicy(slot.id, opt.value);
                }}
                role="radio"
                style={
                  active
                    ? { background: opt.activeBg, color: opt.activeText, borderColor: opt.color }
                    : undefined
                }
                title={opt.hint}
                type="button"
              >
                <span>{opt.shortLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      {isAdmin && slot.status !== "occupied" && slot.status !== "reserved" && (
        <div className="slot-actions">
          {slot.status !== "maintenance" ? (
            <button
              className="slot-action-btn maintenance"
              onClick={() => onMaintenance(slot.id)}
              title="Đặt bảo trì"
              type="button"
            >
              <Wrench size={14} />
            </button>
          ) : (
            <button
              className="slot-action-btn free"
              onClick={() => onFree(slot.id)}
              title="Mở lại"
              type="button"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button
            className="slot-action-btn delete"
            onClick={() => onDelete(slot.id)}
            title="Xóa slot"
            type="button"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export function ParkingSlotsView() {
  const {
    currentUser,
    zoneList,
    slotList,
    createSlot,
    bulkCreateSlots,
    updateSlotStatus,
    deleteSlot,
    updateSlotAccessPolicy,
  } = useParkingApp();

  const [activeTab, setActiveTab] = useState<"map" | "list" | "create" | "bulk">("map");
  const [filterZone, setFilterZone] = useState("");
  const [filterStatus, setFilterStatus] = useState<SlotStatus | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  const triggerSimulation = useCallback(() => {
    setIsSimulating(true);
    setTimeout(() => setIsSimulating(false), 500);
  }, []);

  if (!currentUser) return null;
  const isAdmin = currentUser.role === "admin";

  const filteredSlots = slotList.filter((s) => {
    if (filterZone && s.zoneId !== filterZone) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    if (searchQuery && !s.slotCode.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: slotList.length,
    empty: slotList.filter((s) => s.status === "empty").length,
    occupied: slotList.filter((s) => s.status === "occupied").length,
    reserved: slotList.filter((s) => s.status === "reserved").length,
  };

  const slotsByZone = zoneList.map((zone) => ({
    zone,
    slots: slotList.filter((s) => s.zoneId === zone.id),
  }));

  return (
    <section className="parking-slots-page">
      <div className="parking-slots-header">
        <div className="header-left">
          <div className="header-icon">
            <ParkingSquare size={24} />
          </div>
          <div className="header-text">
            <h1>Quản lý bãi đỗ xe ô tô</h1>
            <p>Bãi đỗ xe thông minh</p>
          </div>
        </div>
        {isAdmin && (
          <div className="header-actions">
            <button
              className={`simulate-btn ${isSimulating ? "simulating" : ""}`}
              onClick={triggerSimulation}
              type="button"
            >
              <RotateCcw size={16} />
              <span>Giả lập</span>
            </button>
          </div>
        )}
      </div>

      <div className="parking-stats-grid">
        <div className="stat-card total">
          <div className="stat-icon"><ParkingSquare size={20} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Tổng chỗ</span>
          </div>
        </div>
        <div className="stat-card empty">
          <div className="stat-icon"><CheckCircle size={20} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.empty}</span>
            <span className="stat-label">Còn trống</span>
          </div>
          <div className="stat-bar">
            <div className="stat-bar-fill" style={{ width: `${(stats.empty / stats.total) * 100 || 0}%` }}></div>
          </div>
        </div>
        <div className="stat-card occupied">
          <div className="stat-icon"><Car size={20} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.occupied}</span>
            <span className="stat-label">Có xe đỗ</span>
          </div>
          <div className="stat-bar">
            <div className="stat-bar-fill occupied" style={{ width: `${(stats.occupied / stats.total) * 100 || 0}%` }}></div>
          </div>
        </div>
        <div className="stat-card reserved">
          <div className="stat-icon"><Clock size={20} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.reserved}</span>
            <span className="stat-label">Đặt trước</span>
          </div>
        </div>
      </div>

      <div className="parking-tabs">
        {(["map", "list", ...(isAdmin ? ["create", "bulk"] : [])] as const).map((tab) => (
          <button
            className={`parking-tab ${activeTab === tab ? "active" : ""}`}
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            type="button"
          >
            {tab === "map" && <ParkingSquare size={16} />}
            {tab === "list" && <Search size={16} />}
            {tab === "create" && <Plus size={16} />}
            {tab === "bulk" && <Plus size={16} />}
            <span>{tab === "map" ? "Sơ đồ" : tab === "list" ? "Danh sách" : tab === "create" ? "1 chỗ" : "Nhiều chỗ"}</span>
          </button>
        ))}
      </div>

      {activeTab === "map" && (
        <div className="slot-map-container">
          {slotsByZone.map(({ zone, slots }) => {
            const zoneStats = {
              total: slots.length,
              empty: slots.filter((s) => s.status === "empty").length,
              occupied: slots.filter((s) => s.status === "occupied").length,
            };
            const occupancyRate = zoneStats.total > 0 ? Math.round((zoneStats.occupied / zoneStats.total) * 100) : 0;
            
            return (
              <div className="zone-section" key={zone.id}>
                <div className="zone-header">
                  <div className="zone-title">
                    <div className="zone-icon">
                      <ParkingSquare size={18} />
                    </div>
                    <div>
                      <h3>Khu {zone.name}</h3>
                      <span className="zone-desc">{zone.description || "Khu vực đỗ xe"}</span>
                    </div>
                  </div>
                  <div className="zone-stats">
                    <div className="zone-stat">
                      <span className="zone-stat-value">{zoneStats.empty}</span>
                      <span className="zone-stat-label">trống</span>
                    </div>
                    <div className="zone-stat-divider">/</div>
                    <div className="zone-stat">
                      <span className="zone-stat-value">{zoneStats.total}</span>
                      <span className="zone-stat-label">tổng</span>
                    </div>
                    <div className="zone-occupancy">
                      <div className="occupancy-ring">
                        <svg viewBox="0 0 36 36">
                          <path
                            className="ring-bg"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="ring-fill"
                            strokeDasharray={`${occupancyRate}, 100`}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className="occupancy-text">{occupancyRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="slot-grid">
                  {slots.map((slot) => (
                    <SlotCard
                      isAdmin={isAdmin}
                      key={slot.id}
                      onChangeAccessPolicy={updateSlotAccessPolicy}
                      onDelete={deleteSlot}
                      onFree={(id) => updateSlotStatus(id, "empty")}
                      onMaintenance={(id) => updateSlotStatus(id, "maintenance")}
                      slot={slot}
                    />
                  ))}
                  {slots.length === 0 && (
                    <div className="empty-zone">
                      <ParkingSquare size={40} strokeWidth={1} />
                      <span>Chưa có chỗ đỗ</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {zoneList.length === 0 && (
            <div className="empty-state">
              <ParkingSquare size={60} strokeWidth={1} />
              <h3>Chưa có khu vực</h3>
              <p>Hãy tạo khu vực trước để quản lý chỗ đỗ xe.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "list" && (
        <div className="list-view-container">
          <div className="filter-bar">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Tìm mã chỗ đỗ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <Filter size={16} />
              <select onChange={(e) => setFilterZone(e.target.value)} value={filterZone}>
                <option value="">Tất cả khu</option>
                {zoneList.map((z) => (
                  <option key={z.id} value={z.id}>Khu {z.name}</option>
                ))}
              </select>
            </div>
            <select className="filter-select" onChange={(e) => setFilterStatus(e.target.value as SlotStatus | "")} value={filterStatus}>
              <option value="">Tất cả</option>
              <option value="empty">Trống</option>
              <option value="occupied">Có xe</option>
              <option value="reserved">Đặt trước</option>
              <option value="maintenance">Bảo trì</option>
            </select>
            <span className="filter-count">{filteredSlots.length} chỗ</span>
          </div>

          <div className="list-grid">
            {filteredSlots.map((slot) => {
              const statusConfig = STATUS_CONFIG[slot.status];
              const zone = zoneList.find((z) => z.id === slot.zoneId);
              
              return (
                <div key={slot.id} className="list-slot-card" style={{ "--status-color": statusConfig.border } as React.CSSProperties}>
                  <div className="list-slot-header">
                    <span className="list-slot-code">{slot.slotCode}</span>
                  </div>
                  <div className="list-slot-zone">
                    {zone ? `Khu ${zone.name}` : "Không xác định"}
                  </div>
                  <div className="list-slot-status" style={{ background: statusConfig.bg, color: statusConfig.text }}>
                    {statusConfig.icon}
                    <span>{statusConfig.label}</span>
                  </div>
                  {isAdmin && slot.status !== "occupied" && slot.status !== "reserved" && (
                    <div className="list-slot-actions">
                      {slot.status !== "maintenance" ? (
                        <button onClick={() => updateSlotStatus(slot.id, "maintenance")} title="Bảo trì" type="button">
                          <Wrench size={14} />
                        </button>
                      ) : (
                        <button onClick={() => updateSlotStatus(slot.id, "empty")} title="Mở lại" type="button">
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <button onClick={() => deleteSlot(slot.id)} title="Xóa" type="button">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredSlots.length === 0 && (
            <div className="empty-list">
              <Search size={40} strokeWidth={1} />
              <span>Không tìm thấy chỗ đỗ nào</span>
            </div>
          )}
        </div>
      )}

      {activeTab === "create" && isAdmin && (
        <div className="create-form-container">
          <h3><Plus size={20} /> Tạo chỗ đỗ mới</h3>
          <form className="parking-form" onSubmit={createSlot}>
            <div className="form-row">
              <label className="form-label">
                <span>Mã chỗ đỗ</span>
                <input name="slotCode" placeholder="VD: A-01, B-02..." required />
              </label>
              <label className="form-label">
                <span>Khu vực</span>
                <select name="zoneId" required>
                  <option value="">Chọn khu</option>
                  {zoneList.map((z) => (
                    <option key={z.id} value={z.id}>Khu {z.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="form-label full">
              <span>Ghi chú</span>
              <input name="notes" placeholder="Ghi chú..." />
            </label>
            <button className="submit-btn" type="submit">
              <ParkingSquare size={18} />
              Tạo chỗ đỗ
            </button>
          </form>
        </div>
      )}

      {activeTab === "bulk" && isAdmin && (
        <div className="create-form-container">
          <h3><Plus size={20} /> Tạo nhiều chỗ đỗ</h3>
          <form className="parking-form" onSubmit={bulkCreateSlots}>
            <div className="form-row">
              <label className="form-label">
                <span>Khu vực</span>
                <select name="zoneId" required>
                  <option value="">Chọn khu</option>
                  {zoneList.map((z) => (
                    <option key={z.id} value={z.id}>Khu {z.name}</option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                <span>Số lượng</span>
                <input defaultValue={5} max={100} min={1} name="count" required type="number" />
              </label>
            </div>
            <label className="form-label full">
              <span>Ghi chú</span>
              <input name="notes" placeholder="Ghi chú..." />
            </label>
            <button className="submit-btn" type="submit">
              <ParkingSquare size={18} />
              Tạo nhiều chỗ đỗ
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
