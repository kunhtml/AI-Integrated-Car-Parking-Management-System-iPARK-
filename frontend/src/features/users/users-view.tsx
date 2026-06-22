"use client";

import { useEffect, useState } from "react";
import { Save, UsersRound } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { roleLabels } from "@/lib/constants";
import type { DemoUser, Role } from "@/types";

export function UsersView() {
  const { userList: contextUsers } = useParkingApp();
  const [users, setUsers] = useState<DemoUser[]>(contextUsers);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setUsers(contextUsers);
  }, [contextUsers]);

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
        if (mounted) {
          setUsers(contextUsers);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadUsers();
    return () => {
      mounted = false;
    };
  }, [contextUsers]);

  async function updateUser(user: DemoUser, changes: Partial<Pick<DemoUser, "role" | "status">>) {
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
      setUsers((items) =>
        items
          .filter((item) => item.id !== user.id || updated.role === "customer")
          .map((item) => (item.id === user.id ? updated : item)),
      );
      setMessage(updated.role === "staff" ? "Đã chuyển khách hàng sang nhân viên." : "Đã cập nhật người dùng.");
    } catch {
      setUsers((items) => items.map((item) => (item.id === user.id ? user : item)));
      setMessage("Không kết nối được API người dùng.");
    }
  }

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p>Admin</p>
          <h2>Quản lý tài khoản</h2>
        </div>
        <UsersRound size={22} />
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
                    onChange={(event) => updateUser(user, { role: event.target.value as Role })}
                    value={user.role}
                  >
                    <option value="customer">{roleLabels.customer}</option>
                    <option value="staff">{roleLabels.staff}</option>
                  </select>
                </td>
                <td className="py-3 pr-4">
                  <select
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    onChange={(event) =>
                      updateUser(user, { status: event.target.value as DemoUser["status"] })
                    }
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

      {!loading && users.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-500">Chưa có tài khoản khách hàng để hiển thị.</p>
      )}
      {loading && <p className="py-10 text-center text-sm text-slate-500">Đang tải danh sách khách hàng...</p>}
    </div>
  );
}
