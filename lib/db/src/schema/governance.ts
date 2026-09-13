import { pgTable, serial, text, timestamp, boolean, numeric, date, integer } from "drizzle-orm/pg-core";

export const dataSourcesTable = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  sourceKey: text("source_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  sourceType: text("source_type").notNull(),
  licenseStatus: text("license_status").notNull(),
  rightsReviewed: boolean("rights_reviewed").notNull().default(false),
  adapterVersion: text("adapter_version"),
  active: boolean("active").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pointInTimeFactsTable = pgTable("point_in_time_facts", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  factKey: text("fact_key").notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
  value: numeric("value", { precision: 24, scale: 8 }),
  unit: text("unit"),
  sourceId: integer("source_id"),
  sourceDocumentId: text("source_document_id"),
  sourceHash: text("source_hash"),
  parserVersion: text("parser_version"),
  revisionOf: integer("revision_of"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const corporateActionsTable = pgTable("corporate_actions", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  actionType: text("action_type").notNull(),
  exDate: date("ex_date", { mode: "string" }).notNull(),
  recordDate: date("record_date", { mode: "string" }),
  announcementDate: date("announcement_date", { mode: "string" }),
  ratioNumerator: numeric("ratio_numerator", { precision: 20, scale: 8 }),
  ratioDenominator: numeric("ratio_denominator", { precision: 20, scale: 8 }),
  cashAmount: numeric("cash_amount", { precision: 20, scale: 8 }),
  sourceId: integer("source_id"),
  sourceDocumentId: text("source_document_id"),
  sourceHash: text("source_hash"),
  status: text("status").notNull().default("unvalidated"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const securityStatusHistoryTable = pgTable("security_status_history", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  status: text("status").notNull(),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  effectiveTo: date("effective_to", { mode: "string" }),
  sourceId: integer("source_id"),
  sourceDocumentId: text("source_document_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});