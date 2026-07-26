/**
 * Backtesting and Performance Analytics Routes
 * Implements backtesting engine and performance metrics calculation
 */

import { Router } from "express";
import { db } from "@ieis/db";
import {
  backtestResultsTable,
  performanceMetricsTable,
  tradeHistoryTable,
  dailyPricesTable,
  securitiesTable,
} from "@ieis/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import * as formulas from "@ieis/formulas";
import { z } from "zod/v4";

const router = Router();

// ============================================================================
// Request/Response Schemas
// ============================================================================

const CreateBacktestBody = z.object({
  name: z.string(),
  test_type: z.enum(["candidate_score", "daily_signal", "weekly_signal", "monthly_signal", "factor", "portfolio_optimization"]),
  period_from: z.string(),
  period_to: z.string(),
  universe: z.string().optional(),
  sector_filter: z.string().optional(),
  data_confidence_threshold: z.number().optional(),
});

const AddTradeBody = z.object({
  backtest_id: text("backtest_id").notNull(),
  isin: z.string(),
  entry_date: z.string(),
  exit_date: z.string().optional(),
  entry_price: z.number().positive(),
  exit_price: z.number().positive().optional(),
  quantity: z.number().positive(),
  entry_signal: z.string().optional(),
  exit_signal: z.string().optional(),
  reason_for_exit: z.string().optional(),
});

const ListBacktestsQueryParams = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  test_type: z.string().optional(),
});

// ============================================================================
// Backtesting Management
// ============================================================================

router.post("/backtest/create", async (req, res): Promise<void> => {
  try {
    const parsed = CreateBacktestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { name, test_type, period_from, period_to, universe, sector_filter, data_confidence_threshold } = parsed.data;

    const [inserted] = await db
      .insert(backtestResultsTable)
      .values({
        name,
        testType: test_type,
        status: "running",
        periodFrom: period_from,
        periodTo: period_to,
        notes: `Universe: ${universe || "all"}, Sector: ${sector_filter || "all"}, DC Threshold: ${data_confidence_threshold || "N/A"}`,
      })
      .returning();

    res.status(201).json({
      backtest_id: inserted.id,
      name,
      test_type,
      status: "running",
      period_from,
      period_to,
    });
  } catch (error) {
    console.error("Error creating backtest:", error);
    res.status(500).json({ error: "Failed to create backtest" });
  }
});

// ============================================================================
// List Backtests
// ============================================================================

