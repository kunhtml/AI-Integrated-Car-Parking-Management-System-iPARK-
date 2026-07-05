"use client";

import { useState, useMemo, useRef } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { createZoneActions } from "@/hooks/actions/use-zone-actions";
import { useParkingApp } from "@/context/parking-app-context";
import type { Zone } from "@/types";

// ---------- shared types ----------
type FieldErrors = {
  name?: string;
  capacity?: string;
  displayOrder?: string;
};

type DeleteConfirm = {
  id: string;
  name: string;
};

type EditDraft = {
  name: string;
  description: string;
  capacity: number;
  displayOrder: number;
  fieldErrors: FieldErrors;
};

// ---------- StatsBar ----------
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

// ---------- validation helpers ----------
function validateName(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Tên khu vực là bắt buộc.";
  if (v.length > 50) return "Tên không được quá 50 ký tự.";
  if (/\s{2,}/.test(v)) return "Không chứa nhiều khoảng trắng liên tiếp.";
  return undefined;
}

function validateCapacity(value: number): string | undefined {
  if (!Number.isInteger(value)) return "Phải là số nguyên.";
  if (value < 1) return "Sức chứa phải lớn hơn 0.";
  return undefined;
}

function validateDisplayOrder(value: number): string | undefined {
  if (!Number.isInteger(value)) return "Phải là số nguyên.";
  if (value < 0) return "Không được là số âm.";
  return undefined;
}

