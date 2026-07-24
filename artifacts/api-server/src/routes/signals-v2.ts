/**
 * Signals Routes - V2 with Canonical Multi-Horizon Signal Formulas
 * Implements HORIZON_SCORE_V2, SIGNAL_CONFIDENCE_V2, FINAL_HSS_V2, ALIGNMENT_SCORE_V2
 */

import { Router } from "express";
import { db } from "@ieis/db";
import {
  signalsTable,
  signalHistoryTable,
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

const CalculateSignalBody = z.object({
  isin: z.string(),
  horizon: z.enum(["daily", "weekly", "monthly", "medium", "long"]),
  component_scores: z.record(z.number()),
  horizon_weights: z.record(z.number()),
  confidence_components: z.array(z.number()),
  stale_penalty: z.number().default(0),
  event_penalty: z.number().default(0),
  risk_penalty: z.number().default(0),
  hard_gate_cap: z.number().default(100),
});

const ListSignalsQueryParams = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  horizon: z.enum(["daily", "weekly", "monthly", "medium", "long"]).optional(),
  state: z.enum(["strong_buy", "buy", "hold", "sell", "avoid", "pending_review"]).optional(),
  sector: z.string().optional(),
});

// ============================================================================
// Calculate Signal with Canonical Formulas
// ============================================================================

