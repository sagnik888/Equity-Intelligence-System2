/**
 * Research Routes - V2 with Evidence Ledger and Deep Research Promotion
 * Implements evidence-led research, deep research promotion, and research scores
 */

import { Router } from "express";
import { db } from "@ieis/db";
import {
  evidenceLedgerTable,
  securitiesTable,
  candidateScoresTable,
} from "@ieis/db";
import { eq, desc } from "drizzle-orm";
import * as formulas from "@ieis/formulas";
import { z } from "zod/v4";

const router = Router();

// ============================================================================
// Request/Response Schemas
// ============================================================================

const AddEvidenceBody = z.object({
  isin: z.string(),
  claim: z.string(),
  claim_type: z.enum(["fundamental", "technical", "macroeconomic", "governance", "event", "other"]),
  source: z.string(),
  source_grade: z.enum(["statutory", "broker", "licensed_vendor", "research_support", "diagnostic_fallback", "analyst_inference"]),
  document_id: z.string().optional(),
  page_or_section: z.string().optional(),
  filing_timestamp: z.string().optional(),
  supporting_evidence: z.array(z.object({ document_id: z.string(), page_or_section: z.string() })).optional(),
  contradictory_evidence: z.array(z.object({ document_id: z.string(), page_or_section: z.string() })).optional(),
  calculation_reference: z.string().optional(),
  analyst_inference: z.string().optional(),
  ai_inference: z.string().optional(),
  confidence: z.number().min(0).max(100),
  affected_score: z.string().optional(),
  affected_forecast: z.string().optional(),
  affected_valuation: z.string().optional(),
});

const ListEvidenceQueryParams = z.object({
  isin: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  claim_type: z.string().optional(),
  review_status: z.string().optional(),
});

// ============================================================================
// Evidence Ledger Management
// ============================================================================

router.post("/research/evidence", async (req, res): Promise<void> => {
  try {
    const parsed = AddEvidenceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const {
      isin,
      claim,
      claim_type,
      source,
      source_grade,
      document_id,
      page_or_section,
      filing_timestamp,
      supporting_evidence,
      contradictory_evidence,
      calculation_reference,
      analyst_inference,
      ai_inference,
      confidence,
      affected_score,
      affected_forecast,
      affected_valuation,
    } = parsed.data;

    // Get security information
    const [security] = await db
      .select()
      .from(securitiesTable)
      .where(eq(securitiesTable.isin, isin));

    if (!security) {
      res.status(404).json({ error: "Security not found" });
      return;
    }

    // Generate unique claim ID
    const claimId = `${isin}_${claim_type}_${Date.now()}`;

    // Insert evidence
    const [inserted] = await db
      .insert(evidenceLedgerTable)
      .values({
        claimId,
        isin,
        ticker: security.ticker,
        name: security.name,
        claim,
        claimType: claim_type,
        source,
        sourceGrade: source_grade,
        documentId: document_id,
        pageOrSection: page_or_section,
        filingTimestamp: filing_timestamp ? new Date(filing_timestamp) : undefined,
        supportingEvidence: supporting_evidence ? JSON.stringify(supporting_evidence) : undefined,
        contradictoryEvidence: contradictory_evidence ? JSON.stringify(contradictory_evidence) : undefined,
        calculationReference: calculation_reference,
        analystInference: analyst_inference,
        aiInference: ai_inference,
        confidence: confidence.toString(),
        affectedScore: affected_score,
        affectedForecast: affected_forecast,
        affectedValuation: affected_valuation,
      })
      .returning();

    res.status(201).json({
      claim_id: claimId,
      isin,
      ticker: security.ticker,
      claim,
      claim_type,
      source,
      source_grade,
      confidence,
      review_status: "pending",
    });
  } catch (error) {
    console.error("Error adding evidence:", error);
    res.status(500).json({ error: "Failed to add evidence" });
  }
});

// ============================================================================
// List Evidence with Filtering
// ============================================================================