router.get("/backtest/list", async (req, res): Promise<void> => {
  try {
    const query = ListBacktestsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    let dbQuery = db.select().from(backtestResultsTable);

    if (query.data.test_type) {
      dbQuery = dbQuery.where(eq(backtestResultsTable.testType, query.data.test_type as any));
    }

    dbQuery = dbQuery.orderBy(desc(backtestResultsTable.createdAt));

    const limit = query.data.limit ?? 20;
    const offset = query.data.offset ?? 0;

    const backtests = await dbQuery.limit(limit).offset(offset);

    const items = backtests.map((b) => ({
      backtest_id: b.id,
      name: b.name,
      test_type: b.testType,
      status: b.status,
      period_from: b.periodFrom,
      period_to: b.periodTo,
      cagr_pct: b.cagrPct ? parseFloat(b.cagrPct) : null,
      sharpe_ratio: b.sharpeRatio ? parseFloat(b.sharpeRatio) : null,
      max_drawdown_pct: b.maxDrawdownPct ? parseFloat(b.maxDrawdownPct) : null,
      created_at: b.createdAt,
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching backtests:", error);
    res.status(500).json({ error: "Failed to fetch backtests" });
  }
});

// ============================================================================
// Backtest Detail
// ============================================================================

router.get("/backtest/:backtest_id", async (req, res): Promise<void> => {
  try {
    const { backtest_id } = req.params;

    const [backtest] = await db
      .select()
      .from(backtestResultsTable)
      .where(eq(backtestResultsTable.id, parseInt(backtest_id)));

    if (!backtest) {
      res.status(404).json({ error: "Backtest not found" });
      return;
    }

    // Get trade history
    const trades = await db
      .select()
      .from(tradeHistoryTable)
      .where(eq(tradeHistoryTable.backtest_id, backtest_id));

    res.json({
      backtest_id: backtest.id,
      name: backtest.name,
      test_type: backtest.testType,
      status: backtest.status,
      period_from: backtest.periodFrom,
      period_to: backtest.periodTo,
      cagr_pct: backtest.cagrPct ? parseFloat(backtest.cagrPct) : null,
      excess_return_pct: backtest.excessReturnPct ? parseFloat(backtest.excessReturnPct) : null,
      volatility_pct: backtest.volatilityPct ? parseFloat(backtest.volatilityPct) : null,
      max_drawdown_pct: backtest.maxDrawdownPct ? parseFloat(backtest.maxDrawdownPct) : null,
      sharpe_ratio: backtest.sharpeRatio ? parseFloat(backtest.sharpeRatio) : null,
      sortino_ratio: backtest.sortinoRatio ? parseFloat(backtest.sortinoRatio) : null,
      calmar_ratio: backtest.calmarRatio ? parseFloat(backtest.calmarRatio) : null,
      hit_rate_pct: backtest.hitRatePct ? parseFloat(backtest.hitRatePct) : null,
      turnover_pct: backtest.turnoverPct ? parseFloat(backtest.turnoverPct) : null,
      total_trades: trades.length,
      equity_curve: backtest.equityCurve ? JSON.parse(backtest.equityCurve as string) : null,
      decile_returns: backtest.decileReturns ? JSON.parse(backtest.decileReturns as string) : null,
    });
  } catch (error) {
    console.error("Error fetching backtest:", error);
    res.status(500).json({ error: "Failed to fetch backtest" });
  }
});

// ============================================================================
// Add Trade to Backtest
// ============================================================================

router.post("/backtest/:backtest_id/trade", async (req, res): Promise<void> => {
  try {
    const { backtest_id } = req.params;
    const { isin, entry_date, exit_date, entry_price, exit_price, quantity, entry_signal, exit_signal, reason_for_exit } = req.body;

    // Get security info
    const [security] = await db
      .select()
      .from(securitiesTable)
      .where(eq(securitiesTable.isin, isin));

    if (!security) {
      res.status(404).json({ error: "Security not found" });
      return;
    }

    const tradeId = `${backtest_id}_${isin}_${Date.now()}`;
    let returnPct = 0;
    let returnAmount = 0;
    let holdingDays = 0;

    if (exit_price && exit_date) {
      returnPct = ((exit_price - entry_price) / entry_price) * 100;
      returnAmount = (exit_price - entry_price) * quantity;
      const entryTime = new Date(entry_date).getTime();
      const exitTime = new Date(exit_date).getTime();
      holdingDays = Math.floor((exitTime - entryTime) / (1000 * 60 * 60 * 24));
    }

    const [inserted] = await db
      .insert(tradeHistoryTable)
      .values({
        backtest_id,
        trade_id: tradeId,
        isin,
        ticker: security.ticker,
        entry_date: new Date(entry_date),
        exit_date: exit_date ? new Date(exit_date) : undefined,
        entry_price: entry_price.toString(),
        exit_price: exit_price ? exit_price.toString() : undefined,
        quantity: quantity.toString(),
        entry_signal,
        exit_signal,
        holding_days: holdingDays.toString(),
        return_pct: returnPct.toString(),
        return_amount: returnAmount.toString(),
        reason_for_exit,
      })
      .returning();

    res.status(201).json({
      trade_id: tradeId,
      isin,
      ticker: security.ticker,
      entry_date,
      exit_date,
      entry_price,
      exit_price,
      quantity,
      return_pct: returnPct,
      return_amount: returnAmount,
    });
  } catch (error) {
    console.error("Error adding trade:", error);
    res.status(500).json({ error: "Failed to add trade" });
  }
});

// ============================================================================
// Get Trade History for Backtest
// ============================================================================

router.get("/backtest/:backtest_id/trades", async (req, res): Promise<void> => {
  try {
    const { backtest_id } = req.params;

    const trades = await db
      .select()
      .from(tradeHistoryTable)
      .where(eq(tradeHistoryTable.backtest_id, backtest_id));

    if (trades.length === 0) {
      res.status(404).json({ error: "No trades found for this backtest" });
      return;
    }

    // Calculate statistics
    const closedTrades = trades.filter((t) => t.exit_date);
    const winningTrades = closedTrades.filter((t) => parseFloat(t.return_pct || "0") > 0);
    const losingTrades = closedTrades.filter((t) => parseFloat(t.return_pct || "0") < 0);

    const totalReturn = closedTrades.reduce((sum, t) => sum + parseFloat(t.return_pct || "0"), 0);
    const avgReturn = closedTrades.length > 0 ? totalReturn / closedTrades.length : 0;
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

    const items = trades.map((t) => ({
      trade_id: t.trade_id,
      isin: t.isin,
      ticker: t.ticker,
      entry_date: t.entry_date,
      exit_date: t.exit_date,
      entry_price: parseFloat(t.entry_price),
      exit_price: t.exit_price ? parseFloat(t.exit_price) : null,
      quantity: parseFloat(t.quantity),
      entry_signal: t.entry_signal,
      exit_signal: t.exit_signal,
      holding_days: t.holding_days ? parseFloat(t.holding_days) : null,
      return_pct: t.return_pct ? parseFloat(t.return_pct) : null,
      return_amount: t.return_amount ? parseFloat(t.return_amount) : null,
      reason_for_exit: t.reason_for_exit,
    }));

    res.json({
      backtest_id,
      total_trades: trades.length,
      closed_trades: closedTrades.length,
      open_trades: trades.length - closedTrades.length,
      winning_trades: winningTrades.length,
      losing_trades: losingTrades.length,
      win_rate_pct: winRate,
      avg_return_pct: avgReturn,
      total_return_pct: totalReturn,
      trades: items,
    });
  } catch (error) {
    console.error("Error fetching trades:", error);
    res.status(500).json({ error: "Failed to fetch trades" });
  }
});

// ============================================================================
// Performance Metrics
// ============================================================================

router.get("/backtest/:backtest_id/performance", async (req, res): Promise<void> => {
  try {
    const { backtest_id } = req.params;

    const metrics = await db
      .select()
      .from(performanceMetricsTable)
      .where(eq(performanceMetricsTable.backtest_id, backtest_id))
      .orderBy(performanceMetricsTable.metric_date);

    if (metrics.length === 0) {
      res.status(404).json({ error: "No performance metrics found for this backtest" });
      return;
    }

    // Calculate summary statistics
    const dailyReturns = metrics
      .filter((m) => m.daily_return_pct)
      .map((m) => parseFloat(m.daily_return_pct!));

    const avgDailyReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const volatility = calculateStdDev(dailyReturns);
    const sharpeRatio = volatility > 0 ? (avgDailyReturn * 252) / (volatility * Math.sqrt(252)) : 0;

    const drawdowns = metrics.map((m) => parseFloat(m.drawdown_pct || "0"));
    const maxDrawdown = Math.min(...drawdowns);

    const items = metrics.map((m) => ({
      metric_date: m.metric_date,
      portfolio_value: parseFloat(m.portfolio_value),
      daily_return_pct: m.daily_return_pct ? parseFloat(m.daily_return_pct) : null,
      cumulative_return_pct: m.cumulative_return_pct ? parseFloat(m.cumulative_return_pct) : null,
      drawdown_pct: m.drawdown_pct ? parseFloat(m.drawdown_pct) : null,
      positions_count: m.positions_count ? parseFloat(m.positions_count) : null,
      cash_balance: m.cash_balance ? parseFloat(m.cash_balance) : null,
      gross_exposure_pct: m.gross_exposure_pct ? parseFloat(m.gross_exposure_pct) : null,
    }));

    res.json({
      backtest_id,
      total_days: metrics.length,
      avg_daily_return_pct: avgDailyReturn,
      volatility_pct: volatility,
      sharpe_ratio: sharpeRatio,
      max_drawdown_pct: maxDrawdown,
      final_value: metrics[metrics.length - 1].portfolio_value ? parseFloat(metrics[metrics.length - 1].portfolio_value) : null,
      metrics: items,
    });
  } catch (error) {
    console.error("Error fetching performance metrics:", error);
    res.status(500).json({ error: "Failed to fetch performance metrics" });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export default router;
