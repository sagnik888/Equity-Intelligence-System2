import { useGetDashboardSummary, useGetDashboardAlerts, useGetRecentChanges, useGetSectorBreakdown, useMarkDashboardAlertRead } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Globe2, Zap, ShieldAlert, AlertTriangle, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Minus, Bell, RefreshCw, BarChart3, Check
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const stateColor: Record<string, string> = {
  strong_buy: "text-emerald-400",
  buy: "text-green-400",
  hold: "text-amber-400",
  sell: "text-orange-400",
  avoid: "text-red-500",
};
const stateBadge: Record<string, string> = {
  strong_buy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  buy: "bg-green-500/10 text-green-400 border-green-500/20",
  hold: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  sell: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  avoid: "bg-red-500/10 text-red-400 border-red-500/20",
};

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = score >= 70 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  return <span className={cn("font-mono text-xs font-semibold", color)}>{score.toFixed(1)}</span>;
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={cn("text-2xl font-bold font-mono", color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={cn("p-2 rounded-md bg-card border border-border", color)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: alertsData } = useGetDashboardAlerts({ limit: 8 });
  const { data: changesData } = useGetRecentChanges({ limit: 8 });
  const { data: sectorData } = useGetSectorBreakdown();
  const markAlertRead = useMarkDashboardAlertRead();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      </div>
    );
  }

  const s = summary;
  const alerts = alertsData?.items ?? [];
  const changes = changesData?.items ?? [];
  const sectors = sectorData?.sectors?.slice(0, 8) ?? [];

  const totalSignals = (s?.signal_snapshot.daily_strong_buy ?? 0)
    + (s?.signal_snapshot.daily_buy ?? 0)
    + (s?.signal_snapshot.daily_accumulate ?? 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">System Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            IEIS v7.2 · {s?.score_date ?? "—"} · <span className="text-amber-400 font-medium">{s?.system_mode?.toUpperCase() ?? "ALERT"} MODE</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          Auto-refresh 60s
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Universe" value={s?.universe_snapshot.total_securities ?? "—"} sub={`${s?.universe_snapshot.investable ?? 0} investable`} icon={Globe2} color="text-blue-400" />
        <StatCard label="Buy Signals (Daily)" value={totalSignals} sub={`${s?.signal_snapshot.daily_strong_buy ?? 0} strong buy · ${s?.signal_snapshot.daily_accumulate ?? 0} accumulate`} icon={Zap} color="text-emerald-400" />
        <StatCard label="Hard Gates Active" value={(s?.universe_snapshot.level1_gates ?? 0) + (s?.universe_snapshot.level2_gates ?? 0)} sub={`${s?.universe_snapshot.level1_gates ?? 0} blocked · ${s?.universe_snapshot.level2_gates ?? 0} capped`} icon={ShieldAlert} color="text-red-400" />
        <StatCard label="Data Confidence" value={`${(s?.data_quality.high_confidence_pct ?? 0).toFixed(1)}%`} sub={`${s?.data_quality.stale_data_count ?? 0} stale`} icon={BarChart3} color="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Candidates */}
        <Card className="border-border col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Top Candidates</CardTitle>
              <Link href="/scores"><span className="text-xs text-primary cursor-pointer hover:underline">View all →</span></Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">#</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Stock</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Sector</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Score</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Quality</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Growth</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Value</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">DC</th>
                </tr>
              </thead>
              <tbody>
                {(s?.top_candidates ?? []).map((c, i) => (
                  <tr key={c.isin} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2 text-muted-foreground font-mono">{i + 1}</td>
                    <td className="px-4 py-2">
                      <Link href={`/universe/${c.isin}`}>
                        <div className="cursor-pointer hover:text-primary transition-colors">
                          <div className="font-semibold font-mono">{c.ticker}</div>
                          <div className="text-muted-foreground truncate max-w-[120px]">{c.name}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{c.sector}</td>
                    <td className="px-4 py-2 text-right"><ScoreBadge score={c.candidate_score} /></td>
                    <td className="px-4 py-2 text-right"><ScoreBadge score={c.quality_score} /></td>
                    <td className="px-4 py-2 text-right"><ScoreBadge score={c.growth_score} /></td>
                    <td className="px-4 py-2 text-right"><ScoreBadge score={c.value_score} /></td>
                    <td className="px-4 py-2 text-right">
                      <span className={cn("font-mono text-xs", c.data_confidence >= 80 ? "text-emerald-400" : c.data_confidence >= 65 ? "text-amber-400" : "text-red-400")}>
                        {c.data_confidence.toFixed(0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Alerts + Changes */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-amber-400" />
                  Alerts
                  {(alertsData?.unread_count ?? 0) > 0 && (
                    <Badge className="h-4 text-[10px] px-1.5 bg-red-500/20 text-red-400 border-red-500/20">
                      {alertsData!.unread_count}
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {alerts.slice(0, 5).map(a => (
                  <div key={a.id} className={cn("px-4 py-2.5", !a.is_read && "bg-primary/5")}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={cn("h-3 w-3 mt-0.5 shrink-0",
                        a.severity === "critical" ? "text-red-400" : a.severity === "high" ? "text-orange-400" : "text-amber-400"
                      )} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{a.message}</p>
                      </div>
                       {!a.is_read && (
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-6 w-6 shrink-0 text-muted-foreground"
                           aria-label={`Acknowledge ${a.title}`}
                           onClick={() => markAlertRead.mutate({ id: a.id })}
                         >
                           <Check className="h-3 w-3" />
                         </Button>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Recent Changes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {changes.slice(0, 5).map((c, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                    {c.change_type.includes("upgrade") ? (
                      <ArrowUpRight className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : c.change_type.includes("downgrade") ? (
                      <ArrowDownRight className="h-3 w-3 text-red-400 shrink-0" />
                    ) : (
                      <Minus className="h-3 w-3 text-amber-400 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-semibold">{c.ticker}</span>
                        {c.horizon && <span className="text-[10px] text-muted-foreground">{c.horizon}</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {c.old_value} → <span className="text-foreground">{c.new_value}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sector chart */}
      {sectors.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Sector Overview — Avg Candidate Score</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sectors} margin={{ left: -20, right: 8, top: 4, bottom: 4 }}>
                <XAxis dataKey="sector" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "#101623", border: "1px solid #1e293b", borderRadius: 6, fontSize: 11 }}
                  itemStyle={{ color: "#f59e0b" }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="avg_candidate_score" name="Avg Score" radius={[3, 3, 0, 0]}>
                  {sectors.map((entry, index) => (
                    <Cell key={index}
                      fill={entry.avg_candidate_score >= 70 ? "#10b981" : entry.avg_candidate_score >= 50 ? "#f59e0b" : "#ef4444"}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
