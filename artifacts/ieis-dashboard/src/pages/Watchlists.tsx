import { useState } from "react";
import { useListWatchlists, useGetWatchlist } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookMarked, ChevronRight, ArrowLeft, TrendingUp, AlertTriangle, Bell } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const CAT_STYLE: Record<string, string> = {
  opportunity: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  risk: "bg-red-500/10 text-red-400 border-red-500/20",
  monitor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  action_required: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};
const CAT_ICON: Record<string, any> = {
  opportunity: TrendingUp, risk: AlertTriangle, monitor: BookMarked, action_required: Bell,
};

function WatchlistDetail({ name }: { name: string }) {
  const { data, isLoading } = useGetWatchlist({ name });

  if (isLoading) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="text-sm font-semibold">{data.display_name}</div>
        <Badge variant="outline" className="text-xs">{data.total} stocks</Badge>
      </div>
      {data.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No securities in this watchlist.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-card/50">
                {["Ticker", "Name", "Sector", "Score", "Quality", "Growth", "Value", "DC", "Rank"].map(h => (
                  <th key={h} className={cn("py-2 px-3 text-muted-foreground font-medium", h === "Ticker" ? "text-left" : "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map(s => (
                <tr key={s.isin} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2">
                    <Link href={`/universe/${s.isin}`}>
                      <span className="font-mono font-semibold text-primary cursor-pointer hover:underline">{s.ticker}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground max-w-[120px] truncate">{s.name}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{s.sector}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    <span className={cn(s.candidate_score >= 70 ? "text-emerald-400" : s.candidate_score >= 50 ? "text-amber-400" : "text-red-400")}>
                      {s.candidate_score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{s.quality_score?.toFixed(0) ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.growth_score?.toFixed(0) ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.value_score?.toFixed(0) ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span className={cn(s.data_confidence >= 80 ? "text-emerald-400" : s.data_confidence >= 65 ? "text-amber-400" : "text-red-400")}>
                      {s.data_confidence.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {s.overall_rank ? `#${s.overall_rank}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Watchlists() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading } = useListWatchlists();

  const lists = data?.watchlists ?? [];

  const grouped: Record<string, typeof lists> = {
    opportunity: lists.filter(w => w.category === "opportunity"),
    action_required: lists.filter(w => w.category === "action_required"),
    risk: lists.filter(w => w.category === "risk"),
    monitor: lists.filter(w => w.category === "monitor"),
  };

  if (selected) {
    const meta = lists.find(w => w.name === selected);
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Watchlists
          </button>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs">{meta?.display_name}</span>
        </div>
        <WatchlistDetail name={selected} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Thematic Watchlists</h1>
        <p className="text-xs text-muted-foreground mt-0.5">20 smart auto-maintained lists · click to explore</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          items.length > 0 && (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                {(() => { const Icon = CAT_ICON[cat] ?? BookMarked; return <Icon className={cn("h-3.5 w-3.5", cat === "opportunity" ? "text-emerald-400" : cat === "risk" ? "text-red-400" : cat === "action_required" ? "text-amber-400" : "text-blue-400")} />; })()}
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground capitalize">
                  {cat.replace("_", " ")}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {items.map(w => (
                  <Card key={w.name} className="border-border cursor-pointer hover:border-primary/30 transition-all" onClick={() => setSelected(w.name)}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-1.5">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5", CAT_STYLE[w.category] ?? "")}>
                          {w.count} stocks
                        </Badge>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-semibold leading-snug">{w.display_name}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{w.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        ))
      )}
    </div>
  );
}
