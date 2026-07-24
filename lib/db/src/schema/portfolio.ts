import {
  pgTable,
  text,
  serial,
  timestamp,
  date,
  numeric,
  integer,
  pgEnum,
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

export const insertPortfolioPositionSchema = createInsertSchema(portfolioPositionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortfolioPosition = z.infer<typeof insertPortfolioPositionSchema>;
export type PortfolioPosition = typeof portfolioPositionsTable.$inferSelect;
