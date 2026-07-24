import {
  pgTable,
  text,
  serial,
  timestamp,
  date,
  numeric,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const universeGroupEnum = pgEnum("universe_group", [
  "large_cap",
  "mid_cap",
  "small_cap",
  "micro_cap",
  "sme",
  "reit_invit",
]);

export const securityStatusEnum = pgEnum("security_status", [
  "active",
  "suspended",
  "delisted",
]);

export const dataConfidenceClassEnum = pgEnum("data_confidence_class", [
  "high",
  "acceptable",
  "restricted",
  "limited",
  "insufficient",
]);

export const securitiesTable = pgTable("securities", {
  id: serial("id").primaryKey(),
  isin: text("isin").notNull().unique(),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  industry: text("industry"),
  subIndustry: text("sub_industry"),
  universeGroup: universeGroupEnum("universe_group").notNull(),
  status: securityStatusEnum("status").notNull().default("active"),
  marketCapCr: numeric("market_cap_cr", { precision: 20, scale: 2 }),
  enterpriseValueCr: numeric("enterprise_value_cr", { precision: 20, scale: 2 }),
  currentPrice: numeric("current_price", { precision: 12, scale: 2 }),
  faceValue: numeric("face_value", { precision: 8, scale: 2 }),
  sharesOutstandingCr: numeric("shares_outstanding_cr", { precision: 12, scale: 4 }),
  promoterHoldingPct: numeric("promoter_holding_pct", { precision: 6, scale: 2 }),
  fiiHoldingPct: numeric("fii_holding_pct", { precision: 6, scale: 2 }),
  diiHoldingPct: numeric("dii_holding_pct", { precision: 6, scale: 2 }),
  listingDate: date("listing_date", { mode: "string" }),
  // Financial snapshot
  revenueTtmCr: numeric("revenue_ttm_cr", { precision: 20, scale: 2 }),
  ebitdaTtmCr: numeric("ebitda_ttm_cr", { precision: 20, scale: 2 }),
  patTtmCr: numeric("pat_ttm_cr", { precision: 20, scale: 2 }),
  cfoTtmCr: numeric("cfo_ttm_cr", { precision: 20, scale: 2 }),
  fcfTtmCr: numeric("fcf_ttm_cr", { precision: 20, scale: 2 }),
  revenueGrowth3yPct: numeric("revenue_growth_3y_pct", { precision: 8, scale: 2 }),
  epsGrowth3yPct: numeric("eps_growth_3y_pct", { precision: 8, scale: 2 }),
  roicPct: numeric("roic_pct", { precision: 8, scale: 2 }),
  rocePct: numeric("roce_pct", { precision: 8, scale: 2 }),
  roePct: numeric("roe_pct", { precision: 8, scale: 2 }),
  ebitdaMarginPct: numeric("ebitda_margin_pct", { precision: 8, scale: 2 }),
  netDebtToEbitda: numeric("net_debt_to_ebitda", { precision: 8, scale: 2 }),
  interestCoverage: numeric("interest_coverage", { precision: 8, scale: 2 }),
  peRatio: numeric("pe_ratio", { precision: 10, scale: 2 }),
  pbRatio: numeric("pb_ratio", { precision: 10, scale: 2 }),
  evEbitda: numeric("ev_ebitda", { precision: 10, scale: 2 }),
  fcfYieldPct: numeric("fcf_yield_pct", { precision: 8, scale: 2 }),
  dividendYieldPct: numeric("dividend_yield_pct", { precision: 8, scale: 2 }),
  medianDailyTradedValueCr: numeric("median_daily_traded_value_cr", { precision: 12, scale: 4 }),
  // Data confidence
  dataConfidence: numeric("data_confidence", { precision: 6, scale: 2 }),
  dataConfidenceClass: dataConfidenceClassEnum("data_confidence_class"),
  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSecuritySchema = createInsertSchema(securitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSecurity = z.infer<typeof insertSecuritySchema>;
export type Security = typeof securitiesTable.$inferSelect;
