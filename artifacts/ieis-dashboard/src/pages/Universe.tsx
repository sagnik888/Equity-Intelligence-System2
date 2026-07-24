import { useState } from "react";
import { useListSecurities, useGetUniverseStats } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Globe2, TrendingUp, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const DC_COLOR = (v: number) => v >= 80 ? "text-emerald-400" : v >= 65 ? "text-amber-400" : "text-red-400";
const SCORE_COLOR = (v: number | null | undefined) => !v ? "text-muted-foreground" : v >= 70 ? "text-emerald-400" : v >= 50 ? "text-amber-400" : "text-red-400";

const GROUP_LABELS: Record<string, string> = {
  large_cap: "Large", mid_cap: "Mid", small_cap: "Small", micro_cap: "Micro", sme: "SME", reit_invit: "REIT"
};

export default function Universe() {
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("all");
  const [group, setGroup] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading } = useListSecurities({
    search: search || undefined,
    sector: sector !== "all" ? sector : undefined,
    group: group !== "all" ? group : undefined,
    limit,
    offset: page * limit,
  });
  const { data: stats } = useGetUniverseStats();

  const sectors = stats?.by_sector?.map(s => s.sector) ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Coverage Universe</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats?.active ?? "—"} active · {stats?.total ?? "—"} total
          </p>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Large Cap", count: stats.by_group?.find(g => g.group === "large_cap")?.count ?? 0, icon: Globe2, color: "text-blue-400" },
            { label: "Mid Cap", count: stats.by_group?.find(g => g.group === "mid_cap")?.count ?? 0, icon: TrendingUp, color: "text-amber-400" },
            { label: "Small Cap", count: stats.by_group?.find(g => g.group === "small_cap")?.count ?? 0, icon: BarChart3, color: "text-purple-400" },
            { label: "High Confidence", count: stats.data_confidence_distribution?.find(d => d.class === "high")?.count ?? 0, icon: BarChart3, color: "text-emerald-400" },
          ].map(({ label, count, icon: Icon, color }) => (
            <Card key={label} className="border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <Icon className={cn("h-4 w-4", color)} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn("text-lg font-bold font-mono", color)}>{count}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search ticker, name, ISIN…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-8 h-8 text-xs bg-card border-border"
          />
        </div>
        <Select value={sector} onValueChange={v => { setSector(v); setPage(0); }}>
          <SelectTrigger className="w-40 h-8 text-xs bg-card border-border">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sectors</SelectItem>
            {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={group} onValueChange={v => { setGroup(v); setPage(0); }}>
          <SelectTrigger className="w-36 h-8 text-xs bg-card border-border">
            <SelectValue placeholder="Group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            <SelectItem value="large_cap">Large Cap</SelectItem>
            <SelectItem value="mid_cap">Mid Cap</SelectItem>
            <SelectItem value="small_cap">Small Cap</SelectItem>
            <SelectItem value="micro_cap">Micro Cap</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-card/50">
                {["Ticker", "Name", "Sector", "Group", "Mkt Cap (Cr)", "Score", "Quality", "Value", "DC", "Status"].map(h => (
                  <th key={h} className={cn("py-2 px-3 text-muted-foreground font-medium whitespace-nowrap", h === "Ticker" ? "text-left" : "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-3 py-2"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : (data?.items ?? []).map(item => (
                    <tr key={item.isin} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors group">
                      <td className="px-3 py-2">
                        <Link href={`/universe/${item.isin}`}>
                          <span className="font-mono font-semibold text-primary cursor-pointer hover:underline">{item.ticker}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right max-w-[160px] truncate text-muted-foreground">{item.name}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{item.sector}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="outline" className="text-[10px] px-1.5">
                          {GROUP_LABELS[item.universe_group] ?? item.universe_group}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {item.market_cap_cr ? (item.market_cap_cr >= 1000 ? `${(item.market_cap_cr / 1000).toFixed(1)}K` : item.market_cap_cr.toFixed(0)) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {item.candidate_score != null
                          ? <span className={cn("font-mono font-semibold", SCORE_COLOR(item.candidate_score))}>{item.candidate_score.toFixed(1)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">—</td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">—</td>
                      <td className="px-3 py-2 text-right">
                        <span className={cn("font-mono font-semibold", DC_COLOR(item.data_confidence))}>
                          {item.data_confidence.toFixed(0)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={cn("inline-block w-1.5 h-1.5 rounded-full",
                          item.status === "active" ? "bg-emerald-500" : item.status === "suspended" ? "bg-amber-500" : "bg-red-500"
                        )} />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card/30">
          <span className="text-xs text-muted-foreground">
            {data?.total ?? 0} securities · page {page + 1}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-xs px-3 py-1 rounded border border-border hover:bg-card disabled:opacity-40"
            >← Prev</button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * limit >= (data?.total ?? 0)}
              className="text-xs px-3 py-1 rounded border border-border hover:bg-card disabled:opacity-40"
            >Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
