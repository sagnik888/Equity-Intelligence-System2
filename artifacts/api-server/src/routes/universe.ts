import { Router, type IRouter } from "express";
import { and, eq, ilike, or, sql, desc, asc } from "drizzle-orm";
import { db, securitiesTable } from "@workspace/db";
import {
  ListSecuritiesQueryParams,
  GetSecurityParams,
  ListSecuritiesResponse,
  GetSecurityResponse,
  GetUniverseStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/universe", async (req, res): Promise<void> => {
  const query = ListSecuritiesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { group, sector, status, limit, offset, search } = query.data;

  const conditions = [];
  if (group && group !== "all") conditions.push(eq(securitiesTable.universeGroup, group as any));
  if (sector) conditions.push(eq(securitiesTable.sector, sector));
  if (status && status !== "all") conditions.push(eq(securitiesTable.status, status as any));
  if (search) {
    conditions.push(
      or(
        ilike(securitiesTable.ticker, `%${search}%`),
        ilike(securitiesTable.name, `%${search}%`),
        ilike(securitiesTable.isin, `%${search}%`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [items, countResult] = await Promise.all([
    db.select().from(securitiesTable).where(where).limit(limit ?? 50).offset(offset ?? 0).orderBy(desc(securitiesTable.marketCapCr)),
    db.select({ count: sql<number>`count(*)` }).from(securitiesTable).where(where),
  ]);

  const securities = items.map(s => ({
    isin: s.isin,
    ticker: s.ticker,
    name: s.name,
    sector: s.sector,
    industry: s.industry ?? undefined,
    universe_group: s.universeGroup,
    status: s.status,
    market_cap_cr: s.marketCapCr ? parseFloat(s.marketCapCr) : 0,
    current_price: s.currentPrice ? parseFloat(s.currentPrice) : 0,
    listing_date: s.listingDate ?? undefined,
    data_confidence: s.dataConfidence ? parseFloat(s.dataConfidence) : 0,
    has_hard_gate: false,
    hard_gate_level: null,
    candidate_score: null,
    daily_signal: null,
    weekly_signal: null,
    monthly_signal: null,
  }));

  res.json({
    items: securities,
    total: Number(countResult[0]?.count ?? 0),
    limit: limit ?? 50,
    offset: offset ?? 0,
  });
});

router.get("/universe/stats", async (_req, res): Promise<void> => {
  const [all, byGroup, bySector, byDC] = await Promise.all([
    db.select({
      status: securitiesTable.status,
      count: sql<number>`count(*)`
    }).from(securitiesTable).groupBy(securitiesTable.status),
    db.select({
      group: securitiesTable.universeGroup,
      count: sql<number>`count(*)`
    }).from(securitiesTable).groupBy(securitiesTable.universeGroup),
    db.select({
      sector: securitiesTable.sector,
      count: sql<number>`count(*)`
    }).from(securitiesTable).groupBy(securitiesTable.sector).orderBy(desc(sql`count(*)`)),
    db.select({
      class: securitiesTable.dataConfidenceClass,
      count: sql<number>`count(*)`
    }).from(securitiesTable).groupBy(securitiesTable.dataConfidenceClass),
  ]);

  const total = all.reduce((s, r) => s + Number(r.count), 0);
  const active = all.find(r => r.status === "active");
  const suspended = all.find(r => r.status === "suspended");
  const delisted = all.find(r => r.status === "delisted");

  res.json({
    total,
    active: Number(active?.count ?? 0),
    suspended: Number(suspended?.count ?? 0),
    delisted: Number(delisted?.count ?? 0),
    investable: Number(active?.count ?? 0),
    by_group: byGroup.map(r => ({ group: r.group, count: Number(r.count) })),
    by_sector: bySector.map(r => ({ sector: r.sector, count: Number(r.count) })),
    data_confidence_distribution: byDC
      .filter(r => r.class)
      .map(r => ({ class: r.class!, count: Number(r.count) })),
  });
});

router.get("/universe/:isin", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.isin) ? req.params.isin[0] : req.params.isin;
  const [security] = await db.select().from(securitiesTable).where(eq(securitiesTable.isin, raw));
  if (!security) {
    res.status(404).json({ error: "Security not found" });
    return;
  }

  res.json({
    isin: security.isin,
    ticker: security.ticker,
    name: security.name,
    sector: security.sector,
    industry: security.industry ?? undefined,
    sub_industry: security.subIndustry ?? undefined,
    universe_group: security.universeGroup,
    status: security.status,
    market_cap_cr: security.marketCapCr ? parseFloat(security.marketCapCr) : 0,
    enterprise_value_cr: security.enterpriseValueCr ? parseFloat(security.enterpriseValueCr) : null,
    current_price: security.currentPrice ? parseFloat(security.currentPrice) : 0,
    face_value: security.faceValue ? parseFloat(security.faceValue) : null,
    shares_outstanding_cr: security.sharesOutstandingCr ? parseFloat(security.sharesOutstandingCr) : null,
    promoter_holding_pct: security.promoterHoldingPct ? parseFloat(security.promoterHoldingPct) : null,
    fii_holding_pct: security.fiiHoldingPct ? parseFloat(security.fiiHoldingPct) : null,
    dii_holding_pct: security.diiHoldingPct ? parseFloat(security.diiHoldingPct) : null,
    listing_date: security.listingDate ?? undefined,
    data_confidence: security.dataConfidence ? parseFloat(security.dataConfidence) : 0,
    data_confidence_class: security.dataConfidenceClass ?? "restricted",
    financials: {
      revenue_ttm_cr: security.revenueTtmCr ? parseFloat(security.revenueTtmCr) : null,
      ebitda_ttm_cr: security.ebitdaTtmCr ? parseFloat(security.ebitdaTtmCr) : null,
      pat_ttm_cr: security.patTtmCr ? parseFloat(security.patTtmCr) : null,
      cfo_ttm_cr: security.cfoTtmCr ? parseFloat(security.cfoTtmCr) : null,
      fcf_ttm_cr: security.fcfTtmCr ? parseFloat(security.fcfTtmCr) : null,
      revenue_growth_3y_pct: security.revenueGrowth3yPct ? parseFloat(security.revenueGrowth3yPct) : null,
      eps_growth_3y_pct: security.epsGrowth3yPct ? parseFloat(security.epsGrowth3yPct) : null,
      roic_pct: security.roicPct ? parseFloat(security.roicPct) : null,
      roce_pct: security.rocePct ? parseFloat(security.rocePct) : null,
      roe_pct: security.roePct ? parseFloat(security.roePct) : null,
      ebitda_margin_pct: security.ebitdaMarginPct ? parseFloat(security.ebitdaMarginPct) : null,
      net_debt_to_ebitda: security.netDebtToEbitda ? parseFloat(security.netDebtToEbitda) : null,
      interest_coverage: security.interestCoverage ? parseFloat(security.interestCoverage) : null,
      pe_ratio: security.peRatio ? parseFloat(security.peRatio) : null,
      pb_ratio: security.pbRatio ? parseFloat(security.pbRatio) : null,
      ev_ebitda: security.evEbitda ? parseFloat(security.evEbitda) : null,
      fcf_yield_pct: security.fcfYieldPct ? parseFloat(security.fcfYieldPct) : null,
      dividend_yield_pct: security.dividendYieldPct ? parseFloat(security.dividendYieldPct) : null,
      median_daily_traded_value_cr: security.medianDailyTradedValueCr ? parseFloat(security.medianDailyTradedValueCr) : null,
    },
    score_summary: {
      candidate_score: null,
      quality_score: null,
      growth_score: null,
      value_score: null,
      balance_sheet_score: null,
      capital_allocation_score: null,
      integrity_score: null,
    },
  });
});

export default router;
