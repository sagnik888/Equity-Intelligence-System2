import { Router, type IRouter } from "express";
import { and, eq, sql, desc, ne } from "drizzle-orm";
import {
  db,
  portfolioPositionsTable,
  portfolioSettingsTable,
  paperOrderIntentsTable,
  securitiesTable,
  signalsTable,
  candidateScoresTable,
  hardGatesTable,
} from "@workspace/db";
import {
  AddPortfolioPositionBody,
  UpdatePortfolioPositionBody,
  UpdatePortfolioPositionParams,
  DeletePortfolioPositionParams,
  ListSuitabilityScoresQueryParams,
  CalculatePositionSizeBody,
} from "@workspace/api-zod";
import { positionSizingV2 } from "../lib/positionSizing";

const router: IRouter = Router();

function computePnl(entryPrice: number, currentPrice: number, quantity: number) {
  const unrealizedPnl = (currentPrice - entryPrice) * quantity;
  const unrealizedPnlPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
  return { unrealizedPnl, unrealizedPnlPct };
}

function mapPosition(p: typeof portfolioPositionsTable.$inferSelect, totalValue: number) {
  const entry = parseFloat(p.entryPrice);
  const current = parseFloat(p.currentPrice);
  const { unrealizedPnl, unrealizedPnlPct } = computePnl(entry, current, p.quantity);
  const posValue = current * p.quantity;
  return {
    id: p.id,
    isin: p.isin,
    ticker: p.ticker,
    name: p.name,
    sector: p.sector,
    quantity: p.quantity,
    entry_price: entry,
    current_price: current,
    stop_price: p.stopPrice ? parseFloat(p.stopPrice) : null,
    target_price: p.targetPrice ? parseFloat(p.targetPrice) : null,
    horizon: p.horizon,
    status: p.status,
    entry_date: p.entryDate,
    exit_date: p.exitDate ?? null,
    unrealized_pnl: unrealizedPnl,
    unrealized_pnl_pct: unrealizedPnlPct,
    weight_pct: totalValue > 0 ? (posValue / totalValue) * 100 : 0,
    current_signal: p.currentSignal ?? null,
    current_candidate_score: p.currentCandidateScore ? parseFloat(p.currentCandidateScore) : null,
    suitability_score: p.suitabilityScore ? parseFloat(p.suitabilityScore) : null,
  };
}

router.get("/portfolio", async (_req, res): Promise<void> => {
  const positions = await db.select().from(portfolioPositionsTable)
    .where(ne(portfolioPositionsTable.status, "closed"))
    .orderBy(desc(portfolioPositionsTable.entryDate));

  const totalValue = positions.reduce((sum, p) => sum + parseFloat(p.currentPrice) * p.quantity, 0);
  res.json({ items: positions.map(p => mapPosition(p, totalValue)), total: positions.length });
});

router.post("/portfolio", async (req, res): Promise<void> => {
  const parsed = AddPortfolioPositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Look up security info
  const [security] = await db.select().from(securitiesTable).where(eq(securitiesTable.isin, parsed.data.isin));
  if (!security) {
    res.status(404).json({ error: "Security not found" });
    return;
  }

  const currentPrice = security.currentPrice ? parseFloat(security.currentPrice) : parseFloat(String(parsed.data.entry_price));
  const [created] = await db.insert(portfolioPositionsTable).values({
    isin: parsed.data.isin,
    ticker: security.ticker,
    name: security.name,
    sector: security.sector,
    quantity: parsed.data.quantity,
    entryPrice: String(parsed.data.entry_price),
    currentPrice: String(currentPrice),
    stopPrice: parsed.data.stop_price != null ? String(parsed.data.stop_price) : null,
    targetPrice: parsed.data.target_price != null ? String(parsed.data.target_price) : null,
    horizon: parsed.data.horizon,
    status: (parsed.data.status ?? "paper") as any,
    entryDate: new Date().toISOString().split("T")[0]!,
    notes: parsed.data.notes,
  }).returning();

  const { unrealizedPnl, unrealizedPnlPct } = computePnl(parseFloat(created!.entryPrice), parseFloat(created!.currentPrice), created!.quantity);
  res.status(201).json(mapPosition(created!, currentPrice * created!.quantity));
});