router.get("/research/evidence", async (req, res): Promise<void> => {
  try {
    const query = ListEvidenceQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    let dbQuery = db.select().from(evidenceLedgerTable);

    if (query.data.isin) {
      dbQuery = dbQuery.where(eq(evidenceLedgerTable.isin, query.data.isin));
    }

    if (query.data.claim_type) {
      dbQuery = dbQuery.where(eq(evidenceLedgerTable.claimType, query.data.claim_type as any));
    }

    if (query.data.review_status) {
      dbQuery = dbQuery.where(eq(evidenceLedgerTable.reviewStatus, query.data.review_status as any));
    }

    // Sort by creation date descending
    dbQuery = dbQuery.orderBy(desc(evidenceLedgerTable.createdAt));

    const limit = query.data.limit ?? 50;
    const offset = query.data.offset ?? 0;

    const evidence = await dbQuery.limit(limit).offset(offset);

    const items = evidence.map((e) => ({
      claim_id: e.claimId,
      isin: e.isin,
      ticker: e.ticker,
      name: e.name,
      claim: e.claim,
      claim_type: e.claimType,
      source: e.source,
      source_grade: e.sourceGrade,
      document_id: e.documentId,
      page_or_section: e.pageOrSection,
      confidence: parseFloat(e.confidence),
      review_status: e.reviewStatus,
      affected_score: e.affectedScore,
      created_at: e.createdAt,
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching evidence:", error);
    res.status(500).json({ error: "Failed to fetch evidence" });
  }
});

// ============================================================================
// Deep Research Promotion Score
// ============================================================================

router.get("/research/promotion/:isin", async (req, res): Promise<void> => {
  try {
    const { isin } = req.params;

    // Get security information
    const [security] = await db
      .select()
      .from(securitiesTable)
      .where(eq(securitiesTable.isin, isin));

    if (!security) {
      res.status(404).json({ error: "Security not found" });
      return;
    }

    // Get candidate score
    const [candidateScore] = await db
      .select()
      .from(candidateScoresTable)
      .where(eq(candidateScoresTable.isin, isin))
      .orderBy(desc(candidateScoresTable.scoreDate))
      .limit(1);

    if (!candidateScore) {
      res.status(404).json({ error: "Candidate score not found" });
      return;
    }

    // Get evidence count
    const evidenceCount = await db
      .select()
      .from(evidenceLedgerTable)
      .where(eq(evidenceLedgerTable.isin, isin));

    // Calculate promotion score using canonical formula
    // PromotionScore = 0.45 * CandidateScore + 0.15 * SectorPercentile + 0.10 * DataConfidence + 
    //                  0.10 * RankPersistence + 0.10 * LiquidityScore + 0.05 * EventPriority + 0.05 * PortfolioPriority

    const candidateScoreValue = parseFloat(candidateScore.candidateScore || "50");
    const dataConfidenceValue = parseFloat(candidateScore.dataConfidence || "50");
    const sectorPercentile = 50; // Placeholder - would be calculated from rankings
    const rankPersistence = 50; // Placeholder - would be calculated from historical ranks
    const liquidityScore = 50; // Placeholder - would be calculated from liquidity metrics
    const eventPriority = 30; // Placeholder - would be calculated from events
    const portfolioPriority = 40; // Placeholder - would be calculated from portfolio context

    const promotionScore = formulas.promotionScore(
      candidateScoreValue,
      sectorPercentile,
      dataConfidenceValue,
      rankPersistence,
      liquidityScore,
      eventPriority,
      portfolioPriority
    );

    // Determine if eligible for deep research
    const isEligible = promotionScore >= 60 && dataConfidenceValue >= 70;

    res.json({
      isin,
      ticker: security.ticker,
      name: security.name,
      promotion_score: promotionScore,
      candidate_score: candidateScoreValue,
      data_confidence: dataConfidenceValue,
      sector_percentile: sectorPercentile,
      rank_persistence: rankPersistence,
      liquidity_score: liquidityScore,
      event_priority: eventPriority,
      portfolio_priority: portfolioPriority,
      evidence_count: evidenceCount.length,
      eligible_for_deep_research: isEligible,
      recommendation: isEligible ? "PROMOTE_TO_DEEP_RESEARCH" : "CONTINUE_MONITORING",
    });
  } catch (error) {
    console.error("Error calculating promotion score:", error);
    res.status(500).json({ error: "Failed to calculate promotion score" });
  }
});

// ============================================================================
// Deep Research Queue
// ============================================================================

router.get("/research/queue", async (req, res): Promise<void> => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // Get all candidate scores
    const scores = await db
      .select()
      .from(candidateScoresTable)
      .orderBy(desc(candidateScoresTable.candidateScore))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const items = [];

    for (const score of scores) {
      const evidenceCount = await db
        .select()
        .from(evidenceLedgerTable)
        .where(eq(evidenceLedgerTable.isin, score.isin));

      const candidateScoreValue = parseFloat(score.candidateScore || "50");
      const dataConfidenceValue = parseFloat(score.dataConfidence || "50");

      // Simple promotion score calculation
      const promotionScore = (candidateScoreValue * 0.6 + dataConfidenceValue * 0.4);

      items.push({
        isin: score.isin,
        ticker: score.ticker,
        name: score.name,
        sector: score.sector,
        candidate_score: candidateScoreValue,
        data_confidence: dataConfidenceValue,
        promotion_score: promotionScore,
        evidence_count: evidenceCount.length,
        eligible_for_deep_research: promotionScore >= 60 && dataConfidenceValue >= 70,
      });
    }

    // Sort by promotion score
    items.sort((a, b) => b.promotion_score - a.promotion_score);

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching research queue:", error);
    res.status(500).json({ error: "Failed to fetch research queue" });
  }
});

// ============================================================================
// Evidence Summary by Security
// ============================================================================

router.get("/research/evidence-summary/:isin", async (req, res): Promise<void> => {
  try {
    const { isin } = req.params;

    const evidence = await db
      .select()
      .from(evidenceLedgerTable)
      .where(eq(evidenceLedgerTable.isin, isin));

    if (evidence.length === 0) {
      res.status(404).json({ error: "No evidence found for this security" });
      return;
    }

    // Group by claim type
    const byClaimType: Record<string, number> = {};
    const bySourceGrade: Record<string, number> = {};
    const byReviewStatus: Record<string, number> = {};
    let totalConfidence = 0;
    let approvedCount = 0;

    for (const e of evidence) {
      byClaimType[e.claimType] = (byClaimType[e.claimType] || 0) + 1;
      bySourceGrade[e.sourceGrade] = (bySourceGrade[e.sourceGrade] || 0) + 1;
      byReviewStatus[e.reviewStatus] = (byReviewStatus[e.reviewStatus] || 0) + 1;
      totalConfidence += parseFloat(e.confidence);
      if (e.reviewStatus === "approved") approvedCount++;
    }

    const averageConfidence = evidence.length > 0 ? totalConfidence / evidence.length : 0;

    res.json({
      isin,
      total_evidence: evidence.length,
      approved_evidence: approvedCount,
      pending_evidence: evidence.length - approvedCount,
      average_confidence: Math.round(averageConfidence * 100) / 100,
      by_claim_type: byClaimType,
      by_source_grade: bySourceGrade,
      by_review_status: byReviewStatus,
      evidence_items: evidence.map((e) => ({
        claim_id: e.claimId,
        claim: e.claim,
        claim_type: e.claimType,
        source_grade: e.sourceGrade,
        confidence: parseFloat(e.confidence),
        review_status: e.reviewStatus,
      })),
    });
  } catch (error) {
    console.error("Error fetching evidence summary:", error);
    res.status(500).json({ error: "Failed to fetch evidence summary" });
  }
});

// ============================================================================
// Review Evidence
// ============================================================================

router.put("/research/evidence/:claimId/review", async (req, res): Promise<void> => {
  try {
    const { claimId } = req.params;
    const { review_status } = req.body;

    if (!["approved", "rejected", "reconciliation_required"].includes(review_status)) {
      res.status(400).json({ error: "Invalid review status" });
      return;
    }

    const [updated] = await db
      .update(evidenceLedgerTable)
      .set({
        reviewStatus: review_status as any,
        updatedAt: new Date(),
      })
      .where(eq(evidenceLedgerTable.claimId, claimId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Evidence not found" });
      return;
    }

    res.json({
      claim_id: claimId,
      review_status,
      message: "Evidence review status updated",
    });
  } catch (error) {
    console.error("Error reviewing evidence:", error);
    res.status(500).json({ error: "Failed to review evidence" });
  }
});

export default router;
