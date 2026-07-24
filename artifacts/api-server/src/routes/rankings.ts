import { Router, type IRouter } from "express";
import { and, eq, sql, asc } from "drizzle-orm";
import { db, rankingsTable } from "@workspace/db";
import { ListRankingsQueryParams, GetStockRankingsParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/rankings", async (req, res): Promise<void> => {
  const query = ListRankingsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { dimension, sector, group, limit } = query.data;
  const dim = dimension ?? "overall";

  const conditions = [eq(rankingsTable.dimension, dim)];
  if (sector) conditions.push(eq(rankingsTable.sector, sector));
  if (group) conditions.push(eq(rankingsTable.universeGroup, group));

  const [items, countResult] = await Promise.all([
    db.select().from(rankingsTable).where(and(...conditions)).orderBy(asc(rankingsTable.rank)).limit(limit ?? 50),
    db.select({ count: sql<number>`count(*)` }).from(rankingsTable).where(and(...conditions)),
  ]);

  res.json({
    items: items.map(r => ({
      isin: r.isin,
      ticker: r.ticker,
      name: r.name,
      sector: r.sector,
      universe_group: r.universeGroup,
      rank: r.rank,
      score: r.score ? parseFloat(r.score) : 0,
      percentile: r.percentile ? parseFloat(r.percentile) : 0,
      rank_change: r.rankChange ?? null,
      dimension: r.dimension,
    })),
    dimension: dim,
    total: Number(countResult[0]?.count ?? 0),
  });
});

router.get("/rankings/:isin", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.isin) ? req.params.isin[0] : req.params.isin;
  const allRanks = await db.select().from(rankingsTable).where(eq(rankingsTable.isin, raw));

  const get = (dim: string) => {
    const r = allRanks.find(x => x.dimension === dim);
    return r?.rank ?? null;
  };

  const ticker = allRanks[0]?.ticker ?? raw;
  const name = allRanks[0]?.name ?? raw;

  // Composite rank score: 0.50 * overall_percentile + 0.25 * sector_percentile + 0.15 * size_percentile + 0.10 * persistence
  const overall = allRanks.find(x => x.dimension === "overall");
  const sector = allRanks.find(x => x.dimension === "sector");
  const size = allRanks.find(x => x.dimension === "market_cap");
  const persistence = allRanks.find(x => x.dimension === "persistence");

  const compositeRankScore = [
    { w: 0.50, v: overall?.percentile ? parseFloat(overall.percentile) : null },
    { w: 0.25, v: sector?.percentile ? parseFloat(sector.percentile) : null },
    { w: 0.15, v: size?.percentile ? parseFloat(size.percentile) : null },
    { w: 0.10, v: persistence?.percentile ? parseFloat(persistence.percentile) : null },
  ].reduce((acc, { w, v }) => v !== null ? acc + w * v : acc, 0);

  res.json({
    isin: raw,
    ticker,
    name,
    ranks: {
      overall: get("overall"),
      sector: get("sector"),
      market_cap: get("market_cap"),
      quality: get("quality"),
      growth: get("growth"),
      value: get("value"),
      balance_sheet: get("balance_sheet"),
      capital_allocation: get("capital_allocation"),
      integrity: get("integrity"),
      momentum: get("momentum"),
      liquidity: get("liquidity"),
      data_confidence: get("data_confidence"),
      research: get("research"),
      persistence: get("persistence"),
      capacity: get("capacity"),
    },
    composite_rank_score: compositeRankScore,
  });
});

export default router;
