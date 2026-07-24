import { useGetPortfolioSummary, useListPortfolioPositions, useCalculatePositionSize } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, TrendingUp, TrendingDown, DollarSign, PieChart, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { PieChart as RPie, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const SECTOR_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ef4444", "#06b6d4", "#84cc16", "#f97316"];

const STATUS_STYLE: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  paper: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  closed: "bg-muted text-muted-foreground",
};
const SIG_STYLE: Record<string, string> = {
  strong_buy: "text-emerald-400", buy: "text-green-400", hold: "text-amber-400", sell: "text-orange-400", avoid: "text-red-400",
};

function fmt(v: number) {
  return v >= 10000000 ? `₹${(v / 10000000).toFixed(2)}Cr`
    : v >= 100000 ? `₹${(v / 100000).toFixed(1)}L`
    : `₹${v.toLocaleString("en-IN")}`;
}

export default function Portfolio() {
  const { data: summary } = useGetPortfolioSummary();
  const { data: positions, isLoading } = useListPortfolioPositions();

  const allPositions = positions?.items ?? [];
  const pnl = summary?.unrealized_pnl ?? 0;
  const pnlPct = summary?.unrealized_pnl_pct ?? 0;
  const pieData = summary?.sector_concentration?.slice(0, 6).map((s, i) => ({
    name: s.sector, value: s.weight_pct, fill: SECTOR_COLORS[i % SECTOR_COLORS.length]
  })) ?? [];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">Portfolio Manager</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Paper + live position tracking · POSITION_SIZING_V2</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Capital", value: summary?.total_capital ? fmt(summary.total_capital) : "—", icon: DollarSign, color: "text-blue-400" },
          { label: "Invested", value: summary?.invested_capital ? fmt(summary.invested_capital) : "—", icon: Briefcase, color: "text-amber-400" },
          { label: "Cash", value: summary?.cash ? fmt(summary.cash) : "—", icon: DollarSign, color: "text-muted-foreground" },
          {
            label: "Unrealized P&L",
            value: `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`,
            icon: pnlPct >= 0 ? TrendingUp : TrendingDown,
            color: pnlPct >= 0 ? "text-emerald-400" : "text-red-400"
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn("text-xl font-bold font-mono mt-1", color)}>{value}</p>
                </div>
                <Icon className={cn("h-4 w-4 mt-0.5", color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Sector Pie */}
        {pieData.length > 0 && (
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <PieChart className="h-3.5 w-3.5 text-primary" />
                Sector Concentration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <RPie>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} strokeWidth={0}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#101623", border: "1px solid #1e293b", borderRadius: 6, fontSize: 11 }}
                    formatter={(v: any) => [`${(+v).toFixed(1)}%`, "Weight"]}
                  />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                </RPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Review required */}
        <div className="col-span-2">
          {summary?.review_required && summary.review_required.length > 0 && (
            <Card className="border-red-500/20 bg-red-500/5 mb-4">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <span className="text-xs text-red-400 font-medium">{summary.review_required.length} position(s) require review — signal changed to Sell/Avoid</span>
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Position Summary</div>
          <div className="grid grid-cols-2 gap-2">
            <Card className="border-border">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">Open Positions</p>
                <p className="text-2xl font-bold font-mono text-emerald-400">{summary?.open_positions ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">Paper Positions</p>
                <p className="text-2xl font-bold font-mono text-blue-400">{summary?.paper_positions ?? 0}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Positions table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-card/50">
              {["Ticker", "Name", "Sector", "Horizon", "Status", "Qty", "Entry", "Current", "Stop", "P&L", "P&L%", "Signal", "Suit."].map(h => (
                <th key={h} className={cn("py-2 px-3 text-muted-foreground font-medium whitespace-nowrap", h === "Ticker" ? "text-left" : "text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 13 }).map((_, j) => <td key={j} className="px-3 py-2"><Skeleton className="h-4" /></td>)}
                  </tr>
                ))
              : allPositions.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2.5">
                      <Link href={`/universe/${p.isin}`}>
                        <span className="font-mono font-semibold text-primary cursor-pointer hover:underline">{p.ticker}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground max-w-[120px] truncate">{p.name}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{p.sector}</td>
                    <td className="px-3 py-2.5 text-right capitalize">{p.horizon}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[p.status] ?? "")}>{p.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{p.quantity}</td>
                    <td className="px-3 py-2.5 text-right font-mono">₹{p.entry_price.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right font-mono">₹{p.current_price.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                      {p.stop_price ? `₹${p.stop_price.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <span className={p.unrealized_pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {p.unrealized_pnl >= 0 ? "+" : ""}₹{Math.abs(p.unrealized_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <span className={p.unrealized_pnl_pct >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {p.unrealized_pnl_pct >= 0 ? "+" : ""}{p.unrealized_pnl_pct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {p.current_signal ? (
                        <span className={cn("capitalize font-medium text-[10px]", SIG_STYLE[p.current_signal] ?? "text-muted-foreground")}>
                          {p.current_signal.replace("_", " ")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {p.suitability_score != null ? p.suitability_score.toFixed(1) : "—"}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!isLoading && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {allPositions.length} positions
          </div>
        )}
      </div>
    </div>
  );
}
