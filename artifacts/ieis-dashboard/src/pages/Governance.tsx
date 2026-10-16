import { ShieldCheck, Database, Cpu, Gauge, LockKeyhole, CircleAlert, type LucideIcon } from "lucide-react";
import {
  useGetGovernanceStatus,
  useGetGovernanceSettings,
  useListFormulaRegistry,
  useListConnectorHealth,
  useListAcceptanceGates,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function stateClass(value: string | undefined) {
  if (value === "validated" || value === "healthy" || value === "approved") return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (value === "blocked_failed" || value === "failed" || value === "rejected") return "text-red-400 border-red-500/30 bg-red-500/10";
  if (value === "blocked_unknown") return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  if (value === "warning" || value === "demo_only" || value === "paper_only") return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  return "text-muted-foreground border-border bg-muted/20";
}

function StateBadge({ value }: { value?: string }) {
  return <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide", stateClass(value))}>{value?.replaceAll("_", " ") ?? "not configured"}</Badge>;
}

export default function Governance() {
  const { data: status, isLoading } = useGetGovernanceStatus();
  const { data: settings } = useGetGovernanceSettings();
  const { data: formulaRegistry } = useListFormulaRegistry();
  const { data: connectors } = useListConnectorHealth();
  const { data: gates } = useListAcceptanceGates();

  if (isLoading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-72" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div></div>;

  const validation = status?.validation as Record<string, string> | undefined;
  const gateRows = (gates?.gates ?? []) as Array<Record<string, any>>;
  const adapterRows = (connectors?.adapters ?? []) as Array<Record<string, any>>;
  const formulaRows = formulaRegistry?.formulas ?? [];
  const referenceTestedCount = formulaRows.filter((formula) => formula.testStatus === "reference_tested").length;
  const approvedFormulaCount = formulaRows.filter((formula) => formula.approvalStatus === "approved").length;
  const validationCards: Array<{ label: string; value?: string; Icon: LucideIcon }> = [
    { label: "Architecture", value: validation?.architecture, Icon: ShieldCheck },
    { label: "Data", value: validation?.data, Icon: Database },
    { label: "Code", value: validation?.code, Icon: Cpu },
    { label: "Investment", value: validation?.investment, Icon: LockKeyhole },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Model & data governance</h1>
        <p className="text-xs text-muted-foreground mt-1">Validation boundaries, source rights, release gates, and resource safety.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {validationCards.map(({ label, value, Icon }) => (
          <Card key={label} className="border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><div className="mt-2"><StateBadge value={value} /></div></div><Icon className="h-4 w-4 text-muted-foreground" /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Acceptance gates</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {gateRows.length === 0 ? <p className="text-xs text-muted-foreground">No persisted gate results.</p> : gateRows.map((gate) => (
              <div key={gate.gateKey} className="flex items-center justify-between border-b border-border/60 py-2 last:border-0">
                <div><p className="text-sm">{gate.gateName}</p><p className="text-[11px] text-muted-foreground">{gate.notes}</p></div><StateBadge value={gate.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4" /> Operating safety</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Profile</span><span>{settings?.profile ?? status?.deployment_profile}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Configured mode</span><StateBadge value={settings?.operatingMode ?? status?.configured_system_mode} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Effective mode</span><StateBadge value={status?.effective_execution_mode ?? "alert_only"} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Live execution</span><span className="text-amber-400">{status?.live_execution_enabled ? "Enabled" : "Disabled"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Kill switch</span><span>{settings?.killSwitchEnabled ? "Enabled" : "Standby"}</span></div>
            <div className="border-t border-border pt-3"><p className="text-muted-foreground mb-1">Effective entry safety</p><StateBadge value={status?.entry_safety.resource_mode ?? "not_configured"} /></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Coverage and source readiness</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Universe coverage</span><span className="font-mono">{status?.coverage.current ?? 0} / {status?.coverage.target ?? 2000}</span></div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, status?.coverage.coverage_pct ?? 0)}%` }} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Licensed sources</span><StateBadge value={status?.foundations.licensed_sources_registered ? "healthy" : "not_configured"} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Source adapters</span><span>{adapterRows.length} registered</span></div>
            <div className="flex items-center gap-2 text-amber-400 pt-1"><CircleAlert className="h-3.5 w-3.5" /> Demo data is not a production market-data entitlement.</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Formula reference registry</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Synthetic vectors</span><span className="font-mono">{referenceTestedCount} / {formulaRows.length || 26}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Registry version</span><span className="font-mono">{formulaRegistry?.registry_version ?? "loading"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Investment approval</span><StateBadge value={approvedFormulaCount > 0 ? "approved" : "not_approved"} /></div>
            <p className="text-amber-400">Offline reference tests only. No formula is approved for investment use.</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Execution boundary</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Signals are research previews; paper and live order paths remain blocked until the required data, investment, resource, account, and execution gates pass.</p>
            <p>Missing source records, revisions, and corporate actions are surfaced as unavailable or pending review rather than replaced with fabricated values.</p>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span>Quantitative release evidence</span>
              <StateBadge value={status?.release_readiness.status ?? "not_configured"} />
            </div>
            <p>{status?.release_readiness.passed_gate_count ?? 0} / {status?.release_readiness.required_gate_count ?? 10} areas complete; {status?.release_readiness.unknown_gate_count ?? 10} unknown; {status?.release_readiness.failed_gate_count ?? 0} failed.</p>
            <p className="text-amber-400">Complete evidence permits independent review only; it never enables order execution.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}