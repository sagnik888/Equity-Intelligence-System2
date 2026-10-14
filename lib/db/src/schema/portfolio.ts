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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const positionStatusEnum = pgEnum("position_status", [
  "open",
  "closed",
  "paper",
]);

export const positionHorizonEnum = pgEnum("position_horizon", [
  "daily",
  "weekly",
  "monthly",
  "medium",
  "long",
]);

export const orderIntentSideEnum = pgEnum("order_intent_side", ["buy", "sell"]);
export const orderIntentTypeEnum = pgEnum("order_intent_type", ["market", "limit"]);
export const orderIntentStatusEnum = pgEnum("order_intent_status", [
  "draft",
  "approved",
  "submitted",
  "partially_filled",
  "filled",
  "cancelled",
  "rejected",
]);

export const portfolioPositionsTable = pgTable("portfolio_positions", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  quantity: integer("quantity").notNull(),
  entryPrice: numeric("entry_price", { precision: 12, scale: 2 }).notNull(),
  currentPrice: numeric("current_price", { precision: 12, scale: 2 }).notNull(),
  stopPrice: numeric("stop_price", { precision: 12, scale: 2 }),
  targetPrice: numeric("target_price", { precision: 12, scale: 2 }),
  exitPrice: numeric("exit_price", { precision: 12, scale: 2 }),
  horizon: positionHorizonEnum("horizon").notNull(),
  status: positionStatusEnum("status").notNull().default("paper"),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  exitDate: date("exit_date", { mode: "string" }),
  notes: text("notes"),
  currentSignal: text("current_signal"),
  currentCandidateScore: numeric("current_candidate_score", { precision: 6, scale: 2 }),
  suitabilityScore: numeric("suitability_score", { precision: 6, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const portfolioSettingsTable = pgTable("portfolio_settings", {
  id: integer("id").primaryKey().default(1),
  capital: numeric("capital", { precision: 20, scale: 2 }).notNull(),
  cashReservePct: numeric("cash_reserve_pct", { precision: 6, scale: 3 }).notNull().default("0"),
  operatingMode: text("operating_mode").notNull().default("alert_only"),
  liveExecutionEnabled: boolean("live_execution_enabled").notNull().default(false),
  killSwitchEnabled: boolean("kill_switch_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const paperOrderIntentsTable = pgTable("paper_order_intents", {
  id: serial("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  businessActionKey: text("business_action_key"),
  accountId: text("account_id"),
  strategyId: text("strategy_id"),
  securityOrContractId: text("security_or_contract_id"),
  horizon: text("horizon"),
  signalId: text("signal_id"),
  decisionVersion: text("decision_version"),
  parentIntentId: integer("parent_intent_id"),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  side: orderIntentSideEnum("side").notNull(),
  orderType: orderIntentTypeEnum("order_type").notNull().default("limit"),
  quantity: integer("quantity").notNull(),
  limitPrice: numeric("limit_price", { precision: 12, scale: 2 }),
  status: orderIntentStatusEnum("status").notNull().default("draft"),
  rationale: text("rationale"),
  createdBy: text("created_by").notNull().default("system"),
  approvedBy: text("approved_by"),
  orderOrigin: text("order_origin").notNull().default("manual"),
  generationMode: text("generation_mode").notNull().default("human"),
  humanConfirmation: boolean("human_confirmation").notNull().default(false),
  algorithmic: boolean("algorithmic").notNull().default(false),
  strategyRegistration: text("strategy_registration"),
  exchangeAlgoId: text("exchange_algo_id"),
  brokerAlgoName: text("broker_algo_name"),
  staticIpStatus: text("static_ip_status"),
  brokerConfirmationReference: text("broker_confirmation_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  businessActionUnique: uniqueIndex("paper_order_intents_business_action_unique").on(table.businessActionKey),
}));

export const insertPortfolioPositionSchema = createInsertSchema(portfolioPositionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortfolioPosition = z.infer<typeof insertPortfolioPositionSchema>;
export type PortfolioPosition = typeof portfolioPositionsTable.$inferSelect;
export const insertPaperOrderIntentSchema = createInsertSchema(paperOrderIntentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaperOrderIntent = z.infer<typeof insertPaperOrderIntentSchema>;
export type PaperOrderIntent = typeof paperOrderIntentsTable.$inferSelect;
