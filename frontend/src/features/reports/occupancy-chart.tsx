"use client";

export function OccupancyChart({ data }: { data: any }) {
  if (!data || data.length === 0) {
    return <p className="muted-cell">Không có dữ liệu lấp đầy.</p>;
  }

  const maxOccupancy = Math.max(...data.map((d: any) => d.occupancy), 1);

  return (
    <div className="panel-body" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((item: any, idx: number) => {
          const val = item.occupancy || 0;
          const pct = (val / maxOccupancy) * 100;
          return (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 100, fontSize: "0.85rem", fontWeight: 500 }}>
                {item.hour !== undefined ? `${item.hour}h` : item.label}
              </span>
              <div style={{ flex: 1, backgroundColor: "#f3f4f6", height: 20, borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    backgroundColor: "#10b981",
                    height: "100%",
                    width: `${pct}%`,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <span style={{ width: 120, fontSize: "0.85rem", textAlign: "right", fontWeight: 600 }}>
                {val} lượt
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
