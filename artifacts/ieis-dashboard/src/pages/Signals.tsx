import { useState } from "react";
import { useListSignals, useGetSignalStateSummary, useGetTopBuySignals } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const HORIZONS = ["all", "daily", "weekly", "monthly", "medium", "long"];
const STATES = ["strong_buy", "buy", "hold", "sell", "avoid"];
const STATE_STYLE: Record<string, string> = {
  strong_buy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  buy: "bg-green-500/10 text-green-400 border-green-500/20",
  hold: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  sell: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  avoid: "bg-red-500/10 text-red-400 border-red-500/20",
};
const STATE_LABEL: Record<string, string> = {
  strong_buy: "Strong Buy", buy: "Buy", hold: "Hold", sell: "Sell", avoid: "Avoid", pending_review: "Pending",
};

function HssBar({ value }: { value: number }) {
  const color = value >= 75 ? "bg-emerald-500" : value >= 58 ? "bg-green-500" : value >= 42 ? "bg-amber-500" : value >= 28 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-xs w-8 text-right">{value.toFixed(0)}</span>
    </div>
  );
}

export default function Signals() {
  const [horizon, setHorizon] = useState("all");
  const [state, setState] = useState("all");

  const { data, isLoading } = useListSignals({
    horizon: horizon !== "all" ? horizon as any : undefined,
    state: state !== "all" ? state as any : undefined,
    limit: 100,
  });
  const { data: summary } = useGetSignalStateSummary();
  const { data: topBuys } = useGetTopBuySignals({ limit: 5 });

  const byHorizon = summary?.by_horizon ?? [];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">Signal Monitor</h1>
        <p className="text-xs text-muted-foreground mt-0.5">HSS-driven state machine · 5 horizons</p>
      </div>

      {/* Horizon summary grid */}
      <div className="grid grid-cols-5 gap-3">
        {["daily", "weekly", "monthly", "medium", "long"].map(h => {
          const row = byHorizon.find(r => r.horizon === h);
          const sb = row?.strong_buy ?? 0;
          const b = row?.buy ?? 0;
          const total = sb + b + (row?.hold ?? 0) + (row?.sell ?? 0) + (row?.avoid ?? 0);
          return (
            <Card key={h} className="border-border cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setHorizon(h)}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 font-medium">{h}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-xl font-bold font-mono text-emerald-400">{sb}</span>
                  <span className="text-xs text-muted-foreground">/ {sb + b} buys</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {sb > 0 && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1 rounded">{sb} S-Buy</span>}
                  {b > 0 && <span className="text-[9px] bg-green-500/10 text-green-400 px-1 rounded">{b} Buy</span>}
                  <span className="text-[9px] text-muted-foreground">{total} total</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top Buys */}
      {topBuys && topBuys.items.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              Top Strong Buys Today
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex gap-4 px-4 py-3 overflow-x-auto">
              {topBuys.items.slice(0, 5).map(s => (
                <Link key={s.isin} href={`/universe/${s.isin}`}>
                  <div className="shrink-0 w-36 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 transition-colors">
                    <div className="font-mono font-semibold text-sm text-emerald-400">{s.ticker}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{s.name}</div>
                    <div className="mt-2 font-mono text-xl font-bold">{s.hss.toFixed(0)}</div>
                    <div className="text-[10px] text-muted-foreground">HSS · {s.confidence.toFixed(0)}% conf</div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <Tabs value={horizon} onValueChange={setHorizon}>
          <TabsList className="bg-card border border-border h-8">
            {HORIZONS.map(h => (
              <TabsTrigger key={h} value={h} className="text-xs capitalize h-6 px-2.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                {h === "all" ? "All" : h}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="w-36 h-8 text-xs bg-card border-border">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {STATES.map(s => <SelectItem key={s} value={s}>{STATE_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Signals table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-card/50">
              {["Ticker", "Name", "Sector", "Horizon", "State", "HSS", "Confidence", "Candidate", "Days", "Price"].map(h => (
                <th key={h} className={cn("py-2 px-3 text-muted-foreground font-medium whitespace-nowrap", h === "Ticker" ? "text-left" : "text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 10 }).map((_, j) => <td key={j} className="px-3 py-2"><Skeleton className="h-4" /></td>)}
                  </tr>
                ))
              : (data?.items ?? []).map((sig, i) => (
                  <tr key={`${sig.isin}-${sig.horizon}`} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2">
                      <Link href={`/universe/${sig.isin}`}>
                        <span className="font-mono font-semibold text-primary cursor-pointer hover:underline">{sig.ticker}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground max-w-[120px] truncate">{sig.name}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{sig.sector}</td>
                    <td className="px-3 py-2 text-right capitalize">{sig.horizon}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="outline" className={cn("text-[10px] px-1.5", STATE_STYLE[sig.state] ?? "")}>
                        {STATE_LABEL[sig.state] ?? sig.state}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right min-w-[100px]">
                      <HssBar value={sig.hss} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span className={cn(sig.confidence >= 80 ? "text-emerald-400" : sig.confidence >= 65 ? "text-amber-400" : "text-red-400")}>
                        {sig.confidence.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {sig.candidate_score != null ? sig.candidate_score.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{sig.days_in_state}d</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {sig.current_price != null ? `₹${sig.current_price.toLocaleString("en-IN")}` : "—"}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!isLoading && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {data?.total ?? 0} signals
          </div>
        )}
      </div>
    </div>
  );
}
