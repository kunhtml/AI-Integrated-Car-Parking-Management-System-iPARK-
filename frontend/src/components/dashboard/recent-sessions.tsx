"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  plate: string;
  zone?: string;
  entryTime: string;
  status: "active" | "completed" | "overdue";
  ownerName?: string;
}

interface RecentSessionsProps {
  sessions: Session[];
  loading?: boolean;
  maxRows?: number;
}

const statusConfig = {
  active: { label: "Đang gửi", variant: "default" as const },
  completed: { label: "Hoàn thành", variant: "success" as const },
  overdue: { label: "Quá hạn", variant: "destructive" as const },
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function RecentSessions({
  sessions,
  loading = false,
  maxRows = 5,
}: RecentSessionsProps) {
  if (loading) return <TableSkeleton rows={maxRows} />;

  const displaySessions = sessions.slice(0, maxRows);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-[15px] font-semibold">Phiên gần đây</CardTitle>
        <Link
          href="/dashboard/sessions"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Xem tất cả
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {displaySessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Chưa có phiên nào.
          </p>
        ) : (
          <div className="space-y-3">
            {displaySessions.map((session) => {
              const status = statusConfig[session.status];
              return (
                <div
                  key={session.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-bold shrink-0">
                      {session.plate.slice(-3)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{session.plate}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.zone && `${session.zone} · `}
                        {formatTime(session.entryTime)}
                        {session.ownerName && ` · ${session.ownerName}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
