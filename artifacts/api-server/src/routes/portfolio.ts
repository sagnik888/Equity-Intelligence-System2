import { Router, type IRouter } from "express";
import { and, eq, sql, desc, ne } from "drizzle-orm";
import { db, portfolioPositionsTable, securitiesTable, signalsTable } from "@workspace/db";
import {
  AddPortfolioPositionBody,
  UpdatePortfolioPositionBody,
  UpdatePortfolioPositionParams,
  DeletePortfolioPositionParams,
  ListSuitabilityScoresQueryParams,
  CalculatePositionSizeBody,
} from "@workspace/api-zod";

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
  const totalCapital = 10_000_000; // 1 Crore default capital
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
    review_required: positions.filter(p => p.currentSignal === "sell" || p.currentSignal === "avoid").map(p => mapPosition(p, totalValue)),
  });
});

router.get("/portfolio/suitability", async (req, res): Promise<void> => {
  const query = ListSuitabilityScoresQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  // Generate suitability scores from signals and securities
  const signals = await db.select().from(signalsTable)
    .where(eq(signalsTable.horizon, "monthly"))
    .orderBy(desc(signalsTable.hss))
    .limit(query.data.limit ?? 50);

  const items = signals.map(s => {
    const returnScore = Math.max(0, Math.min(1, (parseFloat(s.hss) - 50) / 50));
    const confidenceFactor = parseFloat(s.confidence) / 100;
    const liquidityFactor = 0.85; // placeholder
    const downside = 1.1;
    const volatility = 1.15;
    const raw = 100 * returnScore * confidenceFactor * liquidityFactor / (downside * volatility);

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
      correlation_penalty: 1.0,
      event_penalty: 1 + (parseFloat(s.eventPenalty) / 100),
      risk_level: raw > 70 ? "low" : raw > 50 ? "medium" : raw > 30 ? "high" : "very_high",
    };
  });

  res.json({ items, total: items.length });
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

  // POSITION_SIZING_V2 formula from spec
  const riskBudget = portfolio_capital * (risk_percent_per_unit / 100);
  const roundtripCost = entry_price * (estimated_roundtrip_cost_pct / 100);
  const perUnitRisk = Math.abs(entry_price - stop_price) + roundtripCost;
  const minPriceRisk = entry_price * 0.005;
  const effectiveRisk = Math.max(perUnitRisk, minPriceRisk);
  const quantityByRisk = Math.floor(riskBudget / effectiveRisk);

  const liquidityCapacityValue = medianDtv * 1_00_00_000 * allowed_participation_rate * max_exit_days;
  const quantityByLiquidity = Math.floor(liquidityCapacityValue / entry_price);
  const quantityByCompanyCap = Math.floor((portfolio_capital * max_company_weight) / entry_price);
  const quantityBySectorCap = Math.floor((portfolio_capital * max_sector_weight) / entry_price);

  const finalQuantity = Math.max(0, Math.min(quantityByRisk, quantityByLiquidity, quantityByCompanyCap, quantityBySectorCap));

  const constraints = [
    { name: "risk", val: quantityByRisk },
    { name: "liquidity", val: quantityByLiquidity },
    { name: "company_cap", val: quantityByCompanyCap },
    { name: "sector_cap", val: quantityBySectorCap },
  ];
  const binding = constraints.reduce((min, c) => c.val < min.val ? c : min, constraints[0]!);

  const estimatedExitDays = finalQuantity > 0 && medianDtv > 0
    ? (finalQuantity * entry_price) / (medianDtv * 1_00_00_000 * allowed_participation_rate)
    : null;

  res.json({
    isin,
    ticker,
    name,
    final_quantity: finalQuantity,
    quantity_by_risk: quantityByRisk,
    quantity_by_liquidity: quantityByLiquidity,
    quantity_by_company_cap: quantityByCompanyCap,
    quantity_by_sector_cap: quantityBySectorCap,
    binding_constraint: binding.name,
    position_value: finalQuantity * entry_price,
    portfolio_weight_pct: (finalQuantity * entry_price / portfolio_capital) * 100,
    risk_amount: finalQuantity * effectiveRisk,
    median_daily_traded_value_cr: medianDtv,
    estimated_exit_days: estimatedExitDays,
  });
});

export default router;
