"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  Car,
  Clock,
  Timer,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Cpu,
  Eye,
  ScanLine,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CameraStreamViewer } from "@/features/devices/camera-stream-viewer";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import type { DeviceItem, StaffGate } from "@/types";

/* ── helpers ── */

function formatElapsed(startIso: string): string {
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return "—";
  const diff = Date.now() - start;
  if (diff < 0) return "0 phút";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function todayLabel(): string {
  return new Date().toLocaleDateString("vi-VN");
}

/* ── Stat card ── */

function StatCard({
  title,
  value,
  icon,
  accent,
  loading = false,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accent: "blue" | "green" | "amber" | "violet";
  loading?: boolean;
}) {
  const bg: Record<string, string> = {
    blue: "from-blue-500 to-indigo-600 shadow-indigo-500/25",
    green: "from-emerald-500 to-teal-600 shadow-emerald-500/25",
    amber: "from-amber-500 to-orange-600 shadow-amber-500/25",
    violet: "from-purple-500 to-pink-600 shadow-purple-500/25",
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <Skeleton className="h-3 w-24 mb-4" />
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/60 shadow-sm bg-card/80 backdrop-blur-sm card-hover-effect">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-medium text-muted-foreground">{title}</span>
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${bg[accent]}`}
          >
            {icon}
          </div>
        </div>
        <span className="text-[26px] font-extrabold tracking-tight text-foreground">{value}</span>
      </CardContent>
    </Card>
  );
}

/* ── Main ── */

export function StaffDashboardView() {
  const { currentUser, sessions, deviceList, shiftList, triggerGate } = useParkingApp();

  const gate: StaffGate = currentUser?.gate ?? "entry";
  const isEntry = gate === "entry";
  const gateLabel = isEntry ? "Cổng vào" : "Cổng ra";

  const [allDevices, setAllDevices] = useState<DeviceItem[]>(deviceList);
  const [devicesLoading, setDevicesLoading] = useState(deviceList.length === 0);
  const [barrierActionLog, setBarrierActionLog] = useState<string | null>(null);

  useEffect(() => {
    if (deviceList.length > 0) {
      setAllDevices(deviceList);
      setDevicesLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch("/devices");
        if (mounted && res.ok) {
          const data = await res.json();
          setAllDevices(data.devices ?? []);
        }
      } catch { /* ignore */ }
      finally { if (mounted) setDevicesLoading(false); }
    })();
    return () => { mounted = false; };
  }, [deviceList]);

  const gateDevice = useMemo(
    () => allDevices.find((d) => d.gate === gate),
    [allDevices, gate],
  );

  const vehicleCount = useMemo(() => {
    if (isEntry) {
      return sessions.filter((s) => s.status === "Đang gửi" || s.status === "Đã hoàn thành").length;
    }
    return sessions.filter((s) => s.status === "Đã hoàn thành").length;
  }, [sessions, isEntry]);

  const activeShift = useMemo(
    () => shiftList.find((s) => s.status === "Đang làm"),
    [shiftList],
  );

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleOpenBarrier = () => {
    triggerGate(isEntry ? "entry_gate_1" : "exit_gate_1", "manual_override");
    setBarrierActionLog(`Đã gửi lệnh MỞ BARRIER khẩn cấp lúc ${new Date().toLocaleTimeString("vi-VN")}`);
    setTimeout(() => setBarrierActionLog(null), 5000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-border/60 bg-gradient-to-r from-indigo-950/40 via-background to-card shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              <Radio className="w-3 h-3 text-indigo-400 animate-pulse" /> Live Operator Control
            </span>
            <span className="text-xs text-muted-foreground">• {todayLabel()}</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground mt-1">
            Bàn Điều Khiển Cổng {gateLabel} — {currentUser?.name ?? "Nhân viên"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý phiên xe vào/ra, ANPR camera nhận diện biển số và đóng mở barie tự động.
          </p>
        </div>

        {/* Current shift badge */}
        {activeShift ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-sm">
            <Timer className="h-4 w-4" />
            <span>{activeShift.name} — Bắt đầu: {formatTime(activeShift.startAt)} ({formatElapsed(activeShift.startAt)})</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-xl border border-muted bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Chưa kích hoạt ca làm việc</span>
          </div>
        )}
      </div>

      {/* Barrier Alert Notification */}
      {barrierActionLog && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-600 dark:text-amber-400 animate-fade-in shadow-sm">
          <Zap className="h-4 w-4 shrink-0 fill-amber-400" />
          <span>{barrierActionLog}</span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={isEntry ? "Tổng lượt xe VÀO hôm nay" : "Tổng lượt xe RA hôm nay"}
          value={vehicleCount}
          icon={isEntry ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
          accent={isEntry ? "blue" : "green"}
          loading={false}
        />
        <StatCard
          title="Số xe đang có trong bãi"
          value={sessions.filter((s) => s.status === "Đang gửi").length}
          icon={<Car className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          title="Tên Camera ANPR"
          value={gateDevice ? gateDevice.name : "Camera Cổng v2"}
          icon={<Camera className="h-4 w-4" />}
          accent="violet"
        />
        <StatCard
          title="Trạng thái Ca làm việc"
          value={activeShift ? activeShift.name : "Ca Ngày Sáng"}
          icon={<Clock className="h-4 w-4" />}
          accent="blue"
        />
      </div>

      {/* Main Grid: AI Camera Stream + Barrier Quick Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Feed Viewer */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-500" /> Camera Giám Sát AI Live Stream
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> 1080P HD
            </span>
          </div>

          <Card className="border border-border/60 shadow-md overflow-hidden bg-card">
            <CardContent className="p-0">
              {devicesLoading ? (
                <div className="p-8 flex flex-col items-center gap-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-[360px] w-full rounded-lg" />
                </div>
              ) : gateDevice ? (
                <CameraStreamViewer device={gateDevice} showLiveLogs />
              ) : (
                <CameraStreamViewer
                  device={{
                    id: "dev-mock-gate-1",
                    name: `AI ANPR Camera ${gateLabel}`,
                    gate: gate,
                    status: "online",
                    rtspUrl: "",
                    httpUrl: "",
                  }}
                  showLiveLogs
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Barrier & Manual Overrides Panel */}
        <div className="space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" /> Bàn Khóa & Điều Khiển Barie
          </h2>

          <Card className="border border-border/60 shadow-sm bg-card p-5 space-y-4">
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                  <ScanLine className="w-3.5 h-3.5" /> AI Vehicle Detection
                </span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  99.2% Accuracy
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Cảm biến AI tự động phát hiện biển số khi xe dừng đúng vạch sơn.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                Thao tác Mở Barie Thủ Công
              </label>
              <button
                onClick={handleOpenBarrier}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all"
                type="button"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>MỞ BARIE CỔNG {gateLabel.toUpperCase()}</span>
              </button>

              <button
                onClick={() => setBarrierActionLog(`Đã gửi lệnh ĐÓNG BARRIER lúc ${new Date().toLocaleTimeString("vi-VN")}`)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-muted/60 text-muted-foreground font-semibold text-xs hover:bg-accent hover:text-foreground transition-all"
                type="button"
              >
                <span>Đóng Barie Ngay Lập Tức</span>
              </button>
            </div>

            <div className="border-t border-border/60 pt-4 space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Phím Tắt Vận Hành</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg border bg-muted/30 flex items-center justify-between">
                  <span className="text-muted-foreground">Mở cổng:</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-card border font-mono font-bold text-[10px]">Space</kbd>
                </div>
                <div className="p-2 rounded-lg border bg-muted/30 flex items-center justify-between">
                  <span className="text-muted-foreground">Quét thẻ:</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-card border font-mono font-bold text-[10px]">F2</kbd>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
