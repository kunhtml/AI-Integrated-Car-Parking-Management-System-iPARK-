"use client";

import { useMemo, useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2, UsersRound, X, Mail, Phone, Building, Shield, Calendar, MapPin, CreditCard, AlertCircle, Check, Ban, Filter } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import type { UserUpdatePayload } from "@/hooks/actions/use-user-actions";
import { roleLabels } from "@/lib/constants";
import type { DemoUser, Role } from "@/types";

function toDateInput(iso?: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

const GENDER_LABELS: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" };

function show(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("vi-VN");
}

type EditState = Record<string, string>;

const EDIT_FIELDS: { key: keyof DemoUser; label: string; type?: string }[] = [
  { key: "firstName", label: "Tên" },
  { key: "lastName", label: "Họ" },
  { key: "phone", label: "Số điện thoại", type: "tel" },
  { key: "birthDate", label: "Ngày sinh", type: "date" },
  { key: "idCardNumber", label: "Số CCCD/CMND" },
  { key: "idCardIssuedAt", label: "Ngày cấp", type: "date" },
  { key: "idCardExpiry", label: "Ngày hết hạn", type: "date" },
  { key: "address", label: "Địa chỉ" },
  { key: "city", label: "Tỉnh/Thành phố" },
  { key: "district", label: "Quận/Huyện" },
  { key: "emergencyContact", label: "Người liên hệ khẩn cấp" },
  { key: "emergencyPhone", label: "SĐT khẩn cấp", type: "tel" },
  { key: "company", label: "Công ty" },
  { key: "taxCode", label: "Mã số thuế" },
];

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="users-modal-overlay" onClick={onClose}>
      <div className="users-modal" onClick={(e) => e.stopPropagation()}>
        <div className="users-modal-header">
          <h3>{title}</h3>
          <button className="users-modal-close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        <div className="users-modal-content">
          {children}
        </div>
      </div>
    </div>
  );
}

function UserAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const colors = [
    "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4",
    "#6366f1", "#f97316", "#84cc16", "#14b8a6",
  ];
  const colorIndex = name.length % colors.length;

  return (
    <div
      className={`user-avatar user-avatar-${size}`}
      style={{ background: colors[colorIndex] }}
    >
      {initials}
    </div>
  );
}

