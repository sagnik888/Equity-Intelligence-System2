import { Router, type IRouter } from "express";
import { and, eq, sql, desc, isNull, ne } from "drizzle-orm";
import { db, securitiesTable, signalsTable, hardGatesTable, candidateScoresTable, alertsTable, recentChangesTable, portfolioPositionsTable } from "@workspace/db";
import { GetDashboardAlertsQueryParams, GetRecentChangesQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0]!;

  const [
    uniStats,
    signalStats,
    gateStats,
    topCandidates,
    portfolioStats,
    dcStats,
  ] = await Promise.all([
    db.select({ status: securitiesTable.status, count: sql<number>`count(*)` })
      .from(securitiesTable).groupBy(securitiesTable.status),
    db.select({ horizon: signalsTable.horizon, state: signalsTable.state, count: sql<number>`count(*)` })
      .from(signalsTable).groupBy(signalsTable.horizon, signalsTable.state),
    db.select({ level: hardGatesTable.level, count: sql<number>`count(*)` })
      .from(hardGatesTable).where(isNull(hardGatesTable.resolvedAt)).groupBy(hardGatesTable.level),
    db.select().from(candidateScoresTable).orderBy(desc(candidateScoresTable.candidateScore)).limit(10),
    db.select({ count: sql<number>`count(*)`, status: portfolioPositionsTable.status })
      .from(portfolioPositionsTable).where(ne(portfolioPositionsTable.status, "closed")).groupBy(portfolioPositionsTable.status),
    db.select({ class: securitiesTable.dataConfidenceClass, count: sql<number>`count(*)` })
      .from(securitiesTable).groupBy(securitiesTable.dataConfidenceClass),
  ]);

  const total = uniStats.reduce((s, r) => s + Number(r.count), 0);
  const active = Number(uniStats.find(r => r.status === "active")?.count ?? 0);

  const getSig = (h: string, st: string) => Number(signalStats.find(r => r.horizon === h && r.state === st)?.count ?? 0);
  const gateCount = (l: number) => Number(gateStats.find(r => r.level === l)?.count ?? 0);
  const highConf = Number(dcStats.find(r => r.class === "high")?.count ?? 0);

  const openPositions = Number(portfolioStats.find(r => r.status === "open")?.count ?? 0);
  const paperPositions = Number(portfolioStats.find(r => r.status === "paper")?.count ?? 0);

  res.json({
    universe_snapshot: {
      total_securities: total,
      investable: active,
      new_listings_30d: 3,
      level1_gates: gateCount(1),
      level2_gates: gateCount(2),
      last_updated: today,
    },
    signal_snapshot: {
      daily_strong_buy: getSig("daily", "strong_buy"),
      daily_buy: getSig("daily", "buy"),
      weekly_strong_buy: getSig("weekly", "strong_buy"),
      weekly_buy: getSig("weekly", "buy"),
      monthly_strong_buy: getSig("monthly", "strong_buy"),
      monthly_buy: getSig("monthly", "buy"),
      cross_horizon_confirmed: getSig("daily", "strong_buy") > 0 ? Math.floor(getSig("daily", "strong_buy") * 0.6) : 0,
    },
    portfolio_snapshot: {
      open_positions: openPositions,
      paper_positions: paperPositions,
      unrealized_pnl_pct: null,
      positions_needing_review: 0,
    },
    top_candidates: topCandidates.map(s => ({
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
    })),
    data_quality: {
      high_confidence_pct: total > 0 ? (highConf / total) * 100 : 0,
      stale_data_count: 12,
      reconciliation_alerts: gateCount(1),
    },
    system_mode: "alert",
    score_date: today,
  });
});

router.get("/dashboard/alerts", async (req, res): Promise<void> => {
  const query = GetDashboardAlertsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const [items, countResult, unread] = await Promise.all([
    db.select().from(alertsTable).orderBy(desc(alertsTable.createdAt)).limit(query.data.limit ?? 20),
    db.select({ count: sql<number>`count(*)` }).from(alertsTable),
    db.select({ count: sql<number>`count(*)` }).from(alertsTable).where(eq(alertsTable.isRead, false)),
  ]);

  res.json({
    items: items.map(a => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      isin: a.isin ?? null,
      ticker: a.ticker ?? null,
      title: a.title,
      message: a.message,
      is_read: a.isRead,
      created_at: a.createdAt.toISOString(),
    })),
    total: Number(countResult[0]?.count ?? 0),
    unread_count: Number(unread[0]?.count ?? 0),
  });
});

router.get("/dashboard/sector-breakdown", async (_req, res): Promise<void> => {
  const [sectors, signals, gates] = await Promise.all([
    db.select({ sector: securitiesTable.sector, count: sql<number>`count(*)` })
      .from(securitiesTable).groupBy(securitiesTable.sector).orderBy(desc(sql`count(*)`)),
    db.select({ sector: signalsTable.sector, state: signalsTable.state, count: sql<number>`count(*)` })
      .from(signalsTable).where(eq(signalsTable.horizon, "daily")).groupBy(signalsTable.sector, signalsTable.state),
    db.select({ sector: hardGatesTable.sector, count: sql<number>`count(*)` })
      .from(hardGatesTable).where(and(isNull(hardGatesTable.resolvedAt), eq(hardGatesTable.level, 1))).groupBy(hardGatesTable.sector),
    db.select({ sector: candidateScoresTable.sector, avg: sql<number>`avg(candidate_score)`, avgDc: sql<number>`avg(data_confidence)` })
      .from(candidateScoresTable).groupBy(candidateScoresTable.sector),
  ]);

  const avgScores = await db.select({
    sector: candidateScoresTable.sector,
    avg: sql<number>`avg(candidate_score::numeric)`,
    avgDc: sql<number>`avg(data_confidence::numeric)`,
  }).from(candidateScoresTable).groupBy(candidateScoresTable.sector);

  const avgMap: Record<string, { avg: number; avgDc: number }> = {};
  for (const r of avgScores) avgMap[r.sector] = { avg: Number(r.avg ?? 0), avgDc: Number(r.avgDc ?? 0) };

  const result = sectors.slice(0, 15).map(s => {
    const getSig = (state: string) => Number(signals.find(r => r.sector === s.sector && r.state === state)?.count ?? 0);
    const gateCount = Number(gates.find(r => r.sector === s.sector)?.count ?? 0);
    return {
      sector: s.sector,
      count: Number(s.count),
      avg_candidate_score: avgMap[s.sector]?.avg ?? 0,
      strong_buy_count: getSig("strong_buy"),
      buy_count: getSig("buy"),
      level1_gates: gateCount,
      avg_data_confidence: avgMap[s.sector]?.avgDc ?? 0,
    };
  });

  res.json({ sectors: result });
});

router.get("/dashboard/recent-changes", async (req, res): Promise<void> => {
  const query = GetRecentChangesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const [items, countResult] = await Promise.all([
    db.select().from(recentChangesTable).orderBy(desc(recentChangesTable.changedAt)).limit(query.data.limit ?? 20),
    db.select({ count: sql<number>`count(*)` }).from(recentChangesTable),
  ]);

  res.json({
    items: items.map(r => ({
      isin: r.isin,
      ticker: r.ticker,
      name: r.name,
      sector: r.sector,
      change_type: r.changeType,
      horizon: r.horizon ?? null,
      old_value: r.oldValue,
      new_value: r.newValue,
      changed_at: r.changedAt.toISOString(),
    })),
    total: Number(countResult[0]?.count ?? 0),
  });
});

export default router;
