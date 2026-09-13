import { Router, type IRouter } from "express";
import { and, desc, isNull, gte } from "drizzle-orm";
import {
  db,
  candidateScoresTable,
  securitiesTable,
  signalsTable,
  hardGatesTable,
  portfolioPositionsTable,
  recentChangesTable,
} from "@workspace/db";

const router: IRouter = Router();

const WATCHLIST_META: Record<string, { display_name: string; description: string; category: string }> = {
  elite_candidates: { display_name: "Elite Candidates", description: "Top-ranked stocks across all dimensions", category: "opportunity" },
  quality_at_reasonable_value: { display_name: "Quality at Reasonable Value", description: "High quality scores with attractive valuations", category: "opportunity" },
  emerging_compounders: { display_name: "Emerging Compounders", description: "Mid-caps with improving quality and growth metrics", category: "opportunity" },
  earnings_improvers: { display_name: "Earnings Improvers", description: "Companies with accelerating earnings momentum", category: "opportunity" },
  cashflow_improvers: { display_name: "Cash Flow Improvers", description: "FCF conversion trend turning positive", category: "opportunity" },
  turnaround_watch: { display_name: "Turnaround Watch", description: "Distressed companies with recovery potential", category: "monitor" },
  deep_value: { display_name: "Deep Value", description: "Statistically cheap on multiple metrics", category: "opportunity" },
  value_traps: { display_name: "Value Traps", description: "Cheap but with deteriorating fundamentals", category: "risk" },
  governance_deterioration: { display_name: "Governance Deterioration", description: "Declining integrity and governance scores", category: "risk" },
  balance_sheet_risk: { display_name: "Balance Sheet Risk", description: "Leverage and liquidity concerns flagged", category: "risk" },
  overvaluation: { display_name: "Overvaluation", description: "Trading well above fair value estimates", category: "risk" },
  momentum_confirmation: { display_name: "Momentum Confirmation", description: "Technical and fundamental momentum aligned", category: "opportunity" },
  liquidity_deterioration: { display_name: "Liquidity Deterioration", description: "Declining traded volume and bid-ask spread concerns", category: "risk" },
  new_listings: { display_name: "New Listings", description: "IPO seasoning period stocks", category: "monitor" },
  pending_resolution: { display_name: "Pending Resolution", description: "Hard gate Level 1 under active review", category: "action_required" },
  insufficient_data: { display_name: "Insufficient Data", description: "Data confidence below minimum threshold", category: "action_required" },
  recent_upgrades: { display_name: "Recent Upgrades", description: "Signal or score improved in last 5 days", category: "opportunity" },
  recent_downgrades: { display_name: "Recent Downgrades", description: "Signal or score declined in last 5 days", category: "risk" },
  upcoming_results: { display_name: "Upcoming Results", description: "Quarterly results due within 14 days", category: "monitor" },
  portfolio_review_required: { display_name: "Portfolio Review Required", description: "Held positions with changed signals", category: "action_required" },
};

router.get("/watchlists", async (_req, res): Promise<void> => {
  const memberships = await deriveWatchlists();

  const watchlists = Object.entries(WATCHLIST_META).map(([name, meta]) => ({
    name,
    display_name: meta.display_name,
    count: memberships[name]?.size ?? 0,
    description: meta.description,
    category: meta.category,
  }));

  res.json({ watchlists });
});

router.get("/watchlists/:name", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const meta = WATCHLIST_META[raw];
  if (!meta) { res.status(404).json({ error: "Watchlist not found" }); return; }

  const memberships = await deriveWatchlists();
  const isins = memberships[raw] ?? new Set<string>();
  const scores = await db.select().from(candidateScoresTable).orderBy(desc(candidateScoresTable.candidateScore));
  const items = scores
      .filter(s => isins.has(s.isin))
      .map(s => ({
        isin: s.isin,
        ticker: s.ticker,
        name: s.name,
        sector: s.sector,
        universe_group: s.universeGroup,
        candidate_score: s.candidateScore ? parseFloat(s.candidateScore) : 0,
        quality_score: s.qualityScore ? parseFloat(s.qualityScore) : null,
        growth_score: s.growthScore ? parseFloat(s.growthScore) : null,
        value_score: s.valueScore ? parseFloat(s.valueScore) : null,
        balance_sheet_score: s.balanceSheetScore ? parseFloat(s.balanceSheetScore) : null,
        capital_allocation_score: s.capitalAllocationScore ? parseFloat(s.capitalAllocationScore) : null,
        integrity_score: s.integrityScore ? parseFloat(s.integrityScore) : null,
        data_confidence: s.dataConfidence ? parseFloat(s.dataConfidence) : 0,
        hard_gate_cap: s.hardGateCap ? parseFloat(s.hardGateCap) : null,
        overall_rank: s.overallRank ?? null,
        score_date: s.scoreDate,
      }));

  res.json({
    name: raw,
    display_name: meta.display_name,
    items,
    total: items.length,
  });
});

