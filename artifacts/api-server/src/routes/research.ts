import { Router, type IRouter } from "express";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import { db, researchScoresTable, evidenceLedgerTable } from "@workspace/db";
import {
  ListResearchScoresQueryParams,
  GetResearchDetailParams,
  GetEvidenceLedgerParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/research", async (req, res): Promise<void> => {
  const query = ListResearchScoresQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const conditions = [];
  if (query.data.minScore != null) conditions.push(gte(researchScoresTable.researchScore, String(query.data.minScore)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [items, countResult] = await Promise.all([
    db.select().from(researchScoresTable).where(where).orderBy(desc(researchScoresTable.researchScore)).limit(query.data.limit ?? 50),
    db.select({ count: sql<number>`count(*)` }).from(researchScoresTable).where(where),
  ]);

  res.json({
    items: items.map(r => ({
      isin: r.isin,
      ticker: r.ticker,
      name: r.name,
      sector: r.sector,
      research_score: r.researchScore ? parseFloat(r.researchScore) : 0,
      adjusted_research_score: r.adjustedResearchScore ? parseFloat(r.adjustedResearchScore) : 0,
      confidence: r.confidence ? parseFloat(r.confidence) : 0,
      coverage_tier: r.coverageTier,
      business_quality_score: r.businessQualityScore ? parseFloat(r.businessQualityScore) : null,
      integrity_governance_score: r.integrityGovernanceScore ? parseFloat(r.integrityGovernanceScore) : null,
      valuation_score: r.valuationScore ? parseFloat(r.valuationScore) : null,
      score_date: r.scoreDate,
    })),
    total: Number(countResult[0]?.count ?? 0),
  });
});

router.get("/research/:isin", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.isin) ? req.params.isin[0] : req.params.isin;
  const [r] = await db.select().from(researchScoresTable).where(eq(researchScoresTable.isin, raw));
  if (!r) { res.status(404).json({ error: "Research not found" }); return; }

  res.json({
    isin: r.isin,
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
    research_score: r.researchScore ? parseFloat(r.researchScore) : 0,
    adjusted_research_score: r.adjustedResearchScore ? parseFloat(r.adjustedResearchScore) : 0,
    confidence: r.confidence ? parseFloat(r.confidence) : 0,
    components: [
      { name: "Business Quality and Moat", weight: 15, score: r.businessQualityScore ? parseFloat(r.businessQualityScore) : null },
      { name: "Industry Structure", weight: 10, score: r.industryStructureScore ? parseFloat(r.industryStructureScore) : null },
      { name: "Financial Quality", weight: 15, score: r.financialQualityScore ? parseFloat(r.financialQualityScore) : null },
      { name: "Capital Allocation", weight: 10, score: r.capitalAllocationScore ? parseFloat(r.capitalAllocationScore) : null },
      { name: "Integrity and Governance", weight: 20, score: r.integrityGovernanceScore ? parseFloat(r.integrityGovernanceScore) : null },
      { name: "Forecast Resilience", weight: 10, score: r.forecastResilienceScore ? parseFloat(r.forecastResilienceScore) : null },
      { name: "Valuation and Margin of Safety", weight: 15, score: r.valuationScore ? parseFloat(r.valuationScore) : null },
      { name: "Catalysts", weight: 3, score: r.catalystsScore ? parseFloat(r.catalystsScore) : null },
      { name: "Technical Execution", weight: 2, score: r.technicalExecutionScore ? parseFloat(r.technicalExecutionScore) : null },
    ],
    valuation: {
      method: r.valuationMethod ?? null,
      fair_value_base: r.fairValueBase ? parseFloat(r.fairValueBase) : null,
      fair_value_bull: r.fairValueBull ? parseFloat(r.fairValueBull) : null,
      fair_value_bear: r.fairValueBear ? parseFloat(r.fairValueBear) : null,
      weighted_fair_value: r.weightedFairValue ? parseFloat(r.weightedFairValue) : null,
      expected_annual_return_pct: r.expectedAnnualReturnPct ? parseFloat(r.expectedAnnualReturnPct) : null,
      horizon_years: r.horizonYears ? parseFloat(r.horizonYears) : null,
      current_price: r.currentPrice ? parseFloat(r.currentPrice) : null,
    },
    analyst_notes: r.analystNotes ?? undefined,
    score_date: r.scoreDate,
  });
});

router.get("/research/:isin/evidence", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.isin) ? req.params.isin[0] : req.params.isin;
  const entries = await db.select().from(evidenceLedgerTable)
    .where(eq(evidenceLedgerTable.isin, raw))
    .orderBy(desc(evidenceLedgerTable.createdAt));

  res.json({
    isin: raw,
    ticker: raw,
    entries: entries.map(e => ({
      claim_id: e.claimId,
      claim: e.claim,
      claim_type: e.claimType,
      source: e.source,
      source_grade: e.sourceGrade,
      document_id: e.documentId ?? null,
      page_or_section: e.pageOrSection ?? null,
      filing_timestamp: e.filingTimestamp ?? null,
      supporting_evidence: e.supportingEvidence,
      contradictory_evidence: e.contradictoryEvidence,
      analyst_inference: e.analystInference,
      ai_inference: e.aiInference,
      confidence: e.confidence ? parseFloat(e.confidence) : 0,
      review_status: e.reviewStatus,
      affected_score: e.affectedScore ?? null,
      created_at: e.createdAt.toISOString(),
    })),
    total: entries.length,
  });
});

export default router;
