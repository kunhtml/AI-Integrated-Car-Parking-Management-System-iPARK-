"use client";

import { useState } from "react";
import { MapPin, Pencil, Trash2, Plus, X, Search, Car, Bike, Zap, LayoutGrid, List } from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import type { Zone } from "@/types";

const VEHICLE_COLORS: Record<string, string> = {
  "Ô tô": "#3b82f6",
  "Xe máy": "#f59e0b",
  "Xe điện": "#10b981",
};

function ZoneCard({
  zone,
  isAdmin,
  onEdit,
  onDelete,
}: {
  zone: Zone;
  isAdmin: boolean;
  onEdit: (zone: Zone) => void;
  onDelete: (id: string) => void;
}) {
  const stats = zone.stats;
  const occupancyPercent = stats ? Math.round(((stats.occupied + stats.reserved) / stats.total) * 100) : 0;

  const getOccupancyColor = () => {
    if (occupancyPercent >= 90) return "#ef4444";
    if (occupancyPercent >= 70) return "#f59e0b";
    return "#10b981";
  };

  return (
    <div className="zones-card">
      <div className="zones-card-header">
        <div className="zones-card-icon" style={{ background: `linear-gradient(135deg, ${getOccupancyColor()}20, ${getOccupancyColor()}10)` }}>
          <MapPin size={20} style={{ color: getOccupancyColor() }} />
        </div>
        {isAdmin && (
          <div className="zones-card-actions">
            <button className="zones-action-btn zones-action-btn--edit" onClick={() => onEdit(zone)} title="Sửa">
              <span className="zones-action-icon"><Pencil size={14} /></span>
              <span className="zones-action-text">Sửa</span>
            </button>
            <button className="zones-action-btn zones-action-btn--delete" onClick={() => onDelete(zone.id)} title="Xóa">
              <span className="zones-action-icon"><Trash2 size={14} /></span>
              <span className="zones-action-text">Xóa</span>
            </button>
          </div>
        )}
      </div>

      <div className="zones-card-title">
        <h3>{zone.name}</h3>
        {zone.description && <p className="zones-card-desc">{zone.description}</p>}
      </div>

      <div className="zones-card-types">
        {zone.allowedVehicleTypes.map((type) => (
          <span key={type} className="zones-type-badge" style={{ borderColor: VEHICLE_COLORS[type] + "40", color: VEHICLE_COLORS[type] }}>
            {type === "Ô tô" && <Car size={14} />}
            {type === "Xe máy" && <Bike size={14} />}
            {type === "Xe điện" && <Zap size={14} />}
            {type}
          </span>
        ))}
      </div>

      {stats && (
        <>
          <div className="zones-card-progress">
            <div className="zones-progress-bar">
              <div
                className="zones-progress-fill"
                style={{
                  width: `${occupancyPercent}%`,
                  background: getOccupancyColor(),
                }}
              />
            </div>
          </div>

          <div className="zones-card-stats">
            <div className="zones-stat">
              <span className="zones-stat-value" style={{ color: "#10b981" }}>{stats.empty}</span>
              <span className="zones-stat-label">Trống</span>
            </div>
            <div className="zones-stat">
              <span className="zones-stat-value" style={{ color: "#f59e0b" }}>{stats.occupied}</span>
              <span className="zones-stat-label">Đang đỗ</span>
            </div>
            <div className="zones-stat">
              <span className="zones-stat-value">{stats.total}</span>
              <span className="zones-stat-label">Tổng</span>
            </div>
          </div>
        </>
      )}

      <div className="zones-card-footer">
        <span className="zones-order-badge">#{zone.displayOrder}</span>
        <span className="zones-capacity-badge">{zone.capacity} chỗ</span>
      </div>
    </div>
  );
}

function AddZoneModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; capacity: number; displayOrder: number; allowedVehicleTypes: string[] }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState(10);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["Ô tô"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vehicleTypes = ["Ô tô", "Xe máy", "Xe điện"];

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (selectedTypes.length === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), capacity, displayOrder, allowedVehicleTypes: selectedTypes });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="zones-modal-overlay" onClick={onClose}>
      <div className="zones-modal" onClick={(e) => e.stopPropagation()}>
        <div className="zones-modal-header">
          <div className="zones-modal-title">
            <div className="zones-modal-icon">
              <Plus size={18} />
            </div>
            <div>
              <h3>Thêm khu vực mới</h3>
              <p>Tạo khu vực đỗ xe mới</p>
            </div>
          </div>
          <button className="zones-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="zones-modal-form" onSubmit={handleSubmit}>
          <div className="zones-form-group">
            <label>Tên khu vực *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: A, B, VIP, Tầng B1..."
              required
            />
          </div>

          <div className="zones-form-group">
            <label>Mô tả</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Khu đỗ thông thường, khu VIP..."
            />
          </div>

          <div className="zones-form-row">
            <div className="zones-form-group">
              <label>Sức chứa *</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                required
              />
            </div>
            <div className="zones-form-group">
              <label>Thứ tự hiển thị</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="zones-form-group">
            <label>Loại xe được phép *</label>
            <div className="zones-type-selector">
              {vehicleTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`zones-type-btn ${selectedTypes.includes(type) ? "active" : ""}`}
                  style={selectedTypes.includes(type) ? { borderColor: VEHICLE_COLORS[type], background: VEHICLE_COLORS[type] + "15", color: VEHICLE_COLORS[type] } : {}}
                  onClick={() => toggleType(type)}
                >
                  {type === "Ô tô" && <Car size={14} />}
                  {type === "Xe máy" && <Bike size={14} />}
                  {type === "Xe điện" && <Zap size={14} />}
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="zones-modal-actions">
            <button type="button" className="zones-btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="zones-btn-primary" disabled={isSubmitting || !name.trim() || selectedTypes.length === 0}>
              {isSubmitting ? "Đang tạo..." : "Tạo khu vực"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditZoneModal({
  zone,
  onClose,
  onSubmit,
}: {
  zone: Zone;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; capacity: number; displayOrder: number; allowedVehicleTypes: string[] }) => void;
}) {
  const [name, setName] = useState(zone.name);
  const [description, setDescription] = useState(zone.description || "");
  const [capacity, setCapacity] = useState(zone.capacity);
  const [displayOrder, setDisplayOrder] = useState(zone.displayOrder);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(zone.allowedVehicleTypes);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vehicleTypes = ["Ô tô", "Xe máy", "Xe điện"];

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (selectedTypes.length === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), capacity, displayOrder, allowedVehicleTypes: selectedTypes });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="zones-modal-overlay" onClick={onClose}>
      <div className="zones-modal" onClick={(e) => e.stopPropagation()}>
        <div className="zones-modal-header">
          <div className="zones-modal-title">
            <div className="zones-modal-icon">
              <Pencil size={18} />
            </div>
            <div>
              <h3>Chỉnh sửa khu vực</h3>
              <p>Cập nhật thông tin khu vực</p>
            </div>
          </div>
          <button className="zones-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="zones-modal-form" onSubmit={handleSubmit}>
          <div className="zones-form-group">
            <label>Tên khu vực *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: A, B, VIP, Tầng B1..."
              required
            />
          </div>

          <div className="zones-form-group">
            <label>Mô tả</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Khu đỗ thông thường, khu VIP..."
            />
          </div>

          <div className="zones-form-row">
            <div className="zones-form-group">
              <label>Sức chứa *</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                required
              />
            </div>
            <div className="zones-form-group">
              <label>Thứ tự hiển thị</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="zones-form-group">
            <label>Loại xe được phép *</label>
            <div className="zones-type-selector">
              {vehicleTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`zones-type-btn ${selectedTypes.includes(type) ? "active" : ""}`}
                  style={selectedTypes.includes(type) ? { borderColor: VEHICLE_COLORS[type], background: VEHICLE_COLORS[type] + "15", color: VEHICLE_COLORS[type] } : {}}
                  onClick={() => toggleType(type)}
                >
                  {type === "Ô tô" && <Car size={14} />}
                  {type === "Xe máy" && <Bike size={14} />}
                  {type === "Xe điện" && <Zap size={14} />}
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="zones-modal-actions">
            <button type="button" className="zones-btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="zones-btn-primary" disabled={isSubmitting || !name.trim() || selectedTypes.length === 0}>
              {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ZonesView() {
  const { currentUser, zoneList, createZone, updateZone, deleteZone } = useParkingApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const isAdmin = currentUser?.role === "admin";

  if (!currentUser) return null;

  const filteredZones = zoneList.filter((zone) =>
    zone.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    zone.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSlots = zoneList.reduce((sum, z) => sum + (z.stats?.total || 0), 0);
  const totalEmpty = zoneList.reduce((sum, z) => sum + (z.stats?.empty || 0), 0);
  const totalOccupied = zoneList.reduce((sum, z) => sum + (z.stats?.occupied || 0), 0);

  async function handleCreateZone(data: { name: string; description: string; capacity: number; displayOrder: number; allowedVehicleTypes: string[] }) {
    await createZone({ ...data } as any);
  }

  async function handleUpdateZone(data: { name: string; description: string; capacity: number; displayOrder: number; allowedVehicleTypes: string[] }) {
    if (!editingZone) return;
    await updateZone(editingZone.id, data);
    setEditingZone(null);
  }

  function handleDeleteZone(id: string) {
    if (confirm("Bạn có chắc muốn xóa khu vực này?")) {
      deleteZone(id);
    }
  }

  return (
    <section className="zones-page">
      {/* Header */}
      <div className="zones-header">
        <div className="zones-header-content">
          <div className="zones-header-info">
            <div className="zones-header-icon">
              <MapPin size={22} />
            </div>
            <div>
              <h1>Quản lý khu vực</h1>
              <p>{zoneList.length} khu vực đỗ xe</p>
            </div>
          </div>
          {isAdmin && (
            <button className="zones-btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={18} />
              Thêm khu vực
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="zones-stats-bar">
        <div className="zones-stat-card">
          <div className="zones-stat-icon" style={{ background: "#3b82f615" }}>
            <LayoutGrid size={18} style={{ color: "#3b82f6" }} />
          </div>
          <div className="zones-stat-info">
            <span className="zones-stat-value">{zoneList.length}</span>
            <span className="zones-stat-label">Khu vực</span>
          </div>
        </div>
        <div className="zones-stat-card">
          <div className="zones-stat-icon" style={{ background: "#10b98115" }}>
            <MapPin size={18} style={{ color: "#10b981" }} />
          </div>
          <div className="zones-stat-info">
            <span className="zones-stat-value">{totalSlots}</span>
            <span className="zones-stat-label">Tổng chỗ</span>
          </div>
        </div>
        <div className="zones-stat-card">
          <div className="zones-stat-icon" style={{ background: "#22c55e15" }}>
            <Car size={18} style={{ color: "#22c55e" }} />
          </div>
          <div className="zones-stat-info">
            <span className="zones-stat-value" style={{ color: "#22c55e" }}>{totalEmpty}</span>
            <span className="zones-stat-label">Còn trống</span>
          </div>
        </div>
        <div className="zones-stat-card">
          <div className="zones-stat-icon" style={{ background: "#f59e0b15" }}>
            <Car size={18} style={{ color: "#f59e0b" }} />
          </div>
          <div className="zones-stat-info">
            <span className="zones-stat-value" style={{ color: "#f59e0b" }}>{totalOccupied}</span>
            <span className="zones-stat-label">Đang đỗ</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="zones-toolbar">
        <div className="zones-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Tìm kiếm khu vực..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="zones-view-toggle">
          <button
            className={`zones-view-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Lưới"
          >
            <span className="zones-view-icon"><LayoutGrid size={16} /></span>
            <span className="zones-view-text">Lưới</span>
          </button>
          <button
            className={`zones-view-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            title="Danh sách"
          >
            <span className="zones-view-icon"><List size={16} /></span>
            <span className="zones-view-text">Danh sách</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {filteredZones.length === 0 ? (
        <div className="zones-empty">
          <div className="zones-empty-icon">
            <MapPin size={48} />
          </div>
          <h3>Chưa có khu vực nào</h3>
          <p>{searchQuery ? "Không tìm thấy khu vực phù hợp" : "Bắt đầu bằng cách thêm khu vực đỗ xe đầu tiên"}</p>
          {isAdmin && !searchQuery && (
            <button className="zones-btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={18} />
              Thêm khu vực đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className={`zones-grid ${viewMode === "list" ? "zones-grid--list" : ""}`}>
          {filteredZones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              isAdmin={isAdmin}
              onEdit={setEditingZone}
              onDelete={handleDeleteZone}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddZoneModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateZone}
        />
      )}

      {editingZone && (
        <EditZoneModal
          zone={editingZone}
          onClose={() => setEditingZone(null)}
          onSubmit={handleUpdateZone}
        />
      )}
    </section>
  );
}
