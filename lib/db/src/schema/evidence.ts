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

export const claimTypeEnum = pgEnum("claim_type", [
  "fundamental",
  "technical",
  "macroeconomic",
  "governance",
  "event",
  "other",
]);

export const sourceGradeEnum = pgEnum("source_grade", [
  "statutory",
  "broker",
  "licensed_vendor",
  "research_support",
  "diagnostic_fallback",
  "analyst_inference",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
  "reconciliation_required",
]);

export const evidenceLedgerTable = pgTable("evidence_ledger", {
  id: serial("id").primaryKey(),
  claimId: text("claim_id").notNull().unique(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  claim: text("claim").notNull(),
  claimType: claimTypeEnum("claim_type").notNull(),
  source: text("source").notNull(),
  sourceGrade: sourceGradeEnum("source_grade").notNull(),
  documentId: text("document_id"),
  pageOrSection: text("page_or_section"),
  filingTimestamp: timestamp("filing_timestamp", { withTimezone: true }),
  supportingEvidence: jsonb("supporting_evidence"), // Array of document_id, page_or_section
  contradictoryEvidence: jsonb("contradictory_evidence"), // Array of document_id, page_or_section
  calculationReference: text("calculation_reference"),
  analystInference: text("analyst_inference"),
  aiInference: text("ai_inference"),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(), // 0-100
  reviewStatus: reviewStatusEnum("review_status").notNull().default("pending"),
  affectedScore: text("affected_score"), // e.g., "candidate_score", "research_score"
  affectedForecast: text("affected_forecast"),
  affectedValuation: text("affected_valuation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEvidenceLedgerSchema = createInsertSchema(evidenceLedgerTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEvidenceLedger = z.infer<typeof insertEvidenceLedgerSchema>;
export type EvidenceLedger = typeof evidenceLedgerTable.$inferSelect;