async function deriveWatchlists(): Promise<Record<string, Set<string>>> {
  const [scores, securities, signals, gates, positions, changes] = await Promise.all([
    db.select().from(candidateScoresTable),
    db.select().from(securitiesTable),
    db.select().from(signalsTable),
    db.select().from(hardGatesTable).where(isNull(hardGatesTable.resolvedAt)),
    db.select().from(portfolioPositionsTable).where(isNull(portfolioPositionsTable.exitDate)),
    db.select().from(recentChangesTable),
  ]);
  const result: Record<string, Set<string>> = {};
  for (const name of Object.keys(WATCHLIST_META)) result[name] = new Set();
  const n = (value: string | null) => value == null ? null : Number(value);
  const score = new Map(scores.map(s => [s.isin, s]));
  const security = new Map(securities.map(s => [s.isin, s]));
  const signalByIsin = new Map<string, typeof signals>();
  for (const signal of signals) signalByIsin.set(signal.isin, [...(signalByIsin.get(signal.isin) ?? []), signal]);
  const gateByIsin = new Map<string, typeof gates>();
  for (const gate of gates) gateByIsin.set(gate.isin, [...(gateByIsin.get(gate.isin) ?? []), gate]);
  const recentCutoff = new Date(Date.now() - 5 * 86400000);

  for (const s of scores) {
    const q = n(s.qualityScore) ?? 50;
    const g = n(s.growthScore) ?? 50;
    const v = n(s.valueScore) ?? 50;
    const b = n(s.balanceSheetScore) ?? 50;
    const i = n(s.integrityScore) ?? 50;
    const candidate = n(s.candidateScore) ?? 0;
    const dc = n(s.dataConfidence) ?? 0;
    const sec = security.get(s.isin);
    const stockSignals = signalByIsin.get(s.isin) ?? [];
    const activeGates = gateByIsin.get(s.isin) ?? [];
    const buySignal = stockSignals.some(x => ["strong_buy", "buy", "accumulate"].includes(x.state));
    const negativeSignal = stockSignals.some(x => ["reduce", "sell", "avoid"].includes(x.state));
    const isRecentListing = !!sec?.listingDate && new Date(sec.listingDate) >= new Date(Date.now() - 30 * 86400000);
    if (candidate >= 75) result.elite_candidates.add(s.isin);
    if (q >= 70 && v >= 55) result.quality_at_reasonable_value.add(s.isin);
    if (["mid_cap", "small_cap"].includes(s.universeGroup) && g >= 65 && q >= 55) result.emerging_compounders.add(s.isin);
    if (g >= 70) result.earnings_improvers.add(s.isin);
    if (q >= 65 && candidate >= 55) result.cashflow_improvers.add(s.isin);
    if (candidate >= 40 && candidate <= 65 && g >= 55) result.turnaround_watch.add(s.isin);
    if (v >= 75) result.deep_value.add(s.isin);
    if (v >= 70 && q < 50) result.value_traps.add(s.isin);
    if (i < 50 || activeGates.some(x => /GOVERNANCE|AUDITOR|PROMOTER/i.test(x.trigger))) result.governance_deterioration.add(s.isin);
    if (b < 50 || activeGates.some(x => /DEBT|LIQUIDITY|COVENANT/i.test(x.trigger))) result.balance_sheet_risk.add(s.isin);
    if (v < 40) result.overvaluation.add(s.isin);
    if (buySignal && stockSignals.some(x => x.horizon === "monthly" || x.horizon === "long")) result.momentum_confirmation.add(s.isin);
    if ((n(sec?.medianDailyTradedValueCr ?? null) ?? 0) < 5) result.liquidity_deterioration.add(s.isin);
    if (isRecentListing) result.new_listings.add(s.isin);
    if (activeGates.some(x => x.state === "pending_resolution" || x.level === 1)) result.pending_resolution.add(s.isin);
    if (dc < 60) result.insufficient_data.add(s.isin);
    if (changes.some(x => x.isin === s.isin && new Date(x.changedAt) >= recentCutoff && /upgrade|improvement/i.test(x.changeType))) result.recent_upgrades.add(s.isin);
    if (changes.some(x => x.isin === s.isin && new Date(x.changedAt) >= recentCutoff && /downgrade|deterioration/i.test(x.changeType))) result.recent_downgrades.add(s.isin);
    if (negativeSignal && positions.some(x => x.isin === s.isin)) result.portfolio_review_required.add(s.isin);
  }
  return result;
}

export default router;
