import {
  pgTable,
  text,
  serial,
  timestamp,
  numeric,
  jsonb,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hardGateLevelEnum = pgEnum("hard_gate_level", [
  "level_1_block",
  "level_2_cap",
  "level_3_penalty",
]);

export const hardGateTriggerEnum = pgEnum("hard_gate_trigger", [
  "adverse_audit",
  "disclaimer_of_opinion",
  "confirmed_manipulation",
  "fund_diversion",
  "insolvency",
  "liquidation",
  "material_default",
  "unreconciled_accounts",
  "going_concern",
  "current_suspension",
  "invalid_mapping",
  "missing_filing",
  "regulatory_prohibition",
  "inadequate_liquidity",
  "catastrophic_liability",
  "source_conflict",
  "qualified_audit",
  "emphasis_of_matter",
  "auditor_resignation",
  "related_party_exposure",
  "pledge_increase",
  "repeated_dilution",
  "rating_downgrade",
  "revised_filing",
  "contingent_liability",
  "cash_profit_divergence",
  "short_history",
  "concentration_risk",
  "temporary_leverage",
  "working_capital_deterioration",
  "earnings_instability",
  "partial_missing_data",
]);

export const alertStatusEnum = pgEnum("alert_status", [
  "active",
  "acknowledged",
  "resolved",
  "false_positive",
  "escalated",
]);

export const hardGateEventTable = pgTable("hard_gate_events", {
  id: serial("id").primaryKey(),
  event_id: text("event_id").notNull().unique(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  gate_level: hardGateLevelEnum("gate_level").notNull(),
  trigger: hardGateTriggerEnum("trigger").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(), // "critical", "high", "medium", "low"
  evidence: jsonb("evidence"), // Array of {source, document, date, detail}
  affected_scores: jsonb("affected_scores"), // Array of score names
  hard_gate_cap: numeric("hard_gate_cap", { precision: 5, scale: 2 }), // For Level 2
  penalty_amount: numeric("penalty_amount", { precision: 5, scale: 2 }), // For Level 3
  triggered_at: timestamp("triggered_at", { withTimezone: true }).notNull(),
  triggered_by: text("triggered_by").notNull(), // "system", "manual"
  resolution_status: text("resolution_status").notNull().default("pending"), // "pending", "resolved", "waived"
  resolution_date: timestamp("resolution_date", { withTimezone: true }),
  resolution_notes: text("resolution_notes"),
  resolved_by: text("resolved_by"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const alertTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  alert_id: text("alert_id").notNull().unique(),
  isin: text("isin"),
  ticker: text("ticker"),
  name: text("name"),
  alert_type: text("alert_type").notNull(), // "hard_gate", "score_change", "signal_change", "liquidity", "data_quality", "portfolio_risk"
  severity: text("severity").notNull(), // "critical", "high", "medium", "low", "info"
  title: text("title").notNull(),
  description: text("description").notNull(),
  details: jsonb("details"),
  status: alertStatusEnum("status").notNull().default("active"),
  triggered_at: timestamp("triggered_at", { withTimezone: true }).notNull(),
  triggered_by: text("triggered_by").notNull(), // "system", "manual"
  acknowledged_at: timestamp("acknowledged_at", { withTimezone: true }),
  acknowledged_by: text("acknowledged_by"),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
  resolved_by: text("resolved_by"),
  resolution_notes: text("resolution_notes"),
  related_event_id: text("related_event_id"), // Link to hard_gate_event if applicable
  action_required: boolean("action_required").notNull().default(false),
  action_description: text("action_description"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHardGateEventSchema = createInsertSchema(hardGateEventTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertHardGateEvent = z.infer<typeof insertHardGateEventSchema>;
export type HardGateEvent = typeof hardGateEventTable.$inferSelect;

export const insertAlertSchema = createInsertSchema(alertTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertTable.$inferSelect;
