import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateQuantitativeReleaseReadiness,
  REQUIRED_RELEASE_GATE_KEYS,
} from "./releaseReadiness";

const criterion: Record<string, unknown> = {
  criterionId: "sample_count",
  observedValue: 100,
  operator: "gte",
  threshold: 100,
  observedUnit: "observations",
  thresholdUnit: "observations",
  periodStart: "2026-01-01T00:00:00Z",
  periodEnd: "2026-02-01T00:00:00Z",
  sourceRef: "internal:test-dataset-v1",
  sourceEntitled: true,
  reviewerId: "reviewer-1",
  reviewedAt: "2026-02-02T00:00:00Z",
  testArtifactRef: "test-artifact:release-evidence",
  artifactSha256: "a".repeat(64),
};

function completeGateRecords(): Array<{
  gateKey: string;
  gateName: string;
  status: string;
  checkedBy: string;
  checkedAt: string;
  evidence: { criteria: Array<Record<string, unknown>> };
}> {
  return REQUIRED_RELEASE_GATE_KEYS.map((gateKey) => ({
    gateKey,
    gateName: gateKey,
    status: "healthy",
    checkedBy: "reviewer-1",
    checkedAt: "2026-02-02T00:00:00Z",
    evidence: { criteria: [{ ...criterion }] },
  }));
}

test("unknown or absent release evidence blocks release review", () => {
  const result = evaluateQuantitativeReleaseReadiness([]);
  assert.equal(result.status, "blocked_unknown");
  assert.equal(result.release_review_ready, false);
  assert.equal(result.execution_enabled, false);
  assert.equal(result.required_gate_count, 10);
  assert.equal(result.unknown_gate_count, 10);
});

test("complete quantitative evidence can only become ready for independent review", () => {
  const result = evaluateQuantitativeReleaseReadiness(completeGateRecords());
  assert.equal(result.status, "ready_for_review");
  assert.equal(result.release_review_ready, true);
  assert.equal(result.execution_enabled, false);
  assert.equal(result.passed_gate_count, 10);
});

test("missing thresholds, unreviewed gates, and unentitled evidence fail closed", () => {
  const noThreshold = completeGateRecords();
  noThreshold[0]!.evidence.criteria[0]!.threshold = null;
  assert.equal(evaluateQuantitativeReleaseReadiness(noThreshold).status, "blocked_unknown");

  const unreviewed = completeGateRecords();
  unreviewed[0]!.status = "warning";
  assert.equal(evaluateQuantitativeReleaseReadiness(unreviewed).status, "blocked_unknown");

  const unentitled = completeGateRecords();
  unentitled[0]!.evidence.criteria[0]!.sourceEntitled = false;
  assert.equal(evaluateQuantitativeReleaseReadiness(unentitled).status, "blocked_failed");
});

test("threshold violations and duplicate criteria block review", () => {
  const failing = completeGateRecords();
  failing[0]!.evidence.criteria[0]!.observedValue = 99;
  assert.equal(evaluateQuantitativeReleaseReadiness(failing).status, "blocked_failed");

  const duplicated = completeGateRecords();
  duplicated[0]!.evidence.criteria.push({ ...criterion });
  assert.equal(evaluateQuantitativeReleaseReadiness(duplicated).status, "blocked_unknown");

  const duplicateGate = completeGateRecords();
  duplicateGate.push({ ...duplicateGate[0]! });
  assert.equal(evaluateQuantitativeReleaseReadiness(duplicateGate).status, "blocked_unknown");
});

test("criteria require exact source, reviewer, units, date range, and artifact evidence", () => {
  const invalid = completeGateRecords();
  invalid[0]!.evidence.criteria[0]!.sourceEntitled = "true";
  invalid[0]!.evidence.criteria[0]!.thresholdUnit = "different-unit";
  invalid[0]!.evidence.criteria[0]!.periodStart = "2026-02-01T00:00:00";
  invalid[0]!.evidence.criteria[0]!.reviewerId = "different-reviewer";
  assert.equal(evaluateQuantitativeReleaseReadiness(invalid).status, "blocked_unknown");
});
