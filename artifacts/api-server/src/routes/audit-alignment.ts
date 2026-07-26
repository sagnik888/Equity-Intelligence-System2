/**
 * Audit History and Cross-Horizon Alignment Routes
 * Implements audit trail tracking and multi-horizon signal alignment
 */

import { Router } from "express";
import { db } from "@ieis/db";
import {
  auditHistoryTable,
  signalsTable,
  securitiesTable,
} from "@ieis/db";
import { eq, desc } from "drizzle-orm";
import * as formulas from "@ieis/formulas";
import { z } from "zod/v4";

const router = Router();

// ============================================================================
// Request/Response Schemas
// ============================================================================

const CreateAuditEntryBody = z.object({
  action: z.enum([
    "score_calculated",
    "signal_generated",
    "position_opened",
    "position_closed",
    "order_submitted",
    "order_filled",
    "alert_triggered",
    "hard_gate_triggered",
    "evidence_added",
    "forecast_updated",
    "valuation_updated",
    "portfolio_rebalanced",
    "setting_changed",
    "data_reconciliation",
  ]),
  isin: z.string().optional(),
  actor: z.string(),
  details: z.record(z.any()).optional(),
  previous_values: z.record(z.any()).optional(),
  new_values: z.record(z.any()).optional(),
  affected_fields: z.array(z.string()).optional(),
  change_reason: z.string().optional(),
  data_quality_impact: z.enum(["none", "minor", "moderate", "severe"]).optional(),
  requires_review: z.boolean().optional(),
});

