import type { FormEvent } from "react";
import { apiFetch } from "@/lib/client-api";
import type { DemoUser } from "@/types";

export type UserUpdatePayload = {
  name?: string;
  role?: string;
  status?: string;
  password?: string;
  phone?: string;
};

type UserActionsParams = {
  setUserList: (
    users: DemoUser[] | ((items: DemoUser[]) => DemoUser[]),
  ) => void;
  setActionLog: (log: string) => void;
};

// DATA-01: chỉ còn phone là field hồ sơ backend hỗ trợ; bỏ qua giá trị rỗng.
const FORM_TEXT_FIELDS = ["phone"] as const;

export function createUserActions({
  setUserList,
  setActionLog,
}: UserActionsParams) {
  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const body: Record<string, unknown> = {
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
      role: String(form.get("role") || "customer"),
      status: String(form.get("status") || "Đang hoạt động"),
    };
    for (const field of FORM_TEXT_FIELDS) {
      const value = String(form.get(field) || "").trim();
      if (value) body[field] = value;
    }

    const response = await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.message || "Không tạo được người dùng.");
      setActionLog(error.message);
      throw error;
    }
    setUserList((items) => [data.user, ...items]);
    setActionLog(`Đã tạo tài khoản "${data.user.name}".`);
    formEl.reset();
  }

  async function updateUser(id: string, updates: UserUpdatePayload) {
    const response = await apiFetch("/users", {
      method: "PATCH",
      body: JSON.stringify({ id, ...updates }),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(
        data.message || "Không cập nhật được người dùng.",
      );
      setActionLog(error.message);
      throw error;
    }
    setUserList((items) => items.map((u) => (u.id === id ? data.user : u)));
    setActionLog(`Đã cập nhật tài khoản "${data.user.name}".`);
  }

  async function deleteUser(id: string) {
    const response = await apiFetch(`/users/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.message || "Không xóa được người dùng.");
      setActionLog(error.message);
      throw error;
    }
    setUserList((items) => items.filter((u) => u.id !== id));
    setActionLog("Đã xóa tài khoản.");
  }

  return { createUser, updateUser, deleteUser };
}