router.post("/signals/calculate", async (req, res): Promise<void> => {
  try {
    const parsed = CalculateSignalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const {
      isin,
      horizon,
      component_scores,
      horizon_weights,
      confidence_components,
      stale_penalty = 0,
      event_penalty = 0,
      risk_penalty = 0,
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

    // Calculate raw horizon score using HORIZON_SCORE_V2
    const rawHorizonScore = formulas.horizonScore(
      component_scores,
      horizon_weights
    );

    // Calculate signal confidence using SIGNAL_CONFIDENCE_V2 (geometric mean)
    const signalConfidence = formulas.signalConfidence(
      confidence_components
    );

    // Calculate final HSS using FINAL_HSS_V2
    const finalHSS = formulas.finalHSS(
      rawHorizonScore,
      signalConfidence,
      stale_penalty,
      event_penalty,
      risk_penalty,
      hard_gate_cap
    );

    // Map HSS to signal state
    const signalState = formulas.hssToSignalState(finalHSS);

    // Get candidate score for reference
    const [candidateScore] = await db
      .select()
      .from(candidateScoresTable)
      .where(eq(candidateScoresTable.isin, isin))
      .orderBy(desc(candidateScoresTable.scoreDate))
      .limit(1);

    // Get current price
    const currentPrice = security.lastPrice || "0";

    // Store signal
    const today = new Date().toISOString().split("T")[0];
    const [inserted] = await db
      .insert(signalsTable)
      .values({
        isin,
        ticker: security.ticker,
        name: security.name,
        sector: security.sector,
        universeGroup: security.universeGroup || "standard",
        horizon,
        state: signalState,
        hss: finalHSS.toString(),
        confidence: signalConfidence.toString(),
        stalePenalty: stale_penalty.toString(),
        eventPenalty: event_penalty.toString(),
        riskPenalty: risk_penalty.toString(),
        hardGateCap: hard_gate_cap.toString(),
        candidateScore: candidateScore?.candidateScore,
        currentPrice,
        signalDate: today,
      })
      .returning();

    // Also add to history
    await db.insert(signalHistoryTable).values({
      isin,
      horizon,
      state: signalState,
      hss: finalHSS.toString(),
      confidence: signalConfidence.toString(),
      signalDate: today,
    });

    res.status(201).json({
      isin,
      ticker: security.ticker,
      name: security.name,
      sector: security.sector,
      horizon,
      signal_state: signalState,
      hss: finalHSS,
      confidence: signalConfidence,
      raw_horizon_score: rawHorizonScore,
      component_scores,
      confidence_components,
      penalties: {
        stale: stale_penalty,
        event: event_penalty,
        risk: risk_penalty,
      },
      signal_date: today,
    });
  } catch (error) {
    console.error("Error calculating signal:", error);
    res.status(500).json({ error: "Failed to calculate signal" });
  }
});

// ============================================================================
// List Signals with Filtering
// ============================================================================

router.get("/signals", async (req, res): Promise<void> => {
  try {
    const query = ListSignalsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    let dbQuery = db.select().from(signalsTable);

    // Apply filters
    if (query.data.horizon) {
      dbQuery = dbQuery.where(eq(signalsTable.horizon, query.data.horizon));
    }

    if (query.data.state) {
      dbQuery = dbQuery.where(eq(signalsTable.state, query.data.state));
    }

    if (query.data.sector) {
      dbQuery = dbQuery.where(eq(signalsTable.sector, query.data.sector));
    }

    // Sort by HSS descending
    dbQuery = dbQuery.orderBy(desc(signalsTable.hss));

    // Apply pagination
    const limit = query.data.limit ?? 50;
    const offset = query.data.offset ?? 0;

    const signals = await dbQuery.limit(limit).offset(offset);

    const items = signals.map((signal) => ({
      isin: signal.isin,
      ticker: signal.ticker,
      name: signal.name,
      sector: signal.sector,
      horizon: signal.horizon,
      signal_state: signal.state,
      hss: parseFloat(signal.hss || "0"),
      confidence: parseFloat(signal.confidence || "0"),
      stale_penalty: parseFloat(signal.stalePenalty || "0"),
      event_penalty: parseFloat(signal.eventPenalty || "0"),
      risk_penalty: parseFloat(signal.riskPenalty || "0"),
      candidate_score: signal.candidateScore ? parseFloat(signal.candidateScore) : null,
      current_price: signal.currentPrice,
      signal_date: signal.signalDate,
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching signals:", error);
    res.status(500).json({ error: "Failed to fetch signals" });
  }
});

// ============================================================================
// Get Top Buy Signals
// ============================================================================

router.get("/signals/top-buy", async (req, res): Promise<void> => {
  try {
    const { limit = 20, horizon } = req.query;

    let dbQuery = db
      .select()
      .from(signalsTable)
      .where(eq(signalsTable.state, "strong_buy"));

    if (horizon) {
      dbQuery = dbQuery.where(eq(signalsTable.horizon, horizon as string));
    }

    const signals = await dbQuery
      .orderBy(desc(signalsTable.hss))
      .limit(parseInt(limit as string));

    const items = signals.map((signal) => ({
      isin: signal.isin,
      ticker: signal.ticker,
      name: signal.name,
      sector: signal.sector,
      horizon: signal.horizon,
      hss: parseFloat(signal.hss || "0"),
      confidence: parseFloat(signal.confidence || "0"),
      candidate_score: signal.candidateScore ? parseFloat(signal.candidateScore) : null,
      current_price: signal.currentPrice,
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching top buy signals:", error);
    res.status(500).json({ error: "Failed to fetch top buy signals" });
  }
});

// ============================================================================
// Signal History
// ============================================================================

router.get("/signals/history/:isin", async (req, res): Promise<void> => {
  try {
    const { isin } = req.params;
    const { horizon } = req.query;

    let dbQuery = db
      .select()
      .from(signalHistoryTable)
      .where(eq(signalHistoryTable.isin, isin));

    if (horizon) {
      dbQuery = dbQuery.where(eq(signalHistoryTable.horizon, horizon as string));
    }

    const history = await dbQuery.orderBy(desc(signalHistoryTable.signalDate));

    const items = history.map((h) => ({
      isin: h.isin,
      horizon: h.horizon,
      signal_state: h.state,
      hss: parseFloat(h.hss || "0"),
      confidence: parseFloat(h.confidence || "0"),
      signal_date: h.signalDate,
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching signal history:", error);
    res.status(500).json({ error: "Failed to fetch signal history" });
  }
});

// ============================================================================
// Cross-Horizon Alignment (ALIGNMENT_SCORE_V2)
// ============================================================================

router.get("/signals/alignment/:isin", async (req, res): Promise<void> => {
  try {
    const { isin } = req.params;

    // Get signals for all horizons
    const signals = await db
      .select()
      .from(signalsTable)
      .where(eq(signalsTable.isin, isin));

    if (signals.length === 0) {
      res.status(404).json({ error: "No signals found for this security" });
      return;
    }

    // Build horizon directions and importances
    const horizonDirections: Record<string, number> = {};
    const horizonImportances: Record<string, number> = {};

    // Define horizon importance weights
    const importanceWeights = {
      daily: 0.15,
      weekly: 0.2,
      monthly: 0.25,
      medium: 0.25,
      long: 0.15,
    };

    for (const signal of signals) {
      const directionValue = formulas.signalStateToDirectionValue(signal.state);
      horizonDirections[signal.horizon] = directionValue;
      horizonImportances[signal.horizon] = importanceWeights[signal.horizon as keyof typeof importanceWeights] || 0.2;
    }

    // Calculate alignment score
    const alignmentScore = formulas.alignmentScore(
      horizonDirections,
      horizonImportances
    );

    // Get security info
    const [security] = await db
      .select()
      .from(securitiesTable)
      .where(eq(securitiesTable.isin, isin));

    res.json({
      isin,
      ticker: security?.ticker,
      name: security?.name,
      alignment_score: alignmentScore,
      horizon_signals: signals.map((s) => ({
        horizon: s.horizon,
        signal_state: s.state,
        hss: parseFloat(s.hss || "0"),
        direction_value: formulas.signalStateToDirectionValue(s.state),
        importance: importanceWeights[s.horizon as keyof typeof importanceWeights] || 0.2,
      })),
      interpretation:
        alignmentScore > 0.5
          ? "Strong bullish alignment"
          : alignmentScore > 0.25
            ? "Moderate bullish alignment"
            : alignmentScore > -0.25
              ? "Neutral alignment"
              : alignmentScore > -0.5
                ? "Moderate bearish alignment"
                : "Strong bearish alignment",
    });
  } catch (error) {
    console.error("Error calculating alignment score:", error);
    res.status(500).json({ error: "Failed to calculate alignment score" });
  }
});

// ============================================================================
// Signal Distribution Statistics
// ============================================================================

router.get("/signals/distribution", async (req, res): Promise<void> => {
  try {
    const signals = await db.select().from(signalsTable);

    // Count by state
    const byState: Record<string, number> = {
      strong_buy: 0,
      buy: 0,
      hold: 0,
      sell: 0,
      avoid: 0,
      pending_review: 0,
    };

    // Count by horizon
    const byHorizon: Record<string, number> = {
      daily: 0,
      weekly: 0,
      monthly: 0,
      medium: 0,
      long: 0,
    };

    // HSS distribution
    const hssValues: number[] = [];

    for (const signal of signals) {
      byState[signal.state]++;
      byHorizon[signal.horizon]++;
      hssValues.push(parseFloat(signal.hss || "0"));
    }

    // Calculate HSS statistics
    hssValues.sort((a, b) => a - b);
    const mean = hssValues.reduce((a, b) => a + b, 0) / hssValues.length;
    const median = hssValues[Math.floor(hssValues.length / 2)];
    const variance = hssValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / hssValues.length;

    res.json({
      total_signals: signals.length,
      by_state: byState,
      by_horizon: byHorizon,
      hss_statistics: {
        mean: Math.round(mean * 100) / 100,
        median: Math.round(median * 100) / 100,
        min: Math.round(hssValues[0] * 100) / 100,
        max: Math.round(hssValues[hssValues.length - 1] * 100) / 100,
        std_dev: Math.round(Math.sqrt(variance) * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error calculating signal distribution:", error);
    res.status(500).json({ error: "Failed to calculate signal distribution" });
  }
});

export default router;
