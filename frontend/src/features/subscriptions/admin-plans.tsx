"use client";

import { useState, type FormEvent } from "react";
import { CreditCard, Edit, Eye, EyeOff, Plus, Save, Trash2, X, Check, DollarSign, Calendar, Car, Package } from "lucide-react";
import type { SubscriptionPlan } from "@/types";
import { currency } from "@/lib/constants";
import { DURATION_LABELS } from "./styles";

type Props = {
  plans: SubscriptionPlan[];
  onCreate: (data: {
    name: string;
    description: string;
    duration: "monthly" | "quarterly" | "yearly";
    durationDays: number;
    price: number;
    maxVehicles: number;
  }) => Promise<void>;
  onUpdate: (id: string, data: Partial<SubscriptionPlan>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="plan-modal-overlay" onClick={onClose}>
      <div className="plan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="plan-modal-header">
          <h3>{title}</h3>
          <button className="plan-modal-close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        <div className="plan-modal-content">{children}</div>
      </div>
    </div>
  );
}

export function AdminPlans({ plans, onCreate, onUpdate, onDelete }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<SubscriptionPlan>>({});
  const [createDraft, setCreateDraft] = useState({
    name: "",
    description: "",
    duration: "monthly" as "monthly" | "quarterly" | "yearly",
    durationDays: 30,
    price: 0,
    maxVehicles: -1,
  });

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate(createDraft);
    setCreateDraft({ name: "", description: "", duration: "monthly", durationDays: 30, price: 0, maxVehicles: -1 });
    setCreateOpen(false);
  }

  async function saveEdit(id: string) {
    await onUpdate(id, editDraft);
    setEditingId(null);
    setEditDraft({});
  }

  return (
    <section className="admin-plans-page">
      {/* Header */}
      <div className="admin-plans-header">
        <div className="header-left">
          <div className="header-icon">
            <Package size={24} />
          </div>
          <div className="header-text">
            <h1>Quản lý gói đăng ký</h1>
            <p>Tạo và chỉnh sửa các gói dịch vụ</p>
          </div>
        </div>
        <button className="create-plan-btn" onClick={() => setCreateOpen(true)} type="button">
          <Plus size={18} />
          <span>Tạo gói mới</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="plans-grid">
        {plans.map((plan) => (
          <div key={plan.id} className={`plan-card ${!plan.isActive ? "inactive" : ""}`}>
            <div className="plan-card-header">
              <div className="plan-icon">
                <CreditCard size={24} />
              </div>
              <div className="plan-info">
                <h3>{plan.name}</h3>
                {!plan.isActive && <span className="plan-inactive-badge">Đã ẩn</span>}
              </div>
              <div className="plan-actions-top">
                <button
                  className="plan-toggle-btn"
                  onClick={() => onUpdate(plan.id, { isActive: !plan.isActive })}
                  type="button"
                  title={plan.isActive ? "Ẩn gói" : "Hiện gói"}
                >
                  {plan.isActive ? (
                    <>
                      <EyeOff size={14} />
                      <span>Ẩn</span>
                    </>
                  ) : (
                    <>
                      <Eye size={14} />
                      <span>Hiện</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {plan.description && (
              <p className="plan-description">{plan.description}</p>
            )}

            <div className="plan-features">
              <div className="plan-feature">
                <DollarSign size={14} />
                <span>{currency.format(plan.price)}</span>
              </div>
              <div className="plan-feature">
                <Calendar size={14} />
                <span>{plan.durationDays} ngày ({DURATION_LABELS[plan.duration]})</span>
              </div>
              <div className="plan-feature">
                <Car size={14} />
                <span>{plan.maxVehicles < 0 ? "Không giới hạn xe" : `Tối đa ${plan.maxVehicles} xe`}</span>
              </div>
            </div>

            {editingId === plan.id ? (
              <div className="plan-edit-form">
                <div className="plan-edit-row">
                  <label className="plan-edit-label">
                    <span>Tên gói</span>
                    <input
                      type="text"
                      defaultValue={plan.name}
                      onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                  </label>
                  <label className="plan-edit-label">
                    <span>Giá (VND)</span>
                    <input
                      type="number"
                      min={0}
                      defaultValue={plan.price}
                      onChange={(e) => setEditDraft((d) => ({ ...d, price: Number(e.target.value) }))}
                    />
                  </label>
                </div>
                <div className="plan-edit-row">
                  <label className="plan-edit-label">
                    <span>Số ngày</span>
                    <input
                      type="number"
                      min={1}
                      defaultValue={plan.durationDays}
                      onChange={(e) => setEditDraft((d) => ({ ...d, durationDays: Number(e.target.value) }))}
                    />
                  </label>
                  <label className="plan-edit-label">
                    <span>Số xe tối đa</span>
                    <input
                      type="number"
                      min={-1}
                      defaultValue={plan.maxVehicles}
                      onChange={(e) => setEditDraft((d) => ({ ...d, maxVehicles: Number(e.target.value) }))}
                    />
                  </label>
                </div>
                <div className="plan-edit-actions">
                  <button className="plan-save-btn" onClick={() => saveEdit(plan.id)} type="button">
                    <Save size={16} />
                    Lưu
                  </button>
                  <button className="plan-cancel-btn" onClick={() => setEditingId(null)} type="button">
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <div className="plan-card-actions">
                <button
                  className="plan-edit-btn"
                  onClick={() => { setEditingId(plan.id); setEditDraft({}); }}
                  type="button"
                >
                  <Edit size={16} />
                  Sửa
                </button>
                <button
                  className="plan-delete-btn"
                  onClick={() => onDelete(plan.id)}
                  type="button"
                >
                  <Trash2 size={16} />
                  Xóa
                </button>
              </div>
            )}
          </div>
        ))}

        {plans.length === 0 && (
          <div className="plans-empty">
            <Package size={48} strokeWidth={1} />
            <p>Chưa có gói nào</p>
            <span>Tạo gói mới để bắt đầu</span>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Tạo gói mới">
        <form className="plan-form" onSubmit={handleCreate}>
          <label className="plan-form-label">
            <span>Tên gói <span className="required">*</span></span>
            <input
              type="text"
              value={createDraft.name}
              onChange={(e) => setCreateDraft({ ...createDraft, name: e.target.value })}
              placeholder="VD: Gói Tháng"
              required
            />
          </label>

          <label className="plan-form-label">
            <span>Mô tả</span>
            <input
              type="text"
              value={createDraft.description}
              onChange={(e) => setCreateDraft({ ...createDraft, description: e.target.value })}
              placeholder="Mô tả ngắn về gói dịch vụ"
            />
          </label>

          <div className="plan-form-row">
            <label className="plan-form-label">
              <span>Thời hạn</span>
              <select
                value={createDraft.duration}
                onChange={(e) => setCreateDraft({ ...createDraft, duration: e.target.value as "monthly" | "quarterly" | "yearly" })}
              >
                <option value="monthly">Tháng</option>
                <option value="quarterly">Quý</option>
                <option value="yearly">Năm</option>
              </select>
            </label>
            <label className="plan-form-label">
              <span>Số ngày</span>
              <input
                type="number"
                min={1}
                value={createDraft.durationDays}
                onChange={(e) => setCreateDraft({ ...createDraft, durationDays: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="plan-form-row">
            <label className="plan-form-label">
              <span>Giá (VND)</span>
              <input
                type="number"
                min={0}
                value={createDraft.price}
                onChange={(e) => setCreateDraft({ ...createDraft, price: Number(e.target.value) })}
              />
            </label>
            <label className="plan-form-label">
              <span>Số xe tối đa</span>
              <input
                type="number"
                min={-1}
                value={createDraft.maxVehicles}
                onChange={(e) => setCreateDraft({ ...createDraft, maxVehicles: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="plan-form-actions">
            <button className="plan-cancel-btn" type="button" onClick={() => setCreateOpen(false)}>
              Hủy
            </button>
            <button className="plan-save-btn" type="submit">
              <Check size={16} />
              Tạo gói
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
