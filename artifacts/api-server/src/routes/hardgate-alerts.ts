/**
 * Hard-Gate Monitoring and Alerting Routes
 * Implements hard-gate triggers, monitoring, and alert management
 */

import { Router } from "express";
import { db } from "@ieis/db";
import {
  hardGateEventTable,
  alertTable,
  securitiesTable,
  candidateScoresTable,
} from "@ieis/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

// ============================================================================
// Request/Response Schemas
// ============================================================================

const TriggerHardGateBody = z.object({
  isin: z.string(),
  gate_level: z.enum(["level_1_block", "level_2_cap", "level_3_penalty"]),
  trigger: z.enum([
    "adverse_audit",
    "disclaimer_of_opinion",
    "confirmed_manipulation",
    "fund_diversion",
    "insolvency",
    "liquidation",
    "material_default",
    "unreconciled_accounts",
    "going_concern",
    "current_suspension",
    "invalid_mapping",
    "missing_filing",
    "regulatory_prohibition",
    "inadequate_liquidity",
    "catastrophic_liability",
    "source_conflict",
    "qualified_audit",
    "emphasis_of_matter",
    "auditor_resignation",
    "related_party_exposure",
    "pledge_increase",
    "repeated_dilution",
    "rating_downgrade",
    "revised_filing",
    "contingent_liability",
    "cash_profit_divergence",
    "short_history",
    "concentration_risk",
    "temporary_leverage",
    "working_capital_deterioration",
    "earnings_instability",
    "partial_missing_data",
  ]),
  description: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  evidence: z.array(z.object({ source: z.string(), document: z.string(), date: z.string(), detail: z.string() })).optional(),
  affected_scores: z.array(z.string()).optional(),
  hard_gate_cap: z.number().optional(),
  penalty_amount: z.number().optional(),
});

const CreateAlertBody = z.object({
  isin: z.string().optional(),
  alert_type: z.enum(["hard_gate", "score_change", "signal_change", "liquidity", "data_quality", "portfolio_risk"]),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  title: z.string(),
  description: z.string(),
  details: z.record(z.any()).optional(),
  action_required: z.boolean().optional(),
  action_description: z.string().optional(),
  related_event_id: z.string().optional(),
});

