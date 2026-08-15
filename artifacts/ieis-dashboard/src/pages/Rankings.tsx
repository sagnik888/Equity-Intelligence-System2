import { useState } from "react";
import { useListRankings, type ListRankingsDimension } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const DIMENSIONS = [
  { value: "overall", label: "Overall" },
  { value: "quality", label: "Quality" },
  { value: "sector", label: "Sector" },
  { value: "market_cap", label: "Market Cap" },
  { value: "persistence", label: "Persistence" },
];

export default function Rankings() {
  const [dimension, setDimension] = useState("overall");

  const { data, isLoading } = useListRankings({ dimension: dimension as ListRankingsDimension, limit: 50 });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">Cross-Sectional Rankings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">17-dimension composite ranking engine</p>
      </div>

      <Tabs value={dimension} onValueChange={setDimension}>
        <TabsList className="bg-card border border-border h-8">
          {DIMENSIONS.map(d => (
            <TabsTrigger key={d.value} value={d.value} className="text-xs h-6 px-3 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-card/50">
              {["Rank", "Δ", "Ticker", "Name", "Sector", "Group", "Score", "Percentile"].map(h => (
                <th key={h} className={cn("py-2 px-3 text-muted-foreground font-medium whitespace-nowrap", ["Rank", "Δ"].includes(h) ? "text-center" : h === "Ticker" ? "text-left" : "text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 15 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-3 py-2"><Skeleton className="h-4" /></td>)}
                  </tr>
                ))
              : (data?.items ?? []).map(r => (
                  <tr key={r.isin} className={cn(
                    "border-b border-border/50 hover:bg-white/[0.02] transition-colors",
                    r.rank <= 3 && "bg-primary/5"
                  )}>
                    <td className="px-3 py-2 text-center">
                      <span className={cn("font-mono font-bold text-sm",
                        r.rank === 1 ? "text-amber-400" : r.rank === 2 ? "text-slate-400" : r.rank === 3 ? "text-orange-700" : "text-muted-foreground"
                      )}>#{r.rank}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {(r.rank_change ?? 0) > 0
                        ? <TrendingUp className="h-3 w-3 text-emerald-400 inline" />
                        : (r.rank_change ?? 0) < 0
                        ? <TrendingDown className="h-3 w-3 text-red-400 inline" />
                        : <Minus className="h-3 w-3 text-muted-foreground inline" />}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/universe/${r.isin}`}>
                        <span className="font-mono font-semibold text-primary cursor-pointer hover:underline">{r.ticker}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground max-w-[140px] truncate">{r.name}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{r.sector}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="outline" className="text-[10px] px-1.5">{r.universe_group?.replace("_cap", "")}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{r.score.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn("font-mono", r.percentile >= 80 ? "text-emerald-400" : r.percentile >= 50 ? "text-amber-400" : "text-red-400")}>
                        {r.percentile.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!isLoading && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {data?.total ?? 0} securities · {data?.dimension ?? dimension} dimension
          </div>
        )}
      </div>
    </div>
  );
}
