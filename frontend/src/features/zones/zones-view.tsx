"use client";

import { useState } from "react";
import {
  Car,
  Check,
  MapPin,
  Pencil,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import type { Zone } from "@/types";

function StatsBar({ zone }: { zone: Zone }) {
  if (!zone.stats) return null;
  const { empty, occupied, total } = zone.stats;
  return (
    <div className="slot-stats-bar">
      <span className="badge success">{empty} trống</span>
      <span className="badge warning">{occupied} đang đỗ</span>
      <span className="muted-cell">/ {total} tổng</span>
    </div>
  );
}

export function ZonesView() {
  const { currentUser, zoneList, createZone, updateZone, deleteZone } = useParkingApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCapacity, setEditCapacity] = useState(10);

  if (!currentUser) return null;

  function startEdit(zone: Zone) {
    setEditingId(zone.id);
    setEditName(zone.name);
    setEditDesc(zone.description ?? "");
    setEditCapacity(zone.capacity);
  }

  async function saveEdit(id: string) {
    await updateZone(id, { name: editName, description: editDesc, capacity: editCapacity });
    setEditingId(null);
  }

  return (
    <section className="content-grid">
      {currentUser.role === "admin" && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Quản lý</p>
              <h2>Thêm khu vực mới</h2>
            </div>
            <MapPin size={22} />
          </div>
          <form className="stack-form" onSubmit={createZone}>
            <label>
              Tên khu vực
              <input name="name" placeholder="A, B, VIP, Tầng B1..." required />
            </label>
            <label>
              Mô tả
              <input name="description" placeholder="Khu đỗ thông thường..." />
            </label>
            <label>
              Sức chứa (số chỗ tối đa)
              <input defaultValue={10} min={1} name="capacity" required type="number" />
            </label>
            <label>
              Thứ tự hiển thị
              <input defaultValue={0} name="displayOrder" type="number" />
            </label>
            <button className="full-button" type="submit">
              <MapPin size={18} />
              Tạo khu vực
            </button>
          </form>
        </div>
      )}

      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p>Khu vực</p>
            <h2>Danh sách khu vực đỗ xe</h2>
          </div>
          <span className="muted-cell">{zoneList.length} khu vực</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên</th>
                <th>Mô tả</th>
                <th>Sức chứa</th>
                <th>Loại xe</th>
                <th>Trạng thái slot</th>
                <th>Thứ tự</th>
                {currentUser.role === "admin" && <th></th>}
              </tr>
            </thead>
            <tbody>
              {zoneList.map((zone) => (
                <tr key={zone.id}>
                  <td>
                    {editingId === zone.id ? (
                      <input
                        className="inline-input"
                        onChange={(e) => setEditName(e.target.value)}
                        value={editName}
                      />
                    ) : (
                      <strong>{zone.name}</strong>
                    )}
                  </td>
                  <td>
                    {editingId === zone.id ? (
                      <input
                        className="inline-input"
                        onChange={(e) => setEditDesc(e.target.value)}
                        value={editDesc}
                      />
                    ) : (
                      zone.description || <span className="muted-cell">—</span>
                    )}
                  </td>
                  <td>
                    {editingId === zone.id ? (
                      <input
                        className="inline-input"
                        min={1}
                        onChange={(e) => setEditCapacity(Number(e.target.value))}
                        style={{ width: 60 }}
                        type="number"
                        value={editCapacity}
                      />
                    ) : (
                      zone.capacity
                    )}
                  </td>
                  <td>{zone.allowedVehicleTypes.join(", ")}</td>
                  <td>
                    <StatsBar zone={zone} />
                  </td>
                  <td>{zone.displayOrder}</td>
                  {currentUser.role === "admin" && (
                    <td>
                      <div className="inline-actions">
                        {editingId === zone.id ? (
                          <>
                            <button
                              className="small-button"
                              onClick={() => saveEdit(zone.id)}
                              title="Lưu"
                              type="button"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              className="small-button"
                              onClick={() => setEditingId(null)}
                              title="Hủy"
                              type="button"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="small-button"
                              onClick={() => startEdit(zone)}
                              title="Sửa"
                              type="button"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="small-button"
                              onClick={() => deleteZone(zone.id)}
                              title="Xóa"
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {zoneList.length === 0 && (
                <tr>
                  <td className="muted-cell" colSpan={7}>
                    Chưa có khu vực nào. Tạo mới hoặc chạy seed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
