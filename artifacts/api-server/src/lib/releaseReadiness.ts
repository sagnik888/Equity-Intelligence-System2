export const REQUIRED_RELEASE_GATE_KEYS = [
  "architecture",
  "code",
  "safety",
  "formula",
  "regulatory",
  "exchange_session",
  "data",
  "execution",
  "investment",
  "operations",
] as const;

export type GateEvidenceRecord = {
  gateKey: string;
  gateName?: string | null;
  status: string;
  checkedBy?: string | null;
  checkedAt?: Date | string | null;
  evidence?: unknown;
};

type EvidenceCriterion = {
  criterionId: string;
  observedValue: number;
  operator: "gte" | "gt" | "lte" | "lt" | "eq";
  threshold: number;
  observedUnit: string;
  thresholdUnit: string;
  periodStart: string;
  periodEnd: string;
  sourceRef: string;
  sourceEntitled: boolean;
  reviewerId: string;
  reviewedAt: string;
  testArtifactRef: string;
  artifactSha256: string;
};

type GateResult = {
  gateKey: string;
  gateName: string;
  status: "passed" | "failed" | "unknown";
  passedCriteria: number;
  totalCriteria: number;
  issues: string[];
};

export type ReleaseReadinessResult = {
  status: "ready_for_review" | "blocked_failed" | "blocked_unknown";
  release_review_ready: boolean;
  execution_enabled: false;
  required_gate_count: number;
  passed_gate_count: number;
  failed_gate_count: number;
  unknown_gate_count: number;
  gates: GateResult[];
  note: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function zonedTime(value: unknown): number | null {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function reviewedTime(value: unknown): number | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }
  return zonedTime(value);
}

function criterionPasses(criterion: EvidenceCriterion): boolean {
  switch (criterion.operator) {
    case "gte": return criterion.observedValue >= criterion.threshold;
    case "gt": return criterion.observedValue > criterion.threshold;
    case "lte": return criterion.observedValue <= criterion.threshold;
    case "lt": return criterion.observedValue < criterion.threshold;
    case "eq": return criterion.observedValue === criterion.threshold;
  }
}

