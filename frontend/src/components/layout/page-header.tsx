type PageHeaderProps = {
  /** Tiêu đề chính của trang — được render trong đúng một <h1>. */
  title: string;
  /** Mô tả ngắn dưới tiêu đề (không bắt buộc). */
  description?: string;
  /** Slot bên phải tiêu đề (các nút hành động, bộ lọc…). */
  actions?: React.ReactNode;
};

/**
 * Lớp tiêu đề trang truy cập được: render đúng một <h1> duy nhất cho trang,
 * kèm mô tả (tuỳ chọn) và khu vực hành động bên phải (tuỳ chọn).
 *
 * Là server component (không "use client", không hook, không event handler).
 * Style được viết inline bằng token thiết kế sẵn có (--fg, --fg-muted) nên
 * không cần chỉnh sửa globals.css.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header
      className="page-header"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: "12px",
        marginBottom: "16px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          className="page-header__title"
          style={{
            margin: 0,
            color: "var(--fg, #0f172a)",
            fontSize: "1.5rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        {description ? (
          <p
            className="page-header__desc"
            style={{
              margin: 0,
              marginTop: "2px",
              color: "var(--fg-muted, #64748b)",
              fontSize: "0.82rem",
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {actions}
        </div>
      ) : null}
    </header>
  );
}
