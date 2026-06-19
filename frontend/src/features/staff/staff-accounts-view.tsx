"use client";

import { FormEvent, useEffect, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Save, UsersRound } from "lucide-react";
import { apiFetch } from "@/lib/api";

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: "staff" | "admin" | "customer";
  status: "Đang hoạt động" | "Đã khóa";
};

export function StaffAccountsView() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadStaff() {
    setLoading(true);
    try {
      const response = await apiFetch("/users?role=staff");
      const data = await response.json().catch(() => ({}));
      setStaff(response.ok ? data.users || [] : []);
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await apiFetch("/users/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          email: String(form.get("email") || ""),
          password: String(form.get("password") || ""),
          status: "Đang hoạt động",
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.message || "Không tạo được tài khoản nhân viên.");
        return;
      }

      setStaff((items) => [data.user, ...items]);
      setMessage(data.message || "Đã tạo tài khoản nhân viên.");
      event.currentTarget.reset();
    } catch {
      setMessage("Không kết nối được API nhân viên.");
    }
  }

  async function updateStaff(user: StaffUser, changes: Partial<Pick<StaffUser, "name" | "status">>) {
    setMessage(null);
    const nextUser = { ...user, ...changes };
    setStaff((items) => items.map((item) => (item.id === user.id ? nextUser : item)));

    try {
      const response = await apiFetch("/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, ...changes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStaff((items) => items.map((item) => (item.id === user.id ? user : item)));
        setMessage(data.message || "Không cập nhật được nhân viên.");
        return;
      }

      setStaff((items) => items.map((item) => (item.id === user.id ? data.user || nextUser : item)));
      setMessage(data.message || "Đã cập nhật nhân viên.");
    } catch {
      setStaff((items) => items.map((item) => (item.id === user.id ? user : item)));
      setMessage("Không kết nối được API nhân viên.");
    }
  }

  return (
    <section className="bg-slate-50 px-6 py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={createStaff}>
          <div className="mb-6 border-b border-slate-100 pb-4">
            <p className="text-sm text-slate-500">Admin</p>
            <h1 className="text-2xl font-bold text-slate-900">Create Staff</h1>
          </div>
          <div className="space-y-4">
            <InputField label="Tên nhân viên" name="name" required />
            <InputField label="Email" name="email" required type="email" />
            <InputField label="Mật khẩu tạm" minLength={6} name="password" required type="password" />
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700" type="submit">
              <Save size={16} />
              Tạo tài khoản
            </button>
          </div>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-sm text-slate-500">Admin</p>
              <h1 className="text-2xl font-bold text-slate-900">Manage Staff Accounts</h1>
            </div>
            <UsersRound className="text-blue-600" size={24} />
          </div>

          {message && <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                  <th className="py-3 pr-4">Nhân viên</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Trạng thái</th>
                  <th className="py-3 text-right">Lưu</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((user) => (
                  <tr className="border-b border-slate-100 last:border-0" key={user.id}>
                    <td className="py-3 pr-4">
                      <input
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        onBlur={(event) => updateStaff(user, { name: event.target.value })}
                        defaultValue={user.name || user.email}
                      />
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{user.email}</td>
                    <td className="py-3 pr-4">
                      <select
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                        onChange={(event) => updateStaff(user, { status: event.target.value as StaffUser["status"] })}
                        value={user.status}
                      >
                        <option value="Đang hoạt động">Đang hoạt động</option>
                        <option value="Đã khóa">Đã khóa</option>
                      </select>
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      <Save size={16} className="ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && staff.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Chưa có tài khoản nhân viên để hiển thị.</p>}
          {loading && <p className="py-10 text-center text-sm text-slate-500">Đang tải danh sách nhân viên...</p>}
        </div>
      </div>
    </section>
  );
}

function InputField({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" {...props} />
    </label>
  );
}
