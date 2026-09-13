/**
 * IEIS v7.2 canonical formula registry.
 *
 * Scores/confidence are 0..100 unless explicitly marked as a 0..1 factor.
 * This file is intentionally dependency-free so formula tests can exercise it
 * without a database or a running server.
 */

export const FORMULA_VERSION = "IEIS-7.2-formula-safe";
export const NEUTRAL_SCORE = 50;
export const DEFAULT_EPSILON = 1e-9;

export function clip(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  floor = DEFAULT_EPSILON,
): number | null {
  if (numerator == null || denominator == null) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  const safeFloor = Math.max(Math.abs(floor), DEFAULT_EPSILON);
  return numerator / Math.max(Math.abs(denominator), safeFloor);
}

export function relativeDifference(
  first: number | null | undefined,
  second: number | null | undefined,
  epsilon = DEFAULT_EPSILON,
): number | null {
  if (first == null || second == null) return null;
  const denominator = Math.max(Math.abs(first), Math.abs(second), epsilon);
  return Math.abs(first - second) / denominator;
}

export function weightedMean(
  values: Array<{ value: number | null | undefined; weight: number }>,
  neutral = NEUTRAL_SCORE,
): { score: number; coverage: number } {
  const valid = values.filter(
    (item) => item.value != null && Number.isFinite(item.value) && item.weight > 0,
  );
  const requiredWeight = values.reduce(
    (total, item) => total + Math.max(0, item.weight),
    0,
  );
  const availableWeight = valid.reduce((total, item) => total + item.weight, 0);
  if (requiredWeight <= 0 || availableWeight <= 0) {
    return { score: neutral, coverage: 0 };
  }
  const raw =
    valid.reduce((total, item) => total + clip(item.value!) * item.weight, 0) /
    availableWeight;
  const coverage = clip(availableWeight / requiredWeight, 0, 1);
  return {
    score: clip(neutral + coverage * (raw - neutral)),
    coverage,
  };
}

export function dataConfidence(
  components: Array<{ name: string; score: number | null | undefined; weight: number }>,
): { score: number; coverage: number; breakdown: Record<string, number> } {
  const result = weightedMean(
    components.map((component) => ({
      value: component.score,
      weight: component.weight,
    })),
  );
  const breakdown: Record<string, number> = {};
  for (const component of components) {
    breakdown[component.name] =
      component.score == null ? NEUTRAL_SCORE : clip(component.score);
  }
  return { ...result, breakdown };
}

export function freshnessFactor(
  actualAgeDays: number,
  allowedAgeDays: number,
  decayRate = 0.05,
): number {
  const excessAge = Math.max(0, actualAgeDays - allowedAgeDays);
  return Math.exp(-Math.max(0, decayRate) * excessAge);
}

export function tradingContinuity(
  validTradingDays: number,
  expectedTradingDays: number,
): number {
  if (expectedTradingDays <= 0) return 0;
  return clip((validTradingDays / expectedTradingDays) * 100) / 100;
}

export function cfoConversion(
  cfo: number | null | undefined,
  normalizedPat: number | null | undefined,
  patFloor: number,
): number | null {
  return safeDivide(cfo, normalizedPat, patFloor);
}

export function freeCashFlowConversion(
  cfo: number | null | undefined,
  maintenanceCapex: number | null | undefined,
  normalizedPat: number | null | undefined,
  patFloor: number,
): number | null {
  if (cfo == null || maintenanceCapex == null) return null;
  return safeDivide(cfo - maintenanceCapex, normalizedPat, patFloor);
}

export function accrualRatio(
  normalizedPat: number | null | undefined,
  cfo: number | null | undefined,
  averageOperatingAssets: number | null | undefined,
  assetFloor: number,
): number | null {
  if (normalizedPat == null || cfo == null || averageOperatingAssets == null) {
    return null;
  }
  return safeDivide(normalizedPat - cfo, averageOperatingAssets, assetFloor);
}

export function qualityAdjustedValue(
  valueScore: number,
  qualityScore: number,
): number {
  const qualityFactor = 0.5 + 0.5 * (clip(qualityScore) / 100);
  return clip(clip(valueScore) * qualityFactor);
}

export function candidateScore(args: {
  components: Array<{ name: string; score: number | null | undefined; weight: number }>;
  dataConfidence: number;
  hardGateCap?: number | null;
}): {
  rawScore: number;
  adjustedScore: number;
  finalScore: number;
  coverage: number;
} {
  const weighted = weightedMean(
    args.components.map((component) => ({
      value: component.score,
      weight: component.weight,
    })),
  );
  const adjustedScore =
    NEUTRAL_SCORE +
    (weighted.score - NEUTRAL_SCORE) * (clip(args.dataConfidence) / 100);
  const cap = args.hardGateCap == null ? 100 : clip(args.hardGateCap);
  return {
    rawScore: weighted.score,
    adjustedScore: clip(adjustedScore),
    finalScore: clip(Math.min(adjustedScore, cap)),
    coverage: weighted.coverage,
  };
}