// ---------- main component ----------
export function ZonesView() {
  const { currentUser, zoneList, setZoneList, setFormErrors } = useParkingApp();

  // actions use context setFormErrors for server errors, setActionLog for toast
  const { createZone, updateZone, deleteZone } = useMemo(
    () =>
      createZoneActions({
        setZoneList,
        setActionLog: () => {},
        onServerError: setFormErrors,
      }),
    [setZoneList, setFormErrors],
  );

  // ----- create form -----
  const [formErrors, setLocalErrors] = useState<FieldErrors>({});
  const [formPending, setFormPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // merge context errors (server) with local (blur) — context wins for server errors
  const allErrors: FieldErrors = formErrors;

  function handleCreateBlur(field: keyof FieldErrors, value: string | number) {
    const err =
      field === "name"
        ? validateName(String(value))
        : field === "capacity"
          ? validateCapacity(Number(value))
          : validateDisplayOrder(Number(value));
    setLocalErrors((prev) => ({ ...prev, [field]: err }));
  }

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const name = String(form.get("name") || "").trim();
    const capacity = Number(form.get("capacity") || 0);
    const displayOrder = Number(form.get("displayOrder") || 0);

    const errors: FieldErrors = {
      name: validateName(name),
      capacity: validateCapacity(capacity),
      displayOrder: validateDisplayOrder(displayOrder),
    };
    setLocalErrors(errors);
    if (errors.name || errors.capacity || errors.displayOrder) return;

    setFormPending(true);
    try {
      await createZone(e as unknown as React.FormEvent<HTMLFormElement>);
    } finally {
      setFormPending(false);
      setLocalErrors({});
      setFormErrors({});
      e.currentTarget.reset();
      const capInput =
        e.currentTarget.querySelector<HTMLInputElement>('[name="capacity"]');
      if (capInput) capInput.value = "10";
      const orderInput = e.currentTarget.querySelector<HTMLInputElement>(
        '[name="displayOrder"]',
      );
      if (orderInput) orderInput.value = "0";
    }
  }

  // ----- inline edit -----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  function startEdit(zone: Zone) {
    setEditingId(zone.id);
    setDrafts((prev) => ({
      ...prev,
      [zone.id]: {
        name: zone.name,
        description: zone.description ?? "",
        capacity: zone.capacity,
        displayOrder: zone.displayOrder,
        fieldErrors: {},
      },
    }));
  }

  function cancelEdit() {
    if (!editingId) return;
    setEditingId(null);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[editingId];
      return next;
    });
  }

  function handleDraftChange<K extends keyof EditDraft>(
    id: string,
    field: K,
    value: EditDraft[K],
  ) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
        // clear inline error when user types
        fieldErrors: { ...prev[id]?.fieldErrors, [field]: undefined },
      },
    }));
  }

  function handleDraftBlur(
    id: string,
    field: keyof FieldErrors,
    value: string | number,
  ) {
    const draft = drafts[id];
    if (!draft) return;
    const err =
      field === "name"
        ? validateName(String(value))
        : field === "capacity"
          ? validateCapacity(Number(value))
          : validateDisplayOrder(Number(value));
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...draft,
        fieldErrors: { ...prev[id]?.fieldErrors, [field]: err },
      },
    }));
  }

  async function saveEdit(id: string) {
    const draft = drafts[id];
    if (!draft) return;

    const errors = validateDraft(draft);
    if (errors.name || errors.capacity || errors.displayOrder) {
      setDrafts((prev) => ({
        ...prev,
        [id]: { ...draft, fieldErrors: errors },
      }));
      return;
    }

    setSavingId(id);
    try {
      await updateZone(id, {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        capacity: draft.capacity,
        displayOrder: draft.displayOrder,
      });
      setEditingId(null);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  }

  function validateDraft(draft: EditDraft): FieldErrors {
    return {
      name: validateName(draft.name),
      capacity: validateCapacity(draft.capacity),
      displayOrder: validateDisplayOrder(draft.displayOrder),
    };
  }

  // ----- delete -----
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setDeletingId(deleteConfirm.id);
    try {
      await deleteZone(deleteConfirm.id);
    } finally {
      setDeletingId(null);
      setDeleteConfirm(null);
    }
  }

  // ----- render -----
  if (!currentUser) return null;

  return (
    <section className="content-grid">
      {/* CREATE FORM */}
      {currentUser.role === "admin" && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Quản lý</p>
              <h2>Thêm khu vực mới</h2>
            </div>
            <MapPin size={22} />
          </div>

          <form
            className="stack-form"
            noValidate
            onSubmit={handleCreateSubmit}
            ref={formRef}
          >
            {/* Name */}
            <label>
              Tên khu vực
              <input
                maxLength={50}
                name="name"
                onBlur={(e) => handleCreateBlur("name", e.target.value)}
                placeholder="A, B, VIP, Tầng B1..."
                required
                type="text"
              />
              {allErrors.name && (
                <span className="field-error">
                  <AlertCircle size={13} />
                  {allErrors.name}
                </span>
              )}
            </label>

            {/* Description */}
            <label>
              Mô tả
              <input
                maxLength={255}
                name="description"
                placeholder="Khu đỗ thông thường, có mái che..."
                type="text"
              />
            </label>

            {/* Capacity */}
            <label>
              Sức chứa (số chỗ tối đa)
              <input
                min={1}
                name="capacity"
                onBlur={(e) =>
                  handleCreateBlur("capacity", Number(e.target.value))
                }
                required
                step={1}
                type="number"
              />
              {allErrors.capacity && (
                <span className="field-error">
                  <AlertCircle size={13} />
                  {allErrors.capacity}
                </span>
              )}
            </label>

            {/* Display Order */}
            <label>
              Thứ tự hiển thị
              <input
                min={0}
                name="displayOrder"
                onBlur={(e) =>
                  handleCreateBlur("displayOrder", Number(e.target.value))
                }
                step={1}
                type="number"
              />
              {allErrors.displayOrder && (
                <span className="field-error">
                  <AlertCircle size={13} />
                  {allErrors.displayOrder}
                </span>
              )}
            </label>

            <button
              className="full-button"
              disabled={formPending}
              type="submit"
            >
              {formPending ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <MapPin size={18} />
              )}
              {formPending ? "Đang tạo…" : "Tạo khu vực"}
            </button>
          </form>
        </div>
      )}

      {/* ZONE LIST */}
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
              {zoneList.map((zone) => {
                const draft = drafts[zone.id];
                const isEditing = editingId === zone.id;
                const isSaving = savingId === zone.id;
                const isDeleting = deletingId === zone.id;
                const isConfirming = deleteConfirm?.id === zone.id;

                return (
                  <tr key={zone.id} className={isEditing ? "row-editing" : ""}>
                    {/* Name */}
                    <td>
                      {isEditing ? (
                        <>
                          <input
                            className="inline-input"
                            maxLength={50}
                            onBlur={(e) =>
                              handleDraftBlur(zone.id, "name", e.target.value)
                            }
                            onChange={(e) =>
                              handleDraftChange(zone.id, "name", e.target.value)
                            }
                            value={draft?.name ?? zone.name}
                          />
                          {draft?.fieldErrors.name && (
                            <div className="inline-error">
                              <AlertCircle size={12} />
                              {draft.fieldErrors.name}
                            </div>
                          )}
                        </>
                      ) : (
                        <strong>{zone.name}</strong>
                      )}
                    </td>

                    {/* Description */}
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-input"
                          onChange={(e) =>
                            handleDraftChange(
                              zone.id,
                              "description",
                              e.target.value,
                            )
                          }
                          value={draft?.description ?? zone.description ?? ""}
                        />
                      ) : (
                        zone.description || (
                          <span className="muted-cell">—</span>
                        )
                      )}
                    </td>

                    {/* Capacity */}
                    <td>
                      {isEditing ? (
                        <>
                          <input
                            className="inline-input"
                            min={1}
                            onBlur={(e) =>
                              handleDraftBlur(
                                zone.id,
                                "capacity",
                                Number(e.target.value),
                              )
                            }
                            onChange={(e) =>
                              handleDraftChange(
                                zone.id,
                                "capacity",
                                Number(e.target.value),
                              )
                            }
                            step={1}
                            style={{ width: 64 }}
                            type="number"
                            value={draft?.capacity ?? zone.capacity}
                          />
                          {draft?.fieldErrors.capacity && (
                            <div className="inline-error">
                              <AlertCircle size={12} />
                              {draft.fieldErrors.capacity}
                            </div>
                          )}
                        </>
                      ) : (
                        zone.capacity
                      )}
                    </td>

                    {/* Vehicle Types */}
                    <td>{zone.allowedVehicleTypes.join(", ")}</td>

                    {/* Stats */}
                    <td>
                      <StatsBar zone={zone} />
                    </td>

                    {/* Display Order */}
                    <td>
                      {isEditing ? (
                        <>
                          <input
                            className="inline-input"
                            min={0}
                            onBlur={(e) =>
                              handleDraftBlur(
                                zone.id,
                                "displayOrder",
                                Number(e.target.value),
                              )
                            }
                            onChange={(e) =>
                              handleDraftChange(
                                zone.id,
                                "displayOrder",
                                Number(e.target.value),
                              )
                            }
                            step={1}
                            style={{ width: 64 }}
                            type="number"
                            value={draft?.displayOrder ?? zone.displayOrder}
                          />
                          {draft?.fieldErrors.displayOrder && (
                            <div className="inline-error">
                              <AlertCircle size={12} />
                              {draft.fieldErrors.displayOrder}
                            </div>
                          )}
                        </>
                      ) : (
                        zone.displayOrder
                      )}
                    </td>

                    {/* Actions */}
                    {currentUser.role === "admin" && (
                      <td>
                        {isEditing ? (
                          <div className="inline-actions">
                            <button
                              className="small-button success"
                              disabled={isSaving}
                              onClick={() => saveEdit(zone.id)}
                              title="Lưu"
                              type="button"
                            >
                              {isSaving ? (
                                <Loader2 className="spin" size={14} />
                              ) : (
                                <Check size={14} />
                              )}
                            </button>
                            <button
                              className="small-button danger"
                              disabled={isSaving}
                              onClick={cancelEdit}
                              title="Hủy"
                              type="button"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : isConfirming ? (
                          <div className="inline-actions">
                            <button
                              className="small-button success"
                              disabled={isDeleting}
                              onClick={confirmDelete}
                              title="Xác nhận xóa"
                              type="button"
                            >
                              {isDeleting ? (
                                <Loader2 className="spin" size={14} />
                              ) : (
                                <Check size={14} />
                              )}
                            </button>
                            <button
                              className="small-button danger"
                              disabled={isDeleting}
                              onClick={() => setDeleteConfirm(null)}
                              title="Hủy"
                              type="button"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-actions">
                            <button
                              className="small-button"
                              onClick={() => startEdit(zone)}
                              title="Sửa"
                              type="button"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="small-button danger"
                              onClick={() =>
                                setDeleteConfirm({
                                  id: zone.id,
                                  name: zone.name,
                                })
                              }
                              title="Xóa"
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}

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

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => !deletingId && setDeleteConfirm(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <AlertCircle className="text-danger" size={24} />
              <h3>Xác nhận xóa khu vực</h3>
            </div>
            <p className="modal-body">
              Bạn có chắc chắn muốn vô hiệu hóa khu vực{" "}
              <strong>&quot;{deleteConfirm.name}&quot;</strong> không?
              <br />
              Hành động này không thể hoàn tác.
            </p>
            <div className="modal-footer">
              <button
                className="secondary-button"
<<<<<<< HEAD
                disabled={Boolean(deletingId)}
=======
                disabled={!!deletingId}
>>>>>>> 49bfd09c69d8e4d4c7df76f95d064c30a0512d62
                onClick={() => setDeleteConfirm(null)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="danger-button"
<<<<<<< HEAD
                disabled={Boolean(deletingId)}
=======
                disabled={!!deletingId}
>>>>>>> 49bfd09c69d8e4d4c7df76f95d064c30a0512d62
                onClick={confirmDelete}
                type="button"
              >
                {deletingId ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Trash2 size={16} />
                )}
                {deletingId ? "Đang xóa…" : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