router.patch("/portfolio/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdatePortfolioPositionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, any> = {};
  if (parsed.data.quantity != null) updateData.quantity = parsed.data.quantity;
  if (parsed.data.stop_price !== undefined) updateData.stopPrice = parsed.data.stop_price != null ? String(parsed.data.stop_price) : null;
  if (parsed.data.target_price !== undefined) updateData.targetPrice = parsed.data.target_price != null ? String(parsed.data.target_price) : null;
  if (parsed.data.status != null) updateData.status = parsed.data.status;
  if (parsed.data.exit_price != null) updateData.exitPrice = String(parsed.data.exit_price);
  if (parsed.data.notes != null) updateData.notes = parsed.data.notes;

  const [updated] = await db.update(portfolioPositionsTable).set(updateData).where(eq(portfolioPositionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Position not found" }); return; }
  res.json(mapPosition(updated, parseFloat(updated.currentPrice) * updated.quantity));
});

router.delete("/portfolio/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(portfolioPositionsTable).where(eq(portfolioPositionsTable.id, id));
  res.sendStatus(204);
});

router.get("/portfolio/summary", async (_req, res): Promise<void> => {
  const positions = await db.select().from(portfolioPositionsTable).where(ne(portfolioPositionsTable.status, "closed"));
  const [settings] = await db.select().from(portfolioSettingsTable).where(eq(portfolioSettingsTable.id, 1));
  const totalCapital = settings ? parseFloat(settings.capital) : 0;
  const totalValue = positions.reduce((sum, p) => sum + parseFloat(p.currentPrice) * p.quantity, 0);
  const totalCost = positions.reduce((sum, p) => sum + parseFloat(p.entryPrice) * p.quantity, 0);
  const unrealizedPnl = totalValue - totalCost;
  const unrealizedPnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

  const sectorMap: Record<string, number> = {};
  for (const p of positions) {
    sectorMap[p.sector] = (sectorMap[p.sector] ?? 0) + parseFloat(p.currentPrice) * p.quantity;
  }

  const sorted = [...positions].sort((a, b) => {
    const pnlA = (parseFloat(a.currentPrice) - parseFloat(a.entryPrice)) * a.quantity;
    const pnlB = (parseFloat(b.currentPrice) - parseFloat(b.entryPrice)) * b.quantity;
    return pnlB - pnlA;
  });

  res.json({
    total_capital: totalCapital,
    invested_capital: totalValue,
    cash: totalCapital - totalValue,
    unrealized_pnl: unrealizedPnl,
    unrealized_pnl_pct: unrealizedPnlPct,
    positions_count: positions.length,
    sector_concentration: Object.entries(sectorMap).map(([sector, val]) => ({
      sector,
      weight_pct: totalValue > 0 ? (val / totalValue) * 100 : 0,
    })).sort((a, b) => b.weight_pct - a.weight_pct),
    top_winners: sorted.slice(0, 3).map(p => mapPosition(p, totalValue)),
    top_losers: sorted.slice(-3).reverse().map(p => mapPosition(p, totalValue)),
     review_required: positions.filter(p => ["reduce", "sell", "avoid", "pending_review"].includes(p.currentSignal ?? "")).map(p => mapPosition(p, totalValue)),
     operating_mode: settings?.operatingMode ?? "paper",
     live_execution_enabled: settings?.liveExecutionEnabled ?? false,
     kill_switch_enabled: settings?.killSwitchEnabled ?? false,
  });
});

