import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deploymentProfileEnum = pgEnum("deployment_profile", [
  "personal_core",
  "personal_advanced",
  "institutional",
]);

export const operatingModeEnum = pgEnum("operating_mode", [
  "research_only",
  "alert_only",
  "paper_trading",
  "manual_confirmation",
  "semi_automatic",
  "automatic",
]);

export const controlStatusEnum = pgEnum("control_status", [
  "healthy",
  "warning",
  "failed",
  "stale",
  "quarantined",
  "not_configured",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "retired",
]);

export const resourceModeEnum = pgEnum("resource_mode", [
  "normal",
  "busy",
  "throttled",
  "low_memory",
  "low_storage",
  "gpu_limited",
  "market_priority",
  "emergency",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "paused",
]);

export const systemSettingsTable = pgTable("system_settings", {
  id: integer("id").primaryKey().default(1),
  profile: deploymentProfileEnum("profile").notNull().default("personal_core"),
  operatingMode: operatingModeEnum("operating_mode").notNull().default("alert_only"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  benchmark: text("benchmark").notNull().default("NIFTY 500"),
  baseCurrency: text("base_currency").notNull().default("INR"),
  tradingCalendar: text("trading_calendar").notNull().default("NSE"),
  includeSme: boolean("include_sme").notNull().default(false),
  includeNewListings: boolean("include_new_listings").notNull().default(true),
  includeFno: boolean("include_fno").notNull().default(false),
  minimumDataConfidence: numeric("minimum_data_confidence", { precision: 6, scale: 2 }).notNull().default("70"),
  yahooDiagnosticEnabled: boolean("yahoo_diagnostic_enabled").notNull().default(false),
  screenerImportEnabled: boolean("screener_import_enabled").notNull().default(true),
  conflictTolerance: numeric("conflict_tolerance", { precision: 12, scale: 8 }).notNull().default("0.01"),
  staleTimeoutMinutes: integer("stale_timeout_minutes").notNull().default(1440),
  killSwitchEnabled: boolean("kill_switch_enabled").notNull().default(false),
  liveExecutionEnabled: boolean("live_execution_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const dataLicensesTable = pgTable("data_licenses", {
  id: serial("id").primaryKey(),
  licenseId: text("license_id").notNull().unique(),
  provider: text("provider").notNull(),
  productName: text("product_name").notNull(),
  dataCategory: text("data_category").notNull(),
  permittedUse: text("permitted_use").notNull(),
  personalUseAllowed: boolean("personal_use_allowed").notNull().default(false),
  commercialUseAllowed: boolean("commercial_use_allowed").notNull().default(false),
  nonDisplayUseAllowed: boolean("non_display_use_allowed").notNull().default(false),
  derivedDataAllowed: boolean("derived_data_allowed").notNull().default(false),
  redistributionAllowed: boolean("redistribution_allowed").notNull().default(false),
  storageAllowed: boolean("storage_allowed").notNull().default(false),
  retentionPeriodDays: integer("retention_period_days"),
  userLimit: integer("user_limit"),
  effectiveDate: date("effective_date", { mode: "string" }),
  expiryDate: date("expiry_date", { mode: "string" }),
  agreementReference: text("agreement_reference"),
  providerTermsHash: text("provider_terms_hash"),
  reviewStatus: approvalStatusEnum("review_status").notNull().default("pending_review"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const connectorAdaptersTable = pgTable("connector_adapters", {
  id: serial("id").primaryKey(),
  providerId: text("provider_id").notNull().unique(),
  adapterVersion: text("adapter_version").notNull(),
  authenticationMethod: text("authentication_method").notNull(),
  licenseIds: jsonb("license_ids").$type<string[]>().notNull().default([]),
  supportedDataTypes: jsonb("supported_data_types").$type<string[]>().notNull().default([]),
  supportedExchanges: jsonb("supported_exchanges").$type<string[]>().notNull().default([]),
  rateLimitPerMinute: integer("rate_limit_per_minute"),
  requestBatchSize: integer("request_batch_size"),
  requestTimeoutSeconds: integer("request_timeout_seconds").notNull().default(30),
  retryPolicy: jsonb("retry_policy"),
  backoffPolicy: jsonb("backoff_policy"),
  schemaVersion: text("schema_version").notNull(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  timestampSemantics: text("timestamp_semantics"),
  adjustedPriceSemantics: text("adjusted_price_semantics"),
  corporateActionSemantics: text("corporate_action_semantics"),
  retentionPermission: boolean("retention_permission").notNull().default(false),
  commercialUsePermission: boolean("commercial_use_permission").notNull().default(false),
  status: controlStatusEnum("status").notNull().default("not_configured"),
  lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const connectorRequestsTable = pgTable("connector_requests", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  providerId: text("provider_id").notNull(),
  endpoint: text("endpoint"),
  requestTimestamp: timestamp("request_timestamp", { withTimezone: true }).notNull(),
  responseTimestamp: timestamp("response_timestamp", { withTimezone: true }),
  statusCode: integer("status_code"),
  recordsReceived: integer("records_received").notNull().default(0),
  checksum: text("checksum"),
  schemaVersion: text("schema_version"),
  latencyMs: integer("latency_ms"),
  retryCount: integer("retry_count").notNull().default(0),
  errorCode: text("error_code"),
  rawPayloadLocation: text("raw_payload_location"),
  status: controlStatusEnum("status").notNull().default("healthy"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rawDataRecordsTable = pgTable("raw_data_records", {
  id: serial("id").primaryKey(),
  providerId: text("provider_id").notNull(),
  contentType: text("content_type").notNull(),
  payloadHash: text("payload_hash").notNull(),
  payloadLocation: text("payload_location").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  requestId: text("request_id"),
  licenseId: text("license_id"),
  schemaVersion: text("schema_version"),
  parsingStatus: controlStatusEnum("parsing_status").notNull().default("not_configured"),
  documentId: text("document_id"),
  revisionOf: integer("revision_of"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const featureDefinitionsTable = pgTable("feature_definitions", {
  id: serial("id").primaryKey(),
  featureId: text("feature_id").notNull(),
  featureVersion: text("feature_version").notNull(),
  featureName: text("feature_name").notNull(),
  economicDefinition: text("economic_definition").notNull(),
  plainTextFormula: text("plain_text_formula"),
  sourceFields: jsonb("source_fields").$type<string[]>().notNull().default([]),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  sectorApplicability: jsonb("sector_applicability").$type<string[]>().notNull().default([]),
  lookback: integer("lookback"),
  minimumHistory: integer("minimum_history"),
  direction: text("direction"),
  outlierRule: text("outlier_rule"),
  missingRule: text("missing_rule"),
  negativeBaseRule: text("negative_base_rule"),
  stalenessRule: text("staleness_rule"),
  publicationLagDays: integer("publication_lag_days"),
  inputUnits: text("input_units"),
  outputUnit: text("output_unit"),
  dataType: text("data_type"),
  owner: text("owner").notNull(),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const modelRegistryTable = pgTable("model_registry", {
  id: serial("id").primaryKey(),
  modelId: text("model_id").notNull(),
  modelVersion: text("model_version").notNull(),
  featureVersions: jsonb("feature_versions"),
  weights: jsonb("weights"),
  hardGateVersion: text("hard_gate_version"),
  sectorModelVersion: text("sector_model_version"),
  trainingPeriod: text("training_period"),
  validationPeriod: text("validation_period"),
  testPeriod: text("test_period"),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("draft"),
  deploymentDate: timestamp("deployment_date", { withTimezone: true }),
  retirementDate: timestamp("retirement_date", { withTimezone: true }),
  rollbackVersion: text("rollback_version"),
  mode: text("mode").notNull().default("experimental"),
  comparisonSummary: jsonb("comparison_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resourceSnapshotsTable = pgTable("resource_snapshots", {
  id: serial("id").primaryKey(),
  mode: resourceModeEnum("mode").notNull(),
  freeRamGb: numeric("free_ram_gb", { precision: 8, scale: 2 }),
  freeStorageGb: numeric("free_storage_gb", { precision: 10, scale: 2 }),
  gpuUsedPct: numeric("gpu_used_pct", { precision: 6, scale: 2 }),
  cpuWorkers: integer("cpu_workers"),
  documentWorkers: integer("document_workers"),
  apiWorkers: integer("api_workers"),
  marketOpen: boolean("market_open").notNull().default(false),
  actions: jsonb("actions").$type<string[]>().notNull().default([]),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  jobType: text("job_type").notNull(),
  priority: integer("priority").notNull().default(50),
  status: jobStatusEnum("status").notNull().default("queued"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  retryCount: integer("retry_count").notNull().default(0),
  resourceClass: text("resource_class").notNull(),
  checkpoint: text("checkpoint"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const acceptanceGatesTable = pgTable("acceptance_gates", {
  id: serial("id").primaryKey(),
  gateKey: text("gate_key").notNull(),
  gateName: text("gate_name").notNull(),
  category: text("category").notNull(),
  status: controlStatusEnum("status").notNull().default("not_configured"),
  evidence: jsonb("evidence"),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  checkedBy: text("checked_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const immutableAuditLogsTable = pgTable("immutable_audit_logs", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  actorId: text("actor_id"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  requestId: text("request_id"),
  eventHash: text("event_hash").notNull(),
  previousEventHash: text("previous_event_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettingsTable).omit({ updatedAt: true });
export const insertDataLicenseSchema = createInsertSchema(dataLicensesTable).omit({ id: true, createdAt: true });
export const insertConnectorAdapterSchema = createInsertSchema(connectorAdaptersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRawDataRecordSchema = createInsertSchema(rawDataRecordsTable).omit({ id: true, createdAt: true });
export const insertFeatureDefinitionSchema = createInsertSchema(featureDefinitionsTable).omit({ id: true, createdAt: true });
export const insertModelRegistrySchema = createInsertSchema(modelRegistryTable).omit({ id: true, createdAt: true });
export const insertAcceptanceGateSchema = createInsertSchema(acceptanceGatesTable).omit({ id: true, createdAt: true });

export type SystemSettings = typeof systemSettingsTable.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type DataLicense = typeof dataLicensesTable.$inferSelect;
export type ConnectorAdapter = typeof connectorAdaptersTable.$inferSelect;
export type RawDataRecord = typeof rawDataRecordsTable.$inferSelect;
export type FeatureDefinition = typeof featureDefinitionsTable.$inferSelect;
export type ModelRegistryEntry = typeof modelRegistryTable.$inferSelect;
export type ResourceSnapshot = typeof resourceSnapshotsTable.$inferSelect;
export type Job = typeof jobsTable.$inferSelect;
export type AcceptanceGate = typeof acceptanceGatesTable.$inferSelect;
export type ImmutableAuditLog = typeof immutableAuditLogsTable.$inferSelect;