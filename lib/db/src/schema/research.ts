import {
  pgTable,
  text,
  serial,
  timestamp,
  date,
  numeric,
  integer,
  jsonb,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coverageTierEnum = pgEnum("coverage_tier", [
  "full",
  "standard",
  "limited",
  "screening_only",
]);

export const researchScoresTable = pgTable("research_scores", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  coverageTier: coverageTierEnum("coverage_tier").notNull().default("screening_only"),
  // Component scores (0-100) per IEIS v7.2 weights
  researchScore: numeric("research_score", { precision: 6, scale: 2 }),
  adjustedResearchScore: numeric("adjusted_research_score", { precision: 6, scale: 2 }),
  confidence: numeric("confidence", { precision: 6, scale: 2 }),
  businessQualityScore: numeric("business_quality_score", { precision: 6, scale: 2 }),   // w=15
  industryStructureScore: numeric("industry_structure_score", { precision: 6, scale: 2 }), // w=10
  financialQualityScore: numeric("financial_quality_score", { precision: 6, scale: 2 }),  // w=15
  capitalAllocationScore: numeric("capital_allocation_score", { precision: 6, scale: 2 }), // w=10
  integrityGovernanceScore: numeric("integrity_governance_score", { precision: 6, scale: 2 }), // w=20
  forecastResilienceScore: numeric("forecast_resilience_score", { precision: 6, scale: 2 }), // w=10
  valuationScore: numeric("valuation_score", { precision: 6, scale: 2 }),   // w=15
  catalystsScore: numeric("catalysts_score", { precision: 6, scale: 2 }),   // w=3
  technicalExecutionScore: numeric("technical_execution_score", { precision: 6, scale: 2 }), // w=2
  // Valuation
  valuationMethod: text("valuation_method"),
  fairValueBase: numeric("fair_value_base", { precision: 12, scale: 2 }),
  fairValueBull: numeric("fair_value_bull", { precision: 12, scale: 2 }),
  fairValueBear: numeric("fair_value_bear", { precision: 12, scale: 2 }),
  weightedFairValue: numeric("weighted_fair_value", { precision: 12, scale: 2 }),
  expectedAnnualReturnPct: numeric("expected_annual_return_pct", { precision: 8, scale: 2 }),
  horizonYears: numeric("horizon_years", { precision: 4, scale: 1 }),
  currentPrice: numeric("current_price", { precision: 12, scale: 2 }),
  // Notes
  analystNotes: text("analyst_notes"),
  scoreDate: date("score_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const evidenceLedgerTable = pgTable("evidence_ledger", {
  id: serial("id").primaryKey(),
  claimId: text("claim_id").notNull().unique(),
  isin: text("isin").notNull(),
  claim: text("claim").notNull(),
  claimType: text("claim_type").notNull(), // fundamental, technical, qualitative, governance, macro, sector, management, regulatory
  source: text("source").notNull(),
  sourceGrade: text("source_grade").notNull(), // primary, secondary, inferred, ai_inference
  documentId: text("document_id"),
  pageOrSection: text("page_or_section"),
  filingTimestamp: text("filing_timestamp"),
  supportingEvidence: text("supporting_evidence").notNull().default(""),
  contradictoryEvidence: text("contradictory_evidence").notNull().default(""),
  analystInference: boolean("analyst_inference").notNull().default(false),
  aiInference: boolean("ai_inference").notNull().default(false),
  confidence: numeric("confidence", { precision: 6, scale: 2 }).notNull(),
  reviewStatus: text("review_status").notNull(), // confirmed, pending, contradicted, stale, superseded
  affectedScore: text("affected_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResearchScoreSchema = createInsertSchema(researchScoresTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertResearchScore = z.infer<typeof insertResearchScoreSchema>;
export type ResearchScore = typeof researchScoresTable.$inferSelect;

export const insertEvidenceSchema = createInsertSchema(evidenceLedgerTable).omit({ id: true, createdAt: true });
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type Evidence = typeof evidenceLedgerTable.$inferSelect;