router.get("/portfolio/suitability", async (req, res): Promise<void> => {
  const query = ListSuitabilityScoresQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  // Generate suitability scores from signals and securities
  const [signals, securities, scores, gates, openPositions] = await Promise.all([
    db.select().from(signalsTable)
    .where(eq(signalsTable.horizon, "monthly"))
    .orderBy(desc(signalsTable.hss))
    .limit(query.data.limit ?? 50),
    db.select().from(securitiesTable),
    db.select().from(candidateScoresTable),
    db.select().from(hardGatesTable),
    db.select().from(portfolioPositionsTable).where(ne(portfolioPositionsTable.status, "closed")),
  ]);
  const securityMap = new Map(securities.map(s => [s.isin, s]));
  const scoreMap = new Map(scores.map(s => [s.isin, s]));
  const sectorCounts = new Map<string, number>();
  for (const position of openPositions) sectorCounts.set(position.sector, (sectorCounts.get(position.sector) ?? 0) + 1);

  const items = signals.map(s => {
    const security = securityMap.get(s.isin);
    const score = scoreMap.get(s.isin);
    const returnScore = Math.max(0, Math.min(1, (parseFloat(s.hss) - 50) / 50));
    const confidenceFactor = parseFloat(s.confidence) / 100;
    const dtv = security?.medianDailyTradedValueCr ? parseFloat(security.medianDailyTradedValueCr) : null;
    const liquidityFactor = dtv == null ? 0 : Math.min(1, Math.log10(1 + Math.max(0, dtv)) / 3);
    const debt = security?.netDebtToEbitda ? Math.max(0, parseFloat(security.netDebtToEbitda)) : 0;
    const downside = 1 + Math.min(1, debt / 10) + (gates.some(g => g.isin === s.isin && g.level === 1) ? 0.5 : 0);
    const volatility = 1 + Math.max(0, 100 - (score?.dataConfidence ? parseFloat(score.dataConfidence) : 0)) / 100;
    const correlation = 1 + Math.min(1, (sectorCounts.get(s.sector) ?? 0) / 10);
    const eventPenalty = 1 + (parseFloat(s.eventPenalty) / 100);
    const raw = 100 * returnScore * confidenceFactor * liquidityFactor / (downside * volatility * correlation * eventPenalty);

    return {
      isin: s.isin,
      ticker: s.ticker,
      name: s.name,
      sector: s.sector,
      suitability_score: Math.min(100, Math.max(0, raw)),
      expected_return_pct: (parseFloat(s.hss) - 50) * 0.4,
      research_confidence: parseFloat(s.confidence),
      liquidity_factor: liquidityFactor,
      downside_penalty: downside,
      volatility_penalty: volatility,
       correlation_penalty: correlation,
       event_penalty: eventPenalty,
      risk_level: raw > 70 ? "low" : raw > 50 ? "medium" : raw > 30 ? "high" : "very_high",
    };
  });

  res.json({ items, total: items.length });
});

router.get("/portfolio/order-intents", async (_req, res): Promise<void> => {
  const intents = await db.select().from(paperOrderIntentsTable).orderBy(desc(paperOrderIntentsTable.createdAt)).limit(100);
  res.json({
    items: intents.map(intent => ({
      id: intent.id, idempotency_key: intent.idempotencyKey, isin: intent.isin, ticker: intent.ticker,
      side: intent.side, order_type: intent.orderType, quantity: intent.quantity,
      limit_price: intent.limitPrice ? parseFloat(intent.limitPrice) : null, status: intent.status,
      rationale: intent.rationale, created_by: intent.createdBy, approved_by: intent.approvedBy,
      created_at: intent.createdAt.toISOString(), updated_at: intent.updatedAt.toISOString(),
    })),
    total: intents.length,
    execution_mode: "paper_only",
  });
});

