"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2, UsersRound, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff" | "customer";
  status: "Đang hoạt động" | "Đã khóa";
  phone?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dob?: string;
  idCardNumber?: string;
  idCardIssueDate?: string;
  idCardExpiryDate?: string;
  address?: string;
  city?: string;
  district?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  company?: string;
  taxId?: string;
};

const emptyForm: Omit<UserItem, "id"> & { password?: string } = {
  name: "",
  email: "",
  password: "",
  phone: "",
  role: "customer",
  status: "Đang hoạt động",
  firstName: "",
  lastName: "",
  gender: "—",
  dob: "",
  idCardNumber: "",
  idCardIssueDate: "",
  idCardExpiryDate: "",
  address: "",
  city: "",
  district: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  company: "",
  taxId: "",
};

export function UsersView() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [formState, setFormState] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const response = await apiFetch("/users");
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleOpenCreate() {
    setEditingId(null);
    setIsReadOnly(false);
    setFormState(emptyForm);
    setShowForm(true);
    setMessage(null);
  }

  function handleOpenEdit(user: UserItem) {
    setEditingId(user.id);
    setIsReadOnly(false);
    setFormState({
      name: user.name || "",
      email: user.email || "",
      password: "",
      phone: user.phone || "",
      role: user.role || "customer",
      status: user.status || "Đang hoạt động",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      gender: user.gender || "—",
      dob: user.dob || "",
      idCardNumber: user.idCardNumber || "",
      idCardIssueDate: user.idCardIssueDate || "",
      idCardExpiryDate: user.idCardExpiryDate || "",
      address: user.address || "",
      city: user.city || "",
      district: user.district || "",
      emergencyContactName: user.emergencyContactName || "",
      emergencyContactPhone: user.emergencyContactPhone || "",
      company: user.company || "",
      taxId: user.taxId || "",
    });
    setShowForm(true);
    setMessage(null);
  }

  function handleOpenView(user: UserItem) {
    handleOpenEdit(user);
    setIsReadOnly(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingId(null);
    setIsReadOnly(false);
    setFormState(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isReadOnly) return;
    setMessage(null);
    setSubmitting(true);

    try {
      if (editingId) {
        // Update user
        const response = await apiFetch("/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            ...formState,
            ...(formState.password ? { password: formState.password } : {}),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMessage(data.message || "Cập nhật tài khoản thất bại.");
          return;
        }
        setMessage("Đã cập nhật tài khoản thành công.");
        handleCloseForm();
        loadUsers();
      } else {
        // Create user
        const response = await apiFetch("/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formState),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMessage(data.message || "Tạo tài khoản thất bại.");
          return;
        }
        setMessage("Đã tạo tài khoản thành công.");
        handleCloseForm();
        loadUsers();
      }
    } catch {
      setMessage("Lỗi kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${name}"?`)) {
      return;
    }
    setMessage(null);
    try {
      const response = await apiFetch(`/users/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setMessage(data.message || "Đã xóa tài khoản.");
        setUsers((items) => items.filter((u) => u.id !== id));
      } else {
        setMessage(data.message || "Xóa tài khoản thất bại.");
      }
    } catch {
      setMessage("Lỗi kết nối máy chủ.");
    }
  }

  const filteredUsers = users.filter((user) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      user.name?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.phone?.toLowerCase().includes(term) ||
      user.company?.toLowerCase().includes(term) ||
      user.role?.toLowerCase().includes(term) ||
      user.status?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-medium text-slate-400">Admin</p>
          <h1 className="text-xl font-bold text-slate-900">Quản lý tài khoản</h1>
        </div>
        <UsersRound className="text-slate-400" size={22} />
      </div>

      {message && (
        <div className="mb-4 rounded-md bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700">
          {message}
        </div>
      )}

      {/* Action Bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên, email, SĐT, mã thành viên, công ty..."
            type="text"
            value={searchTerm}
          />
        </div>

        {showForm ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={handleCloseForm}
            type="button"
          >
            <X size={16} />
            Đóng
          </button>
        ) : (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            onClick={handleOpenCreate}
            type="button"
          >
            <Plus size={16} />
            Thêm tài khoản
          </button>
        )}
      </div>

      {/* Form Area */}
      {showForm && (
        <form className="mb-8 rounded-xl border border-slate-200 bg-slate-50/50 p-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Họ tên hiển thị <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                placeholder="VD: Nguyễn Văn A"
                required
                type="text"
                value={formState.name}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly || Boolean(editingId)}
                onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                placeholder="you@email.com"
                required
                type="email"
                value={formState.email}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Mật khẩu {!editingId && <span className="text-red-500">*</span>}
              </label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                minLength={6}
                onChange={(e) => setFormState({ ...formState, password: e.target.value })}
                placeholder={editingId ? "Để trống nếu không đổi" : "Tối thiểu 6 ký tự"}
                required={!editingId}
                type="password"
                value={formState.password || ""}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Số điện thoại</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                placeholder="0xxx xxx xxx"
                type="text"
                value={formState.phone || ""}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Vai trò</label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, role: e.target.value as UserItem["role"] })}
                value={formState.role}
              >
                <option value="customer">Khách hàng</option>
                <option value="staff">Nhân viên</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Trạng thái</label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, status: e.target.value as UserItem["status"] })}
                value={formState.status}
              >
                <option value="Đang hoạt động">Đang hoạt động</option>
                <option value="Đã khóa">Đã khóa</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tên</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, firstName: e.target.value })}
                placeholder="Văn A"
                type="text"
                value={formState.firstName || ""}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Họ</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, lastName: e.target.value })}
                placeholder="Nguyễn"
                type="text"
                value={formState.lastName || ""}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Giới tính</label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, gender: e.target.value })}
                value={formState.gender || "—"}
              >
                <option value="—">—</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày sinh</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, dob: e.target.value })}
                type="date"
                value={formState.dob || ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Số CCCD/CMND</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, idCardNumber: e.target.value })}
                type="text"
                value={formState.idCardNumber || ""}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày cấp</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, idCardIssueDate: e.target.value })}
                type="date"
                value={formState.idCardIssueDate || ""}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày hết hạn</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, idCardExpiryDate: e.target.value })}
                type="date"
                value={formState.idCardExpiryDate || ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Địa chỉ</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                placeholder="Số nhà, đường"
                type="text"
                value={formState.address || ""}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tỉnh/Thành phố</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, city: e.target.value })}
                type="text"
                value={formState.city || ""}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Quận/Huyện</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, district: e.target.value })}
                type="text"
                value={formState.district || ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Người liên hệ khẩn cấp</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, emergencyContactName: e.target.value })}
                type="text"
                value={formState.emergencyContactName || ""}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">SĐT khẩn cấp</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, emergencyContactPhone: e.target.value })}
                type="text"
                value={formState.emergencyContactPhone || ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Công ty</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, company: e.target.value })}
                type="text"
                value={formState.company || ""}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mã số thuế</label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                disabled={isReadOnly}
                onChange={(e) => setFormState({ ...formState, taxId: e.target.value })}
                type="text"
                value={formState.taxId || ""}
              />
            </div>
          </div>

          {!isReadOnly && (
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              <Plus size={18} />
              {editingId ? "Lưu thay đổi" : "Tạo tài khoản"}
            </button>
          )}
        </form>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
              <th className="py-3.5 px-4">HỌ TÊN</th>
              <th className="py-3.5 px-4">EMAIL</th>
              <th className="py-3.5 px-4">SĐT</th>
              <th className="py-3.5 px-4">VAI TRÒ</th>
              <th className="py-3.5 px-4">TRẠNG THÁI</th>
              <th className="py-3.5 px-4 text-right"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((user) => (
              <tr className="transition hover:bg-slate-50/50" key={user.id}>
                <td className="py-4 px-4 font-semibold text-slate-900">{user.name || "—"}</td>
                <td className="py-4 px-4 text-slate-500">{user.email}</td>
                <td className="py-4 px-4 text-slate-500">{user.phone || "—"}</td>
                <td className="py-4 px-4">
                  <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {user.role === "staff" ? "Nhân viên" : user.role === "admin" ? "Quản trị viên" : "Khách hàng"}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                      user.status === "Đang hoạt động" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    }`}
                  >
                    {user.status || "Đang hoạt động"}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      onClick={() => handleOpenView(user)}
                      title="Xem chi tiết"
                      type="button"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      onClick={() => handleOpenEdit(user)}
                      title="Chỉnh sửa"
                      type="button"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      onClick={() => handleDelete(user.id, user.name)}
                      title="Xóa tài khoản"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && filteredUsers.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">
          {searchTerm ? "Không tìm thấy tài khoản phù hợp." : "Chưa có dữ liệu người dùng."}
        </p>
      )}

      {loading && <p className="py-12 text-center text-sm text-slate-400">Đang tải danh sách tài khoản...</p>}
    </div>
  );
}
