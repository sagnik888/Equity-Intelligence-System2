import { useState } from "react";
import { useListBacktestResults, useGetBacktestResult, useGetFactorAnalysis } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FlaskConical, TrendingUp, TrendingDown, ArrowLeft, ChevronRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

const TYPE_STYLE: Record<string, string> = {
  candidate_score: "bg-primary/10 text-primary border-primary/20",
  daily_signal: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  weekly_signal: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  factor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};
const TYPE_LABEL: Record<string, string> = {
  candidate_score: "Candidate Score", daily_signal: "Daily Signal", factor: "Factor",
  weekly_signal: "Weekly Signal", monthly_signal: "Monthly Signal", portfolio_optimization: "Portfolio",
};

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className={cn("font-mono text-lg font-bold", color ?? "text-foreground")}>{value}</p>
    </div>
  );
}

function BacktestDetail({ id }: { id: number }) {
  const { data } = useGetBacktestResult(id);
  const [tab, setTab] = useState("equity");

  if (!data) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  const m = data.metrics;
  const cagr = m.cagr_pct ?? 0;
  const sharpe = m.sharpe_ratio ?? 0;
  const maxDrawdown = m.max_drawdown_pct ?? 0;
  const volatility = m.volatility_pct ?? 0;
  const curve = (data.equity_curve ?? []) as any[];
  const deciles = (data.decile_returns ?? []) as any[];

  return (
    <div>
      {/* Key metrics */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mb-5">
        <MetricCard label="CAGR" value={`${cagr >= 0 ? "+" : ""}${cagr.toFixed(1)}%`} color={cagr >= 0 ? "text-emerald-400" : "text-red-400"} />
        <MetricCard label="Excess Return" value={m.excess_return_pct != null ? `${m.excess_return_pct >= 0 ? "+" : ""}${m.excess_return_pct.toFixed(1)}%` : "—"} color={m.excess_return_pct != null && m.excess_return_pct >= 0 ? "text-emerald-400" : "text-red-400"} />
        <MetricCard label="Sharpe" value={sharpe.toFixed(2)} color={sharpe >= 1.5 ? "text-emerald-400" : sharpe >= 0.8 ? "text-amber-400" : "text-red-400"} />
        <MetricCard label="Sortino" value={m.sortino_ratio != null ? m.sortino_ratio.toFixed(2) : "—"} />
        <MetricCard label="Max DD" value={`${maxDrawdown.toFixed(1)}%`} color="text-red-400" />
        <MetricCard label="Calmar" value={m.calmar_ratio != null ? m.calmar_ratio.toFixed(2) : "—"} />
        <MetricCard label="Hit Rate" value={m.hit_rate_pct != null ? `${m.hit_rate_pct.toFixed(1)}%` : "—"} />
        <MetricCard label="Rank IC" value={m.rank_ic != null ? m.rank_ic.toFixed(4) : "—"} color={m.rank_ic != null && m.rank_ic > 0.03 ? "text-emerald-400" : "text-amber-400"} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card border border-border h-8 mb-4">
          {[{ v: "equity", l: "Equity Curve" }, { v: "deciles", l: "Decile Returns" }, { v: "stats", l: "Full Statistics" }].map(({ v, l }) => (
            <TabsTrigger key={v} value={v} className="text-xs h-6 px-3 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">{l}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="equity" className="mt-0">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={curve} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "#101623", border: "1px solid #1e293b", borderRadius: 6, fontSize: 11 }} />
              <Area type="monotone" dataKey="benchmark" name="Benchmark" stroke="#334155" fill="#334155" fillOpacity={0.2} strokeWidth={1} dot={false} />
              <Area type="monotone" dataKey="value" name="Strategy" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </TabsContent>
        <TabsContent value="deciles" className="mt-0">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={deciles} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="decile" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} label={{ value: "Decile (1=Best)", position: "insideBottom", offset: -2, style: { fontSize: 10, fill: "#64748b" } }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} unit="%" />
              <ReferenceLine y={0} stroke="#334155" />
              <Tooltip contentStyle={{ background: "#101623", border: "1px solid #1e293b", borderRadius: 6, fontSize: 11 }} formatter={(v: any) => [`${v}%`, "Return"]} />
              <Bar dataKey="return_pct" name="Annual Return" radius={[3, 3, 0, 0]}>
                {deciles.map((e, i) => <Cell key={i} fill={e.return_pct >= 0 ? "#10b981" : "#ef4444"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </TabsContent>
        <TabsContent value="stats" className="mt-0">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
            {[
              { l: "Volatility", v: `${volatility.toFixed(1)}%` },
              { l: "Drawdown Duration", v: m.drawdown_duration_days != null ? `${m.drawdown_duration_days}d` : "—" },
              { l: "Information Ratio", v: m.information_ratio?.toFixed(2) ?? "—" },
              { l: "Upside Capture", v: m.upside_capture_pct != null ? `${m.upside_capture_pct.toFixed(0)}%` : "—" },
              { l: "Downside Capture", v: m.downside_capture_pct != null ? `${m.downside_capture_pct.toFixed(0)}%` : "—" },
              { l: "Rank IC Stability", v: m.rank_ic_stability?.toFixed(2) ?? "—" },
              { l: "Decile Spread", v: m.decile_spread_pct != null ? `${m.decile_spread_pct.toFixed(1)}%` : "—" },
              { l: "Decile Monotonicity", v: m.decile_monotonicity_pct != null ? `${m.decile_monotonicity_pct.toFixed(0)}%` : "—" },
              { l: "Avg Turnover", v: m.turnover_pct != null ? `${m.turnover_pct.toFixed(0)}%` : "—" },
              { l: "Avg Slippage", v: m.avg_slippage_bps != null ? `${m.avg_slippage_bps.toFixed(0)}bps` : "—" },
              { l: "Deflated Sharpe", v: m.deflated_sharpe?.toFixed(2) ?? "—" },
              { l: "Prob. of Overfitting", v: m.probability_of_overfitting != null ? `${(m.probability_of_overfitting * 100).toFixed(1)}%` : "—" },
            ].map(({ l, v }) => (
              <div key={l} className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">{l}</span>
                <span className="font-mono">{v}</span>
              </div>
            ))}
          </div>
          {data.notes && (
            <div className="mt-4 p-3 rounded-lg bg-card border border-border">
              <p className="text-xs font-medium mb-1">Notes</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.notes}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Backtest() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, isLoading } = useListBacktestResults();
  const { data: factorData } = useGetFactorAnalysis();

  const results = data?.items ?? [];
  const selected = results.find(r => r.id === selectedId);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        {selectedId && (
          <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            All Results
          </button>
        )}
        {selectedId && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <div>
          <h1 className="text-xl font-bold">{selectedId ? selected?.name : "Backtest Results"}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Walk-forward backtest framework · CSCV overfitting protection</p>
        </div>
      </div>

      {selectedId ? (
        <BacktestDetail id={selectedId} />
      ) : (
        <>
          {/* Results list */}
          <div className="grid gap-4">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
              : results.map(r => (
                  <Card key={r.id} className="border-border cursor-pointer hover:border-primary/30 transition-all" onClick={() => setSelectedId(r.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold">{r.name}</span>
                            <Badge variant="outline" className={cn("text-[10px]", TYPE_STYLE[r.test_type] ?? "")}>
                              {TYPE_LABEL[r.test_type] ?? r.test_type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{r.period_from} → {r.period_to}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                      </div>
                      <div className="grid grid-cols-5 gap-3 mt-3">
                        {[
                          { l: "CAGR", v: `${r.cagr_pct >= 0 ? "+" : ""}${r.cagr_pct.toFixed(1)}%`, color: r.cagr_pct >= 0 ? "text-emerald-400" : "text-red-400" },
                          { l: "Sharpe", v: r.sharpe_ratio.toFixed(2), color: r.sharpe_ratio >= 1.5 ? "text-emerald-400" : r.sharpe_ratio >= 0.8 ? "text-amber-400" : "text-red-400" },
                          { l: "Max DD", v: `${r.max_drawdown_pct.toFixed(1)}%`, color: "text-red-400" },
                          { l: "Hit Rate", v: r.hit_rate_pct != null ? `${r.hit_rate_pct.toFixed(1)}%` : "—", color: "" },
                          { l: "Rank IC", v: r.rank_ic != null ? r.rank_ic.toFixed(4) : "—", color: r.rank_ic != null && r.rank_ic > 0.03 ? "text-emerald-400" : "" },
                        ].map(({ l, v, color }) => (
                          <div key={l}>
                            <p className="text-[10px] text-muted-foreground">{l}</p>
                            <p className={cn("font-mono font-semibold text-sm", color)}>{v}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>

          {/* Factor Analysis */}
          {factorData?.factors && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Factor Analysis — IC & Decile Spread</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-card/50">
                      {["Factor", "IC Mean", "IC Stability", "IC IR", "Decile Spread", "Sector Exp.", "Size Exp."].map(h => (
                        <th key={h} className={cn("py-2 px-3 text-muted-foreground font-medium", h === "Factor" ? "text-left" : "text-right")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {factorData.factors.map((f: any) => (
                      <tr key={f.factor_name} className="border-b border-border/50 hover:bg-white/[0.02]">
                        <td className="px-3 py-2 font-medium">{f.factor_name}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          <span className={cn(f.ic_mean > 0.04 ? "text-emerald-400" : f.ic_mean > 0.02 ? "text-amber-400" : "text-muted-foreground")}>
                            {f.ic_mean.toFixed(4)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{f.ic_stability.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          <span className={cn(f.ic_ir > 1.5 ? "text-emerald-400" : f.ic_ir > 0.8 ? "text-amber-400" : "text-muted-foreground")}>
                            {f.ic_ir.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{f.decile_spread_pct.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">{f.sector_exposure.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">{f.size_exposure.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
