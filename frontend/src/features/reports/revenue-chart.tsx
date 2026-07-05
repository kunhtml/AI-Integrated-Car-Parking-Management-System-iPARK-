"use client";

export function RevenueChart({ data }: { data: any }) {
  if (!data || !data.labels || data.labels.length === 0) {
    return <p className="muted-cell">Không có dữ liệu doanh thu.</p>;
  }

  const maxVal = Math.max(...data.values, 1);

  return (
    <div className="panel-body" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.labels.map((label: string, idx: number) => {
          const val = data.values[idx] || 0;
          const pct = (val / maxVal) * 100;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 100, fontSize: "0.85rem", fontWeight: 500 }}>{label}</span>
              <div style={{ flex: 1, backgroundColor: "#f3f4f6", height: 20, borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    backgroundColor: "#3b82f6",
                    height: "100%",
                    width: `${pct}%`,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <span style={{ width: 120, fontSize: "0.85rem", textAlign: "right", fontWeight: 600 }}>
                {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
