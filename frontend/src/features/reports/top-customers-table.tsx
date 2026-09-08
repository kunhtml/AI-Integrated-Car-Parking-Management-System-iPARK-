"use client";

import { Users } from "lucide-react";
import { currency } from "@/lib/constants";
import type { TopCustomer } from "@/types";

export function TopCustomersTable({ data }: { data: TopCustomer[] }) {
  if (!data.length) {
    return <p className="muted-cell">Nhấn "Tải dữ liệu" để xem top khách hàng.</p>;
  }

  return (
    <div>
      <div className="panel-heading">
        <div><p>Khách hàng</p><h2>Top khách hàng thân thiết</h2></div>
        <Users size={20} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tên</th>
              <th>Email</th>
              <th>Số phiên</th>
              <th>Tổng chi tiêu</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c, i) => (
              <tr key={c.userId}>
                <td>{i + 1}</td>
                <td><strong>{c.name}</strong></td>
                <td>{c.email || "—"}</td>
                <td>{c.sessionCount}</td>
                <td>{currency.format(c.totalSpent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
