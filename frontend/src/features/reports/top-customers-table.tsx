import React from "react";
import { TopCustomer } from "@/types";
import { currency } from "@/lib/constants";

export function TopCustomersTable({ data }: { data: TopCustomer[] }) {
  if (!data || data.length === 0) {
    return <p className="muted-cell text-slate-500 text-sm">Chưa có dữ liệu khách hàng thân thiết.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mt-4">
      <h3 className="text-sm font-bold text-slate-900 mb-4">Top khách hàng gửi xe nhiều nhất</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Họ và tên</th>
              <th>Biển số</th>
              <th>Số lượt gửi</th>
              <th>Tổng chi tiêu</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c, index) => (
              <tr key={index}>
                <td><strong>{c.name}</strong></td>
                <td>{c.plate || "N/A"}</td>
                <td>{c.sessions} lượt</td>
                <td><strong className="text-blue-600">{currency.format(c.revenue)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
