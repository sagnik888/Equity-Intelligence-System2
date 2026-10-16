import { Router, type IRouter } from "express";
import {
  db,
  securitiesTable,
  dataSourcesTable,
  pointInTimeFactsTable,
  corporateActionsTable,
  systemSettingsTable,
  dataLicensesTable,
  connectorAdaptersTable,
  connectorRequestsTable,
  modelRegistryTable,
  featureDefinitionsTable,
  resourceSnapshotsTable,
  jobsTable,
  acceptanceGatesTable,
} from "@workspace/db";
import { count, desc, eq } from "drizzle-orm";
import { FORMULA_REGISTRY, FORMULA_VERSION } from "../lib/formulas";
import { evaluateDiskResourceState } from "../lib/safetyControls";
import { evaluateQuantitativeReleaseReadiness } from "../lib/releaseReadiness";

const router: IRouter = Router();

router.get("/governance/formulas", (_req, res) => {
  res.json({
    registry_version: FORMULA_VERSION,
    formulas: FORMULA_REGISTRY,
    generated_at: new Date().toISOString(),
  });
});

router.get("/governance/status", async (_req, res): Promise<void> => {
  const [coverage, sources, facts, actions, settings, licenses, connectors, gates, latestResource] = await Promise.all([
    db.select({ count: count() }).from(securitiesTable),
    db.select({ count: count() }).from(dataSourcesTable),
    db.select({ count: count() }).from(pointInTimeFactsTable),
    db.select({ count: count() }).from(corporateActionsTable),
    db.select().from(systemSettingsTable).where(eq(systemSettingsTable.id, 1)).limit(1),
    db.select({ count: count() }).from(dataLicensesTable),
    db.select({ count: count() }).from(connectorAdaptersTable),
    db.select().from(acceptanceGatesTable),
    db.select().from(resourceSnapshotsTable).orderBy(desc(resourceSnapshotsTable.capturedAt)).limit(1),
  ]);
  const universeCount = Number(coverage[0]?.count ?? 0);
  const sourceCount = Number(sources[0]?.count ?? 0);
  const factCount = Number(facts[0]?.count ?? 0);
  const actionCount = Number(actions[0]?.count ?? 0);
  const profile = settings[0];
  const target = 2000;
  const architectureStatus = "implemented_not_certified";
  const codeStatus = "implemented_not_certified";
  const dataStatus = "demo_only";
  const investmentStatus = "not_validated";
  const executionStatus = "blocked_by_policy";
  const resourceState = evaluateDiskResourceState({
    freeGb: latestResource[0]?.freeStorageGb == null ? null : Number(latestResource[0].freeStorageGb),
    reserveGb: null,
    hysteresisGb: null,
    healthReviewComplete: false,
  });
  res.json({
    system_mode: "alert_only",
    configured_system_mode: profile?.operatingMode ?? "alert_only",
    effective_execution_mode: "alert_only",
    deployment_profile: profile?.profile ?? "personal_core",
    live_execution_enabled: false,
    configured_live_execution_enabled: profile?.liveExecutionEnabled ?? false,
    kill_switch_enabled: profile?.killSwitchEnabled ?? false,
    dataset_status: "seeded_demo",
    coverage: { current: universeCount, target, coverage_pct: Math.min(100, (universeCount / target) * 100) },
    validation: {
      architecture: architectureStatus,
      data: dataStatus,
      code: codeStatus,
      model: "not_validated",
      investment: investmentStatus,
      execution: executionStatus,
    },
    entry_safety: {
      allow_new_entries: false,
      resource_mode: resourceState.mode,
      resource_health_review_required: resourceState.requireHealthReview,
      reason: "Disk reserve/hysteresis policy and reviewed live resource telemetry are not configured.",
    },
    foundations: {
      licensed_sources_registered: Number(licenses[0]?.count ?? 0) > 0,
      source_adapters_registered: Number(connectors[0]?.count ?? 0) > 0,
      point_in_time_facts: factCount > 0,
      corporate_actions: actionCount > 0,
      acceptance_gates_registered: gates.length > 0,
    },
    release_readiness: evaluateQuantitativeReleaseReadiness(gates),
    resources: latestResource[0] ?? null,
    generated_at: new Date().toISOString(),
  });
});

router.get("/governance/settings", async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.id, 1)).limit(1);
  res.json({
    ...(settings ?? {
    id: 1,
    profile: "personal_core",
    operatingMode: "alert_only",
    liveExecutionEnabled: false,
    killSwitchEnabled: false,
    }),
    effectiveOperatingMode: "alert_only",
    effectiveLiveExecutionEnabled: false,
  });
});

router.get("/governance/licenses", async (_req, res): Promise<void> => {
  const rows = await db.select().from(dataLicensesTable).orderBy(desc(dataLicensesTable.createdAt));
  res.json({ licenses: rows, count: rows.length });
});

router.get("/governance/connectors", async (_req, res): Promise<void> => {
  const [adapters, recentRequests] = await Promise.all([
    db.select().from(connectorAdaptersTable).orderBy(connectorAdaptersTable.providerId),
    db.select().from(connectorRequestsTable).orderBy(desc(connectorRequestsTable.createdAt)).limit(50),
  ]);
  res.json({ adapters, recent_requests: recentRequests });
});

router.get("/governance/models", async (_req, res): Promise<void> => {
  const rows = await db.select().from(modelRegistryTable).orderBy(desc(modelRegistryTable.createdAt));
  res.json({ models: rows, count: rows.length });
});

router.get("/governance/features", async (_req, res): Promise<void> => {
  const rows = await db.select().from(featureDefinitionsTable).orderBy(featureDefinitionsTable.featureId);
  res.json({ features: rows, count: rows.length });
});

router.get("/governance/gates", async (_req, res): Promise<void> => {
  const rows = await db.select().from(acceptanceGatesTable).orderBy(acceptanceGatesTable.category, acceptanceGatesTable.gateKey);
  res.json({ gates: rows, count: rows.length });
});

router.get("/governance/resources", async (_req, res): Promise<void> => {
  const rows = await db.select().from(resourceSnapshotsTable).orderBy(desc(resourceSnapshotsTable.capturedAt)).limit(100);
  res.json({ current: rows[0] ?? null, history: rows });
});

router.get("/governance/jobs", async (_req, res): Promise<void> => {
  const rows = await db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt)).limit(100);
  res.json({ jobs: rows, count: rows.length });
});

export default router;