import {
  pgTable,
  text,
  serial,
  timestamp,
  date,
  numeric,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const candidateScoresTable = pgTable("candidate_scores", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  universeGroup: text("universe_group").notNull(),
  // Core scores (0-100)
  candidateScore: numeric("candidate_score", { precision: 6, scale: 2 }),
  qualityScore: numeric("quality_score", { precision: 6, scale: 2 }),
  growthScore: numeric("growth_score", { precision: 6, scale: 2 }),
  valueScore: numeric("value_score", { precision: 6, scale: 2 }),
  balanceSheetScore: numeric("balance_sheet_score", { precision: 6, scale: 2 }),
  capitalAllocationScore: numeric("capital_allocation_score", { precision: 6, scale: 2 }),
  integrityScore: numeric("integrity_score", { precision: 6, scale: 2 }),
  // Confidence-adjusted
  confidenceAdjustedScore: numeric("confidence_adjusted_score", { precision: 6, scale: 2 }),
  hardGateCap: numeric("hard_gate_cap", { precision: 6, scale: 2 }),
  // Data confidence
  dataConfidence: numeric("data_confidence", { precision: 6, scale: 2 }),
  // Rankings
  overallRank: integer("overall_rank"),
  // Sub-score breakdown stored as JSON
  scoreBreakdown: jsonb("score_breakdown"),
  // History tracking
  scoreDate: date("score_date", { mode: "string" }).notNull(),
  previousScore: numeric("previous_score", { precision: 6, scale: 2 }),
  scoreDelta: numeric("score_delta", { precision: 6, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scoreHistoryTable = pgTable("score_history", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  candidateScore: numeric("candidate_score", { precision: 6, scale: 2 }),
  qualityScore: numeric("quality_score", { precision: 6, scale: 2 }),
  growthScore: numeric("growth_score", { precision: 6, scale: 2 }),
  valueScore: numeric("value_score", { precision: 6, scale: 2 }),
  dataConfidence: numeric("data_confidence", { precision: 6, scale: 2 }),
  scoreDate: date("score_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rankingsTable = pgTable("rankings", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  universeGroup: text("universe_group").notNull(),
  dimension: text("dimension").notNull(),
  rank: integer("rank").notNull(),
  score: numeric("score", { precision: 8, scale: 4 }),
  percentile: numeric("percentile", { precision: 6, scale: 2 }),
  rankChange: integer("rank_change"),
  rankDate: date("rank_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCandidateScoreSchema = createInsertSchema(candidateScoresTable).omit({ id: true, createdAt: true });
export type InsertCandidateScore = z.infer<typeof insertCandidateScoreSchema>;
export type CandidateScore = typeof candidateScoresTable.$inferSelect;
