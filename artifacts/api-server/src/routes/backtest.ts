import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, backtestResultsTable } from "@workspace/db";
import { GetBacktestResultParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/backtest/results", async (_req, res): Promise<void> => {
  const items = await db.select().from(backtestResultsTable).orderBy(desc(backtestResultsTable.createdAt));
  res.json({
    items: items.map(r => ({
      id: r.id,
      name: r.name,
      test_type: r.testType,
      status: r.status,
      period_from: r.periodFrom ?? undefined,
      period_to: r.periodTo ?? undefined,
      cagr_pct: r.cagrPct ? parseFloat(r.cagrPct) : 0,
      sharpe_ratio: r.sharpeRatio ? parseFloat(r.sharpeRatio) : 0,
      sortino_ratio: r.sortinoRatio ? parseFloat(r.sortinoRatio) : null,
      max_drawdown_pct: r.maxDrawdownPct ? parseFloat(r.maxDrawdownPct) : 0,
      hit_rate_pct: r.hitRatePct ? parseFloat(r.hitRatePct) : null,
      rank_ic: r.rankIc ? parseFloat(r.rankIc) : null,
      created_at: r.createdAt.toISOString(),
    })),
    total: items.length,
  });
});

router.get("/backtest/factor-analysis", async (_req, res): Promise<void> => {
  // Do not return invented IC/decile statistics. A real factor analysis must be
  // computed from a PIT walk-forward run and linked to its source snapshot.
  res.json({
    computed: false,
    status: "not_computed",
    reason: "No reproducible point-in-time walk-forward run is available; fabricated factor statistics are intentionally suppressed.",
    factors: [],
  });
});

router.get("/backtest/results/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [r] = await db.select().from(backtestResultsTable).where(eq(backtestResultsTable.id, id));
  if (!r) { res.status(404).json({ error: "Backtest result not found" }); return; }

  res.json({
    id: r.id,
    name: r.name,
    test_type: r.testType,
    status: r.status,
    period_from: r.periodFrom ?? undefined,
    period_to: r.periodTo ?? undefined,
    metrics: {
      cagr_pct: r.cagrPct ? parseFloat(r.cagrPct) : 0,
      excess_return_pct: r.excessReturnPct ? parseFloat(r.excessReturnPct) : null,
      volatility_pct: r.volatilityPct ? parseFloat(r.volatilityPct) : 0,
      max_drawdown_pct: r.maxDrawdownPct ? parseFloat(r.maxDrawdownPct) : 0,
      drawdown_duration_days: r.drawdownDurationDays ?? null,
      sharpe_ratio: r.sharpeRatio ? parseFloat(r.sharpeRatio) : 0,
      sortino_ratio: r.sortinoRatio ? parseFloat(r.sortinoRatio) : null,
      calmar_ratio: r.calmarRatio ? parseFloat(r.calmarRatio) : null,
      information_ratio: r.informationRatio ? parseFloat(r.informationRatio) : null,
      hit_rate_pct: r.hitRatePct ? parseFloat(r.hitRatePct) : null,
      upside_capture_pct: r.upsideCapturePct ? parseFloat(r.upsideCapturePct) : null,
      downside_capture_pct: r.downsideCapturePct ? parseFloat(r.downsideCapturePct) : null,
      rank_ic: r.rankIc ? parseFloat(r.rankIc) : null,
      rank_ic_stability: r.rankIcStability ? parseFloat(r.rankIcStability) : null,
      decile_spread_pct: r.decileSpreadPct ? parseFloat(r.decileSpreadPct) : null,
      decile_monotonicity_pct: r.decileMonotonicityPct ? parseFloat(r.decileMonotonicityPct) : null,
      turnover_pct: r.turnoverPct ? parseFloat(r.turnoverPct) : null,
      avg_slippage_bps: r.avgSlippageBps ? parseFloat(r.avgSlippageBps) : null,
      avg_market_impact_bps: r.avgMarketImpactBps ? parseFloat(r.avgMarketImpactBps) : null,
      deflated_sharpe: r.deflatedSharpe ? parseFloat(r.deflatedSharpe) : null,
      probability_of_overfitting: r.probabilityOfOverfitting ? parseFloat(r.probabilityOfOverfitting) : null,
    },
    equity_curve: (r.equityCurve as any[]) ?? [],
    decile_returns: (r.decileReturns as any[]) ?? [],
    notes: r.notes ?? "",
    created_at: r.createdAt.toISOString(),
  });
});

export default router;
