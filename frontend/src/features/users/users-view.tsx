"use client";

import { useEffect, useState } from "react";
import { Save, UsersRound } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { roleLabels } from "@/lib/constants";

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff" | "customer";
  status: "Đang hoạt động" | "Đã khóa";
};

export function UsersView() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      try {
        const response = await apiFetch("/users?role=customer");
        const data = await response.json().catch(() => ({}));
        if (mounted && response.ok) {
          setUsers(data.users || []);
        }
      } catch {
        if (mounted) setUsers([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadUsers();
    return () => {
      mounted = false;
    };
  }, []);

  async function updateUser(user: User, changes: Partial<Pick<User, "role" | "status">>) {
    setMessage(null);
    const nextUser = { ...user, ...changes };
    setUsers((items) => items.map((item) => (item.id === user.id ? nextUser : item)));

    try {
      const response = await apiFetch("/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, ...changes }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setUsers((items) => items.map((item) => (item.id === user.id ? user : item)));
        setMessage(data.message || "Không cập nhật được người dùng.");
        return;
      }

      const updated = data.user || nextUser;
      setUsers((items) => items.filter((item) => item.id !== user.id || updated.role === "customer").map((item) => (item.id === user.id ? updated : item)));
      setMessage(updated.role === "staff" ? "Đã chuyển khách hàng sang nhân viên." : "Đã cập nhật người dùng.");
    } catch {
      setUsers((items) => items.map((item) => (item.id === user.id ? user : item)));
      setMessage("Không kết nối được API người dùng.");
    }
  }

  return (
    <section className="bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-6xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm text-slate-500">Admin</p>
            <h1 className="text-2xl font-bold text-slate-900">Manage Users & Roles</h1>
          </div>
          <UsersRound className="text-blue-600" size={24} />
        </div>

        {message && <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                <th className="py-3 pr-4">Khách hàng</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3 pr-4">Trạng thái</th>
                <th className="py-3 text-right">Lưu</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-b border-slate-100 last:border-0" key={user.id}>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{user.name || user.email}</td>
                  <td className="py-3 pr-4 text-slate-600">{user.email}</td>
                  <td className="py-3 pr-4">
                    <select
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                      onChange={(event) => updateUser(user, { role: event.target.value as User["role"] })}
                      value={user.role}
                    >
                      <option value="customer">{roleLabels.customer}</option>
                      <option value="staff">{roleLabels.staff}</option>
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                      onChange={(event) => updateUser(user, { status: event.target.value as User["status"] })}
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

        {!loading && users.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Chưa có tài khoản khách hàng để hiển thị.</p>}
        {loading && <p className="py-10 text-center text-sm text-slate-500">Đang tải danh sách khách hàng...</p>}
      </div>
    </section>
  );
}
