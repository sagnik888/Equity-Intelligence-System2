import assert from "node:assert/strict";
import test from "node:test";
import { FORMULA_REGISTRY } from "./formulas";
import {
  evaluateFormulaReference,
  FORMULA_REFERENCE_IDS,
  FormulaReferenceError,
} from "./formulaReference";
import { FORMULA_REFERENCE_VECTORS } from "./formulaReferenceVectors";

test("the 7.1.4 reference allowlist exactly matches its 26 formula IDs", () => {
  assert.equal(FORMULA_REFERENCE_IDS.length, 26);
  assert.equal(new Set(FORMULA_REFERENCE_IDS).size, 26);
  assert.deepEqual(
    [...FORMULA_REGISTRY.map((formula) => formula.id)].sort(),
    [...FORMULA_REFERENCE_IDS].sort(),
  );
  assert.ok(FORMULA_REGISTRY.every((formula) => formula.testStatus === "reference_tested"));
  assert.ok(FORMULA_REGISTRY.every((formula) => formula.approvalStatus === "not_approved"));
});

test("each whitelisted formula matches its deterministic synthetic reference vector", () => {
  assert.equal(FORMULA_REFERENCE_VECTORS.length, 26);
  assert.deepEqual(
    [...FORMULA_REFERENCE_VECTORS.map((vector) => vector.id)].sort(),
    [...FORMULA_REFERENCE_IDS].sort(),
  );
  for (const vector of FORMULA_REFERENCE_VECTORS) {
    const actual = evaluateFormulaReference(vector.id, vector.args);
    if (typeof vector.expected === "number") {
      assert.equal(typeof actual, "number", `${vector.id} should return a number`);
      assert.ok(Math.abs((actual as number) - vector.expected) < 1e-10, vector.id);
    } else {
      assert.equal(actual, vector.expected, vector.id);
    }
  }
});

test("every formula rejects each omitted required named argument", () => {
  for (const vector of FORMULA_REFERENCE_VECTORS) {
    for (const key of vector.requiredArguments) {
      const args = { ...vector.args };
      delete args[key];
      assert.throws(
        () => evaluateFormulaReference(vector.id, args),
        FormulaReferenceError,
        `${vector.id} should reject missing ${key}`,
      );
    }
  }
});

test("unknown expressions, numeric coercion, and truthy eligibility are rejected", () => {
  assert.throws(() => evaluateFormulaReference("arbitrary expression", {}), {
    code: "UNSUPPORTED_FORMULA",
  });
  assert.throws(() => evaluateFormulaReference("RELATIVE_DIFFERENCE_V2", {
    x1: "100",
    x2: 110,
    epsilon: 1e-9,
  }), { code: "INVALID_INPUT" });
  assert.throws(() => evaluateFormulaReference("CANDIDATE_SCORE_V3", {
    eligible: "true",
    rawScore: 90,
    confidence: 90,
    hardGateCap: 100,
  }), { code: "INVALID_INPUT" });
});

test("horizon confidence requires all components for the named horizon", () => {
  assert.throws(() => evaluateFormulaReference("SIGNAL_CONFIDENCE_V3", {
    horizon: "long",
    components: { data: 100, model: 100, regime: 100, liquidity: 100, feature_coverage: 100, stability: 100 },
  }), { code: "MISSING_ARGUMENT" });
});

test("scenario probabilities must sum to one and position sizing requires all 14 caps", () => {
  assert.throws(() => evaluateFormulaReference("WEIGHTED_FAIR_VALUE_V2", {
    scenarios: [{ probability: 0.4, fairValue: 100 }, { probability: 0.4, fairValue: 200 }],
  }), { code: "INVALID_INPUT" });

  const vector = FORMULA_REFERENCE_VECTORS.find((item) => item.id === "POSITION_SIZING_V4")!;
  const caps = vector.args.caps as Record<string, number>;
  for (const key of [
    "risk", "liquidity", "companyResidual", "sectorResidual", "groupResidual",
    "horizonResidual", "eventResidual", "correlationResidual", "cashOrMargin",
    "gross", "net", "fnoAllocation", "drawdownResidual", "accountRisk",
  ]) {
    const incompleteCaps = { ...caps };
    delete incompleteCaps[key];
    assert.throws(() => evaluateFormulaReference("POSITION_SIZING_V4", {
      ...vector.args,
      caps: incompleteCaps,
    }));
  }
});

test("V3 gates can only suppress a score, never make an ineligible score actionable", () => {
  assert.equal(evaluateFormulaReference("CANDIDATE_SCORE_V3", {
    eligible: false,
    rawScore: 90,
    confidence: 100,
    hardGateCap: 100,
  }), null);
  assert.equal(evaluateFormulaReference("FINAL_HSS_V3", {
    horizonEligible: false,
    rawHss: 90,
    signalConfidence: 100,
    hardGateCap: 100,
    stalePenalty: 0,
    eventPenalty: 0,
    riskPenalty: 0,
  }), null);
});
