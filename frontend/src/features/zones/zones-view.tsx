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
    <div className="flex flex-col rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 transition-all hover:border-[var(--primary)] hover:shadow-md">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px]" style={{ background: `linear-gradient(135deg, ${getOccupancyColor()}20, ${getOccupancyColor()}10)` }}>
          <MapPin size={20} style={{ color: getOccupancyColor() }} />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <button className="inline-flex cursor-pointer items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" onClick={() => onEdit(zone)} title="Sửa">
              <span className="inline-flex items-center"><Pencil size={14} /></span>
              <span className="text-xs">Sửa</span>
            </button>
            <button className="inline-flex cursor-pointer items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]" onClick={() => onDelete(zone.id)} title="Xóa">
              <span className="inline-flex items-center"><Trash2 size={14} /></span>
              <span className="text-xs">Xóa</span>
            </button>
          </div>
        )}
      </div>

      <div className="mb-2.5 [&>h3]:m-0 [&>h3]:text-base [&>h3]:font-bold [&>h3]:text-[var(--fg)]">
        <h3>{zone.name}</h3>
        {zone.description && <p className="mt-1 text-xs text-[var(--fg-muted)]">{zone.description}</p>}
      </div>

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {zone.allowedVehicleTypes.map((type) => (
          <span key={type} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: VEHICLE_COLORS[type] + "40", color: VEHICLE_COLORS[type] }}>
            {type === "Ô tô" && <Car size={14} />}
            {type === "Xe máy" && <Bike size={14} />}
            {type === "Xe điện" && <Zap size={14} />}
            {type}
          </span>
        ))}
      </div>

      {stats && (
        <>
          <div className="mb-3.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-hover)]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${occupancyPercent}%`,
                  background: getOccupancyColor(),
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-[var(--radius)] bg-[var(--bg)] p-2.5 text-center">
            <div className="flex flex-col gap-0.5">
              <span className="text-xl font-bold text-[var(--fg)]" style={{ color: "#10b981" }}>{stats.empty}</span>
              <span className="text-xs text-[var(--fg-muted)]">Trống</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xl font-bold text-[var(--fg)]" style={{ color: "#f59e0b" }}>{stats.occupied}</span>
              <span className="text-xs text-[var(--fg-muted)]">Đang đỗ</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xl font-bold text-[var(--fg)]">{stats.total}</span>
              <span className="text-xs text-[var(--fg-muted)]">Tổng</span>
            </div>
          </div>
        </>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-[var(--fg-muted)]">
        <span className="inline-flex items-center rounded-md bg-[var(--bg)] px-2 py-0.5 text-[11px] font-mono text-[var(--fg-muted)]">#{zone.displayOrder}</span>
        <span className="font-medium text-[var(--fg)]">{zone.capacity} chỗ</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-[560px] flex-col rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] p-[18px_24px]">
          <div className="flex items-center gap-3 [&>h2]:m-0 [&>h2]:text-lg [&>h2]:font-bold [&>h2]:text-[var(--fg)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-[var(--primary-soft)] text-[var(--primary)]">
              <Plus size={18} />
            </div>
            <div>
              <h3>Thêm khu vực mới</h3>
              <p>Tạo khu vực đỗ xe mới</p>
            </div>
          </div>
          <button className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius)] border-none bg-transparent text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="flex flex-col gap-4 overflow-y-auto p-6" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5 [&>label]:text-xs [&>label]:font-semibold [&>label]:text-[var(--fg)] [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)] [&>textarea]:rounded-[var(--radius)] [&>textarea]:border [&>textarea]:border-[var(--border)] [&>textarea]:bg-[var(--bg)] [&>textarea]:p-3 [&>textarea]:text-sm [&>textarea]:text-[var(--fg)] [&>textarea]:outline-none focus:[&>textarea]:border-[var(--primary)]">
            <label>Tên khu vực *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: A, B, VIP, Tầng B1..."
              required
            />
          </div>

          <div className="flex flex-col gap-1.5 [&>label]:text-xs [&>label]:font-semibold [&>label]:text-[var(--fg)] [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)] [&>textarea]:rounded-[var(--radius)] [&>textarea]:border [&>textarea]:border-[var(--border)] [&>textarea]:bg-[var(--bg)] [&>textarea]:p-3 [&>textarea]:text-sm [&>textarea]:text-[var(--fg)] [&>textarea]:outline-none focus:[&>textarea]:border-[var(--primary)]">
            <label>Mô tả</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Khu đỗ thông thường, khu VIP..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            <div className="flex flex-col gap-1.5 [&>label]:text-xs [&>label]:font-semibold [&>label]:text-[var(--fg)] [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)] [&>textarea]:rounded-[var(--radius)] [&>textarea]:border [&>textarea]:border-[var(--border)] [&>textarea]:bg-[var(--bg)] [&>textarea]:p-3 [&>textarea]:text-sm [&>textarea]:text-[var(--fg)] [&>textarea]:outline-none focus:[&>textarea]:border-[var(--primary)]">
              <label>Sức chứa *</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5 [&>label]:text-xs [&>label]:font-semibold [&>label]:text-[var(--fg)] [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)] [&>textarea]:rounded-[var(--radius)] [&>textarea]:border [&>textarea]:border-[var(--border)] [&>textarea]:bg-[var(--bg)] [&>textarea]:p-3 [&>textarea]:text-sm [&>textarea]:text-[var(--fg)] [&>textarea]:outline-none focus:[&>textarea]:border-[var(--primary)]">
              <label>Thứ tự hiển thị</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 [&>label]:text-xs [&>label]:font-semibold [&>label]:text-[var(--fg)] [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)] [&>textarea]:rounded-[var(--radius)] [&>textarea]:border [&>textarea]:border-[var(--border)] [&>textarea]:bg-[var(--bg)] [&>textarea]:p-3 [&>textarea]:text-sm [&>textarea]:text-[var(--fg)] [&>textarea]:outline-none focus:[&>textarea]:border-[var(--primary)]">
            <label>Loại xe được phép *</label>
            <div className="flex flex-wrap gap-2">
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

          <div className="mt-2 flex justify-end gap-3 border-t border-[var(--border)] pt-4">
            <button type="button" className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-[18px] py-2.5 text-sm font-semibold text-[var(--fg)] transition-all hover:bg-[var(--bg-hover)]" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border-none bg-[var(--primary)] px-[18px] py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(59,130,246,0.25)] transition-all hover:bg-[var(--primary-hover)]" disabled={isSubmitting || !name.trim() || selectedTypes.length === 0}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-[560px] flex-col rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] p-[18px_24px]">
          <div className="flex items-center gap-3 [&>h2]:m-0 [&>h2]:text-lg [&>h2]:font-bold [&>h2]:text-[var(--fg)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-[var(--primary-soft)] text-[var(--primary)]">
              <Pencil size={18} />
            </div>
            <div>
              <h3>Chỉnh sửa khu vực</h3>
              <p>Cập nhật thông tin khu vực</p>
            </div>
          </div>
          <button className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius)] border-none bg-transparent text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="flex flex-col gap-4 overflow-y-auto p-6" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5 [&>label]:text-xs [&>label]:font-semibold [&>label]:text-[var(--fg)] [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)] [&>textarea]:rounded-[var(--radius)] [&>textarea]:border [&>textarea]:border-[var(--border)] [&>textarea]:bg-[var(--bg)] [&>textarea]:p-3 [&>textarea]:text-sm [&>textarea]:text-[var(--fg)] [&>textarea]:outline-none focus:[&>textarea]:border-[var(--primary)]">
            <label>Tên khu vực *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: A, B, VIP, Tầng B1..."
              required
            />
          </div>

          <div className="flex flex-col gap-1.5 [&>label]:text-xs [&>label]:font-semibold [&>label]:text-[var(--fg)] [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)] [&>textarea]:rounded-[var(--radius)] [&>textarea]:border [&>textarea]:border-[var(--border)] [&>textarea]:bg-[var(--bg)] [&>textarea]:p-3 [&>textarea]:text-sm [&>textarea]:text-[var(--fg)] [&>textarea]:outline-none focus:[&>textarea]:border-[var(--primary)]">
            <label>Mô tả</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Khu đỗ thông thường, khu VIP..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            <div className="flex flex-col gap-1.5 [&>label]:text-xs [&>label]:font-semibold [&>label]:text-[var(--fg)] [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)] [&>textarea]:rounded-[var(--radius)] [&>textarea]:border [&>textarea]:border-[var(--border)] [&>textarea]:bg-[var(--bg)] [&>textarea]:p-3 [&>textarea]:text-sm [&>textarea]:text-[var(--fg)] [&>textarea]:outline-none focus:[&>textarea]:border-[var(--primary)]">
              <label>Sức chứa *</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5 [&>label]:text-xs [&>label]:font-semibold [&>label]:text-[var(--fg)] [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)] [&>textarea]:rounded-[var(--radius)] [&>textarea]:border [&>textarea]:border-[var(--border)] [&>textarea]:bg-[var(--bg)] [&>textarea]:p-3 [&>textarea]:text-sm [&>textarea]:text-[var(--fg)] [&>textarea]:outline-none focus:[&>textarea]:border-[var(--primary)]">
              <label>Thứ tự hiển thị</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 [&>label]:text-xs [&>label]:font-semibold [&>label]:text-[var(--fg)] [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)] [&>textarea]:rounded-[var(--radius)] [&>textarea]:border [&>textarea]:border-[var(--border)] [&>textarea]:bg-[var(--bg)] [&>textarea]:p-3 [&>textarea]:text-sm [&>textarea]:text-[var(--fg)] [&>textarea]:outline-none focus:[&>textarea]:border-[var(--primary)]">
            <label>Loại xe được phép *</label>
            <div className="flex flex-wrap gap-2">
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

          <div className="mt-2 flex justify-end gap-3 border-t border-[var(--border)] pt-4">
            <button type="button" className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-[18px] py-2.5 text-sm font-semibold text-[var(--fg)] transition-all hover:bg-[var(--bg-hover)]" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border-none bg-[var(--primary)] px-[18px] py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(59,130,246,0.25)] transition-all hover:bg-[var(--primary-hover)]" disabled={isSubmitting || !name.trim() || selectedTypes.length === 0}>
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
    <section className="mx-auto max-w-[1400px] p-[28px_32px] max-[768px]:p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 max-[768px]:flex-col max-[768px]:items-start">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius)] bg-[var(--primary-soft)] text-[var(--primary)]">
              <MapPin size={22} />
            </div>
            <div>
              <h1>Quản lý khu vực</h1>
              <p>{zoneList.length} khu vực đỗ xe</p>
            </div>
          </div>
          {isAdmin && (
            <button className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border-none bg-[var(--primary)] px-[18px] py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(59,130,246,0.25)] transition-all hover:bg-[var(--primary-hover)]" onClick={() => setShowAddModal(true)}>
              <Plus size={18} />
              Thêm khu vực
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 grid grid-cols-4 gap-4 max-[980px]:grid-cols-2 max-[640px]:grid-cols-1">
        <div className="flex items-center gap-3.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-[18px_20px] transition-all">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg-hover)] text-[var(--fg-muted)]" style={{ background: "#3b82f615" }}>
            <LayoutGrid size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xl font-bold text-[var(--fg)]">{zoneList.length}</span>
            <span className="text-xs text-[var(--fg-muted)]">Khu vực</span>
          </div>
        </div>
        <div className="flex items-center gap-3.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-[18px_20px] transition-all">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg-hover)] text-[var(--fg-muted)]" style={{ background: "#10b98115" }}>
            <MapPin size={18} style={{ color: "#10b981" }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xl font-bold text-[var(--fg)]">{totalSlots}</span>
            <span className="text-xs text-[var(--fg-muted)]">Tổng chỗ</span>
          </div>
        </div>
        <div className="flex items-center gap-3.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-[18px_20px] transition-all">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg-hover)] text-[var(--fg-muted)]" style={{ background: "#22c55e15" }}>
            <Car size={18} style={{ color: "var(--success)" }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xl font-bold text-[var(--fg)]" style={{ color: "var(--success)" }}>{totalEmpty}</span>
            <span className="text-xs text-[var(--fg-muted)]">Còn trống</span>
          </div>
        </div>
        <div className="flex items-center gap-3.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-[18px_20px] transition-all">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg-hover)] text-[var(--fg-muted)]" style={{ background: "#f59e0b15" }}>
            <Car size={18} style={{ color: "#f59e0b" }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xl font-bold text-[var(--fg)]" style={{ color: "#f59e0b" }}>{totalOccupied}</span>
            <span className="text-xs text-[var(--fg-muted)]">Đang đỗ</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between gap-4 max-[640px]:flex-col max-[640px]:items-stretch">
        <div className="relative max-w-[360px] flex-1 max-[640px]:max-w-none [&>svg]:absolute [&>svg]:top-1/2 [&>svg]:left-3 [&>svg]:-translate-y-1/2 [&>svg]:text-[var(--fg-muted)] [&>input]:w-full [&>input]:rounded-[var(--radius)] [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg-elevated)] [&>input]:py-2 [&>input]:pr-3 [&>input]:pl-9 [&>input]:text-sm [&>input]:text-[var(--fg)] [&>input]:outline-none focus:[&>input]:border-[var(--primary)]">
          <Search size={16} />
          <input
            type="text"
            placeholder="Tìm kiếm khu vực..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
          <button
            className={`zones-view-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Lưới"
          >
            <span className="inline-flex items-center"><LayoutGrid size={16} /></span>
            <span className="text-xs">Lưới</span>
          </button>
          <button
            className={`zones-view-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            title="Danh sách"
          >
            <span className="inline-flex items-center"><List size={16} /></span>
            <span className="text-xs">Danh sách</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {filteredZones.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-center text-[var(--fg-muted)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--fg-muted)]">
            <MapPin size={48} />
          </div>
          <h3>Chưa có khu vực nào</h3>
          <p>{searchQuery ? "Không tìm thấy khu vực phù hợp" : "Bắt đầu bằng cách thêm khu vực đỗ xe đầu tiên"}</p>
          {isAdmin && !searchQuery && (
            <button className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border-none bg-[var(--primary)] px-[18px] py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(59,130,246,0.25)] transition-all hover:bg-[var(--primary-hover)]" onClick={() => setShowAddModal(true)}>
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
