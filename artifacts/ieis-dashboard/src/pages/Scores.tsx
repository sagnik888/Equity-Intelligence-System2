import { Link } from "wouter";
import { useListCandidateScores } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Scores() {
  const { data, isLoading } = useListCandidateScores({ limit: 100, offset: 0 });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Candidate scores</h1>
        <p className="text-xs text-muted-foreground mt-1">Coverage-shrunk opportunity scores with component and data-confidence context.</p>
      </div>
      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Current score table</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border bg-card/50">
                {["Ticker", "Name", "Sector", "Group", "Candidate", "Quality", "Growth", "Value", "DC", "Gate"].map(label => <th key={label} className="px-3 py-2 text-right text-muted-foreground font-medium first:text-left">{label}</th>)}
              </tr></thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 12 }).map((_, row) => <tr key={row}>{Array.from({ length: 10 }).map((__, cell) => <td key={cell} className="px-3 py-2"><Skeleton className="h-4 w-16 ml-auto first:ml-0" /></td>)}</tr>)
                  : (data?.items ?? []).map((score) => (
                    <tr key={score.isin} className="border-b border-border/50 hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-left"><Link href={`/universe/${score.isin}`}><span className="font-mono font-semibold text-primary hover:underline">{score.ticker}</span></Link></td>
                      <td className="px-3 py-2 text-right text-muted-foreground max-w-[180px] truncate">{score.name}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{score.sector}</td>
                      <td className="px-3 py-2 text-right"><Badge variant="outline" className="text-[10px]">{score.universe_group?.replace("_cap", "")}</Badge></td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">{score.candidate_score.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{score.quality_score?.toFixed(1) ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{score.growth_score?.toFixed(1) ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{score.value_score?.toFixed(1) ?? "—"}</td>
                      <td className={cn("px-3 py-2 text-right font-mono", score.data_confidence < 60 ? "text-amber-400" : "text-emerald-400")}>{score.data_confidence.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">{score.hard_gate_cap == null ? "—" : <Badge variant="outline" className="text-[10px] text-amber-400">cap {score.hard_gate_cap.toFixed(0)}</Badge>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!isLoading && <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">{data?.total ?? 0} current score records · demo dataset</div>}
        </CardContent>
      </Card>
    </div>
  );
}