function evaluateGate(gateKey: string, gate?: GateEvidenceRecord): GateResult {
  const gateName = gate?.gateName ?? gateKey.replaceAll("_", " ");
  if (!gate) {
    return {
      gateKey,
      gateName,
      status: "unknown",
      passedCriteria: 0,
      totalCriteria: 0,
      issues: ["No persisted acceptance-gate record."],
    };
  }

  const issues: string[] = [];
  if (gate.status !== "healthy") {
    issues.push(gate.status === "failed"
      ? "The persisted gate status is failed."
      : "The gate has not been explicitly reviewed as healthy.");
  }
  if (!nonEmptyString(gate.checkedBy) || reviewedTime(gate.checkedAt) === null) {
    issues.push("A reviewed identity and timezone-aware review timestamp are required.");
  }

  const evidence = asRecord(gate.evidence);
  const criteria = evidence && Array.isArray(evidence.criteria) ? evidence.criteria : null;
  if (!criteria || criteria.length === 0) {
    issues.push("Quantitative criteria and thresholds are missing.");
    return {
      gateKey,
      gateName,
      status: gate.status === "failed" ? "failed" : "unknown",
      passedCriteria: 0,
      totalCriteria: 0,
      issues,
    };
  }

  let passedCriteria = 0;
  let failedCriteria = 0;
  let unknownCriteria = 0;
  const seenIds = new Set<string>();

  for (const rawCriterion of criteria) {
    const criterion = asRecord(rawCriterion);
    if (!criterion) {
      unknownCriteria++;
      issues.push("A criterion is not a structured evidence record.");
      continue;
    }

    const criterionId = criterion.criterionId;
    const observedValue = criterion.observedValue;
    const threshold = criterion.threshold;
    const operator = criterion.operator;
    const observedUnit = criterion.observedUnit;
    const thresholdUnit = criterion.thresholdUnit;
    const periodStartText = criterion.periodStart;
    const periodEndText = criterion.periodEnd;
    const reviewedAtText = criterion.reviewedAt;
    const sourceRef = criterion.sourceRef;
    const testArtifactRef = criterion.testArtifactRef;
    const artifactSha256 = criterion.artifactSha256;
    const periodStart = zonedTime(periodStartText);
    const periodEnd = zonedTime(periodEndText);
    const reviewedAt = zonedTime(reviewedAtText);
    const gateReviewer = gate.checkedBy;
    const reviewerId = criterion.reviewerId;
    const sourceEntitled = criterion.sourceEntitled;

    const recognizedOperator = operator === "gte" || operator === "gt"
      || operator === "lte" || operator === "lt" || operator === "eq";
    if (
      !nonEmptyString(criterionId)
      || !finiteNumber(observedValue)
      || !finiteNumber(threshold)
      || !recognizedOperator
      || !nonEmptyString(observedUnit)
      || !nonEmptyString(thresholdUnit)
      || observedUnit !== thresholdUnit
      || !nonEmptyString(periodStartText)
      || !nonEmptyString(periodEndText)
      || !nonEmptyString(sourceRef)
      || !nonEmptyString(reviewerId)
      || !nonEmptyString(reviewedAtText)
      || !nonEmptyString(testArtifactRef)
      || typeof artifactSha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(artifactSha256)
      || typeof sourceEntitled !== "boolean"
      || periodStart === null
      || periodEnd === null
      || reviewedAt === null
      || periodStart >= periodEnd
      || !nonEmptyString(gateReviewer)
      || reviewerId !== gateReviewer
    ) {
      unknownCriteria++;
      issues.push(`Criterion ${nonEmptyString(criterionId) ? criterionId : "(unnamed)"} has incomplete or invalid evidence.`);
      continue;
    }
    if (seenIds.has(criterionId)) {
      unknownCriteria++;
      issues.push(`Criterion ${criterionId} is duplicated.`);
      continue;
    }
    seenIds.add(criterionId);

    if (sourceEntitled !== true) {
      failedCriteria++;
      issues.push(`Criterion ${criterionId} has no confirmed evidence-use entitlement.`);
      continue;
    }

    const typedCriterion = {
      criterionId,
      observedValue,
      operator,
      threshold,
      observedUnit,
      thresholdUnit,
      periodStart: periodStartText,
      periodEnd: periodEndText,
      sourceRef,
      sourceEntitled,
      reviewerId,
      reviewedAt: reviewedAtText,
      testArtifactRef,
      artifactSha256,
    } satisfies EvidenceCriterion;
    if (criterionPasses(typedCriterion)) passedCriteria++;
    else {
      failedCriteria++;
      issues.push(`Criterion ${criterionId} does not meet its explicitly configured threshold.`);
    }
  }

  const status = gate.status === "failed" || failedCriteria > 0
    ? "failed"
    : gate.status !== "healthy" || unknownCriteria > 0 || passedCriteria === 0
      ? "unknown"
      : "passed";
  return {
    gateKey,
    gateName,
    status,
    passedCriteria,
    totalCriteria: criteria.length,
    issues,
  };
}

/**
 * This reports evidence completeness for independent release review only.
 * It never authorizes paper/live orders or changes the execution mode.
 */
export function evaluateQuantitativeReleaseReadiness(
  records: readonly GateEvidenceRecord[],
): ReleaseReadinessResult {
  const byKey = new Map<string, GateEvidenceRecord[]>();
  for (const record of records) {
    const matches = byKey.get(record.gateKey) ?? [];
    matches.push(record);
    byKey.set(record.gateKey, matches);
  }

  const gates = REQUIRED_RELEASE_GATE_KEYS.map((key) => {
    const matches = byKey.get(key) ?? [];
    if (matches.length > 1) {
      return {
        gateKey: key,
        gateName: matches[0]?.gateName ?? key.replaceAll("_", " "),
        status: "unknown" as const,
        passedCriteria: 0,
        totalCriteria: 0,
        issues: ["Multiple persisted gate records conflict; resolve duplicates before review."],
      };
    }
    return evaluateGate(key, matches[0]);
  });
  const passedGateCount = gates.filter((gate) => gate.status === "passed").length;
  const failedGateCount = gates.filter((gate) => gate.status === "failed").length;
  const unknownGateCount = gates.filter((gate) => gate.status === "unknown").length;
  const status = failedGateCount > 0
    ? "blocked_failed"
    : unknownGateCount > 0
      ? "blocked_unknown"
      : "ready_for_review";

  return {
    status,
    release_review_ready: status === "ready_for_review",
    execution_enabled: false,
    required_gate_count: REQUIRED_RELEASE_GATE_KEYS.length,
    passed_gate_count: passedGateCount,
    failed_gate_count: failedGateCount,
    unknown_gate_count: unknownGateCount,
    gates,
    note: "Evidence completeness is not release approval. Paper and live execution remain disabled pending independent sign-off.",
  };
}
