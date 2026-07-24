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

export const insertBacktestResultSchema = createInsertSchema(backtestResultsTable).omit({ id: true, createdAt: true });
export type InsertBacktestResult = z.infer<typeof insertBacktestResultSchema>;
export type BacktestResult = typeof backtestResultsTable.$inferSelect;
