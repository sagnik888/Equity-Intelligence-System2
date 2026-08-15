import { Router, type IRouter } from "express";
import { and, eq, sql, desc, or } from "drizzle-orm";
import { db, signalsTable, signalHistoryTable } from "@workspace/db";
import {
  ListSignalsQueryParams,
  GetStockSignalsParams,
  GetTopBuySignalsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function mapSignal(s: typeof signalsTable.$inferSelect) {
  return {
    isin: s.isin,
    ticker: s.ticker,
    name: s.name,
    sector: s.sector,
    universe_group: s.universeGroup,
    horizon: s.horizon,
    state: s.state,
    hss: s.hss ? parseFloat(s.hss) : 0,
    confidence: s.confidence ? parseFloat(s.confidence) : 0,
    stale_penalty: s.stalePenalty ? parseFloat(s.stalePenalty) : 0,
    event_penalty: s.eventPenalty ? parseFloat(s.eventPenalty) : 0,
    risk_penalty: s.riskPenalty ? parseFloat(s.riskPenalty) : 0,
    hard_gate_cap: s.hardGateCap ? parseFloat(s.hardGateCap) : null,
    alignment_score: s.alignmentScore ? parseFloat(s.alignmentScore) : null,
    signal_date: s.signalDate,
    days_in_state: s.daysInState,
    candidate_score: s.candidateScore ? parseFloat(s.candidateScore) : null,
    current_price: s.currentPrice ? parseFloat(s.currentPrice) : null,
  };
}

router.get("/signals", async (req, res): Promise<void> => {
  const query = ListSignalsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { horizon, state, sector, group, limit, offset } = query.data;

  const conditions = [];
  if (horizon && horizon !== "all") conditions.push(eq(signalsTable.horizon, horizon as any));
  if (state) conditions.push(eq(signalsTable.state, state as any));
  if (sector) conditions.push(eq(signalsTable.sector, sector));
  if (group) conditions.push(eq(signalsTable.universeGroup, group));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [items, countResult] = await Promise.all([
    db.select().from(signalsTable).where(where).orderBy(desc(signalsTable.hss)).limit(limit ?? 100).offset(offset ?? 0),
    db.select({ count: sql<number>`count(*)` }).from(signalsTable).where(where),
  ]);

  res.json({ items: items.map(mapSignal), total: Number(countResult[0]?.count ?? 0) });
});

router.get("/signals/state-summary", async (_req, res): Promise<void> => {
  const [byState, byHorizonState] = await Promise.all([
    db.select({
      state: signalsTable.state,
      count: sql<number>`count(*)`
    }).from(signalsTable).groupBy(signalsTable.state),
    db.select({
      horizon: signalsTable.horizon,
      state: signalsTable.state,
      count: sql<number>`count(*)`
    }).from(signalsTable).groupBy(signalsTable.horizon, signalsTable.state),
  ]);

  const horizons = ["daily", "weekly", "monthly", "medium", "long"];
  const byHorizon = horizons.map(h => {
    const rows = byHorizonState.filter(r => r.horizon === h);
    const get = (st: string) => Number(rows.find(r => r.state === st)?.count ?? 0);
    return {
      horizon: h,
      strong_buy: get("strong_buy"),
      buy: get("buy"),
      accumulate: get("accumulate"),
      watch: get("watch"),
      hold: get("hold"),
      reduce: get("reduce"),
      sell: get("sell"),
      avoid: get("avoid"),
      pending_review: get("pending_review"),
    };
  });

  res.json({
    by_state: byState.map(r => ({ state: r.state, count: Number(r.count) })),
    by_horizon: byHorizon,
  });
});

router.get("/signals/top-buys", async (req, res): Promise<void> => {
  const query = GetTopBuySignalsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { horizon, limit } = query.data;

  const conditions = [or(
    eq(signalsTable.state, "strong_buy"),
    eq(signalsTable.state, "buy"),
    eq(signalsTable.state, "accumulate"),
  )!];
  if (horizon) conditions.push(eq(signalsTable.horizon, horizon as any));

  const items = await db.select().from(signalsTable)
    .where(and(...conditions))
    .orderBy(desc(signalsTable.hss))
    .limit(limit ?? 20);

  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(signalsTable).where(and(...conditions));

  res.json({ items: items.map(mapSignal), total: Number(countResult?.count ?? 0) });
});

router.get("/signals/:isin", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.isin) ? req.params.isin[0] : req.params.isin;
  const [signals, history] = await Promise.all([
    db.select().from(signalsTable).where(eq(signalsTable.isin, raw)).orderBy(signalsTable.horizon),
    db.select({
      date: signalHistoryTable.signalDate,
      horizon: signalHistoryTable.horizon,
      state: signalHistoryTable.state,
      hss: signalHistoryTable.hss,
    }).from(signalHistoryTable).where(eq(signalHistoryTable.isin, raw)).orderBy(signalHistoryTable.signalDate),
  ]);

  // Cross-horizon alignment score: weighted average of DirectionValue
  const directionMap: Record<string, number> = {
    strong_buy: 1.0, buy: 0.75, accumulate: 0.5, watch: 0.2,
    hold: 0, reduce: -0.5, sell: -0.5, avoid: -1.0, pending_review: 0, no_signal: 0
  };
  const horizonWeights: Record<string, number> = { daily: 0.1, weekly: 0.2, monthly: 0.3, medium: 0.2, long: 0.2 };
  let weightedSum = 0, totalWeight = 0;
  for (const sig of signals) {
    const w = horizonWeights[sig.horizon] ?? 0.2;
    weightedSum += w * (directionMap[sig.state] ?? 0);
    totalWeight += w;
  }
  const alignmentScore = totalWeight > 0 ? (weightedSum / totalWeight) : null;

  const ticker = signals[0]?.ticker ?? raw;
  const name = signals[0]?.name ?? raw;

  res.json({
    isin: raw,
    ticker,
    name,
    alignment_score: alignmentScore,
    cross_horizon_state: alignmentScore !== null
      ? (alignmentScore >= 0.65 ? "strong_buy"
        : alignmentScore >= 0.25 ? "buy"
        : alignmentScore <= -0.65 ? "avoid"
        : alignmentScore < -0.25 ? "reduce"
        : alignmentScore > 0 ? "watch" : "hold")
      : null,
    signals: signals.map(mapSignal),
    signal_history: history.map(h => ({
      date: h.date,
      horizon: h.horizon,
      state: h.state,
      hss: h.hss ? parseFloat(h.hss) : 0,
    })),
  });
});

export default router;
