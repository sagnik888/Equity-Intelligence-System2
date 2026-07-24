import { Router, type IRouter } from "express";
import { and, eq, sql, desc, isNull } from "drizzle-orm";
import { db, hardGatesTable } from "@workspace/db";
import { ListHardGatesQueryParams, GetStockHardGatesParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/hardgates", async (req, res): Promise<void> => {
  const query = ListHardGatesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { level, sector, limit } = query.data;

  const conditions = [isNull(hardGatesTable.resolvedAt)];
  if (level && level !== "all") conditions.push(eq(hardGatesTable.level, parseInt(level.replace("level", ""))));
  if (sector) conditions.push(eq(hardGatesTable.sector, sector));

  const [items, countResult] = await Promise.all([
    db.select().from(hardGatesTable).where(and(...conditions)).orderBy(hardGatesTable.level, desc(hardGatesTable.flaggedAt)).limit(limit ?? 100),
    db.select({ count: sql<number>`count(*)` }).from(hardGatesTable).where(and(...conditions)),
  ]);

  res.json({
    items: items.map(g => ({
      isin: g.isin,
      ticker: g.ticker,
      name: g.name,
      sector: g.sector,
      level: g.level,
      trigger: g.trigger,
      state: g.state,
      cap_score: g.capScore ? parseFloat(g.capScore) : null,
      penalty_points: g.penaltyPoints ? parseFloat(g.penaltyPoints) : null,
      description: g.description,
      flagged_at: g.flaggedAt,
      resolved_at: g.resolvedAt ?? null,
    })),
    total: Number(countResult[0]?.count ?? 0),
  });
});

router.get("/hardgates/summary", async (_req, res): Promise<void> => {
  const active = isNull(hardGatesTable.resolvedAt);
  const [byLevel, byTrigger, bySector] = await Promise.all([
    db.select({
      level: hardGatesTable.level,
      count: sql<number>`count(*)`
    }).from(hardGatesTable).where(active).groupBy(hardGatesTable.level),
    db.select({
      trigger: hardGatesTable.trigger,
      level: hardGatesTable.level,
      count: sql<number>`count(*)`
    }).from(hardGatesTable).where(active).groupBy(hardGatesTable.trigger, hardGatesTable.level).orderBy(desc(sql`count(*)`)),
    db.select({
      sector: hardGatesTable.sector,
      count: sql<number>`count(*)`
    }).from(hardGatesTable).where(active).groupBy(hardGatesTable.sector).orderBy(desc(sql`count(*)`)),
  ]);

  const l1 = byLevel.find(r => r.level === 1);
  const l2 = byLevel.find(r => r.level === 2);
  const l3 = byLevel.find(r => r.level === 3);

  res.json({
    level1_count: Number(l1?.count ?? 0),
    level2_count: Number(l2?.count ?? 0),
    level3_count: Number(l3?.count ?? 0),
    total_blocked: Number(l1?.count ?? 0),
    total_capped: Number(l2?.count ?? 0),
    by_trigger: byTrigger.map(r => ({ trigger: r.trigger, count: Number(r.count), level: r.level })),
    by_sector: bySector.map(r => ({ sector: r.sector, count: Number(r.count) })),
  });
});

router.get("/hardgates/:isin", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.isin) ? req.params.isin[0] : req.params.isin;
  const gates = await db.select().from(hardGatesTable)
    .where(and(eq(hardGatesTable.isin, raw), isNull(hardGatesTable.resolvedAt)))
    .orderBy(hardGatesTable.level);

  const minLevel1Cap = gates.filter(g => g.level === 1).length > 0 ? 0 : null;
  const minCapScore = gates.filter(g => g.capScore).reduce<number | null>((min, g) => {
    const v = g.capScore ? parseFloat(g.capScore) : null;
    if (v === null) return min;
    return min === null ? v : Math.min(min, v);
  }, null);

  const effectiveCap = minLevel1Cap ?? minCapScore;
  const effectiveState = gates.length > 0
    ? (gates[0]?.level === 1 ? "avoid" : gates[0]?.state ?? null)
    : null;

  res.json({
    isin: raw,
    ticker: gates[0]?.ticker ?? raw,
    name: gates[0]?.name ?? raw,
    has_gate: gates.length > 0,
    effective_cap: effectiveCap,
    effective_state: effectiveState,
    gates: gates.map(g => ({
      isin: g.isin,
      ticker: g.ticker,
      name: g.name,
      sector: g.sector,
      level: g.level,
      trigger: g.trigger,
      state: g.state,
      cap_score: g.capScore ? parseFloat(g.capScore) : null,
      penalty_points: g.penaltyPoints ? parseFloat(g.penaltyPoints) : null,
      description: g.description,
      flagged_at: g.flaggedAt,
      resolved_at: g.resolvedAt ?? null,
    })),
  });
});

export default router;
