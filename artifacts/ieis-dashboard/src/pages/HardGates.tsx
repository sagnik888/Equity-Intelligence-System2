import { useState } from "react";
import { useListHardGates, useGetHardGateSummary } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, ShieldX, Shield, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<number, string> = {
  1: "bg-red-500/10 text-red-400 border-red-500/20",
  2: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  3: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};
const LEVEL_LABEL: Record<number, string> = { 1: "L1 Block", 2: "L2 Cap", 3: "L3 Penalty" };
const STATE_STYLE: Record<string, string> = {
  avoid: "bg-red-500/10 text-red-400 border-red-500/20",
  capped: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  penalized: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  pending_resolution: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export default function HardGates() {
  const [level, setLevel] = useState("all");

  const { data, isLoading } = useListHardGates({ level: level !== "all" ? level as any : undefined, limit: 100 });
  const { data: summary } = useGetHardGateSummary();

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">Hard Gate Monitor</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Defensive exclusion protocols — L1 Block · L2 Cap · L3 Penalty</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Level 1 — Blocked", count: summary?.level1_count ?? 0, icon: ShieldX, color: "text-red-400", sub: "Excluded from all systems" },
          { label: "Level 2 — Score Capped", count: summary?.level2_count ?? 0, icon: ShieldAlert, color: "text-amber-400", sub: "Cap applied to score" },
          { label: "Level 3 — Penalty", count: summary?.level3_count ?? 0, icon: Shield, color: "text-orange-400", sub: "Points deducted" },
        ].map(({ label, count, icon: Icon, color, sub }) => (
          <Card key={label} className="border-border">
            <CardContent className="p-4 flex items-start gap-3">
              <div className={cn("p-2 rounded-md bg-card border border-border mt-0.5", color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("text-2xl font-bold font-mono mt-0.5", color)}>{count}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By trigger */}
      {summary?.by_trigger && summary.by_trigger.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground self-center">Triggers:</span>
          {summary.by_trigger.slice(0, 8).map(t => (
            <Badge key={t.trigger} variant="outline" className={cn("text-[10px]", LEVEL_STYLE[t.level] ?? "")}>
              {t.trigger.replace(/_/g, " ")} ({t.count})
            </Badge>
          ))}
        </div>
      )}

      <Tabs value={level} onValueChange={setLevel}>
        <TabsList className="bg-card border border-border h-8">
          {[{ v: "all", l: "All" }, { v: "level1", l: "Level 1" }, { v: "level2", l: "Level 2" }, { v: "level3", l: "Level 3" }].map(({ v, l }) => (
            <TabsTrigger key={v} value={v} className="text-xs h-6 px-3 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">{l}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-card/50">
              {["Ticker", "Name", "Sector", "Level", "State", "Trigger", "Cap / Penalty", "Flagged", "Description"].map(h => (
                <th key={h} className={cn("py-2 px-3 text-muted-foreground font-medium whitespace-nowrap text-left")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-3 py-2"><Skeleton className="h-4" /></td>)}
                  </tr>
                ))
              : (data?.items ?? []).map((g, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors align-top">
                    <td className="px-3 py-2.5">
                      <Link href={`/universe/${g.isin}`}>
                        <span className="font-mono font-semibold text-primary cursor-pointer hover:underline">{g.ticker}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate">{g.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{g.sector}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={cn("text-[10px]", LEVEL_STYLE[g.level] ?? "")}>
                        {LEVEL_LABEL[g.level] ?? `L${g.level}`}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={cn("text-[10px]", STATE_STYLE[g.state] ?? "")}>
                        {g.state.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px]">{g.trigger.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2.5 font-mono">
                      {g.cap_score != null ? <span className="text-amber-400">{g.cap_score.toFixed(0)}</span>
                        : g.penalty_points != null ? <span className="text-orange-400">-{g.penalty_points.toFixed(0)}pt</span>
                        : <span className="text-red-400">BLOCKED</span>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{g.flagged_at}</td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[280px] text-[10px] leading-relaxed">{g.description}</td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!isLoading && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {data?.total ?? 0} active gates
          </div>
        )}
      </div>
    </div>
  );
}
