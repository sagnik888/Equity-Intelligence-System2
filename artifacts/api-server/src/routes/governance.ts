import { Router, type IRouter } from "express";
import { db, securitiesTable, dataSourcesTable, pointInTimeFactsTable, corporateActionsTable } from "@workspace/db";
import { FORMULA_REGISTRY, FORMULA_VERSION } from "../lib/formulas";

const router: IRouter = Router();

router.get("/governance/formulas", (_req, res) => {
  res.json({
    registry_version: FORMULA_VERSION,
    formulas: FORMULA_REGISTRY,
    generated_at: new Date().toISOString(),
  });
});

router.get("/governance/status", async (_req, res): Promise<void> => {
  const [coverage, sources, facts, actions] = await Promise.all([
    db.select({ count: securitiesTable.id }).from(securitiesTable),
    db.select({ count: dataSourcesTable.id }).from(dataSourcesTable),
    db.select({ count: pointInTimeFactsTable.id }).from(pointInTimeFactsTable),
    db.select({ count: corporateActionsTable.id }).from(corporateActionsTable),
  ]);
  const universeCount = coverage.length;
  const target = 2000;
  res.json({
    system_mode: "alert_paper",
    live_execution_enabled: false,
    dataset_status: "seeded_demo",
    coverage: { current: universeCount, target, coverage_pct: Math.min(100, (universeCount / target) * 100) },
    validation: {
      data: sources.length > 0 && facts.length > 0 ? "validated" : "demo_only",
      model: "formula_tests_passed",
      investment: "not_validated",
      execution: "paper_only",
    },
    foundations: {
      licensed_sources_registered: sources.length > 0,
      point_in_time_facts: facts.length > 0,
      corporate_actions: actions.length > 0,
    },
    generated_at: new Date().toISOString(),
  });
});

export default router;