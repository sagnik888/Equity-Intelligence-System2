import {
  pgTable,
  text,
  serial,
  timestamp,
  date,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const watchlistEntriesTable = pgTable("watchlist_entries", {
  id: serial("id").primaryKey(),
  watchlistName: text("watchlist_name").notNull(),
  isin: text("isin").notNull(),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  universeGroup: text("universe_group").notNull(),
  addedAt: date("added_at", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWatchlistEntrySchema = createInsertSchema(watchlistEntriesTable).omit({ id: true, createdAt: true });
export type InsertWatchlistEntry = z.infer<typeof insertWatchlistEntrySchema>;
export type WatchlistEntry = typeof watchlistEntriesTable.$inferSelect;