const ListAuditQueryParams = z.object({
  isin: z.string().optional(),
  action: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

// ============================================================================
// Audit History Management
// ============================================================================

router.post("/audit/entry", async (req, res): Promise<void> => {
  try {
    const parsed = CreateAuditEntryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const {
      action,
      isin,
      actor,
      details,
      previous_values,
      new_values,
      affected_fields,
      change_reason,
      data_quality_impact,
      requires_review,
    } = parsed.data;

    let ticker: string | undefined;
    let name: string | undefined;

    // Get security information if ISIN provided
    if (isin) {
      const [security] = await db
        .select()
        .from(securitiesTable)
        .where(eq(securitiesTable.isin, isin));

      if (security) {
        ticker = security.ticker;
        name = security.name;
      }
    }

    // Insert audit entry
    const [inserted] = await db
      .insert(auditHistoryTable)
      .values({
        action,
        isin,
        ticker,
        name,
        actionDate: new Date(),
        actor,
        details: details ? JSON.stringify(details) : undefined,
        previousValues: previous_values ? JSON.stringify(previous_values) : undefined,
        newValues: new_values ? JSON.stringify(new_values) : undefined,
        affectedFields: affected_fields ? JSON.stringify(affected_fields) : undefined,
        changeReason: change_reason,
        dataQualityImpact: data_quality_impact || "none",
        requiresReview: requires_review ? "true" : "false",
      })
      .returning();

    res.status(201).json({
      id: inserted.id,
      action,
      isin,
      actor,
      action_date: inserted.actionDate,
      requires_review,
    });
  } catch (error) {
    console.error("Error creating audit entry:", error);
    res.status(500).json({ error: "Failed to create audit entry" });
  }
});

// ============================================================================
// List Audit History with Filtering
// ============================================================================

router.get("/audit/history", async (req, res): Promise<void> => {
  try {
    const query = ListAuditQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    let dbQuery = db.select().from(auditHistoryTable);

    if (query.data.isin) {
      dbQuery = dbQuery.where(eq(auditHistoryTable.isin, query.data.isin));
    }

    if (query.data.action) {
      dbQuery = dbQuery.where(eq(auditHistoryTable.action, query.data.action as any));
    }

    // Sort by action date descending
    dbQuery = dbQuery.orderBy(desc(auditHistoryTable.actionDate));

    const limit = query.data.limit ?? 50;
    const offset = query.data.offset ?? 0;

    const history = await dbQuery.limit(limit).offset(offset);

    const items = history.map((h) => ({
      id: h.id,
      action: h.action,
      isin: h.isin,
      ticker: h.ticker,
      name: h.name,
      action_date: h.actionDate,
      actor: h.actor,
      change_reason: h.changeReason,
      data_quality_impact: h.dataQualityImpact,
      requires_review: h.requiresReview === "true",
      reviewed_by: h.reviewedBy,
      reviewed_at: h.reviewedAt,
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching audit history:", error);
    res.status(500).json({ error: "Failed to fetch audit history" });
  }
});

// ============================================================================
// Audit Detail
// ============================================================================

router.get("/audit/entry/:id", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;

    const [entry] = await db
      .select()
      .from(auditHistoryTable)
      .where(eq(auditHistoryTable.id, parseInt(id)));

    if (!entry) {
      res.status(404).json({ error: "Audit entry not found" });
      return;
    }

    res.json({
      id: entry.id,
      action: entry.action,
      isin: entry.isin,
      ticker: entry.ticker,
      name: entry.name,
      action_date: entry.actionDate,
      actor: entry.actor,
      details: entry.details ? JSON.parse(entry.details as string) : null,
      previous_values: entry.previousValues ? JSON.parse(entry.previousValues as string) : null,
      new_values: entry.newValues ? JSON.parse(entry.newValues as string) : null,
      affected_fields: entry.affectedFields ? JSON.parse(entry.affectedFields as string) : null,
      change_reason: entry.changeReason,
      data_quality_impact: entry.dataQualityImpact,
      requires_review: entry.requiresReview === "true",
      reviewed_by: entry.reviewedBy,
      reviewed_at: entry.reviewedAt,
      review_notes: entry.reviewNotes,
    });
  } catch (error) {
    console.error("Error fetching audit entry:", error);
    res.status(500).json({ error: "Failed to fetch audit entry" });
  }
});

// ============================================================================
// Cross-Horizon Alignment
// ============================================================================

router.get("/alignment/cross-horizon/:isin", async (req, res): Promise<void> => {
  try {
    const { isin } = req.params;

    // Get all signals for this security across all horizons
    const signals = await db
      .select()
      .from(signalsTable)
      .where(eq(signalsTable.isin, isin));

    if (signals.length === 0) {
      res.status(404).json({ error: "No signals found for this security" });
      return;
    }

    // Get security info
    const [security] = await db
      .select()
      .from(securitiesTable)
      .where(eq(securitiesTable.isin, isin));

    // Build horizon directions and importances
    const horizonDirections: Record<string, number> = {};
    const horizonImportances: Record<string, number> = {};
    const horizonDetails: Record<string, any> = {};

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
      horizonDetails[signal.horizon] = {
        signal_state: signal.state,
        hss: parseFloat(signal.hss || "0"),
        confidence: parseFloat(signal.confidence || "0"),
        direction_value: directionValue,
      };
    }

    // Calculate alignment score using canonical formula
    const alignmentScore = formulas.alignmentScore(
      horizonDirections,
      horizonImportances
    );

    // Determine alignment interpretation
    let interpretation = "Neutral alignment";
    if (alignmentScore > 0.5) {
      interpretation = "Strong bullish alignment across horizons";
    } else if (alignmentScore > 0.25) {
      interpretation = "Moderate bullish alignment";
    } else if (alignmentScore > -0.25) {
      interpretation = "Neutral alignment";
    } else if (alignmentScore > -0.5) {
      interpretation = "Moderate bearish alignment";
    } else {
      interpretation = "Strong bearish alignment across horizons";
    }

    // Determine priority horizon (highest importance with strongest signal)
    let priorityHorizon = "long";
    let maxScore = -Infinity;
    for (const [horizon, importance] of Object.entries(horizonImportances)) {
      const direction = Math.abs(horizonDirections[horizon] || 0);
      const score = importance * direction;
      if (score > maxScore) {
        maxScore = score;
        priorityHorizon = horizon;
      }
    }

    res.json({
      isin,
      ticker: security?.ticker,
      name: security?.name,
      alignment_score: alignmentScore,
      alignment_interpretation: interpretation,
      priority_horizon: priorityHorizon,
      horizon_signals: Object.entries(horizonDetails).map(([horizon, details]) => ({
        horizon,
        ...details,
        importance: horizonImportances[horizon],
      })),
      recommendation:
        alignmentScore > 0.5
          ? "STRONG_BUY"
          : alignmentScore > 0.25
            ? "BUY"
            : alignmentScore > -0.25
              ? "HOLD"
              : alignmentScore > -0.5
                ? "SELL"
                : "AVOID",
    });
  } catch (error) {
    console.error("Error calculating cross-horizon alignment:", error);
    res.status(500).json({ error: "Failed to calculate alignment" });
  }
});

// ============================================================================
// Audit Summary
// ============================================================================

router.get("/audit/summary", async (req, res): Promise<void> => {
  try {
    const history = await db.select().from(auditHistoryTable);

    // Group by action
    const byAction: Record<string, number> = {};
    const byActor: Record<string, number> = {};
    const byDataQualityImpact: Record<string, number> = {};
    let requiresReviewCount = 0;

    for (const h of history) {
      byAction[h.action] = (byAction[h.action] || 0) + 1;
      byActor[h.actor] = (byActor[h.actor] || 0) + 1;
      byDataQualityImpact[h.dataQualityImpact || "none"] = (byDataQualityImpact[h.dataQualityImpact || "none"] || 0) + 1;
      if (h.requiresReview === "true") requiresReviewCount++;
    }

    res.json({
      total_entries: history.length,
      entries_requiring_review: requiresReviewCount,
      by_action: byAction,
      by_actor: byActor,
      by_data_quality_impact: byDataQualityImpact,
    });
  } catch (error) {
    console.error("Error calculating audit summary:", error);
    res.status(500).json({ error: "Failed to calculate audit summary" });
  }
});

export default router;
