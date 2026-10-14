import {
  pgTable,
  text,
  serial,
  timestamp,
  date,
  numeric,
  integer,
  pgEnum,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const signalHorizonEnum = pgEnum("signal_horizon", [
  "daily",
  "weekly",
  "monthly",
  "medium",
  "long",
]);

export const signalStateEnum = pgEnum("signal_state", [
  "strong_buy",
  "buy",
  "accumulate",
  "watch",
  "hold",
  "reduce",
  "sell",
  "avoid",
  "pending_review",
  "no_signal",
]);

export const signalLifecycleEnum = pgEnum("signal_lifecycle", [
  "not_eligible",
  "insufficient_data",
  "preview_only",
  "ready",
  "entry_pending",
  "active",
  "exit_pending",
  "closed",
  "cooldown",
]);

export const signalsTable = pgTable("signals", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  universeGroup: text("universe_group").notNull(),
  horizon: signalHorizonEnum("horizon").notNull(),
  state: signalStateEnum("state").notNull(),
  lifecycleState: signalLifecycleEnum("lifecycle_state").notNull().default("insufficient_data"),
  previousState: signalStateEnum("previous_state"),
  completedBar: boolean("completed_bar").notNull().default(false),
  sourceSealed: boolean("source_sealed").notNull().default(false),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
  nextSessionEligibleAt: timestamp("next_session_eligible_at", { withTimezone: true }),
  regime: text("regime"),
  modelVersion: text("model_version"),
  decisionVersion: text("decision_version"),
  sourceSnapshotId: text("source_snapshot_id"),
  componentBreakdown: jsonb("component_breakdown"),
  eligibilityReason: text("eligibility_reason"),
  hss: numeric("hss", { precision: 6, scale: 2 }).notNull(), // Horizon Signal Score 0-100
  confidence: numeric("confidence", { precision: 6, scale: 2 }).notNull(),
  stalePenalty: numeric("stale_penalty", { precision: 6, scale: 2 }).notNull().default("0"),
  eventPenalty: numeric("event_penalty", { precision: 6, scale: 2 }).notNull().default("0"),
  riskPenalty: numeric("risk_penalty", { precision: 6, scale: 2 }).notNull().default("0"),
  hardGateCap: numeric("hard_gate_cap", { precision: 6, scale: 2 }),
  alignmentScore: numeric("alignment_score", { precision: 6, scale: 2 }),
  candidateScore: numeric("candidate_score", { precision: 6, scale: 2 }),
  currentPrice: numeric("current_price", { precision: 12, scale: 2 }),
  daysInState: integer("days_in_state").notNull().default(0),
  signalDate: date("signal_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const signalHistoryTable = pgTable("signal_history", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  horizon: signalHorizonEnum("horizon").notNull(),
  state: signalStateEnum("state").notNull(),
  hss: numeric("hss", { precision: 6, scale: 2 }).notNull(),
  confidence: numeric("confidence", { precision: 6, scale: 2 }).notNull(),
  signalDate: date("signal_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSignalSchema = createInsertSchema(signalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signalsTable.$inferSelect;
