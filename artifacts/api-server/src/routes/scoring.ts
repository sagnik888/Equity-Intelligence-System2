/**
 * Scoring Routes - Canonical Formula Implementations
 * Implements all scoring formulas from Indian Equity Intelligence System 7.1.2
 */

import { Router } from "express";
import { db } from "@ieis/db";
import {
  candidateScoresTable,
  scoreHistoryTable,
  rankingsTable,
  securitiesTable,
} from "@ieis/db";
import { eq, desc } from "drizzle-orm";
import * as formulas from "@ieis/formulas";
import { z } from "zod/v4";

const router = Router();

// ============================================================================
// Request/Response Schemas
// ============================================================================

const CalculateCandidateScoreBody = z.object({
  isin: z.string(),
  component_scores: z.record(z.number()),
  weights: z.record(z.number()),
  data_confidence: z.number().min(0).max(100),
  hard_gate_cap: z.number().min(0).max(100).optional(),
});

const ListCandidateScoresQueryParams = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  sector: z.string().optional(),
  min_score: z.number().optional(),
  sort_by: z.enum(["score", "name", "sector"]).optional(),
});

// ============================================================================
// Candidate Score Calculation and Storage
// ============================================================================

router.post("/scores/calculate", async (req, res): Promise<void> => {
  try {
    const parsed = CalculateCandidateScoreBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const {
      isin,
      component_scores,
      weights,
      data_confidence,
      hard_gate_cap = 100,
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

    // Calculate candidate score using canonical formula
    const candidateScore = formulas.candidateScore(
      component_scores,
      weights,
      data_confidence,
      hard_gate_cap
    );

    // Get previous score for delta calculation
    const [previousScore] = await db
      .select()
      .from(candidateScoresTable)
      .where(eq(candidateScoresTable.isin, isin))
      .orderBy(desc(candidateScoresTable.scoreDate))
      .limit(1);

    const scoreDelta = previousScore
      ? candidateScore - parseFloat(previousScore.candidateScore || "0")
      : 0;

    // Store in database
    const today = new Date().toISOString().split("T")[0];
    const [inserted] = await db
      .insert(candidateScoresTable)
      .values({
        isin,
        ticker: security.ticker,
        name: security.name,
        sector: security.sector,
        universeGroup: security.universeGroup || "standard",
        candidateScore: candidateScore.toString(),
        qualityScore: (component_scores.quality || 50).toString(),
        growthScore: (component_scores.growth || 50).toString(),
        valueScore: (component_scores.value || 50).toString(),
        balanceSheetScore: (component_scores.balanceSheet || 50).toString(),
        capitalAllocationScore: (component_scores.capitalAllocation || 50).toString(),
        integrityScore: (component_scores.integrity || 50).toString(),
        dataConfidence: data_confidence.toString(),
        hardGateCap: hard_gate_cap.toString(),
        scoreDate: today,
        previousScore: previousScore?.candidateScore,
        scoreDelta: scoreDelta.toString(),
        scoreBreakdown: JSON.stringify(component_scores),
      })
      .returning();

    // Also add to history
    await db.insert(scoreHistoryTable).values({
      isin,
      candidateScore: candidateScore.toString(),
      qualityScore: (component_scores.quality || 50).toString(),
      growthScore: (component_scores.growth || 50).toString(),
      valueScore: (component_scores.value || 50).toString(),
      dataConfidence: data_confidence.toString(),
      scoreDate: today,
    });

    res.status(201).json({
      isin,
      ticker: security.ticker,
      name: security.name,
      candidate_score: candidateScore,
      component_scores,
      data_confidence,
      hard_gate_cap,
      score_delta: scoreDelta,
      score_date: today,
    });
  } catch (error) {
    console.error("Error calculating candidate score:", error);
    res.status(500).json({ error: "Failed to calculate candidate score" });
  }
});

// ============================================================================
// List Candidate Scores with Filtering
// ============================================================================

router.get("/scores/candidate", async (req, res): Promise<void> => {
  try {
    const query = ListCandidateScoresQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    let dbQuery = db.select().from(candidateScoresTable);

    // Apply filters
    if (query.data.sector) {
      dbQuery = dbQuery.where(eq(candidateScoresTable.sector, query.data.sector));
    }

    // Apply sorting
    if (query.data.sort_by === "score") {
      dbQuery = dbQuery.orderBy(desc(candidateScoresTable.candidateScore));
    } else if (query.data.sort_by === "name") {
      dbQuery = dbQuery.orderBy(candidateScoresTable.name);
    } else if (query.data.sort_by === "sector") {
      dbQuery = dbQuery.orderBy(candidateScoresTable.sector);
    } else {
      dbQuery = dbQuery.orderBy(desc(candidateScoresTable.scoreDate));
    }

    // Apply pagination
    const limit = query.data.limit ?? 50;
    const offset = query.data.offset ?? 0;

    const scores = await dbQuery.limit(limit).offset(offset);

    const items = scores.map((score) => ({
      isin: score.isin,
      ticker: score.ticker,
      name: score.name,
      sector: score.sector,
      candidate_score: parseFloat(score.candidateScore || "0"),
      quality_score: parseFloat(score.qualityScore || "0"),
      growth_score: parseFloat(score.growthScore || "0"),
      value_score: parseFloat(score.valueScore || "0"),
      balance_sheet_score: parseFloat(score.balanceSheetScore || "0"),
      capital_allocation_score: parseFloat(score.capitalAllocationScore || "0"),
      integrity_score: parseFloat(score.integrityScore || "0"),
      data_confidence: parseFloat(score.dataConfidence || "0"),
      score_date: score.scoreDate,
      score_delta: parseFloat(score.scoreDelta || "0"),
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching candidate scores:", error);
    res.status(500).json({ error: "Failed to fetch candidate scores" });
  }
});

// ============================================================================
// Score History
// ============================================================================

router.get("/scores/history/:isin", async (req, res): Promise<void> => {
  try {
    const { isin } = req.params;

    const history = await db
      .select()
      .from(scoreHistoryTable)
      .where(eq(scoreHistoryTable.isin, isin))
      .orderBy(desc(scoreHistoryTable.scoreDate));

    const items = history.map((h) => ({
      isin: h.isin,
      candidate_score: parseFloat(h.candidateScore || "0"),
      quality_score: parseFloat(h.qualityScore || "0"),
      growth_score: parseFloat(h.growthScore || "0"),
      value_score: parseFloat(h.valueScore || "0"),
      data_confidence: parseFloat(h.dataConfidence || "0"),
      score_date: h.scoreDate,
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching score history:", error);
    res.status(500).json({ error: "Failed to fetch score history" });
  }
});

// ============================================================================
// Rankings with Composite Rank Formula
// ============================================================================

router.get("/rankings", async (req, res): Promise<void> => {
  try {
    const { dimension = "overall", limit = 50, offset = 0 } = req.query;

    const rankings = await db
      .select()
      .from(rankingsTable)
      .where(eq(rankingsTable.dimension, dimension as string))
      .orderBy(rankingsTable.rank)
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const items = rankings.map((r) => ({
      rank: r.rank,
      isin: r.isin,
      ticker: r.ticker,
      name: r.name,
      sector: r.sector,
      dimension: r.dimension,
      score: parseFloat(r.score || "0"),
      percentile: parseFloat(r.percentile || "0"),
      rank_change: r.rankChange,
      rank_date: r.rankDate,
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    res.status(500).json({ error: "Failed to fetch rankings" });
  }
});

// ============================================================================
// Score Distribution and Statistics
// ============================================================================

router.get("/scores/distribution", async (req, res): Promise<void> => {
  try {
    const scores = await db.select().from(candidateScoresTable);

    if (scores.length === 0) {
      res.json({
        count: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        std_dev: 0,
        buckets: [],
      });
      return;
    }

    // Parse scores
    const scoreValues = scores.map((s) => parseFloat(s.candidateScore || "0"));
    scoreValues.sort((a, b) => a - b);

    // Calculate statistics
    const count = scoreValues.length;
    const mean = scoreValues.reduce((a, b) => a + b, 0) / count;
    const median = scoreValues[Math.floor(count / 2)];
    const min = scoreValues[0];
    const max = scoreValues[count - 1];

    // Standard deviation
    const variance = scoreValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    // Distribution buckets (0-10, 10-20, ..., 90-100)
    const buckets = Array(10).fill(0);
    for (const score of scoreValues) {
      const bucket = Math.min(9, Math.floor(score / 10));
      buckets[bucket]++;
    }

    res.json({
      count,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      std_dev: Math.round(stdDev * 100) / 100,
      buckets: buckets.map((count, index) => ({
        range_start: index * 10,
        range_end: (index + 1) * 10,
        count,
      })),
    });
  } catch (error) {
    console.error("Error calculating score distribution:", error);
    res.status(500).json({ error: "Failed to calculate score distribution" });
  }
});

// ============================================================================
// Sector Statistics
// ============================================================================

router.get("/scores/by-sector", async (req, res): Promise<void> => {
  try {
    const scores = await db.select().from(candidateScoresTable);

    const sectorStats: Record<string, any> = {};

    for (const score of scores) {
      const sector = score.sector || "Unknown";
      if (!sectorStats[sector]) {
        sectorStats[sector] = {
          count: 0,
          scores: [],
          total_score: 0,
        };
      }

      const scoreValue = parseFloat(score.candidateScore || "0");
      sectorStats[sector].count++;
      sectorStats[sector].scores.push(scoreValue);
      sectorStats[sector].total_score += scoreValue;
    }

    const items = Object.entries(sectorStats).map(([sector, stats]) => {
      const scores = stats.scores.sort((a: number, b: number) => a - b);
      const mean = stats.total_score / stats.count;
      const median = scores[Math.floor(scores.length / 2)];
      const variance = scores.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / stats.count;

      return {
        sector,
        count: stats.count,
        mean_score: Math.round(mean * 100) / 100,
        median_score: Math.round(median * 100) / 100,
        min_score: Math.round(Math.min(...scores) * 100) / 100,
        max_score: Math.round(Math.max(...scores) * 100) / 100,
        std_dev: Math.round(Math.sqrt(variance) * 100) / 100,
      };
    });

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error calculating sector statistics:", error);
    res.status(500).json({ error: "Failed to calculate sector statistics" });
  }
});

export default router;
