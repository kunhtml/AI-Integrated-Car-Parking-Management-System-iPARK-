"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Pencil,
  ReceiptText,
  Settings,
  Trash2,
  X,
  DollarSign,
  Moon,
  Sun,
  Clock,
  AlertTriangle,
  Save,
  Plus,
  CreditCard,
} from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";

type NotifTemplate = {
  id: string;
  name: string;
  triggerType: string;
  title: string;
  content: string;
  isActive: boolean;
};

const TRIGGER_LABELS: Record<string, string> = {
  entry: "Xe vào",
  exit: "Xe ra",
  overdue: "Quá hạn",
  low_balance: "Số dư thấp",
  promotion: "Khuyến mãi",
  reservation_confirmed: "Đặt chỗ xác nhận",
  reservation_expired: "Đặt chỗ hết hạn",
  subscription_expiring: "Gói sắp hết",
  custom: "Tùy chỉnh",
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
    <div className="pricing-modal-overlay" onClick={onClose}>
      <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pricing-modal-header">
          <h3>{title}</h3>
          <button
            className="pricing-modal-close"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <div className="pricing-modal-content">{children}</div>
      </div>
    </div>
  );
}

interface PricingCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onEdit: () => void;
}

function PricingCard({
  title,
  description,
  icon,
  children,
  onEdit,
}: PricingCardProps) {
  return (
    <div className="pricing-card">
      <div className="pricing-card-header">
        <div className="pricing-card-icon">{icon}</div>
        <div className="pricing-card-title">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button className="pricing-edit-btn" onClick={onEdit} type="button">
          <Pencil size={16} />
          <span>Chỉnh sửa</span>
        </button>
      </div>
      <div className="pricing-card-body">{children}</div>
    </div>
  );
}