export function geometricConfidence(
  components: Array<number | null | undefined>,
): number {
  const valid = components.filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
  if (valid.length === 0) return 0;
  const product = valid.reduce(
    (total, value) => total * (clip(value) / 100),
    1,
  );
  return clip(100 * Math.pow(product, 1 / valid.length));
}

export function horizonSignalScore(args: {
  components: Array<{ score: number | null | undefined; weight: number }>;
  confidenceComponents: Array<number | null | undefined>;
  stalePenalty?: number;
  eventPenalty?: number;
  riskPenalty?: number;
  hardGateCap?: number | null;
}): {
  rawScore: number;
  signalConfidence: number;
  confidenceAdjusted: number;
  penalizedScore: number;
  finalScore: number;
} {
  const raw = weightedMean(
    args.components.map((component) => ({
      value: component.score,
      weight: component.weight,
    })),
  ).score;
  const signalConfidence = geometricConfidence(args.confidenceComponents);
  const confidenceAdjusted =
    NEUTRAL_SCORE +
    (raw - NEUTRAL_SCORE) * (signalConfidence / 100);
  const penalizedScore =
    confidenceAdjusted -
    Math.max(0, args.stalePenalty ?? 0) -
    Math.max(0, args.eventPenalty ?? 0) -
    Math.max(0, args.riskPenalty ?? 0);
  const cap = args.hardGateCap == null ? 100 : clip(args.hardGateCap);
  return {
    rawScore: raw,
    signalConfidence,
    confidenceAdjusted,
    penalizedScore,
    finalScore: clip(Math.min(penalizedScore, cap)),
  };
}

export type SignalState =
  | "strong_buy"
  | "buy"
  | "accumulate"
  | "watch"
  | "hold"
  | "reduce"
  | "avoid";

export function classifySignal(score: number): SignalState {
  if (score >= 85) return "strong_buy";
  if (score >= 75) return "buy";
  if (score >= 68) return "accumulate";
  if (score >= 58) return "watch";
  if (score >= 45) return "hold";
  if (score >= 35) return "reduce";
  return "avoid";
}

export function weightedFairValue(
  scenarios: Array<{ probability: number; fairValue: number }>,
): number | null {
  const valid = scenarios.filter(
    (scenario) =>
      Number.isFinite(scenario.probability) &&
      scenario.probability >= 0 &&
      Number.isFinite(scenario.fairValue),
  );
  const probabilityTotal = valid.reduce(
    (total, scenario) => total + scenario.probability,
    0,
  );
  if (valid.length === 0 || probabilityTotal <= 0) return null;
  return valid.reduce(
    (total, scenario) =>
      total + (scenario.probability / probabilityTotal) * scenario.fairValue,
    0,
  );
}

export function expectedAnnualizedReturn(
  weightedValue: number | null,
  expectedDividends: number | null,
  currentPrice: number | null,
  horizonYears: number | null,
): number | null {
  if (
    weightedValue == null ||
    expectedDividends == null ||
    currentPrice == null ||
    horizonYears == null ||
    weightedValue + expectedDividends <= 0 ||
    currentPrice <= 0 ||
    horizonYears <= 0
  ) {
    return null;
  }
  return (
    Math.pow((weightedValue + expectedDividends) / currentPrice, 1 / horizonYears) -
    1
  );
}

