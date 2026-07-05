"use client";

export function PeakHoursHeatmap({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <p className="muted-cell">Không có dữ liệu giờ cao điểm.</p>;
  }

  // Find max count to scale colors
  const maxCount = Math.max(...data.map((d: any) => d.count), 1);

  // Group by day of week (0-6) and hour (0-23) if detailed, or just render list
  return (
    <div className="panel-body" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {data.map((item: any, idx: number) => {
          const intensity = Math.min(0.1 + (item.count / maxCount) * 0.9, 1);
          return (
            <div
              key={idx}
              style={{
                padding: "8px 12px",
                borderRadius: 4,
                backgroundColor: `rgba(239, 68, 68, ${intensity})`,
                color: intensity > 0.5 ? "#fff" : "#000",
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: 60,
              }}
            >
              <span>{item.hour}h</span>
              <span style={{ fontSize: "0.75rem", opacity: 0.9 }}>{item.count} xe</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
