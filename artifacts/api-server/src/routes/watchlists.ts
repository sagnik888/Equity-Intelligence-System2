import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, watchlistEntriesTable, candidateScoresTable } from "@workspace/db";
import { GetWatchlistParams } from "@workspace/api-zod";

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
  const counts = await db.select({
    watchlistName: watchlistEntriesTable.watchlistName,
    count: sql<number>`count(*)`,
  }).from(watchlistEntriesTable).groupBy(watchlistEntriesTable.watchlistName);

  const countMap: Record<string, number> = {};
  for (const r of counts) countMap[r.watchlistName] = Number(r.count);

  const watchlists = Object.entries(WATCHLIST_META).map(([name, meta]) => ({
    name,
    display_name: meta.display_name,
    count: countMap[name] ?? 0,
    description: meta.description,
    category: meta.category,
  }));

  res.json({ watchlists });
});

router.get("/watchlists/:name", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const meta = WATCHLIST_META[raw];
  if (!meta) { res.status(404).json({ error: "Watchlist not found" }); return; }

  const entries = await db.select({
    isin: watchlistEntriesTable.isin,
  }).from(watchlistEntriesTable).where(eq(watchlistEntriesTable.watchlistName, raw));

  const isins = entries.map(e => e.isin);

  // Join with candidate scores
  let items: any[] = [];
  if (isins.length > 0) {
    const scores = await db.select().from(candidateScoresTable)
      .orderBy(desc(candidateScoresTable.candidateScore));
    items = scores
      .filter(s => isins.includes(s.isin))
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
  }

  res.json({
    name: raw,
    display_name: meta.display_name,
    items,
    total: items.length,
  });
});

export default router;
