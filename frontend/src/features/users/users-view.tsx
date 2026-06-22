"use client";

import { UsersRound } from "lucide-react";

import { useParkingApp } from "@/context/parking-app-context";
import { roleLabels } from "@/lib/constants";

export function UsersView() {
  const { userList } = useParkingApp();

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p>Admin</p>
          <h2>Quản lý tài khoản</h2>
        </div>
        <UsersRound size={22} />
      </div>
      <div className="user-list">
        {userList.map((user) => (
          <div className="user-row" key={user.id}>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <span className="badge">{roleLabels[user.role]}</span>
            <span className="badge success">{user.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
