import assert from "node:assert/strict";
import {
  candidateScore,
  geometricConfidence,
  horizonSignalScore,
  relativeDifference,
  weightedFairValue,
} from "./formulas";
import { positionSizingV2 } from "./positionSizing";
import { calculateCandidateScore } from "./scoring";

export function runFormulaTests() {
  assert.equal(relativeDifference(100, 110), 10 / 110);
  assert.equal(relativeDifference(0, 0), 0);

  const noData = candidateScore({
    components: [
      { name: "quality", score: null, weight: 50 },
      { name: "growth", score: null, weight: 50 },
    ],
    dataConfidence: 100,
  });
  assert.equal(noData.finalScore, 50);

  const adjusted = candidateScore({
    components: [{ name: "quality", score: 90, weight: 100 }],
    dataConfidence: 50,
  });
  assert.equal(adjusted.finalScore, 70);
  assert.equal(
    candidateScore({
      components: [{ name: "quality", score: 100, weight: 100 }],
      dataConfidence: 100,
      hardGateCap: 69,
    }).finalScore,
    69,
  );

  assert.equal(geometricConfidence([100, 100, 100]), 100);
  assert.equal(Math.round(geometricConfidence([100, 25]) * 100) / 100, 50);
  assert.equal(
    Math.round(
      horizonSignalScore({
        components: [{ score: 90, weight: 1 }],
        confidenceComponents: [100],
        stalePenalty: 5,
        hardGateCap: 80,
      }).finalScore,
    ),
    80,
  );

  assert.equal(weightedFairValue([
    { probability: 0.5, fairValue: 100 },
    { probability: 0.5, fairValue: 200 },
  ]), 150);

  const scored = calculateCandidateScore({
    roicPct: 25,
    rocePct: 30,
    cfoTtmCr: 120,
    fcfTtmCr: 90,
    patTtmCr: 100,
    ebitdaMarginPct: 25,
    revenueGrowth3yPct: 18,
    epsGrowth3yPct: 20,
    netDebtToEbitda: 0.5,
    interestCoverage: 12,
    peRatio: 20,
    pbRatio: 4,
    evEbitda: 14,
    fcfYieldPct: 5,
    dataAgeDays: 10,
    sourceCoveragePct: 100,
    financialReconciliationPct: 100,
    historicalCoveragePct: 90,
    sourceAgreementPct: 95,
    parsingConfidencePct: 98,
    sectorModelCompletenessPct: 90,
    corporateActionCompletenessPct: 95,
  });
  assert.ok(scored.finalScore > 50);
  assert.equal(scored.gates.effectiveCap, 100);

  const size = positionSizingV2({
    accountCapital: 1_000_000,
    riskPercent: 1,
    entryPrice: 100,
    stopPrice: 90,
    medianDailyTradedValueCr: 20,
    allowedParticipationRate: 0.1,
    maxExitDays: 5,
    maxCompanyWeight: 0.1,
    maxSectorWeight: 0.25,
    maxHorizonWeight: 0.25,
    maxCorrelationWeight: 0.2,
    maxEventWeight: 0.2,
  });
  assert.ok(size.finalQuantity > 0);
  assert.ok(size.bindingConstraint.length > 0);
}

if (process.argv[1]?.endsWith("formulaTests.ts")) {
  runFormulaTests();
  console.log("IEIS formula tests passed");
}