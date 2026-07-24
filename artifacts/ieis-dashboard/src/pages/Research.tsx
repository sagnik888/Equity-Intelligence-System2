import { useState } from "react";
import { useListResearchScores, useGetResearchDetail, useGetEvidenceLedger } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Microscope, ChevronRight, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_STYLE: Record<string, string> = {
  full: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  standard: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  limited: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  screening_only: "bg-muted text-muted-foreground",
};
const REVIEW_STYLE: Record<string, string> = {
  confirmed: "text-emerald-400", pending: "text-amber-400", contradicted: "text-red-400", stale: "text-muted-foreground", superseded: "text-muted-foreground",
};
const REVIEW_ICON: Record<string, any> = {
  confirmed: CheckCircle2, pending: AlertTriangle, contradicted: AlertTriangle,
};

function ScoreBar({ label, weight, score }: { label: string; weight: number; score: number | null | undefined }) {
  const v = score ?? 0;
  const color = v >= 70 ? "bg-emerald-500" : v >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-44 text-xs text-muted-foreground truncate">{label}</div>
      <div className="flex-1">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${v}%` }} />
        </div>
      </div>
      <div className="w-8 text-right text-xs font-mono font-semibold">{score != null ? score.toFixed(0) : "—"}</div>
      <div className="w-8 text-right text-[10px] text-muted-foreground">{weight}%</div>
    </div>
  );
}

function ResearchDetail({ isin }: { isin: string }) {
  const [tab, setTab] = useState("scores");
  const { data: detail } = useGetResearchDetail({ isin });
  const { data: evidence } = useGetEvidenceLedger({ isin });

  if (!detail) return <div className="p-4"><Skeleton className="h-48 w-full" /></div>;

  const ev = evidence?.entries ?? [];

  return (
    <div className="border-t border-border bg-card/30">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start h-9 px-4">
          {[{ v: "scores", l: "Score Breakdown" }, { v: "valuation", l: "Valuation" }, { v: "evidence", l: `Evidence (${ev.length})` }].map(({ v, l }) => (
            <TabsTrigger key={v} value={v} className="text-xs h-7 px-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">{l}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="scores" className="p-4 mt-0">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold">Research Score</span>
                <span className="text-2xl font-bold font-mono text-primary">{detail.research_score.toFixed(1)}</span>
              </div>
              {detail.components.map(c => (
                <ScoreBar key={c.name} label={c.name} weight={c.weight} score={c.score} />
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold mb-2">Analyst Notes</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{detail.analyst_notes || "No notes available."}</p>
              <div className="mt-4 flex items-center gap-3">
                <Badge variant="outline" className={cn("text-[10px]", TIER_STYLE[detail.components[0] ? "full" : "screening_only"])}>
                  Full Coverage
                </Badge>
                <span className="text-xs text-muted-foreground">Confidence: {detail.confidence.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="valuation" className="p-4 mt-0">
          {detail.valuation ? (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Fair Value Estimates</div>
                {[
                  { label: "Bear Case", value: detail.valuation.fair_value_bear, color: "text-red-400" },
                  { label: "Base Case", value: detail.valuation.fair_value_base, color: "text-foreground" },
                  { label: "Weighted FV", value: detail.valuation.weighted_fair_value, color: "text-primary" },
                  { label: "Bull Case", value: detail.valuation.fair_value_bull, color: "text-emerald-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={cn("font-mono text-sm font-semibold", color)}>
                      {value != null ? `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground">Current Price</span>
                  <span className="font-mono text-sm font-semibold">
                    {detail.valuation.current_price != null ? `₹${detail.valuation.current_price.toLocaleString("en-IN")}` : "—"}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Return Expectations</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Expected Annual Return</span>
                  <span className={cn("font-mono text-lg font-bold",
                    (detail.valuation.expected_annual_return_pct ?? 0) >= 15 ? "text-emerald-400"
                      : (detail.valuation.expected_annual_return_pct ?? 0) >= 0 ? "text-amber-400" : "text-red-400"
                  )}>
                    {detail.valuation.expected_annual_return_pct != null
                      ? `${detail.valuation.expected_annual_return_pct >= 0 ? "+" : ""}${detail.valuation.expected_annual_return_pct.toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Horizon</span>
                  <span className="font-mono text-xs">{detail.valuation.horizon_years != null ? `${detail.valuation.horizon_years}Y` : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Method</span>
                  <span className="text-xs">{detail.valuation.method ?? "—"}</span>
                </div>
              </div>
            </div>
          ) : <p className="text-xs text-muted-foreground">No valuation data available.</p>}
        </TabsContent>
        <TabsContent value="evidence" className="mt-0">
          {ev.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4">No evidence entries.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {ev.map(e => {
                const Icon = REVIEW_ICON[e.review_status] ?? FileText;
                return (
                  <div key={e.claim_id} className="p-4">
                    <div className="flex items-start gap-2">
                      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", REVIEW_STYLE[e.review_status] ?? "text-muted-foreground")} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium">{e.claim}</span>
                          <Badge variant="outline" className="text-[10px] px-1">{e.claim_type}</Badge>
                          <Badge variant="outline" className={cn("text-[10px] px-1", REVIEW_STYLE[e.review_status])}>{e.review_status}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {e.source} · {e.source_grade} · Conf: {e.confidence.toFixed(0)}%
                          {e.filing_timestamp && ` · ${e.filing_timestamp.split("T")[0]}`}
                        </p>
                        {e.supporting_evidence && (
                          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                            <span className="text-emerald-400">✓ </span>{e.supporting_evidence}
                          </p>
                        )}
                        {e.contradictory_evidence && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            <span className="text-red-400">✗ </span>{e.contradictory_evidence}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Research() {
  const [selectedIsin, setSelectedIsin] = useState<string | null>(null);
  const { data, isLoading } = useListResearchScores({ limit: 50 });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">Deep Research</h1>
        <p className="text-xs text-muted-foreground mt-0.5">9-component research scores · evidence ledger · valuation</p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-card/50">
              {["Ticker", "Name", "Sector", "Tier", "Research Score", "Adj Score", "Confidence", "BQ", "Integrity", "Valuation", "Score Date"].map(h => (
                <th key={h} className={cn("py-2 px-3 text-muted-foreground font-medium whitespace-nowrap", h === "Ticker" ? "text-left" : "text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 11 }).map((_, j) => <td key={j} className="px-3 py-2"><Skeleton className="h-4" /></td>)}
                  </tr>
                ))
              : (data?.items ?? []).map(r => (
                  <>
                    <tr
                      key={r.isin}
                      className={cn("border-b border-border/50 hover:bg-white/[0.02] transition-colors cursor-pointer", selectedIsin === r.isin && "bg-primary/5")}
                      onClick={() => setSelectedIsin(selectedIsin === r.isin ? null : r.isin)}
                    >
                      <td className="px-3 py-2.5 font-mono font-semibold text-primary">{r.ticker}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground max-w-[120px] truncate">{r.name}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{r.sector}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Badge variant="outline" className={cn("text-[10px]", TIER_STYLE[r.coverage_tier] ?? "")}>{r.coverage_tier}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold">{r.research_score.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{r.adjusted_research_score.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={cn("font-mono", r.confidence >= 80 ? "text-emerald-400" : r.confidence >= 65 ? "text-amber-400" : "text-red-400")}>
                          {r.confidence.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.business_quality_score?.toFixed(0) ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.integrity_governance_score?.toFixed(0) ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.valuation_score?.toFixed(0) ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{r.score_date}</td>
                    </tr>
                    {selectedIsin === r.isin && (
                      <tr key={`${r.isin}-detail`} className="border-b border-border/50">
                        <td colSpan={11} className="p-0">
                          <ResearchDetail isin={r.isin} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
          </tbody>
        </table>
        {!isLoading && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {data?.total ?? 0} covered securities · Click row to expand
          </div>
        )}
      </div>
    </div>
  );
}
