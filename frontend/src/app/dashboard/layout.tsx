import Link from "next/link";
import { CalendarDays, Car, LayoutDashboard, ParkingCircle, Shield } from "lucide-react";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-white/10 bg-slate-950 px-6 py-6 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-500 p-3 text-white shadow-lg shadow-blue-500/30">
            <ParkingCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              iPARK admin
            </p>
            <h1 className="text-xl font-black tracking-tight">Dashboard</h1>
          </div>
        </div>

        <nav className="mt-10 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            <LayoutDashboard className="h-4 w-4" />
            Tổng quan
          </Link>
          <Link
            href="/dashboard/shifts"
            className="flex items-center gap-3 rounded-2xl border border-blue-400/30 bg-blue-500/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500/20"
          >
            <CalendarDays className="h-4 w-4" />
            Manage Work Shifts
          </Link>
          <Link
            href="/dashboard/vehicles"
            className="flex items-center gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500/20"
          >
            <Car className="h-4 w-4" />
            Verify Vehicles & RFID
          </Link>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
            <div className="mb-2 flex items-center gap-2 font-semibold text-slate-100">
              <Shield className="h-4 w-4" />
              Ghi chú
            </div>
            Luồng admin này đang được nối dần vào các màn quản trị khác.
          </div>
        </nav>
      </aside>

      <div className="bg-slate-100 text-slate-900">{children}</div>
    </div>
  );
}
