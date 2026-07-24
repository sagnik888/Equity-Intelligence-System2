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

export const hardGateStateEnum = pgEnum("hard_gate_state", [
  "avoid",
  "pending_resolution",
  "not_ranked",
  "capped",
  "penalized",
]);

export const hardGatesTable = pgTable("hard_gates", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  level: integer("level").notNull(), // 1, 2, or 3
  trigger: text("trigger").notNull(),
  state: hardGateStateEnum("state").notNull(),
  capScore: numeric("cap_score", { precision: 6, scale: 2 }),
  penaltyPoints: numeric("penalty_points", { precision: 6, scale: 2 }),
  description: text("description").notNull().default(""),
  flaggedAt: date("flagged_at", { mode: "string" }).notNull(),
  resolvedAt: date("resolved_at", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHardGateSchema = createInsertSchema(hardGatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHardGate = z.infer<typeof insertHardGateSchema>;
export type HardGate = typeof hardGatesTable.$inferSelect;
