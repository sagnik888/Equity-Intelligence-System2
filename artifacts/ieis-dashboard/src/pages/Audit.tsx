import { useState } from "react";
import { useGetAuditHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollText, Search, Clock, ShieldAlert, Zap, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const STATE_STYLE: Record<string, string> = {
  strong_buy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  buy: "bg-green-500/10 text-green-400 border-green-500/20",
  hold: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  sell: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  avoid: "bg-red-500/10 text-red-400 border-red-500/20",
};

function AuditResult({ isin, date }: { isin: string; date: string }) {
  const { data, isLoading, error } = useGetAuditHistory({ isin, date });

  if (isLoading) return <div className="mt-6"><Skeleton className="h-64 w-full" /></div>;
  if (error || !data) return (
    <div className="mt-6 p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400">
      No audit data found for this ISIN / date combination.
    </div>
  );

  return (
    <div className="mt-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">{data.name} <span className="font-mono text-muted-foreground text-xs ml-1">({data.ticker})</span></h2>
          <p className="text-xs text-muted-foreground mt-0.5">Point-in-time reconstruction · {data.as_of_date}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{data.model_version}</Badge>
          <Badge variant="outline" className="text-[10px]">{data.formula_version}</Badge>
        </div>
      </div>

      {/* Score snapshot */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Data Confidence", value: data.data_confidence?.toFixed(1) ?? "—", color: (data.data_confidence ?? 0) >= 80 ? "text-emerald-400" : (data.data_confidence ?? 0) >= 65 ? "text-amber-400" : "text-red-400" },
          { label: "Candidate Score", value: data.candidate_score?.toFixed(1) ?? "—", color: (data.candidate_score ?? 0) >= 70 ? "text-emerald-400" : (data.candidate_score ?? 0) >= 50 ? "text-amber-400" : "text-red-400" },
          { label: "Research Score", value: data.research_score?.toFixed(1) ?? "—", color: (data.research_score ?? 0) >= 70 ? "text-emerald-400" : "text-amber-400" },
          { label: "Universe Status", value: data.universe_status ?? "—", color: data.universe_status === "active" ? "text-emerald-400" : "text-red-400" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="border-border">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={cn("font-mono text-xl font-bold mt-1 capitalize", color)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active gates */}
      {data.hard_gates && data.hard_gates.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-400">
              <ShieldAlert className="h-3.5 w-3.5" />
              Active Hard Gates as of {data.as_of_date}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {data.hard_gates.map((g, i) => (
                <div key={i} className="px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">L{g.level}</Badge>
                    <span className="font-mono">{g.trigger.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="capitalize">{g.state}</span>
                    {g.cap_score != null && <span className="text-amber-400">Cap: {g.cap_score}</span>}
                  </div>
                  <p className="text-muted-foreground mt-1">{g.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signals */}
      {data.signals && data.signals.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Signals as of {data.as_of_date}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Horizon", "State", "HSS", "Confidence"].map(h => (
                    <th key={h} className={cn("py-2 px-4 text-muted-foreground font-medium", h === "Horizon" ? "text-left" : "text-right")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.signals.map((s, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-4 py-2 capitalize">{s.horizon}</td>
                    <td className="px-4 py-2 text-right">
                      <Badge variant="outline" className={cn("text-[10px]", STATE_STYLE[s.state] ?? "")}>{s.state.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{s.hss.toFixed(1)}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.confidence.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Decision explanation */}
      {data.decision_explanation && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Decision Explanation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground leading-relaxed">{data.decision_explanation}</p>
          </CardContent>
        </Card>
      )}

      {/* Available filings */}
      {data.available_filings && data.available_filings.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Source Filings</p>
          <div className="space-y-1.5">
            {data.available_filings.map((f: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{f.filing_type}</span>
                <span className="text-muted-foreground">·</span>
                <span>{f.period}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{f.source}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono text-[10px]">{f.timestamp?.split("T")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Audit() {
  const [isin, setIsin] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]!);
  const [query, setQuery] = useState<{ isin: string; date: string } | null>(null);

  const handleSearch = () => {
    if (isin.trim() && date) setQuery({ isin: isin.trim().toUpperCase(), date });
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">System Audit Log</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Point-in-time reconstruction · decision provenance · evidence trail</p>
      </div>

      {/* Search */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">ISIN</label>
              <Input
                value={isin}
                onChange={e => setIsin(e.target.value)}
                placeholder="e.g. INE467B01029"
                className="h-8 text-xs font-mono bg-card border-border"
                onKeyDown={e => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="w-44">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">As-of Date</label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-8 text-xs bg-card border-border"
              />
            </div>
            <div className="mt-5">
              <button
                onClick={handleSearch}
                className="flex items-center gap-1.5 h-8 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                Reconstruct
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <p className="text-[10px] text-muted-foreground">Quick picks:</p>
            {[
              { label: "TCS", isin: "INE467B01029" },
              { label: "RELIANCE", isin: "INE002A01018" },
              { label: "YESBANK", isin: "INE880J01026" },
              { label: "INFY", isin: "INE009A01021" },
            ].map(({ label, isin: i }) => (
              <button key={i} onClick={() => { setIsin(i); setQuery({ isin: i, date }); }}
                className="text-[10px] px-2 py-0.5 rounded border border-border hover:border-primary/50 hover:text-primary transition-colors">
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {query && <AuditResult isin={query.isin} date={query.date} />}

      {!query && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Time-machine audit</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Enter an ISIN and date to reconstruct the full model state at any historical point</p>
        </div>
      )}
    </div>
  );
}
