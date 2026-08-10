import { LogOut, Menu } from "lucide-react";

function useBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const labelMap: Record<string, string> = {
    dashboard: "Dashboard",
    overview: "Tổng quan",
    vehicles: "Phương tiện",
    sessions: "Phiên gửi xe",
    "membership-packages": "Gói đăng ký",
    wallet: "Ví điện tử",
    users: "Người dùng",
    staff: "Bàn điều khiển Cổng",
    "parking-fee-rules": "Cấu hình phí",
    zones: "Sơ đồ bãi đỗ",
    "revenue-reports": "Báo cáo doanh thu",
    "rfid-cards": "Thẻ RFID",
    "rfid-operations": "Vận hành RFID",
    "rfid-reports": "Báo cáo RFID",
    devices: "Camera & AI Gate",
    ai: "Nhận diện AI ANPR",
    "recognition-logs": "Nhật ký AI",
    shifts: "Ca làm việc",
    incidents: "Sự cố Bãi xe",
    feedback: "Phản hồi khách",
    notifications: "Thông báo",
    security: "Bảo mật",
    "audit-logs": "Nhật ký hệ thống",
    invoices: "Hóa đơn",
    backups: "Sao lưu",
    privacy: "Quyền riêng tư",
    "change-password": "Đổi mật khẩu",
    "assisted-registration": "Đăng ký hộ",
    profile: "Hồ sơ cá nhân",
    reports: "Báo cáo tổng hợp",
  };

  return segments.map((seg) => ({
    label: labelMap[seg] ?? seg,
    href: "/" + segments.slice(0, segments.indexOf(seg) + 1).join("/"),
  }));
}

export function AppHeader() {
  const { toggle, setMobileOpen } = useSidebar();
  const { triggerGate } = useParkingApp();
  const breadcrumbs = useBreadcrumbs();
  const [quickNotif, setQuickNotif] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6 shadow-sm">
      {/* Mobile menu toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        type="button text-xs"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Mở menu</span>
      </button>

      {/* Desktop sidebar toggle */}
      <button
        onClick={toggle}
        className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        type="button"
      >
        <PanelLeft className="h-4 w-4" />
        <span className="sr-only">Thu/Mở sidebar</span>
      </button>

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-medium">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground/30 font-bold">/</span>}
            <span
              className={cn(
                i === breadcrumbs.length - 1
                  ? "font-bold text-foreground text-sm tracking-tight"
                  : "text-muted-foreground hover:text-foreground transition-colors"
              )}
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Center Search Input */}
      <div className="hidden md:flex items-center gap-2 ml-6 max-w-sm flex-1">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm biển số, thẻ RFID, chủ xe... (Ctrl+K)"
            className="w-full h-9 rounded-xl border border-border/70 bg-muted/40 pl-9 pr-4 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-background transition-all"
          />
        </div>
      </div>

      {/* Actions & Utilities */}
      <div className="ml-auto flex items-center gap-2">
        {/* Emergency Barrier Gate Trigger */}
        <button
          onClick={() => triggerGate("entry_gate_1", "manual_override")}
          className="hidden sm:flex items-center gap-1.5 h-9 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all shadow-sm"
          type="button"
          title="Mở Barie Khẩn Cấp"
        >
          <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500 animate-bounce" />
          <span>Mở Cổng Khẩn Cấp</span>
        </button>

        {/* Notifications Icon with Badge */}
        <button
          onClick={() => setQuickNotif(!quickNotif)}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          type="button"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-background animate-pulse" />
        </button>

        {/* Theme Toggle Button */}
        <ThemeToggle />
      </div>
    </header>
  );
}