const ListAlertsQueryParams = z.object({
  isin: z.string().optional(),
  alert_type: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

// ============================================================================
// Hard-Gate Management
// ============================================================================

router.post("/hardgate/trigger", async (req, res): Promise<void> => {
  try {
    const parsed = TriggerHardGateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const {
      isin,
      gate_level,
      trigger,
      description,
      severity,
      evidence,
      affected_scores,
      hard_gate_cap,
      penalty_amount,
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

    const eventId = `HG_${isin}_${Date.now()}`;

    // Insert hard-gate event
    const [inserted] = await db
      .insert(hardGateEventTable)
      .values({
        event_id: eventId,
        isin,
        ticker: security.ticker,
        name: security.name,
        gate_level,
        trigger,
        description,
        severity,
        evidence: evidence ? JSON.stringify(evidence) : undefined,
        affected_scores: affected_scores ? JSON.stringify(affected_scores) : undefined,
        hard_gate_cap: hard_gate_cap ? hard_gate_cap.toString() : undefined,
        penalty_amount: penalty_amount ? penalty_amount.toString() : undefined,
        triggered_at: new Date(),
        triggered_by: "system",
      })
      .returning();

    // Create corresponding alert
    const alertId = `ALERT_${eventId}`;
    await db.insert(alertTable).values({
      alert_id: alertId,
      isin,
      ticker: security.ticker,
      name: security.name,
      alert_type: "hard_gate",
      severity,
      title: `Hard Gate ${gate_level.toUpperCase()}: ${trigger}`,
      description,
      details: {
        event_id: eventId,
        gate_level,
        trigger,
        affected_scores,
      },
      triggered_at: new Date(),
      triggered_by: "system",
      related_event_id: eventId,
      action_required: gate_level === "level_1_block",
    });

    // Update candidate score if Level 1 block
    if (gate_level === "level_1_block") {
      await db
        .update(candidateScoresTable)
        .set({
          hardGate: "AVOID",
        })
        .where(eq(candidateScoresTable.isin, isin));
    }

    res.status(201).json({
      event_id: eventId,
      isin,
      ticker: security.ticker,
      gate_level,
      trigger,
      severity,
      status: "pending",
      triggered_at: inserted.triggered_at,
    });
  } catch (error) {
    console.error("Error triggering hard-gate:", error);
    res.status(500).json({ error: "Failed to trigger hard-gate" });
  }
});

// ============================================================================
// List Hard-Gate Events
// ============================================================================

router.get("/hardgate/events", async (req, res): Promise<void> => {
  try {
    const { isin, limit = 50, offset = 0 } = req.query;

    let dbQuery = db.select().from(hardGateEventTable);

    if (isin) {
      dbQuery = dbQuery.where(eq(hardGateEventTable.isin, isin as string));
    }

    dbQuery = dbQuery.orderBy(desc(hardGateEventTable.triggered_at));

    const events = await dbQuery.limit(parseInt(limit as string)).offset(parseInt(offset as string));

    const items = events.map((e) => ({
      event_id: e.event_id,
      isin: e.isin,
      ticker: e.ticker,
      name: e.name,
      gate_level: e.gate_level,
      trigger: e.trigger,
      severity: e.severity,
      triggered_at: e.triggered_at,
      resolution_status: e.resolution_status,
      affected_scores: e.affected_scores ? JSON.parse(e.affected_scores as string) : null,
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching hard-gate events:", error);
    res.status(500).json({ error: "Failed to fetch hard-gate events" });
  }
});

// ============================================================================
// Resolve Hard-Gate Event
// ============================================================================

router.put("/hardgate/event/:event_id/resolve", async (req, res): Promise<void> => {
  try {
    const { event_id } = req.params;
    const { resolution_status, resolution_notes, resolved_by } = req.body;

    if (!["resolved", "waived"].includes(resolution_status)) {
      res.status(400).json({ error: "Invalid resolution status" });
      return;
    }

    const [updated] = await db
      .update(hardGateEventTable)
      .set({
        resolution_status,
        resolution_date: new Date(),
        resolution_notes,
        resolved_by,
        updated_at: new Date(),
      })
      .where(eq(hardGateEventTable.event_id, event_id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Hard-gate event not found" });
      return;
    }

    res.json({
      event_id,
      resolution_status,
      resolution_date: updated.resolution_date,
      message: "Hard-gate event resolved",
    });
  } catch (error) {
    console.error("Error resolving hard-gate:", error);
    res.status(500).json({ error: "Failed to resolve hard-gate" });
  }
});

// ============================================================================
// Alert Management
// ============================================================================

router.post("/alerts/create", async (req, res): Promise<void> => {
  try {
    const parsed = CreateAlertBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const {
      isin,
      alert_type,
      severity,
      title,
      description,
      details,
      action_required,
      action_description,
      related_event_id,
    } = parsed.data;

    let ticker: string | undefined;
    let name: string | undefined;

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

    const alertId = `ALERT_${Date.now()}`;

    const [inserted] = await db
      .insert(alertTable)
      .values({
        alert_id: alertId,
        isin,
        ticker,
        name,
        alert_type,
        severity,
        title,
        description,
        details: details ? JSON.stringify(details) : undefined,
        triggered_at: new Date(),
        triggered_by: "system",
        action_required: action_required || false,
        action_description,
        related_event_id,
      })
      .returning();

    res.status(201).json({
      alert_id: alertId,
      isin,
      alert_type,
      severity,
      title,
      status: "active",
      triggered_at: inserted.triggered_at,
    });
  } catch (error) {
    console.error("Error creating alert:", error);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

// ============================================================================
// List Alerts
// ============================================================================

router.get("/alerts", async (req, res): Promise<void> => {
  try {
    const query = ListAlertsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    let dbQuery = db.select().from(alertTable);

    if (query.data.isin) {
      dbQuery = dbQuery.where(eq(alertTable.isin, query.data.isin));
    }

    if (query.data.alert_type) {
      dbQuery = dbQuery.where(eq(alertTable.alert_type, query.data.alert_type));
    }

    if (query.data.severity) {
      dbQuery = dbQuery.where(eq(alertTable.severity, query.data.severity));
    }

    if (query.data.status) {
      dbQuery = dbQuery.where(eq(alertTable.status, query.data.status as any));
    }

    dbQuery = dbQuery.orderBy(desc(alertTable.triggered_at));

    const limit = query.data.limit ?? 50;
    const offset = query.data.offset ?? 0;

    const alerts = await dbQuery.limit(limit).offset(offset);

    const items = alerts.map((a) => ({
      alert_id: a.alert_id,
      isin: a.isin,
      ticker: a.ticker,
      name: a.name,
      alert_type: a.alert_type,
      severity: a.severity,
      title: a.title,
      description: a.description,
      status: a.status,
      triggered_at: a.triggered_at,
      action_required: a.action_required,
      acknowledged: !!a.acknowledged_at,
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// ============================================================================
// Acknowledge Alert
// ============================================================================

router.put("/alerts/:alert_id/acknowledge", async (req, res): Promise<void> => {
  try {
    const { alert_id } = req.params;
    const { acknowledged_by } = req.body;

    const [updated] = await db
      .update(alertTable)
      .set({
        status: "acknowledged",
        acknowledged_at: new Date(),
        acknowledged_by,
        updated_at: new Date(),
      })
      .where(eq(alertTable.alert_id, alert_id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    res.json({
      alert_id,
      status: "acknowledged",
      acknowledged_at: updated.acknowledged_at,
    });
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

// ============================================================================
// Resolve Alert
// ============================================================================

router.put("/alerts/:alert_id/resolve", async (req, res): Promise<void> => {
  try {
    const { alert_id } = req.params;
    const { resolved_by, resolution_notes } = req.body;

    const [updated] = await db
      .update(alertTable)
      .set({
        status: "resolved",
        resolved_at: new Date(),
        resolved_by,
        resolution_notes,
        updated_at: new Date(),
      })
      .where(eq(alertTable.alert_id, alert_id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    res.json({
      alert_id,
      status: "resolved",
      resolved_at: updated.resolved_at,
    });
  } catch (error) {
    console.error("Error resolving alert:", error);
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

// ============================================================================
// Alert Summary
// ============================================================================

router.get("/alerts/summary", async (req, res): Promise<void> => {
  try {
    const alerts = await db.select().from(alertTable);

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let actionRequiredCount = 0;

    for (const a of alerts) {
      byType[a.alert_type] = (byType[a.alert_type] || 0) + 1;
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      if (a.action_required) actionRequiredCount++;
    }

    res.json({
      total_alerts: alerts.length,
      alerts_requiring_action: actionRequiredCount,
      by_type: byType,
      by_severity: bySeverity,
      by_status: byStatus,
    });
  } catch (error) {
    console.error("Error calculating alert summary:", error);
    res.status(500).json({ error: "Failed to calculate alert summary" });
  }
});

export default router;