export function PricingView() {
  const { pricingConfigState, updatePricing } = useParkingApp();
  const [activeTab, setActiveTab] = useState<"pricing" | "templates">(
    "pricing",
  );
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [tplMsg, setTplMsg] = useState("");

  // Modals
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [createTplModalOpen, setCreateTplModalOpen] = useState(false);
  const [editTplModalOpen, setEditTplModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<NotifTemplate | null>(null);

  // Form states
  const [pricingForm, setPricingForm] = useState({
    dayRate: 0,
    rfidCardSalePrice: 50000,
    nightRate: 0,
    dayStartHour: 6,
    nightStartHour: 18,
    gracePeriod: 20,
  });
  const [tplForm, setTplForm] = useState({
    name: "",
    triggerType: "custom",
    title: "",
    content: "",
  });

  useEffect(() => {
    if (pricingConfigState) {
      setPricingForm({
        dayRate: pricingConfigState.dayRate || 0,
        rfidCardSalePrice: pricingConfigState.rfidCardSalePrice ?? 50000,
        nightRate: pricingConfigState.nightRate || 0,
        dayStartHour: pricingConfigState.dayStartHour || 6,
        nightStartHour: pricingConfigState.nightStartHour || 18,
        gracePeriod: pricingConfigState.gracePeriod ?? 20,
      });
    }
  }, [pricingConfigState]);

  async function handleSavePricing(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const success = await updatePricing(formData);
    if (success) {
      setPricingModalOpen(false);
    }
  }

  async function loadTemplates() {
    const response = await apiFetch("/notification-templates");
    if (response.ok) {
      const data = await response.json();
      setTemplates(data.templates);
      setTemplatesLoaded(true);
    }
  }

  async function handleCreateTemplate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      name: String(form.get("name") || ""),
      triggerType: String(form.get("triggerType") || "custom"),
      title: String(form.get("title") || ""),
      content: String(form.get("content") || ""),
    };
    const response = await apiFetch("/notification-templates", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (response.ok) {
      setTemplates((prev) => [...prev, data.template]);
      setTplMsg("Đã tạo mẫu thông báo.");
      setCreateTplModalOpen(false);
      e.currentTarget.reset();
    } else {
      setTplMsg(data.message || "Lỗi.");
    }
  }

  async function updateTemplate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTemplate) return;

    const form = new FormData(e.currentTarget);
    const body = {
      name: String(form.get("name") || ""),
      triggerType: String(form.get("triggerType") || "custom"),
      title: String(form.get("title") || ""),
      content: String(form.get("content") || ""),
    };
    const response = await apiFetch(
      `/notification-templates/${selectedTemplate.id}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();
    if (response.ok) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === selectedTemplate.id ? data.template : t)),
      );
      setTplMsg("Đã cập nhật mẫu thông báo.");
      setEditTplModalOpen(false);
    } else {
      setTplMsg(data.message || "Lỗi.");
    }
  }

  async function deleteTemplate(id: string) {
    const response = await apiFetch(`/notification-templates/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setTplMsg("Đã xóa mẫu.");
    }
  }

  function openEditTemplate(tpl: NotifTemplate) {
    setSelectedTemplate(tpl);
    setTplForm({
      name: tpl.name,
      triggerType: tpl.triggerType,
      title: tpl.title,
      content: tpl.content,
    });
    setEditTplModalOpen(true);
  }

  return (
    <section className="pricing-page">
      {/* Page Header */}
      <div className="pricing-header">
        <div className="header-left">
          <div className="header-icon">
            <ReceiptText size={24} />
          </div>
          <div className="header-text">
            <h1>Cấu hình hệ thống</h1>
            <p>Quản lý bảng giá và thông báo</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="pricing-tabs">
        <button
          className={`pricing-tab ${activeTab === "pricing" ? "active" : ""}`}
          onClick={() => setActiveTab("pricing")}
          type="button"
        >
          <DollarSign size={18} />
          <span>Bảng giá</span>
        </button>
        <button
          className={`pricing-tab ${activeTab === "templates" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("templates");
            if (!templatesLoaded) loadTemplates();
          }}
          type="button"
        >
          <Bell size={18} />
          <span>Mẫu thông báo</span>
        </button>
      </div>

      {/* Pricing Tab */}
      {activeTab === "pricing" && (
        <div className="pricing-content">
          <div className="pricing-grid">
            {/* Day Rate Card */}
            <PricingCard
              title="Giá ban ngày"
              description="Áp dụng trong khung giờ ngày"
              icon={<Sun size={24} />}
              onEdit={() => setPricingModalOpen(true)}
            >
              <div className="pricing-value-display">
                <span className="pricing-currency">
                  {currency.format(pricingConfigState.dayRate || 0)}
                </span>
                <span className="pricing-unit">/ ngày</span>
              </div>
              <div className="pricing-time-range">
                <Clock size={14} />
                <span>
                  {pricingConfigState.dayStartHour}:00 -{" "}
                  {pricingConfigState.nightStartHour}:00
                </span>
              </div>
            </PricingCard>

            {/* Night Rate Card */}
            <PricingCard
              title="Giá ban đêm"
              description="Áp dụng trong khung giờ đêm"
              icon={<Moon size={24} />}
              onEdit={() => setPricingModalOpen(true)}
            >
              <div className="pricing-value-display">
                <span className="pricing-currency">
                  {currency.format(pricingConfigState.nightRate || 0)}
                </span>
                <span className="pricing-unit">/ ngày</span>
              </div>
              <div className="pricing-time-range">
                <Clock size={14} />
                <span>
                  {pricingConfigState.nightStartHour}:00 -{" "}
                  {pricingConfigState.dayStartHour}:00 (ngày hôm sau)
                </span>
              </div>
            </PricingCard>
          </div>

          {/* Quick Info */}
          <div className="pricing-info-card">
            <h4>
              <Settings size={18} /> Thông tin bảng giá
            </h4>
            <div className="pricing-info-grid">
              <div className="pricing-info-item">
                <span className="pricing-info-label">Bắt đầu tính phí sau</span>
                <span className="pricing-info-value">
                  {pricingConfigState.gracePeriod ?? 20} phút
                </span>
              </div>
              <div className="pricing-info-item">
                <span className="pricing-info-label">Khung giờ ngày</span>
                <span className="pricing-info-value">
                  {pricingConfigState.dayStartHour}:00 -{" "}
                  {pricingConfigState.nightStartHour}:00
                </span>
              </div>
              <div className="pricing-info-item">
                <span className="pricing-info-label">Khung giờ đêm</span>
                <span className="pricing-info-value">
                  {pricingConfigState.nightStartHour}:00 -{" "}
                  {pricingConfigState.dayStartHour}:00
                </span>
              </div>
              <div className="pricing-info-item">
                <span className="pricing-info-label">Giá ngày</span>
                <span className="pricing-info-value">
                  {currency.format(pricingConfigState.dayRate || 0)}
                </span>
              </div>
              <div className="pricing-info-item">
                <span className="pricing-info-label">Giá đêm</span>
                <span className="pricing-info-value">
                  {currency.format(pricingConfigState.nightRate || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="pricing-content">
          <div className="templates-header">
            <h3>Mẫu thông báo</h3>
            <button
              className="create-template-btn"
              onClick={() => setCreateTplModalOpen(true)}
              type="button"
            >
              <Plus size={18} />
              <span>Tạo mẫu mới</span>
            </button>
          </div>

          {tplMsg && <div className="template-message">{tplMsg}</div>}

          <div className="templates-grid">
            {templates.map((tpl) => (
              <div key={tpl.id} className="template-card">
                <div className="template-card-header">
                  <div className="template-trigger">
                    <Bell size={14} />
                    <span>
                      {TRIGGER_LABELS[tpl.triggerType] || tpl.triggerType}
                    </span>
                  </div>
                  <span
                    className={`template-status ${tpl.isActive ? "active" : ""}`}
                  >
                    {tpl.isActive ? "Bật" : "Tắt"}
                  </span>
                </div>
                <h4 className="template-name">{tpl.name}</h4>
                <p className="template-title">{tpl.title}</p>
                <p className="template-content">
                  {tpl.content.slice(0, 100)}...
                </p>
                <div className="template-actions">
                  <button
                    className="template-edit-btn"
                    onClick={() => openEditTemplate(tpl)}
                    type="button"
                  >
                    <Pencil size={14} />
                    <span>Sửa</span>
                  </button>
                  <button
                    className="template-delete-btn"
                    onClick={() => deleteTemplate(tpl.id)}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {templates.length === 0 && templatesLoaded && (
              <div className="templates-empty">
                <Bell size={48} strokeWidth={1} />
                <p>Chưa có mẫu thông báo nào</p>
                <span>Tạo mẫu mới để gửi thông báo tự động</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Edit Modal */}
      <Modal
        isOpen={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        title="Chỉnh sửa bảng giá"
      >
        <form className="pricing-edit-form" onSubmit={handleSavePricing}>
          <div className="form-section">
            <h4><CreditCard size={18} /> Giá thẻ RFID Member</h4>
            <label className="form-label">
              <span>Giá bán thẻ (VND)</span>
              <input name="rfidCardSalePrice" type="number" min={0} step={1000} value={pricingForm.rfidCardSalePrice} onChange={(e) => setPricingForm({ ...pricingForm, rfidCardSalePrice: Number(e.target.value) })} required />
            </label>
            <p className="pricing-form-hint">Giá này được dùng khi khách mua thẻ RFID Member trực tiếp trên website.</p>
          </div>
          <div className="form-section">
            <h4>
              <Sun size={18} /> Giá ban ngày
            </h4>
            <div className="form-row">
              <label className="form-label">
                <span>Giá (VND/ngày)</span>
                <input
                  name="dayRate"
                  type="number"
                  min={1}
                  value={pricingForm.dayRate}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      dayRate: Number(e.target.value),
                    })
                  }
                  required
                />
              </label>
              <label className="form-label">
                <span>Giờ bắt đầu ngày</span>
                <input
                  name="dayStartHour"
                  type="number"
                  min={0}
                  max={23}
                  value={pricingForm.dayStartHour}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      dayStartHour: Number(e.target.value),
                    })
                  }
                  required
                />
              </label>
            </div>
          </div>
          <div className="form-section">
            <h4>
              <Clock size={18} /> Thời gian bắt đầu tính phí
            </h4>
            <label className="form-label">
              <span>Miễn phí ban đầu (phút)</span>
              <input
                name="gracePeriod"
                type="number"
                min={0}
                value={pricingForm.gracePeriod}
                onChange={(e) =>
                  setPricingForm({
                    ...pricingForm,
                    gracePeriod: Number(e.target.value),
                  })
                }
                required
              />
            </label>
            <p className="pricing-form-hint">Sau số phút này, hệ thống bắt đầu tính phí gửi xe.</p>
          </div>

          <div className="form-section">
            <h4>
              <Moon size={18} /> Giá ban đêm
            </h4>
            <div className="form-row">
              <label className="form-label">
                <span>Giá (VND/ngày)</span>
                <input
                  name="nightRate"
                  type="number"
                  min={1}
                  value={pricingForm.nightRate}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      nightRate: Number(e.target.value),
                    })
                  }
                  required
                />
              </label>
              <label className="form-label">
                <span>Giờ bắt đầu đêm</span>
                <input
                  name="nightStartHour"
                  type="number"
                  min={0}
                  max={23}
                  value={pricingForm.nightStartHour}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      nightStartHour: Number(e.target.value),
                    })
                  }
                  required
                />
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button
              className="cancel-btn"
              type="button"
              onClick={() => setPricingModalOpen(false)}
            >
              Hủy
            </button>
            <button className="save-btn" type="submit">
              <Save size={16} />
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Template Modal */}
      <Modal
        isOpen={createTplModalOpen}
        onClose={() => setCreateTplModalOpen(false)}
        title="Tạo mẫu thông báo mới"
      >
        <form className="pricing-edit-form" onSubmit={handleCreateTemplate}>
          <label className="form-label">
            <span>Tên mẫu</span>
            <input name="name" placeholder="VD: ThongBaoXeVao" required />
          </label>
          <label className="form-label">
            <span>Loại trigger</span>
            <select name="triggerType" required>
              {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            <span>Tiêu đề</span>
            <input name="title" placeholder="Tiêu đề thông báo..." required />
          </label>
          <label className="form-label full">
            <span>Nội dung</span>
            <textarea
              name="content"
              placeholder="Nội dung thông báo... (hỗ trợ biến: {{plate}}, {{fee}}, {{name}})"
              required
              rows={4}
            />
          </label>

          <div className="form-actions">
            <button
              className="cancel-btn"
              type="button"
              onClick={() => setCreateTplModalOpen(false)}
            >
              Hủy
            </button>
            <button className="save-btn" type="submit">
              <Plus size={16} />
              <span>Tạo mẫu</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Template Modal */}
      <Modal
        isOpen={editTplModalOpen}
        onClose={() => setEditTplModalOpen(false)}
        title="Sửa mẫu thông báo"
      >
        <form className="pricing-edit-form" onSubmit={updateTemplate}>
          <label className="form-label">
            <span>Tên mẫu</span>
            <input name="name" defaultValue={selectedTemplate?.name} required />
          </label>
          <label className="form-label">
            <span>Loại trigger</span>
            <select
              name="triggerType"
              defaultValue={selectedTemplate?.triggerType}
              required
            >
              {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            <span>Tiêu đề</span>
            <input
              name="title"
              defaultValue={selectedTemplate?.title}
              required
            />
          </label>
          <label className="form-label full">
            <span>Nội dung</span>
            <textarea
              name="content"
              defaultValue={selectedTemplate?.content}
              required
              rows={4}
            />
          </label>

          <div className="form-actions">
            <button
              className="cancel-btn"
              type="button"
              onClick={() => setEditTplModalOpen(false)}
            >
              Hủy
            </button>
            <button className="save-btn" type="submit">
              <Save size={16} />
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}


