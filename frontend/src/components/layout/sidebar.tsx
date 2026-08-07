"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeft, ShieldAlert, Cpu, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavItemsForRole, navGroupLabels, type NavGroup } from "@/config/nav-items";
import { parkingConfig } from "@/lib/parking-config";
import { useSidebar } from "./sidebar-provider";
import type { DemoUser } from "@/types";

type SidebarProps = {
  currentUser: DemoUser;
  onLogout: () => void;
};

const groupOrder: NavGroup[] = ["overview", "management", "users", "system"];

export function Sidebar({ currentUser, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();
  const navItems = getNavItemsForRole(currentUser.role);

  const grouped = groupOrder
    .map((group) => ({
      group,
      label: navGroupLabels[group],
      items: navItems.filter((item) => item.group === group),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-screen flex-col transition-all duration-300 ease-out",
          "lg:sticky lg:z-auto",
          // Deep Dark Cyber Accent Background
          "bg-gradient-to-b from-[#090d16] via-[#0b0f19] to-[#05070d] border-r border-white/[0.08]",
          collapsed ? "w-[72px]" : "w-[264px]",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Logo & Title */}
        <div className={cn(
          "flex h-16 items-center border-b border-white/[0.08] px-4 shrink-0",
          collapsed ? "justify-center" : "justify-between"
        )}>
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white font-black text-lg shadow-lg shadow-indigo-500/30">
              <span className="tracking-tighter">iP</span>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            {!collapsed && (
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-extrabold tracking-tight text-white">
                    {parkingConfig.brandName}
                  </span>
                  <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300 border border-indigo-500/30 flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> AI v2.5
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium tracking-wide">AI Parking Command Center</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
          {grouped.map(({ group, label, items }) => (
            <div key={group}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-300/40">
                  {label}
                </p>
              )}

              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.path;
                  return (
                    <Link
                      key={item.id}
                      href={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white shadow-md shadow-indigo-500/20"
                          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        size={18}
                        className={cn(
                          "shrink-0 transition-transform duration-200 group-hover:scale-110",
                          active ? "text-white" : "text-slate-400 group-hover:text-indigo-300"
                        )}
                      />
                      {!collapsed && <span className="truncate tracking-wide">{item.label}</span>}
                      {active && !collapsed && (
                        <span className="ml-auto h-2 w-2 rounded-full bg-white shadow-sm shadow-white/80" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* AI Camera System Widget */}
        {!collapsed && (
          <div className="mx-3 my-2 rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-3 text-xs">
            <div className="flex items-center justify-between font-semibold text-indigo-200 mb-1">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> AI ANPR Status
              </span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span>FPS: <strong className="text-white">30.0</strong></span>
              <span>Độ chính xác: <strong className="text-emerald-400">98.8%</strong></span>
            </div>
          </div>
        )}

        {/* Footer & User Profile */}
        <div className="border-t border-white/[0.08] px-3 py-3 space-y-2 shrink-0 bg-black/20">
          <button
            onClick={toggle}
            className={cn(
              "hidden lg:flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-slate-400 hover:bg-white/[0.06] hover:text-white transition-all w-full",
              collapsed && "justify-center px-0"
            )}
            type="button"
          >
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span className="text-xs font-medium">Thu gọn Sidebar</span>}
          </button>

          <div className={cn(
            "flex items-center gap-3 px-2 py-1.5 rounded-xl border border-white/[0.04] bg-white/[0.02]",
            collapsed && "justify-center"
          )}>
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-xs font-bold text-white shadow-sm ring-2 ring-emerald-400/20">
              {currentUser.name?.charAt(0)?.toUpperCase() || "A"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{currentUser.name}</p>
                <p className="truncate text-[10px] text-indigo-300 uppercase tracking-wider font-bold">{currentUser.role}</p>
              </div>
            )}
          </div>

          <button
            onClick={onLogout}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all",
              collapsed && "justify-center px-0"
            )}
            type="button"
            title="Đăng xuất"
          >
            <LogOut size={18} className="shrink-0 text-red-400/70" />
            {!collapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
