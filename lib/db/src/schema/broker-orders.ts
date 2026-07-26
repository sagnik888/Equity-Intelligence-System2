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

export const brokerEnum = pgEnum("broker", [
  "upstox",
  "angel_one",
  "paper_trading",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "signal_confirmed",
  "risk_checked",
  "order_previewed",
  "approved",
  "submission_pending",
  "submitted",
  "acknowledged",
  "partially_filled",
  "filled",
  "position_reconciled",
  "rejected",
  "cancel_pending",
  "cancelled",
  "stale",
  "orphaned",
  "broker_unknown",
  "manual_review",
]);

export const orderTypeEnum = pgEnum("order_type", [
  "market",
  "limit",
  "stop_loss",
  "stop_loss_limit",
]);

export const orderSideEnum = pgEnum("order_side", [
  "buy",
  "sell",
]);

export const brokerOrderTable = pgTable("broker_orders", {
  id: serial("id").primaryKey(),
  order_id: text("order_id").notNull().unique(),
  idempotency_key: text("idempotency_key").notNull().unique(),
  broker: brokerEnum("broker").notNull(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  horizon: text("horizon").notNull(), // "daily", "weekly", "monthly", "medium", "long"
  signal_id: text("signal_id").notNull(),
  order_type: orderTypeEnum("order_type").notNull(),
  side: orderSideEnum("side").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 0 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }),
  stop_price: numeric("stop_price", { precision: 10, scale: 2 }),
  status: orderStatusEnum("status").notNull().default("signal_confirmed"),
  
  // Risk checks
  risk_budget_pct: numeric("risk_budget_pct", { precision: 8, scale: 4 }),
  position_suitability_score: numeric("position_suitability_score", { precision: 5, scale: 2 }),
  liquidity_check_passed: boolean("liquidity_check_passed"),
  
  // Submission details
  submitted_at: timestamp("submitted_at", { withTimezone: true }),
  broker_order_id: text("broker_order_id"),
  broker_reference: text("broker_reference"),
  
  // Execution details
  filled_quantity: numeric("filled_quantity", { precision: 10, scale: 0 }),
  average_fill_price: numeric("average_fill_price", { precision: 10, scale: 2 }),
  filled_at: timestamp("filled_at", { withTimezone: true }),
  
  // Rejection/Cancellation
  rejection_reason: text("rejection_reason"),
  cancellation_reason: text("cancellation_reason"),
  
  // Reconciliation
  reconciliation_status: text("reconciliation_status"), // "pending", "matched", "partial_mismatch", "full_mismatch"
  reconciliation_notes: text("reconciliation_notes"),
  reconciled_at: timestamp("reconciled_at", { withTimezone: true }),
  
  // Failover tracking
  failover_count: numeric("failover_count", { precision: 3, scale: 0 }).default("0"),
  last_failover_at: timestamp("last_failover_at", { withTimezone: true }),
  
  // Metadata
  strategy: text("strategy"),
  entry_reason: text("entry_reason"),
  exit_reason: text("exit_reason"),
  
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const brokerFillTable = pgTable("broker_fills", {
  id: serial("id").primaryKey(),
  fill_id: text("fill_id").notNull().unique(),
  order_id: text("order_id").notNull(),
  broker: brokerEnum("broker").notNull(),
  broker_fill_id: text("broker_fill_id").notNull(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 0 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  commission: numeric("commission", { precision: 10, scale: 2 }),
  tax: numeric("tax", { precision: 10, scale: 2 }),
  filled_at: timestamp("filled_at", { withTimezone: true }).notNull(),
  exchange_timestamp: timestamp("exchange_timestamp", { withTimezone: true }),
  
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brokerConfigTable = pgTable("broker_config", {
  id: serial("id").primaryKey(),
  broker: brokerEnum("broker").notNull().unique(),
  api_key: text("api_key"),
  api_secret: text("api_secret"),
  auth_token: text("auth_token"),
  static_ip: text("static_ip"),
  algo_registered: boolean("algo_registered").default(false),
  algo_strategy_id: text("algo_strategy_id"),
  max_order_value: numeric("max_order_value", { precision: 15, scale: 2 }),
  rate_limit_orders_per_minute: numeric("rate_limit_orders_per_minute", { precision: 5, scale: 0 }),
  order_split_size: numeric("order_split_size", { precision: 10, scale: 0 }),
  enabled: boolean("enabled").default(true),
  
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBrokerOrderSchema = createInsertSchema(brokerOrderTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertBrokerOrder = z.infer<typeof insertBrokerOrderSchema>;
export type BrokerOrder = typeof brokerOrderTable.$inferSelect;

export const insertBrokerFillSchema = createInsertSchema(brokerFillTable).omit({ id: true, created_at: true });
export type InsertBrokerFill = z.infer<typeof insertBrokerFillSchema>;
export type BrokerFill = typeof brokerFillTable.$inferSelect;

export const insertBrokerConfigSchema = createInsertSchema(brokerConfigTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertBrokerConfig = z.infer<typeof insertBrokerConfigSchema>;
export type BrokerConfig = typeof brokerConfigTable.$inferSelect;
