"use client";

export function TopCustomersTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <p className="muted-cell">Không có dữ liệu khách hàng.</p>;
  }

  return (
    <div className="table-wrap" style={{ marginTop: 16 }}>
      <table>
        <thead>
          <tr>
            <th>Khách hàng</th>
            <th>Email</th>
            <th>Số lượt gửi</th>
            <th>Tổng chi tiêu</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item: any, idx: number) => (
            <tr key={idx}>
              <td>
                <strong>{item.name}</strong>
              </td>
              <td>{item.email}</td>
              <td>{item.sessionCount} lượt</td>
              <td>
                {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(item.totalSpent || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
