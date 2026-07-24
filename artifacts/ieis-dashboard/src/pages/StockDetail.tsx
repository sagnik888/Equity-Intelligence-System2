import { useRoute, Link } from "wouter";
import { useGetSecurity, useGetStockScore, useGetStockSignals, useGetResearchDetail, useGetStockHardGates } from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ShieldAlert, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

const STATE_STYLE: Record<string, string> = {
  strong_buy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  buy: "bg-green-500/10 text-green-400 border-green-500/20",
  hold: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  sell: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  avoid: "bg-red-500/10 text-red-400 border-red-500/20",
};

function ScoreComponent({ name, score, weight }: { name: string; score: number | null | undefined; weight: number }) {
  const v = score ?? 0;
  const color = v >= 70 ? "bg-emerald-500" : v >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="w-40 text-xs text-muted-foreground truncate">{name}</div>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${v}%` }} />
      </div>
      <div className="w-9 text-right font-mono text-xs font-semibold">{score != null ? score.toFixed(1) : "—"}</div>
      <div className="w-8 text-right text-[10px] text-muted-foreground">{weight}%</div>
    </div>
  );
}

function FinancialRow({ label, value, positive }: { label: string; value: string | null; positive?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono", positive !== undefined && value
        ? (positive ? "text-emerald-400" : "text-red-400")
        : "text-foreground"
      )}>{value ?? "—"}</span>
    </div>
  );
}

export default function StockDetail() {
  const [, params] = useRoute("/universe/:isin");
  const isin = params?.isin ?? "";

  const { data: security, isLoading: secLoading } = useGetSecurity({ isin });
  const { data: score } = useGetStockScore({ isin });
  const { data: signals } = useGetStockSignals({ isin });
  const { data: research } = useGetResearchDetail({ isin });
  const { data: gates } = useGetStockHardGates({ isin });

  if (secLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!security) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Security not found.</p>
        <Link href="/universe"><span className="text-xs text-primary mt-2 inline-block cursor-pointer hover:underline">← Back to Universe</span></Link>
      </div>
    );
  }

  const f = security.financials;
  const hasGate = gates?.has_gate;
  const scoreHistory = score?.score_history ?? [];
  const chartData = scoreHistory.map((h: any) => ({ date: h.date, score: h.candidate_score }));

  return (
    <div className="p-6 space-y-5">
      {/* Back link */}
      <Link href="/universe">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          Coverage Universe
        </span>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{security.ticker}</h1>
            <Badge variant="outline" className="text-xs">{security.universe_group?.replace("_cap", "")} cap</Badge>
            {hasGate && (
              <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                Hard Gate
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{security.name} · {security.sector} · {security.industry}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-mono">₹{security.current_price?.toLocaleString("en-IN")}</p>
          <p className="text-xs text-muted-foreground">Market Cap: ₹{security.market_cap_cr ? `${(+security.market_cap_cr / 1000).toFixed(0)}K Cr` : "—"}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Candidate Score", value: score?.candidate_score?.toFixed(1) ?? "—", color: (score?.candidate_score ?? 0) >= 70 ? "text-emerald-400" : (score?.candidate_score ?? 0) >= 50 ? "text-amber-400" : "text-red-400" },
          { label: "Data Confidence", value: security.data_confidence?.toFixed(0) ?? "—", color: (security.data_confidence ?? 0) >= 80 ? "text-emerald-400" : (security.data_confidence ?? 0) >= 65 ? "text-amber-400" : "text-red-400" },
          { label: "Daily Signal", value: signals?.signals?.find((s: any) => s.horizon === "daily")?.state?.replace("_", " ") ?? "—", color: "text-foreground" },
          { label: "Research Score", value: research?.research_score?.toFixed(1) ?? "—", color: (research?.research_score ?? 0) >= 70 ? "text-emerald-400" : "text-amber-400" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="border-border">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={cn("font-mono text-xl font-bold mt-1 capitalize", color)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hard gate warning */}
      {hasGate && gates?.gates && gates.gates.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400">Active Hard Gates</span>
            </div>
            {gates.gates.map((g: any, i: number) => (
              <div key={i} className="text-xs text-red-300 mt-1">
                L{g.level} · {g.trigger.replace(/_/g, " ")} · {g.description}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="scores">
        <TabsList className="bg-card border border-border h-8">
          {["scores", "signals", "research", "financials"].map(t => (
            <TabsTrigger key={t} value={t} className="text-xs h-6 px-3 capitalize data-[state=active]:bg-primary/20 data-[state=active]:text-primary">{t}</TabsTrigger>
          ))}
        </TabsList>

        {/* SCORES */}
        <TabsContent value="scores" className="mt-4">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold">Component Scores</span>
                <span className="font-mono text-xl font-bold text-primary">{score?.candidate_score?.toFixed(1) ?? "—"}</span>
              </div>
              {score ? (
                <>
                  <ScoreComponent name="Quality" score={score.components.quality.score} weight={score.components.quality.weight} />
                  <ScoreComponent name="Growth" score={score.components.growth.score} weight={score.components.growth.weight} />
                  <ScoreComponent name="Value" score={score.components.value.score} weight={score.components.value.weight} />
                  <ScoreComponent name="Balance Sheet" score={score.components.balance_sheet.score} weight={score.components.balance_sheet.weight} />
                  <ScoreComponent name="Capital Allocation" score={score.components.capital_allocation.score} weight={score.components.capital_allocation.weight} />
                  <ScoreComponent name="Integrity" score={score.components.integrity.score} weight={score.components.integrity.weight} />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No score data available.</p>
              )}
            </div>
            <div>
              {chartData.length > 0 && (
                <>
                  <p className="text-xs font-semibold mb-3">Score History (12 months)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData} margin={{ left: -20, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: "#101623", border: "1px solid #1e293b", borderRadius: 6, fontSize: 11 }} />
                      <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
              {score && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-card border border-border p-3">
                    <p className="text-[10px] text-muted-foreground">Data Confidence</p>
                    <p className={cn("font-mono text-lg font-bold mt-1",
                      (score.data_confidence ?? 0) >= 80 ? "text-emerald-400" : (score.data_confidence ?? 0) >= 65 ? "text-amber-400" : "text-red-400"
                    )}>{score.data_confidence?.toFixed(0) ?? "—"}</p>
                  </div>
                  <div className="rounded-lg bg-card border border-border p-3">
                    <p className="text-[10px] text-muted-foreground">Gate Cap</p>
                    <p className={cn("font-mono text-lg font-bold mt-1", score.hard_gate_cap != null ? "text-red-400" : "text-emerald-400")}>
                      {score.hard_gate_cap != null ? score.hard_gate_cap.toFixed(0) : "None"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* SIGNALS */}
        <TabsContent value="signals" className="mt-4">
          {signals?.signals && signals.signals.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-semibold">Cross-Horizon Alignment:</span>
                <span className={cn("text-sm font-bold capitalize",
                  (signals.alignment_score ?? 0) > 0.3 ? "text-emerald-400"
                    : (signals.alignment_score ?? 0) > 0 ? "text-amber-400" : "text-red-400"
                )}>
                  {signals.cross_horizon_state?.replace("_", " ") ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  (score: {signals.alignment_score != null ? signals.alignment_score.toFixed(2) : "—"})
                </span>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {signals.signals.map((s: any) => (
                  <Card key={s.horizon} className={cn("border", STATE_STYLE[s.state] ?? "border-border")}>
                    <CardContent className="p-3">
                      <p className="text-[10px] text-muted-foreground capitalize mb-1">{s.horizon}</p>
                      <Badge variant="outline" className={cn("text-[10px] mb-2", STATE_STYLE[s.state] ?? "")}>
                        {s.state.replace("_", " ")}
                      </Badge>
                      <div className="font-mono text-2xl font-bold">{s.hss.toFixed(0)}</div>
                      <p className="text-[10px] text-muted-foreground">HSS</p>
                      <div className="mt-2 text-[10px] space-y-0.5">
                        <div className="flex justify-between"><span className="text-muted-foreground">Conf</span><span>{s.confidence.toFixed(0)}%</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Days</span><span>{s.days_in_state}d</span></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : <p className="text-xs text-muted-foreground">No signals available.</p>}
        </TabsContent>

        {/* RESEARCH */}
        <TabsContent value="research" className="mt-4">
          {research ? (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold">Research Score</span>
                  <span className="font-mono text-xl font-bold text-primary">{research.research_score.toFixed(1)}</span>
                </div>
                {research.components.map((c: any) => (
                  <ScoreComponent key={c.name} name={c.name} score={c.score} weight={c.weight} />
                ))}
              </div>
              <div className="space-y-4">
                {research.valuation && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Valuation</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { l: "Bear FV", v: research.valuation.fair_value_bear, color: "text-red-400" },
                        { l: "Base FV", v: research.valuation.fair_value_base, color: "text-foreground" },
                        { l: "Weighted FV", v: research.valuation.weighted_fair_value, color: "text-primary" },
                        { l: "Exp. Return", v: research.valuation.expected_annual_return_pct != null ? `${research.valuation.expected_annual_return_pct >= 0 ? "+" : ""}${research.valuation.expected_annual_return_pct.toFixed(1)}%` : null, color: (research.valuation.expected_annual_return_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400" },
                      ].map(({ l, v, color }) => (
                        <div key={l} className="rounded-lg bg-card border border-border p-2.5">
                          <p className="text-[10px] text-muted-foreground">{l}</p>
                          <p className={cn("font-mono font-semibold text-sm mt-0.5", color)}>
                            {v != null ? (typeof v === "number" ? `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : v) : "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {research.analyst_notes && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Analyst Notes</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{research.analyst_notes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : <p className="text-xs text-muted-foreground">No research coverage.</p>}
        </TabsContent>

        {/* FINANCIALS */}
        <TabsContent value="financials" className="mt-4">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-semibold mb-2">Income & Profitability</p>
              <FinancialRow label="Revenue TTM" value={f?.revenue_ttm_cr != null ? `₹${f.revenue_ttm_cr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr` : null} />
              <FinancialRow label="EBITDA TTM" value={f?.ebitda_ttm_cr != null ? `₹${f.ebitda_ttm_cr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr` : null} />
              <FinancialRow label="PAT TTM" value={f?.pat_ttm_cr != null ? `₹${f.pat_ttm_cr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr` : null} />
              <FinancialRow label="EBITDA Margin" value={f?.ebitda_margin_pct != null ? `${f.ebitda_margin_pct.toFixed(1)}%` : null} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-2">Returns & Cash Flow</p>
              <FinancialRow label="ROIC" value={f?.roic_pct != null ? `${f.roic_pct.toFixed(1)}%` : null} positive={(f?.roic_pct ?? 0) >= 15} />
              <FinancialRow label="ROCE" value={f?.roce_pct != null ? `${f.roce_pct.toFixed(1)}%` : null} positive={(f?.roce_pct ?? 0) >= 15} />
              <FinancialRow label="ROE" value={f?.roe_pct != null ? `${f.roe_pct.toFixed(1)}%` : null} positive={(f?.roe_pct ?? 0) >= 15} />
              <FinancialRow label="CFO TTM" value={f?.cfo_ttm_cr != null ? `₹${f.cfo_ttm_cr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr` : null} />
              <FinancialRow label="FCF TTM" value={f?.fcf_ttm_cr != null ? `₹${f.fcf_ttm_cr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr` : null} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-2">Valuation & Leverage</p>
              <FinancialRow label="P/E" value={f?.pe_ratio != null ? f.pe_ratio.toFixed(1) : null} />
              <FinancialRow label="P/B" value={f?.pb_ratio != null ? f.pb_ratio.toFixed(1) : null} />
              <FinancialRow label="EV/EBITDA" value={f?.ev_ebitda != null ? f.ev_ebitda.toFixed(1) : null} />
              <FinancialRow label="FCF Yield" value={f?.fcf_yield_pct != null ? `${f.fcf_yield_pct.toFixed(1)}%` : null} />
              <FinancialRow label="Net Debt/EBITDA" value={f?.net_debt_to_ebitda != null ? f.net_debt_to_ebitda.toFixed(1) : null} positive={(f?.net_debt_to_ebitda ?? 3) <= 2} />
              <FinancialRow label="Interest Coverage" value={f?.interest_coverage != null ? f.interest_coverage.toFixed(1) : null} positive={(f?.interest_coverage ?? 0) >= 5} />
              <FinancialRow label="Rev Growth 3Y" value={f?.revenue_growth_3y_pct != null ? `${f.revenue_growth_3y_pct.toFixed(1)}%` : null} positive={(f?.revenue_growth_3y_pct ?? 0) >= 10} />
              <FinancialRow label="EPS Growth 3Y" value={f?.eps_growth_3y_pct != null ? `${f.eps_growth_3y_pct.toFixed(1)}%` : null} positive={(f?.eps_growth_3y_pct ?? 0) >= 10} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