function UserCard({ user, onView, onEdit, onDelete }: {
  user: DemoUser;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusConfig = user.status === "Đang hoạt động"
    ? { bg: "#ecfdf5", color: "#059669", icon: <Check size={14} />, text: "Hoạt động" }
    : { bg: "#fef2f2", color: "#dc2626", icon: <Ban size={14} />, text: "Đã khóa" };

  const roleConfig: Record<string, { bg: string; color: string }> = {
    admin: { bg: "#fef3c7", color: "#d97706" },
    staff: { bg: "#eff6ff", color: "#2563eb" },
    customer: { bg: "#f3f4f6", color: "#6b7280" },
  };
  const roleStyle = roleConfig[user.role] || roleConfig.customer;

  return (
    <div className="user-card">
      <div className="user-card-header">
        <UserAvatar name={user.name} />
        <div className="user-card-info">
          <h4>{user.name}</h4>
          <span className="user-email">{user.email}</span>
        </div>
        <div className="user-card-badges">
          <span className="user-role-badge" style={{ background: roleStyle.bg, color: roleStyle.color }}>
            {roleLabels[user.role]}
          </span>
        </div>
      </div>

      <div className="user-card-details">
        {user.phone && (
          <div className="user-detail">
            <Phone size={14} />
            <span>{user.phone}</span>
          </div>
        )}
        {user.company && (
          <div className="user-detail">
            <Building size={14} />
            <span>{user.company}</span>
          </div>
        )}
        <div className="user-detail">
          <span className="user-status" style={{ background: statusConfig.bg, color: statusConfig.color }}>
            {statusConfig.icon}
            {statusConfig.text}
          </span>
        </div>
      </div>

      <div className="user-card-actions">
        <button className="user-action-btn view" onClick={onView} type="button" title="Xem chi tiết">
          <Eye size={16} />
        </button>
        <button className="user-action-btn edit" onClick={onEdit} type="button" title="Sửa">
          <Pencil size={16} />
        </button>
        <button className="user-action-btn delete" onClick={onDelete} type="button" title="Xóa">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="user-detail-section">
      <h4>{title}</h4>
      <div className="user-detail-grid">{children}</div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="user-detail-row">
      <span className="user-detail-label">
        {icon}
        {label}
      </span>
      <span className="user-detail-value">{value}</span>
    </div>
  );
}

export function UsersView() {
  const { currentUser, userList, createUser, updateUser, deleteUser } = useParkingApp();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "">("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState<DemoUser | null>(null);
  const [editing, setEditing] = useState<DemoUser | null>(null);
  const [form, setForm] = useState<EditState>({});

  const isAdmin = currentUser?.role === "admin";
  const manageableRoles: Role[] = isAdmin ? ["staff", "customer"] : ["customer"];

  const visibleUsers = useMemo(
    () => userList.filter((u) => manageableRoles.includes(u.role)),
    [userList, isAdmin],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleUsers.filter((u) => {
      if (q && ![u.name, u.email, u.phone ?? "", u.company ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)) return false;
      if (filterRole && u.role !== filterRole) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      return true;
    });
  }, [visibleUsers, search, filterRole, filterStatus]);

  const stats = useMemo(() => ({
    total: visibleUsers.length,
    active: visibleUsers.filter((u) => u.status === "Đang hoạt động").length,
    staff: visibleUsers.filter((u) => u.role === "staff").length,
    customer: visibleUsers.filter((u) => u.role === "customer").length,
  }), [visibleUsers]);

  if (!currentUser) return null;

  function openEdit(user: DemoUser) {
    setEditing(user);
    setForm({
      name: user.name,
      role: user.role,
      status: user.status,
      password: "",
      gender: user.gender ?? "",
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      phone: user.phone ?? "",
      birthDate: toDateInput(user.birthDate),
      idCardNumber: user.idCardNumber ?? "",
      idCardIssuedAt: toDateInput(user.idCardIssuedAt),
      idCardExpiry: toDateInput(user.idCardExpiry),
      address: user.address ?? "",
      city: user.city ?? "",
      district: user.district ?? "",
      emergencyContact: user.emergencyContact ?? "",
      emergencyPhone: user.emergencyPhone ?? "",
      company: user.company ?? "",
      taxCode: user.taxCode ?? "",
    });
  }

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveEdit() {
    if (!editing) return;
    const updates: UserUpdatePayload = {
      name: form.name,
      status: form.status,
      ...(isAdmin ? { role: form.role } : {}),
      ...(form.password ? { password: form.password } : {}),
    };
    for (const { key } of EDIT_FIELDS) {
      (updates as Record<string, unknown>)[key] = form[key] ?? "";
    }
    if (form.gender) updates.gender = form.gender;
    await updateUser(String(editing.id), updates);
    setEditing(null);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    await createUser(event);
    setShowCreate(false);
  }

  async function handleDelete(user: DemoUser) {
    if (!window.confirm(`Xóa tài khoản "${user.name}"? Hành động này không thể hoàn tác.`)) return;
    await deleteUser(String(user.id));
  }

  return (
    <section className="users-page">
      {/* Header */}
      <div className="users-header">
        <div className="header-left">
          <div className="header-icon">
            <UsersRound size={24} />
          </div>
          <div className="header-text">
            <h1>Quản lý tài khoản</h1>
            <p>{isAdmin ? "Quản trị viên" : "Nhân viên"}</p>
          </div>
        </div>
        <button className="add-user-btn" onClick={() => setShowCreate(true)} type="button">
          <Plus size={18} />
          <span>Thêm tài khoản</span>
        </button>
      </div>

      {/* Stats */}
      <div className="users-stats-grid">
        <div className="user-stat-card">
          <div className="user-stat-icon total"><UsersRound size={20} /></div>
          <div className="user-stat-content">
            <span className="user-stat-value">{stats.total}</span>
            <span className="user-stat-label">Tổng tài khoản</span>
          </div>
        </div>
        <div className="user-stat-card">
          <div className="user-stat-icon active"><Check size={20} /></div>
          <div className="user-stat-content">
            <span className="user-stat-value">{stats.active}</span>
            <span className="user-stat-label">Đang hoạt động</span>
          </div>
        </div>
        <div className="user-stat-card">
          <div className="user-stat-icon staff"><Shield size={20} /></div>
          <div className="user-stat-content">
            <span className="user-stat-value">{stats.staff}</span>
            <span className="user-stat-label">Nhân viên</span>
          </div>
        </div>
        <div className="user-stat-card">
          <div className="user-stat-icon customer"><Building size={20} /></div>
          <div className="user-stat-content">
            <span className="user-stat-value">{stats.customer}</span>
            <span className="user-stat-label">Khách hàng</span>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="users-filter-bar">
        <div className="users-search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Tìm tên, email, SĐT, công ty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="users-filter-group">
          <Filter size={16} />
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as Role | "")}>
            <option value="">Tất cả vai trò</option>
            {manageableRoles.map((r) => (
              <option key={r} value={r}>{roleLabels[r]}</option>
            ))}
          </select>
        </div>
        <select className="users-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="Đang hoạt động">Hoạt động</option>
          <option value="Đã khóa">Đã khóa</option>
        </select>
        <span className="users-filter-count">{filtered.length} tài khoản</span>
      </div>

      {/* Users Grid */}
      <div className="users-grid">
        {filtered.map((user) => (
          <UserCard
            key={String(user.id)}
            user={user}
            onView={() => setViewing(user)}
            onEdit={() => openEdit(user)}
            onDelete={() => handleDelete(user)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="users-empty">
            <UsersRound size={48} strokeWidth={1} />
            <p>Không tìm thấy tài khoản nào</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Tạo tài khoản mới">
        <form className="users-form" onSubmit={handleCreate}>
          <div className="users-form-section">
            <h4>Thông tin đăng nhập</h4>
            <div className="users-form-row">
              <label className="users-form-label">
                <span>Họ tên <span className="required">*</span></span>
                <input name="name" placeholder="VD: Nguyễn Văn A" required />
              </label>
              <label className="users-form-label">
                <span>Email <span className="required">*</span></span>
                <input name="email" placeholder="you@email.com" required type="email" />
              </label>
            </div>
            <div className="users-form-row">
              <label className="users-form-label">
                <span>Mật khẩu <span className="required">*</span></span>
                <input name="password" placeholder="Tối thiểu 6 ký tự" required type="password" />
              </label>
              <label className="users-form-label">
                <span>Số điện thoại</span>
                <input name="phone" placeholder="0xxx xxx xxx" type="tel" />
              </label>
            </div>
            <div className="users-form-row">
              <label className="users-form-label">
                <span>Vai trò</span>
                <select name="role" defaultValue="customer">
                  {manageableRoles.map((r) => (
                    <option key={r} value={r}>{roleLabels[r]}</option>
                  ))}
                </select>
              </label>
              <label className="users-form-label">
                <span>Trạng thái</span>
                <select name="status" defaultValue="Đang hoạt động">
                  <option value="Đang hoạt động">Đang hoạt động</option>
                  <option value="Đã khóa">Đã khóa</option>
                </select>
              </label>
            </div>
          </div>

          <div className="users-form-section">
            <h4>Thông tin cá nhân</h4>
            <div className="users-form-row">
              <label className="users-form-label">
                <span>Tên</span>
                <input name="firstName" placeholder="Văn A" />
              </label>
              <label className="users-form-label">
                <span>Họ</span>
                <input name="lastName" placeholder="Nguyễn" />
              </label>
            </div>
            <div className="users-form-row">
              <label className="users-form-label">
                <span>Giới tính</span>
                <select name="gender" defaultValue="">
                  <option value="">—</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </label>
              <label className="users-form-label">
                <span>Ngày sinh</span>
                <input name="birthDate" type="date" />
              </label>
            </div>
            <div className="users-form-row">
              <label className="users-form-label full">
                <span>Địa chỉ</span>
                <input name="address" placeholder="Số nhà, đường" />
              </label>
            </div>
          </div>

          <div className="users-form-actions">
            <button className="users-cancel-btn" type="button" onClick={() => setShowCreate(false)}>
              Hủy
            </button>
            <button className="users-submit-btn" type="submit">
              <Plus size={16} />
              Tạo tài khoản
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Chi tiết tài khoản">
        {viewing && (
          <div className="user-detail-modal">
            <div className="user-detail-header">
              <UserAvatar name={viewing.name} size="lg" />
              <div className="user-detail-header-info">
                <h3>{viewing.name}</h3>
                <span className={`user-detail-status ${viewing.status === "Đang hoạt động" ? "active" : "inactive"}`}>
                  {viewing.status === "Đang hoạt động" ? <Check size={14} /> : <Ban size={14} />}
                  {viewing.status}
                </span>
              </div>
            </div>

            <DetailSection title="Tài khoản">
              <DetailRow icon={<Mail size={14} />} label="Email" value={viewing.email} />
              <DetailRow icon={<Shield size={14} />} label="Vai trò" value={roleLabels[viewing.role]} />
              <DetailRow icon={<AlertCircle size={14} />} label="Xác thực 2 lớp" value={viewing.twoFactorEnabled ? "Đã bật" : "Tắt"} />
            </DetailSection>

            <DetailSection title="Thông tin cá nhân">
              <DetailRow icon={<Phone size={14} />} label="SĐT" value={show(viewing.phone)} />
              <DetailRow icon={viewing.gender ? <></> : null} label="Giới tính" value={viewing.gender ? GENDER_LABELS[viewing.gender] : "—"} />
              <DetailRow icon={<Calendar size={14} />} label="Ngày sinh" value={fmtDate(viewing.birthDate)} />
            </DetailSection>

            <DetailSection title="Giấy tờ">
              <DetailRow icon={<CreditCard size={14} />} label="Số CCCD" value={show(viewing.idCardNumber)} />
              <DetailRow icon={<Calendar size={14} />} label="Ngày cấp" value={fmtDate(viewing.idCardIssuedAt)} />
              <DetailRow icon={<AlertCircle size={14} />} label="Ngày hết hạn" value={fmtDate(viewing.idCardExpiry)} />
            </DetailSection>

            <DetailSection title="Địa chỉ & liên hệ">
              <DetailRow icon={<MapPin size={14} />} label="Địa chỉ" value={show(viewing.address)} />
              <DetailRow icon={<Building size={14} />} label="Công ty" value={show(viewing.company)} />
            </DetailSection>

            <DetailSection title="Hệ thống">
              <DetailRow icon={<Calendar size={14} />} label="Đăng nhập gần nhất" value={fmtDateTime(viewing.lastLoginAt)} />
              <DetailRow icon={<Calendar size={14} />} label="Ngày tạo" value={fmtDateTime(viewing.createdAt)} />
            </DetailSection>

            <div className="user-detail-actions">
              <button className="users-cancel-btn" type="button" onClick={() => setViewing(null)}>
                Đóng
              </button>
              <button
                className="users-submit-btn"
                type="button"
                onClick={() => { const u = viewing; setViewing(null); openEdit(u); }}
              >
                <Pencil size={16} />
                Chỉnh sửa
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Chỉnh sửa tài khoản">
        {editing && (
          <form className="users-form" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
            <div className="users-form-section">
              <h4>Thông tin cơ bản</h4>
              <div className="users-form-row">
                <label className="users-form-label">
                  <span>Họ tên</span>
                  <input onChange={(e) => setField("name", e.target.value)} value={form.name ?? ""} />
                </label>
                {isAdmin && (
                  <label className="users-form-label">
                    <span>Vai trò</span>
                    <select onChange={(e) => setField("role", e.target.value)} value={form.role ?? "customer"}>
                      {manageableRoles.map((r) => (
                        <option key={r} value={r}>{roleLabels[r]}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="users-form-row">
                <label className="users-form-label">
                  <span>Trạng thái</span>
                  <select onChange={(e) => setField("status", e.target.value)} value={form.status ?? "Đang hoạt động"}>
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Đã khóa">Đã khóa</option>
                  </select>
                </label>
                <label className="users-form-label">
                  <span>Đặt lại mật khẩu</span>
                  <input onChange={(e) => setField("password", e.target.value)} placeholder="Để trống nếu không đổi" type="password" />
                </label>
              </div>
            </div>

            <div className="users-form-section">
              <h4>Thông tin cá nhân</h4>
              <div className="users-form-row">
                <label className="users-form-label">
                  <span>Tên</span>
                  <input onChange={(e) => setField("firstName", e.target.value)} value={form.firstName ?? ""} />
                </label>
                <label className="users-form-label">
                  <span>Họ</span>
                  <input onChange={(e) => setField("lastName", e.target.value)} value={form.lastName ?? ""} />
                </label>
              </div>
              <div className="users-form-row">
                <label className="users-form-label">
                  <span>Số điện thoại</span>
                  <input onChange={(e) => setField("phone", e.target.value)} type="tel" value={form.phone ?? ""} />
                </label>
                <label className="users-form-label">
                  <span>Giới tính</span>
                  <select onChange={(e) => setField("gender", e.target.value)} value={form.gender ?? ""}>
                    <option value="">—</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </label>
              </div>
              <div className="users-form-row">
                <label className="users-form-label">
                  <span>Ngày sinh</span>
                  <input onChange={(e) => setField("birthDate", e.target.value)} type="date" value={form.birthDate ?? ""} />
                </label>
                <label className="users-form-label">
                  <span>Công ty</span>
                  <input onChange={(e) => setField("company", e.target.value)} value={form.company ?? ""} />
                </label>
              </div>
            </div>

            <div className="users-form-actions">
              <button className="users-cancel-btn" type="button" onClick={() => setEditing(null)}>
                Hủy
              </button>
              <button className="users-submit-btn" type="submit">
                <Check size={16} />
                Lưu thay đổi
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
