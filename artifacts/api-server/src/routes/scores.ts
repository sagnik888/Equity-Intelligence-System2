import { Router, type IRouter } from "express";
import { and, eq, gte, desc, sql, lte } from "drizzle-orm";
import { db, candidateScoresTable, scoreHistoryTable } from "@workspace/db";
import {
  ListCandidateScoresQueryParams,
  GetStockScoreParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/scores", async (req, res): Promise<void> => {
  const query = ListCandidateScoresQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { sector, group, minScore, limit, offset, sortBy } = query.data;

  const conditions = [];
  if (sector) conditions.push(eq(candidateScoresTable.sector, sector));
  if (group) conditions.push(eq(candidateScoresTable.universeGroup, group));
  if (minScore != null) conditions.push(gte(candidateScoresTable.candidateScore, String(minScore)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderCol = sortBy === "quality_score" ? candidateScoresTable.qualityScore
    : sortBy === "growth_score" ? candidateScoresTable.growthScore
    : sortBy === "value_score" ? candidateScoresTable.valueScore
    : sortBy === "data_confidence" ? candidateScoresTable.dataConfidence
    : candidateScoresTable.candidateScore;

  const [items, countResult] = await Promise.all([
    db.select().from(candidateScoresTable)
      .where(where)
      .orderBy(desc(orderCol))
      .limit(limit ?? 100)
      .offset(offset ?? 0),
    db.select({ count: sql<number>`count(*)` }).from(candidateScoresTable).where(where),
  ]);

  res.json({
    items: items.map(s => ({
      isin: s.isin,
      ticker: s.ticker,
      name: s.name,
      sector: s.sector,
      universe_group: s.universeGroup,
      candidate_score: s.candidateScore ? parseFloat(s.candidateScore) : 0,
      quality_score: s.qualityScore ? parseFloat(s.qualityScore) : null,
      growth_score: s.growthScore ? parseFloat(s.growthScore) : null,
      value_score: s.valueScore ? parseFloat(s.valueScore) : null,
      balance_sheet_score: s.balanceSheetScore ? parseFloat(s.balanceSheetScore) : null,
      capital_allocation_score: s.capitalAllocationScore ? parseFloat(s.capitalAllocationScore) : null,
      integrity_score: s.integrityScore ? parseFloat(s.integrityScore) : null,
      data_confidence: s.dataConfidence ? parseFloat(s.dataConfidence) : 0,
      hard_gate_cap: s.hardGateCap ? parseFloat(s.hardGateCap) : null,
      overall_rank: s.overallRank ?? null,
      score_date: s.scoreDate,
    })),
    total: Number(countResult[0]?.count ?? 0),
  });
});

router.get("/scores/distribution", async (_req, res): Promise<void> => {
  const allScores = await db.select({
    score: candidateScoresTable.candidateScore
  }).from(candidateScoresTable);

  const scores = allScores.map(r => r.score ? parseFloat(r.score) : 0).sort((a, b) => a - b);
  const total = scores.length;

  const buckets = [
    { range_label: "0-20", min: 0, max: 20 },
    { range_label: "20-30", min: 20, max: 30 },
    { range_label: "30-40", min: 30, max: 40 },
    { range_label: "40-50", min: 40, max: 50 },
    { range_label: "50-60", min: 50, max: 60 },
    { range_label: "60-70", min: 60, max: 70 },
    { range_label: "70-80", min: 70, max: 80 },
    { range_label: "80-100", min: 80, max: 100 },
  ].map(b => ({
    ...b,
    count: scores.filter(s => s >= b.min && s < b.max).length,
  }));

  const mean = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 0;
  const median = total > 0 ? scores[Math.floor(total / 2)] : 0;
  const p75 = total > 0 ? scores[Math.floor(total * 0.75)] : 0;
  const p90 = total > 0 ? scores[Math.floor(total * 0.90)] : 0;

  res.json({ buckets, total, mean, median, p75, p90 });
});

router.get("/scores/:isin", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.isin) ? req.params.isin[0] : req.params.isin;
  const [score] = await db.select().from(candidateScoresTable).where(eq(candidateScoresTable.isin, raw));
  if (!score) {
    res.status(404).json({ error: "Score not found" });
    return;
  }

  const history = await db.select({
    date: scoreHistoryTable.scoreDate,
    candidate_score: scoreHistoryTable.candidateScore,
  }).from(scoreHistoryTable).where(eq(scoreHistoryTable.isin, raw)).orderBy(scoreHistoryTable.scoreDate);

  const breakdown = (score.scoreBreakdown as any) ?? {};

  res.json({
    isin: score.isin,
    ticker: score.ticker,
    name: score.name,
    candidate_score: score.candidateScore ? parseFloat(score.candidateScore) : 0,
    confidence_adjusted_score: score.confidenceAdjustedScore ? parseFloat(score.confidenceAdjustedScore) : null,
    hard_gate_cap: score.hardGateCap ? parseFloat(score.hardGateCap) : null,
    components: {
      quality: {
        score: score.qualityScore ? parseFloat(score.qualityScore) : null,
        weight: 20,
        sub_scores: breakdown.quality_subs ?? [
          { name: "Normalized ROIC", value: null, weight: 18, percentile: null },
          { name: "ROCE", value: null, weight: 8, percentile: null },
          { name: "CFO/PAT", value: null, weight: 12, percentile: null },
          { name: "FCF Conversion", value: null, weight: 12, percentile: null },
          { name: "Operating Margin Stability", value: null, weight: 10, percentile: null },
          { name: "Gross Margin Stability", value: null, weight: 5, percentile: null },
          { name: "Asset Turnover", value: null, weight: 8, percentile: null },
          { name: "Earnings Stability", value: null, weight: 10, percentile: null },
          { name: "Accrual Quality", value: null, weight: 10, percentile: null },
          { name: "Incremental Returns", value: null, weight: 7, percentile: null },
        ],
      },
      growth: {
        score: score.growthScore ? parseFloat(score.growthScore) : null,
        weight: 20,
        sub_scores: breakdown.growth_subs ?? [
          { name: "5Y Revenue CAGR", value: null, weight: 20, percentile: null },
          { name: "3Y Revenue CAGR", value: null, weight: 15, percentile: null },
          { name: "TTM Revenue Growth", value: null, weight: 10, percentile: null },
          { name: "5Y EPS Growth", value: null, weight: 20, percentile: null },
          { name: "FCF Growth", value: null, weight: 15, percentile: null },
          { name: "Growth Consistency", value: null, weight: 10, percentile: null },
          { name: "Per-Share Growth", value: null, weight: 10, percentile: null },
        ],
      },
      value: {
        score: score.valueScore ? parseFloat(score.valueScore) : null,
        weight: 20,
        sub_scores: breakdown.value_subs ?? [
          { name: "EV/EBIT Percentile", value: null, weight: 25, percentile: null },
          { name: "FCF Yield", value: null, weight: 25, percentile: null },
          { name: "P/E Percentile", value: null, weight: 20, percentile: null },
          { name: "EV/EBITDA Percentile", value: null, weight: 15, percentile: null },
          { name: "P/B Percentile", value: null, weight: 15, percentile: null },
        ],
      },
      balance_sheet: {
        score: score.balanceSheetScore ? parseFloat(score.balanceSheetScore) : null,
        weight: 15,
        sub_scores: breakdown.bs_subs ?? [
          { name: "Net Debt/EBITDA", value: null, weight: 35, percentile: null },
          { name: "Interest Coverage", value: null, weight: 30, percentile: null },
          { name: "Current Ratio", value: null, weight: 20, percentile: null },
          { name: "Debt Trend", value: null, weight: 15, percentile: null },
        ],
      },
      capital_allocation: {
        score: score.capitalAllocationScore ? parseFloat(score.capitalAllocationScore) : null,
        weight: 15,
        sub_scores: breakdown.capalloc_subs ?? [
          { name: "ROIC vs WACC Spread", value: null, weight: 30, percentile: null },
          { name: "Capex Quality", value: null, weight: 25, percentile: null },
          { name: "Dividend Track Record", value: null, weight: 20, percentile: null },
          { name: "Buyback Quality", value: null, weight: 15, percentile: null },
          { name: "M&A Track Record", value: null, weight: 10, percentile: null },
        ],
      },
      integrity: {
        score: score.integrityScore ? parseFloat(score.integrityScore) : null,
        weight: 10,
        sub_scores: breakdown.integrity_subs ?? [
          { name: "Audit Quality", value: null, weight: 30, percentile: null },
          { name: "Related Party Exposure", value: null, weight: 25, percentile: null },
          { name: "Promoter Pledge %", value: null, weight: 20, percentile: null },
          { name: "Corporate Governance Score", value: null, weight: 15, percentile: null },
          { name: "Regulatory Compliance", value: null, weight: 10, percentile: null },
        ],
      },
    },
    data_confidence: score.dataConfidence ? parseFloat(score.dataConfidence) : 0,
    data_confidence_breakdown: breakdown.dc_breakdown ?? {
      primary_source_coverage: 0,
      financial_reconciliation: 0,
      data_freshness: 0,
      historical_coverage: 0,
      source_agreement: 0,
      parsing_confidence: 0,
      sector_model_completeness: 0,
      corporate_action_completeness: 0,
    },
    score_date: score.scoreDate,
    score_history: history.map(h => ({
      date: h.date,
      candidate_score: h.candidate_score ? parseFloat(h.candidate_score) : 0,
    })),
  });
});

export default router;
