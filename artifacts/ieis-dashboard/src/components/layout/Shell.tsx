import { Link, useRoute, useLocation } from "wouter";
import {
  LayoutDashboard, Globe2, Zap, BarChart3, ShieldAlert,
  Briefcase, Microscope, BookMarked, FlaskConical, ScrollText,
  ChevronRight, Activity, Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetDashboardAlerts } from "@workspace/api-client-react";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { path: "/",           label: "Dashboard",    icon: LayoutDashboard, hint: "Cockpit" },
  { path: "/universe",   label: "Universe",     icon: Globe2,          hint: "2,000+ stocks" },
  { path: "/signals",    label: "Signals",      icon: Zap,             hint: "5 horizons" },
  { path: "/rankings",   label: "Rankings",     icon: BarChart3,       hint: "17 dimensions" },
  { path: "/hardgates",  label: "Hard Gates",   icon: ShieldAlert,     hint: "Exclusion engine" },
   { path: "/portfolio",  label: "Portfolio",    icon: Briefcase,       hint: "Paper only" },
  { path: "/research",   label: "Research",     icon: Microscope,      hint: "Deep coverage" },
  { path: "/watchlists", label: "Watchlists",   icon: BookMarked,      hint: "Smart lists" },
  { path: "/backtest",   label: "Backtest",     icon: FlaskConical,    hint: "Walk-forward" },
  { path: "/audit",      label: "Audit",        icon: ScrollText,      hint: "Time-machine" },
];

function NavItem({ path, label, icon: Icon, hint }: typeof NAV_ITEMS[number]) {
  const [isActive] = useRoute(path === "/" ? "/" : `${path}*` as any);
  return (
    <Link href={path}>
      <div className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all",
        "hover:bg-white/5",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
      )}>
        <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
        <span className="flex-1 text-sm font-medium">{label}</span>
        {isActive && <ChevronRight className="h-3 w-3 text-primary opacity-60" />}
      </div>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { data: alertsData } = useGetDashboardAlerts({ limit: 50 });
  const unreadCount = alertsData?.unread_count ?? 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-sidebar">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Activity className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground tracking-wide">IEIS</div>
              <div className="text-[10px] text-muted-foreground">v7.2 · Paper Mode</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-0.5">
            {NAV_ITEMS.map(item => (
              <NavItem key={item.path} {...item} />
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Alerts</span>
            </div>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-4 text-[10px] px-1.5 py-0">{unreadCount}</Badge>
            )}
          </div>
           <div className="mt-2 flex items-center gap-1.5">
             <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
             <span className="text-[10px] text-muted-foreground">Alert + paper · live disabled</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="min-h-full">
            {children}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
