import {
  pgTable,
  text,
  serial,
  timestamp,
  date,
  numeric,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const backtestStatusEnum = pgEnum("backtest_status", [
  "completed",
  "running",
  "failed",
]);

export const backtestTypeEnum = pgEnum("backtest_type", [
  "candidate_score",
  "daily_signal",
  "weekly_signal",
  "monthly_signal",
  "factor",
  "portfolio_optimization",
]);

export const backtestResultsTable = pgTable("backtest_results", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  testType: backtestTypeEnum("test_type").notNull(),
  status: backtestStatusEnum("status").notNull().default("completed"),
  periodFrom: date("period_from", { mode: "string" }),
  periodTo: date("period_to", { mode: "string" }),
  // Core return metrics
  cagrPct: numeric("cagr_pct", { precision: 8, scale: 2 }),
  excessReturnPct: numeric("excess_return_pct", { precision: 8, scale: 2 }),
  volatilityPct: numeric("volatility_pct", { precision: 8, scale: 2 }),
  maxDrawdownPct: numeric("max_drawdown_pct", { precision: 8, scale: 2 }),
  drawdownDurationDays: integer("drawdown_duration_days"),
  sharpeRatio: numeric("sharpe_ratio", { precision: 8, scale: 4 }),
  sortinoRatio: numeric("sortino_ratio", { precision: 8, scale: 4 }),
  calmarRatio: numeric("calmar_ratio", { precision: 8, scale: 4 }),
  informationRatio: numeric("information_ratio", { precision: 8, scale: 4 }),
  hitRatePct: numeric("hit_rate_pct", { precision: 8, scale: 2 }),
  upsideCapturePct: numeric("upside_capture_pct", { precision: 8, scale: 2 }),
  downsideCapturePct: numeric("downside_capture_pct", { precision: 8, scale: 2 }),
  // Ranking quality
  rankIc: numeric("rank_ic", { precision: 8, scale: 4 }),
  rankIcStability: numeric("rank_ic_stability", { precision: 8, scale: 4 }),
  decileSpreadPct: numeric("decile_spread_pct", { precision: 8, scale: 2 }),
  decileMonotonicityPct: numeric("decile_monotonicity_pct", { precision: 8, scale: 2 }),
  // Execution
  turnoverPct: numeric("turnover_pct", { precision: 8, scale: 2 }),
  avgSlippageBps: numeric("avg_slippage_bps", { precision: 8, scale: 2 }),
  avgMarketImpactBps: numeric("avg_market_impact_bps", { precision: 8, scale: 2 }),
  // Reliability
  deflatedSharpe: numeric("deflated_sharpe", { precision: 8, scale: 4 }),
  probabilityOfOverfitting: numeric("probability_of_overfitting", { precision: 6, scale: 4 }),
  // Detailed data
  equityCurve: jsonb("equity_curve"),  // [{date, value, benchmark}]
  decileReturns: jsonb("decile_returns"), // [{decile, return_pct}]
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const performanceMetricsTable = pgTable("performance_metrics", {
  id: serial("id").primaryKey(),
  backtest_id: text("backtest_id").notNull(),
  metric_date: timestamp("metric_date", { withTimezone: true }).notNull(),
  portfolio_value: numeric("portfolio_value", { precision: 15, scale: 2 }).notNull(),
  daily_return_pct: numeric("daily_return_pct", { precision: 8, scale: 4 }),
  cumulative_return_pct: numeric("cumulative_return_pct", { precision: 8, scale: 4 }),
  drawdown_pct: numeric("drawdown_pct", { precision: 8, scale: 4 }),
  positions_count: numeric("positions_count", { precision: 5, scale: 0 }),
  cash_balance: numeric("cash_balance", { precision: 15, scale: 2 }),
  gross_exposure_pct: numeric("gross_exposure_pct", { precision: 8, scale: 4 }),
  net_exposure_pct: numeric("net_exposure_pct", { precision: 8, scale: 4 }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeHistoryTable = pgTable("trade_history", {
  id: serial("id").primaryKey(),
  backtest_id: text("backtest_id").notNull(),
  trade_id: text("trade_id").notNull().unique(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  entry_date: timestamp("entry_date", { withTimezone: true }).notNull(),
  exit_date: timestamp("exit_date", { withTimezone: true }),
  entry_price: numeric("entry_price", { precision: 10, scale: 2 }).notNull(),
  exit_price: numeric("exit_price", { precision: 10, scale: 2 }),
  quantity: numeric("quantity", { precision: 10, scale: 0 }).notNull(),
  entry_signal: text("entry_signal"),
  exit_signal: text("exit_signal"),
  holding_days: numeric("holding_days", { precision: 5, scale: 0 }),
  return_pct: numeric("return_pct", { precision: 8, scale: 4 }),
  return_amount: numeric("return_amount", { precision: 15, scale: 2 }),
  max_gain_pct: numeric("max_gain_pct", { precision: 8, scale: 4 }),
  max_loss_pct: numeric("max_loss_pct", { precision: 8, scale: 4 }),
  reason_for_exit: text("reason_for_exit"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBacktestResultSchema = createInsertSchema(backtestResultsTable).omit({ id: true, createdAt: true });
export type InsertBacktestResult = z.infer<typeof insertBacktestResultSchema>;
export type BacktestResult = typeof backtestResultsTable.$inferSelect;

export const insertPerformanceMetricsSchema = createInsertSchema(performanceMetricsTable).omit({ id: true, created_at: true });
export type InsertPerformanceMetrics = z.infer<typeof insertPerformanceMetricsSchema>;
export type PerformanceMetrics = typeof performanceMetricsTable.$inferSelect;

export const insertTradeHistorySchema = createInsertSchema(tradeHistoryTable).omit({ id: true, created_at: true });
export type InsertTradeHistory = z.infer<typeof insertTradeHistorySchema>;
export type TradeHistory = typeof tradeHistoryTable.$inferSelect;