export const FORMULA_REGISTRY = [
  {
    id: "RELATIVE_DIFFERENCE_V2", version: "2.0", name: "Relative difference",
    expression: "abs(x1-x2)/max(abs(x1),abs(x2),epsilon)",
    variables: ["x1", "x2", "epsilon"], units: "ratio", validRange: "[0,1]",
    missingValueRule: "return null", zeroDivisionRule: "epsilon floor",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "DATA_CONFIDENCE_V2", version: "2.0", name: "Data confidence",
    expression: "sum(weight[k]*component_score[k])/sum(weight[k])",
    variables: ["component_score", "weight"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "coverage shrinkage toward 50", zeroDivisionRule: "return neutral 50",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "COVERAGE_SHRINKAGE_V2", version: "2.0", name: "Coverage shrinkage",
    expression: "50 + coverage*(raw-50)",
    variables: ["coverage", "raw"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "missing components excluded from coverage", zeroDivisionRule: "neutral 50",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "CANDIDATE_SCORE_V2", version: "2.0", name: "Candidate score",
    expression: "clip(min(50+(raw-50)*(DC/100), HardGateCap),0,100)",
    variables: ["raw", "DC", "HardGateCap"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "neutral component with reduced coverage", zeroDivisionRule: "DC denominator bounded",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "CFO_CONVERSION_V2", version: "2.0", name: "CFO conversion",
    expression: "CFO/max(abs(NormalizedPAT),PATDenominatorFloor)",
    variables: ["CFO", "NormalizedPAT", "PATDenominatorFloor"], units: "ratio", validRange: "finite",
    missingValueRule: "return null", zeroDivisionRule: "PAT floor",
    testStatus: "passed", owner: "IEIS Fundamental", approvalStatus: "approved",
  },
  {
    id: "FCF_CONVERSION_V2", version: "2.0", name: "FCF conversion",
    expression: "(CFO-MaintenanceCapex)/max(abs(NormalizedPAT),PATDenominatorFloor)",
    variables: ["CFO", "MaintenanceCapex", "NormalizedPAT", "PATDenominatorFloor"], units: "ratio", validRange: "finite",
    missingValueRule: "return null", zeroDivisionRule: "PAT floor",
    testStatus: "passed", owner: "IEIS Fundamental", approvalStatus: "approved",
  },
  {
    id: "VALUE_QUALITY_ADJUSTMENT_V2", version: "2.0", name: "Value quality adjustment",
    expression: "ValueScore*(0.50+0.50*(QualityScore/100))",
    variables: ["ValueScore", "QualityScore"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "neutral score", zeroDivisionRule: "fixed 100 scale",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "COMPOSITE_RANK_V2", version: "2.0", name: "Composite rank",
    expression: "0.50*Overall+0.25*Sector+0.15*Size+0.10*Persistence",
    variables: ["Overall", "Sector", "Size", "Persistence"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "component omitted and coverage reduced", zeroDivisionRule: "weights renormalized",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "PROMOTION_SCORE_V2", version: "2.0", name: "Promotion score",
    expression: "0.45*Candidate+0.15*Sector+0.10*DC+0.10*Persistence+0.10*Liquidity+0.05*Event+0.05*Portfolio",
    variables: ["Candidate", "Sector", "DC", "Persistence", "Liquidity", "Event", "Portfolio"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "missing dimensions reduce coverage", zeroDivisionRule: "weights renormalized",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "RESEARCH_SCORE_V2", version: "2.0", name: "Research score",
    expression: "50+(raw-50)*(ResearchConfidence/100)",
    variables: ["raw", "ResearchConfidence"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "neutral raw score", zeroDivisionRule: "fixed 100 scale",
    testStatus: "passed", owner: "IEIS Research", approvalStatus: "approved",
  },
  {
    id: "HORIZON_SCORE_V2", version: "2.0", name: "Horizon score",
    expression: "sum(weight[k]*component[k])/sum(weight[k])",
    variables: ["component", "weight"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "coverage shrinkage", zeroDivisionRule: "neutral 50",
    testStatus: "passed", owner: "IEIS Signals", approvalStatus: "approved",
  },
  {
    id: "SIGNAL_CONFIDENCE_V2", version: "2.0", name: "Signal confidence",
    expression: "100*product(component[j]/100)^(1/n)",
    variables: ["component"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "missing components excluded", zeroDivisionRule: "zero component yields zero confidence",
    testStatus: "passed", owner: "IEIS Signals", approvalStatus: "approved",
  },
  {
    id: "FINAL_HSS_V2", version: "2.0", name: "Final horizon signal score",
    expression: "clip(min(50+(raw-50)*(confidence/100)-penalties,HardGateCap),0,100)",
    variables: ["raw", "confidence", "penalties", "HardGateCap"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "insufficient data state", zeroDivisionRule: "confidence denominator bounded",
    testStatus: "passed", owner: "IEIS Signals", approvalStatus: "approved",
  },
  {
    id: "WEIGHTED_FAIR_VALUE_V2", version: "2.0", name: "Weighted fair value",
    expression: "sum(probability[s]*fair_value[s])",
    variables: ["probability", "fair_value"], units: "INR/share", validRange: "finite positive",
    missingValueRule: "invalid scenarios excluded", zeroDivisionRule: "return null when probability sum is zero",
    testStatus: "passed", owner: "IEIS Research", approvalStatus: "approved",
  },
  {
    id: "EXPECTED_ANNUAL_RETURN_V2", version: "2.0", name: "Expected annualized return",
    expression: "((WeightedFairValue+Dividends)/CurrentPrice)^(1/HorizonYears)-1",
    variables: ["WeightedFairValue", "Dividends", "CurrentPrice", "HorizonYears"], units: "decimal return",
    validRange: "finite", missingValueRule: "return null", zeroDivisionRule: "positive price and horizon required",
    testStatus: "passed", owner: "IEIS Research", approvalStatus: "approved",
  },
] as const;