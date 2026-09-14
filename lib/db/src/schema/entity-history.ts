import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const securityIdentifierHistoryTable = pgTable("security_identifier_history", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  identifierType: text("identifier_type").notNull(),
  identifierValue: text("identifier_value").notNull(),
  exchange: text("exchange"),
  validFrom: date("valid_from", { mode: "string" }).notNull(),
  validTo: date("valid_to", { mode: "string" }),
  sourceId: integer("source_id"),
  sourceDocumentId: text("source_document_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sectorHistoryTable = pgTable("sector_history", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  sectorModel: text("sector_model").notNull(),
  sector: text("sector"),
  industry: text("industry"),
  validFrom: date("valid_from", { mode: "string" }).notNull(),
  validTo: date("valid_to", { mode: "string" }),
  manualOverride: boolean("manual_override").notNull().default(false),
  sourceId: integer("source_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const indexMembershipHistoryTable = pgTable("index_membership_history", {
  id: serial("id").primaryKey(),
  indexName: text("index_name").notNull(),
  isin: text("isin").notNull(),
  validFrom: date("valid_from", { mode: "string" }).notNull(),
  validTo: date("valid_to", { mode: "string" }),
  sourceId: integer("source_id"),
  sourceDocumentId: text("source_document_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entityMappingReviewQueueTable = pgTable("entity_mapping_review_queue", {
  id: serial("id").primaryKey(),
  candidateCompanyId: text("candidate_company_id"),
  candidateSecurityId: text("candidate_security_id"),
  matchBasis: text("match_basis").notNull(),
  confidence: text("confidence"),
  conflictingFields: jsonb("conflicting_fields"),
  sourceDocuments: jsonb("source_documents"),
  reviewStatus: text("review_status").notNull().default("pending"),
  reviewer: text("reviewer"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});