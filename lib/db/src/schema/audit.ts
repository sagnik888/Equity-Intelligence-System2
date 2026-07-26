import {
  pgTable,
  text,
  serial,
  timestamp,
  numeric,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditActionEnum = pgEnum("audit_action", [
  "score_calculated",
  "signal_generated",
  "position_opened",
  "position_closed",
  "order_submitted",
  "order_filled",
  "alert_triggered",
  "hard_gate_triggered",
  "evidence_added",
  "forecast_updated",
  "valuation_updated",
  "portfolio_rebalanced",
  "setting_changed",
  "data_reconciliation",
]);

export const auditHistoryTable = pgTable("audit_history", {
  id: serial("id").primaryKey(),
  action: auditActionEnum("action").notNull(),
  isin: text("isin"),
  ticker: text("ticker"),
  name: text("name"),
  actionDate: timestamp("action_date", { withTimezone: true }).notNull(),
  actor: text("actor").notNull(), // "system", "user", "scheduler"
  details: jsonb("details"),
  previousValues: jsonb("previous_values"),
  newValues: jsonb("new_values"),
  affectedFields: jsonb("affected_fields"), // Array of field names
  changeReason: text("change_reason"),
  relatedRecords: jsonb("related_records"), // Array of {table, id}
  dataQualityImpact: text("data_quality_impact"), // "none", "minor", "moderate", "severe"
  requiresReview: text("requires_review").default("false"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditHistorySchema = createInsertSchema(auditHistoryTable).omit({ id: true, createdAt: true });
export type InsertAuditHistory = z.infer<typeof insertAuditHistorySchema>;
export type AuditHistory = typeof auditHistoryTable.$inferSelect;