router.post("/portfolio/order-intents", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const isin = typeof body.isin === "string" ? body.isin : "";
  const side = body.side === "buy" || body.side === "sell" ? body.side : null;
  const quantity = Number(body.quantity);
  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key : "";
  if (!isin || !side || !Number.isInteger(quantity) || quantity <= 0 || !idempotencyKey) {
    res.status(400).json({ error: "isin, side, positive integer quantity, and idempotency_key are required" }); return;
  }
  const [existing] = await db.select().from(paperOrderIntentsTable).where(eq(paperOrderIntentsTable.idempotencyKey, idempotencyKey));
  if (existing) {
    res.status(200).json({ duplicate: true, execution_mode: "paper_only", id: existing.id, status: existing.status }); return;
  }
  const [security] = await db.select().from(securitiesTable).where(eq(securitiesTable.isin, isin));
  if (!security) { res.status(404).json({ error: "Security not found" }); return; }
  const orderType = body.order_type === "market" ? "market" : "limit";
  const limitPrice = body.limit_price == null ? null : Number(body.limit_price);
  if (orderType === "limit" && (limitPrice == null || !Number.isFinite(limitPrice) || limitPrice <= 0)) {
    res.status(400).json({ error: "A positive limit_price is required for limit orders" }); return;
  }
  const [created] = await db.insert(paperOrderIntentsTable).values({
    idempotencyKey, isin, ticker: security.ticker, side, orderType,
    quantity, limitPrice: limitPrice == null ? null : String(limitPrice),
    rationale: typeof body.rationale === "string" ? body.rationale : null,
    status: "draft", createdBy: "api",
  }).returning();
  res.status(201).json({ id: created!.id, status: created!.status, execution_mode: "paper_only", live_execution_enabled: false });
});

router.post("/portfolio/size", async (req, res): Promise<void> => {
  const parsed = CalculatePositionSizeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { isin, entry_price, stop_price, portfolio_capital,
    risk_percent_per_unit = 1.0, allowed_participation_rate = 0.1,
    max_exit_days = 10, max_company_weight = 0.1, max_sector_weight = 0.25,
    estimated_roundtrip_cost_pct = 0.3 } = parsed.data;

  const [security] = await db.select().from(securitiesTable).where(eq(securitiesTable.isin, isin));
  if (!security) { res.status(404).json({ error: "Security not found" }); return; }

  const ticker = security.ticker;
  const name = security.name;
  const medianDtv = security.medianDailyTradedValueCr ? parseFloat(security.medianDailyTradedValueCr) : 5;

  const currentPositions = await db.select().from(portfolioPositionsTable)
    .where(ne(portfolioPositionsTable.status, "closed"));
  const currentCompanyValue = currentPositions
    .filter((position) => position.isin === isin)
    .reduce((total, position) => total + parseFloat(position.currentPrice) * position.quantity, 0);
  const currentSectorValue = currentPositions
    .filter((position) => position.sector === security.sector)
    .reduce((total, position) => total + parseFloat(position.currentPrice) * position.quantity, 0);
  const currentHorizonValue = currentPositions
    .filter((position) => position.horizon === "medium")
    .reduce((total, position) => total + parseFloat(position.currentPrice) * position.quantity, 0);

  const sized = positionSizingV2({
    accountCapital: portfolio_capital,
    riskPercent: risk_percent_per_unit,
    entryPrice: entry_price,
    stopPrice: stop_price,
    medianDailyTradedValueCr: medianDtv,
    allowedParticipationRate: allowed_participation_rate,
    maxExitDays: max_exit_days,
    maxCompanyWeight: max_company_weight,
    maxSectorWeight: max_sector_weight,
    maxHorizonWeight: 0.25,
    maxCorrelationWeight: 0.2,
    maxEventWeight: 0.2,
    currentCompanyValue,
    currentSectorValue,
    currentHorizonValue,
    roundTripCostPct: estimated_roundtrip_cost_pct,
  });

  res.json({
    isin,
    ticker,
    name,
    final_quantity: sized.finalQuantity,
    quantity_by_risk: sized.quantityByRisk,
    quantity_by_liquidity: sized.quantityByLiquidity,
    quantity_by_company_cap: sized.quantityByCompanyCap,
    quantity_by_sector_cap: sized.quantityBySectorCap,
    binding_constraint: sized.bindingConstraint === "event_risk_cap" ? "event_cap" : sized.bindingConstraint,
    position_value: sized.finalPositionValue,
    portfolio_weight_pct: sized.portfolioWeightPct,
    risk_amount: sized.riskAmount,
    median_daily_traded_value_cr: medianDtv,
    estimated_exit_days: sized.estimatedExitDays,
  });
});

export default router;
