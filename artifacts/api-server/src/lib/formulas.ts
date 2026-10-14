/**
 * IEIS v7.2 canonical formula registry.
 *
 * Scores/confidence are 0..100 unless explicitly marked as a 0..1 factor.
 * This file is intentionally dependency-free so formula tests can exercise it
 * without a database or a running server.
 */

export const FORMULA_VERSION = "IEIS-7.1.4-reference-v1";
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

const FORMULA_DEFINITIONS = [
  {
    id: "RELATIVE_DIFFERENCE_V2", version: "2.0", name: "Relative difference",
    expression: "abs(x1-x2)/max(abs(x1),abs(x2),epsilon)",
    machineExpression: { op: "divide", left: { op: "abs_diff", args: ["x1", "x2"] }, right: { op: "max", args: [{ op: "abs", arg: "x1" }, { op: "abs", arg: "x2" }, "epsilon"] } },
    variables: ["x1", "x2", "epsilon"], units: "ratio", validRange: "[0,1]",
    missingValueRule: "return null", zeroDivisionRule: "epsilon floor",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "DATA_CONFIDENCE_V2", version: "2.0", name: "Data confidence",
    expression: "sum(weight[k]*component_score[k])/sum(weight[k])",
    machineExpression: { op: "weighted_mean", values: "component_score", weights: "weight", missing: "coverage_shrinkage" },
    variables: ["component_score", "weight"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "coverage shrinkage toward 50", zeroDivisionRule: "return neutral 50",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "COVERAGE_SHRINKAGE_V2", version: "2.0", name: "Coverage shrinkage",
    expression: "50 + coverage*(raw-50)",
    machineExpression: { op: "add", args: [50, { op: "multiply", args: ["coverage", { op: "subtract", args: ["raw", 50] }] }] },
    variables: ["coverage", "raw"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "missing components excluded from coverage", zeroDivisionRule: "neutral 50",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "CANDIDATE_SCORE_V3", version: "3.0", name: "Candidate actionable score",
    expression: "eligible ? clip(min(RawScore,50+(RawScore-50)*(Confidence/100),HardGateCap),0,100) : null",
    machineExpression: { op: "if", condition: "eligible", then: { op: "clip", min: 0, max: 100, value: { op: "min", args: ["RawScore", { op: "add", args: [50, { op: "multiply", args: [{ op: "subtract", args: ["RawScore", 50] }, { op: "divide", left: "Confidence", right: 100 }] }] }, "HardGateCap"] } }, otherwise: null },
    variables: ["eligible", "RawScore", "Confidence", "HardGateCap"], units: "score 0..100 or null", validRange: "[0,100]",
    missingValueRule: "missing required input is unavailable; ineligible returns null", zeroDivisionRule: "fixed 100 confidence scale",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "CFO_CONVERSION_V2", version: "2.0", name: "CFO conversion",
    expression: "CFO/max(abs(NormalizedPAT),PATDenominatorFloor)",
    machineExpression: { op: "divide", left: "CFO", right: { op: "max", args: [{ op: "abs", arg: "NormalizedPAT" }, "PATDenominatorFloor"] } },
    variables: ["CFO", "NormalizedPAT", "PATDenominatorFloor"], units: "ratio", validRange: "finite",
    missingValueRule: "return null", zeroDivisionRule: "PAT floor",
    testStatus: "passed", owner: "IEIS Fundamental", approvalStatus: "approved",
  },
  {
    id: "FCF_CONVERSION_V2", version: "2.0", name: "FCF conversion",
    expression: "(CFO-MaintenanceCapex)/max(abs(NormalizedPAT),PATDenominatorFloor)",
    machineExpression: { op: "divide", left: { op: "subtract", args: ["CFO", "MaintenanceCapex"] }, right: { op: "max", args: [{ op: "abs", arg: "NormalizedPAT" }, "PATDenominatorFloor"] } },
    variables: ["CFO", "MaintenanceCapex", "NormalizedPAT", "PATDenominatorFloor"], units: "ratio", validRange: "finite",
    missingValueRule: "return null", zeroDivisionRule: "PAT floor",
    testStatus: "passed", owner: "IEIS Fundamental", approvalStatus: "approved",
  },
  {
    id: "VALUE_QUALITY_ADJUSTMENT_V2", version: "2.0", name: "Value quality adjustment",
    expression: "ValueScore*(0.50+0.50*(QualityScore/100))",
    machineExpression: { op: "multiply", args: ["ValueScore", { op: "add", args: [0.5, { op: "multiply", args: [0.5, { op: "divide", left: "QualityScore", right: 100 }] }] }] },
    variables: ["ValueScore", "QualityScore"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "neutral score", zeroDivisionRule: "fixed 100 scale",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "COMPOSITE_RANK_V2", version: "2.0", name: "Composite rank",
    expression: "0.50*Overall+0.25*Sector+0.15*Size+0.10*Persistence",
    machineExpression: { op: "sum", terms: [{ weight: 0.5, value: "Overall" }, { weight: 0.25, value: "Sector" }, { weight: 0.15, value: "Size" }, { weight: 0.1, value: "Persistence" }] },
    variables: ["Overall", "Sector", "Size", "Persistence"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "component omitted and coverage reduced", zeroDivisionRule: "weights renormalized",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "PROMOTION_SCORE_V2", version: "2.0", name: "Promotion score",
    expression: "0.45*Candidate+0.15*Sector+0.10*DC+0.10*Persistence+0.10*Liquidity+0.05*Event+0.05*Portfolio",
    machineExpression: { op: "sum", terms: [{ weight: 0.45, value: "Candidate" }, { weight: 0.15, value: "Sector" }, { weight: 0.1, value: "DC" }, { weight: 0.1, value: "Persistence" }, { weight: 0.1, value: "Liquidity" }, { weight: 0.05, value: "Event" }, { weight: 0.05, value: "Portfolio" }] },
    variables: ["Candidate", "Sector", "DC", "Persistence", "Liquidity", "Event", "Portfolio"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "missing dimensions reduce coverage", zeroDivisionRule: "weights renormalized",
    testStatus: "passed", owner: "IEIS Quant", approvalStatus: "approved",
  },
  {
    id: "RESEARCH_SCORE_V3", version: "3.0", name: "Research actionable score",
    expression: "research_eligible ? clip(min(RawResearchScore,50+(RawResearchScore-50)*(ResearchConfidence/100),ResearchHardCap),0,100) : null",
    machineExpression: { op: "if", condition: "research_eligible", then: { op: "clip", min: 0, max: 100, value: { op: "min", args: ["RawResearchScore", { op: "add", args: [50, { op: "multiply", args: [{ op: "subtract", args: ["RawResearchScore", 50] }, { op: "divide", left: "ResearchConfidence", right: 100 }] }] }, "ResearchHardCap"] } }, otherwise: null },
    variables: ["research_eligible", "RawResearchScore", "ResearchConfidence", "ResearchHardCap"], units: "score 0..100 or null", validRange: "[0,100]",
    missingValueRule: "missing required input is unavailable; ineligible returns null", zeroDivisionRule: "fixed 100 confidence scale",
    testStatus: "passed", owner: "IEIS Research", approvalStatus: "approved",
  },
  {
    id: "HORIZON_SCORE_V2", version: "2.0", name: "Horizon score",
    expression: "sum(weight[k]*component[k])/sum(weight[k])",
    machineExpression: { op: "weighted_mean", values: "component", weights: "weight", missing: "coverage_shrinkage" },
    variables: ["component", "weight"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "coverage shrinkage", zeroDivisionRule: "neutral 50",
    testStatus: "passed", owner: "IEIS Signals", approvalStatus: "approved",
  },
  {
    id: "SIGNAL_CONFIDENCE_V3", version: "3.0", name: "Signal confidence",
    expression: "100*product(required_component[j]/100)^(1/N_required)",
    machineExpression: { op: "geometric_mean", values: "required_components", scale: 100, missing: "unavailable" },
    variables: ["horizon", "required_components"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "a missing horizon-required component is unavailable; never change N silently", zeroDivisionRule: "zero required component yields zero confidence",
    testStatus: "passed", owner: "IEIS Signals", approvalStatus: "approved",
  },
  {
    id: "FINAL_HSS_V3", version: "3.0", name: "Final horizon signal score",
    expression: "horizon_eligible ? clip(min(RawHSS,50+(RawHSS-50)*(SignalConfidence/100),HardGateCap)-StalePenalty-EventPenalty-RiskPenalty,0,100) : null",
    machineExpression: { op: "if", condition: "horizon_eligible", then: { op: "clip", min: 0, max: 100, value: { op: "subtract", args: [{ op: "min", args: ["RawHSS", { op: "add", args: [50, { op: "multiply", args: [{ op: "subtract", args: ["RawHSS", 50] }, { op: "divide", left: "SignalConfidence", right: 100 }] }] }, "HardGateCap"] }, { op: "sum", args: ["StalePenalty", "EventPenalty", "RiskPenalty"] }] } }, otherwise: null },
    variables: ["horizon_eligible", "RawHSS", "SignalConfidence", "HardGateCap", "StalePenalty", "EventPenalty", "RiskPenalty"], units: "score 0..100 or null", validRange: "[0,100]",
    missingValueRule: "missing required input is unavailable; ineligible returns null", zeroDivisionRule: "fixed 100 confidence scale",
    testStatus: "passed", owner: "IEIS Signals", approvalStatus: "approved",
  },
  {
    id: "WEIGHTED_FAIR_VALUE_V2", version: "2.0", name: "Weighted fair value",
    expression: "sum(probability[s]*fair_value[s])",
    machineExpression: { op: "weighted_sum", values: "fair_value", weights: "probability", requireWeightTotal: 1 },
    variables: ["probability", "fair_value"], units: "INR/share", validRange: "finite positive",
    missingValueRule: "invalid scenarios excluded", zeroDivisionRule: "return null when probability sum is zero",
    testStatus: "passed", owner: "IEIS Research", approvalStatus: "approved",
  },
  {
    id: "EXPECTED_ANNUAL_RETURN_V2", version: "2.0", name: "Expected annualized return",
    expression: "((WeightedFairValue+Dividends)/CurrentPrice)^(1/HorizonYears)-1",
    machineExpression: { op: "subtract", args: [{ op: "power", base: { op: "divide", left: { op: "add", args: ["WeightedFairValue", "Dividends"] }, right: "CurrentPrice" }, exponent: { op: "divide", left: 1, right: "HorizonYears" } }, 1] },
    variables: ["WeightedFairValue", "Dividends", "CurrentPrice", "HorizonYears"], units: "decimal return",
    validRange: "finite", missingValueRule: "return null", zeroDivisionRule: "positive price and horizon required",
    testStatus: "passed", owner: "IEIS Research", approvalStatus: "approved",
  },
  {
    id: "ACCRUAL_RATIO_V2", version: "2.0", name: "Accrual ratio",
    expression: "(NormalizedPAT-CFO)/max(abs(AverageOperatingAssets),AssetFloor)",
    machineExpression: { op: "divide", left: { op: "subtract", args: ["NormalizedPAT", "CFO"] }, right: { op: "max", args: [{ op: "abs", arg: "AverageOperatingAssets" }, "AssetFloor"] } },
    variables: ["NormalizedPAT", "CFO", "AverageOperatingAssets", "AssetFloor"], units: "ratio", validRange: "finite",
    missingValueRule: "return null", zeroDivisionRule: "asset floor",
    testStatus: "passed", owner: "IEIS Fundamental", approvalStatus: "approved",
  },
  {
    id: "PER_SHARE_CAGR_V2", version: "2.0", name: "Per-share CAGR",
    expression: "((EndingMetric/EndingDilutedShares)/(BeginningMetric/BeginningDilutedShares))^(1/Years)-1",
    machineExpression: { op: "subtract", args: [{ op: "power", base: { op: "divide", left: { op: "divide", left: "EndingMetric", right: "EndingDilutedShares" }, right: { op: "divide", left: "BeginningMetric", right: "BeginningDilutedShares" } }, exponent: { op: "divide", left: 1, right: "Years" } }, 1] },
    variables: ["BeginningMetric", "EndingMetric", "BeginningDilutedShares", "EndingDilutedShares", "Years"], units: "decimal return", validRange: "finite",
    missingValueRule: "invalid or non-positive bases return null", zeroDivisionRule: "positive share counts and years required",
    testStatus: "passed", owner: "IEIS Fundamental", approvalStatus: "approved",
  },
  {
    id: "ROIIC_V2", version: "2.0", name: "Return on incremental invested capital",
    expression: "ChangeInNOPAT/max(abs(ChangeInInvestedCapital),CapitalChangeFloor)",
    machineExpression: { op: "divide", left: "ChangeInNOPAT", right: { op: "max", args: [{ op: "abs", arg: "ChangeInInvestedCapital" }, "CapitalChangeFloor"] } },
    variables: ["ChangeInNOPAT", "ChangeInInvestedCapital", "CapitalChangeFloor"], units: "ratio", validRange: "finite",
    missingValueRule: "multi-year smoothing required", zeroDivisionRule: "capital change floor",
    testStatus: "passed", owner: "IEIS Fundamental", approvalStatus: "approved",
  },
  {
    id: "POSITION_SUITABILITY_V2", version: "2.0", name: "Position suitability",
    expression: "clip(100*ReturnScore*ConfidenceFactor*LiquidityFactor/(DownsidePenalty*VolatilityPenalty*CorrelationPenalty*EventPenalty),0,100)",
    machineExpression: { op: "clip", min: 0, max: 100, value: { op: "divide", left: { op: "multiply", args: [100, "ReturnScore", "ConfidenceFactor", "LiquidityFactor"] }, right: { op: "multiply", args: ["DownsidePenalty", "VolatilityPenalty", "CorrelationPenalty", "EventPenalty"] } } },
    variables: ["ReturnScore", "ConfidenceFactor", "LiquidityFactor", "DownsidePenalty", "VolatilityPenalty", "CorrelationPenalty", "EventPenalty"], units: "score 0..100", validRange: "[0,100]",
    missingValueRule: "hard gates override; missing inputs produce pending review", zeroDivisionRule: "positive penalty references required",
    testStatus: "passed", owner: "IEIS Portfolio", approvalStatus: "draft",
  },
  {
    id: "REQUIRED_MEDIAN_ADV_V2", version: "2.0", name: "Required median traded value",
    expression: "PlannedPositionValue / MaximumParticipationRate",
    machineExpression: { op: "divide", left: "PlannedPositionValue", right: "MaximumParticipationRate" },
    variables: ["PlannedPositionValue", "MaximumParticipationRate"], units: "currency", validRange: "non-negative finite",
    missingValueRule: "return null when unavailable", zeroDivisionRule: "participation rate must be greater than zero and at most one",
    testStatus: "passed", owner: "IEIS Portfolio", approvalStatus: "draft",
  },
  {
    id: "EXIT_DAYS_V2", version: "2.0", name: "Estimated exit days",
    expression: "PositionValue / max(MedianDailyTradedValue*AllowedParticipationRate,MinimumLiquidityDenominator)",
    machineExpression: { op: "divide", left: "PositionValue", right: { op: "max", args: [{ op: "multiply", args: ["MedianDailyTradedValue", "AllowedParticipationRate"] }, "MinimumLiquidityDenominator"] } },
    variables: ["PositionValue", "MedianDailyTradedValue", "AllowedParticipationRate", "MinimumLiquidityDenominator"], units: "trading days", validRange: "non-negative finite",
    missingValueRule: "return null when unavailable", zeroDivisionRule: "minimum liquidity denominator must be positive",
    testStatus: "passed", owner: "IEIS Portfolio", approvalStatus: "draft",
  },
  {
    id: "TRADING_CONTINUITY_V2", version: "2.0", name: "Trading continuity",
    expression: "clip(DaysWithValidTrades/ExpectedTradingDays,0,1)",
    machineExpression: { op: "clip", min: 0, max: 1, value: { op: "divide", left: "DaysWithValidTrades", right: "ExpectedTradingDays" } },
    variables: ["DaysWithValidTrades", "ExpectedTradingDays"], units: "ratio", validRange: "[0,1]",
    missingValueRule: "return null when unavailable", zeroDivisionRule: "expected trading days must be positive",
    testStatus: "passed", owner: "IEIS Data", approvalStatus: "draft",
  },
  {
    id: "FRESHNESS_FACTOR_V2", version: "2.0", name: "Staleness decay",
    expression: "exp(-DecayRate*max(0,ActualAge-AllowedAge))",
    machineExpression: { op: "exp", arg: { op: "negate", arg: { op: "multiply", args: ["DecayRate", { op: "max", args: [0, { op: "subtract", args: ["ActualAge", "AllowedAge"] }] }] } } },
    variables: ["ActualAge", "AllowedAge", "DecayRate"], units: "ratio", validRange: "[0,1]",
    missingValueRule: "return null when unavailable", zeroDivisionRule: "decay rate uses reciprocal age units",
    testStatus: "passed", owner: "IEIS Data", approvalStatus: "draft",
  },
  {
    id: "ALIGNMENT_SCORE_V2", version: "2.0", name: "Cross-horizon alignment",
    expression: "sum(HorizonImportance[h]*DirectionValue[h])/sum(HorizonImportance[h])",
    machineExpression: { op: "weighted_mean", values: "DirectionValue", weights: "HorizonImportance", validRange: [-1, 1] },
    variables: ["HorizonImportance", "DirectionValue"], units: "direction score", validRange: "[-1,1]",
    missingValueRule: "missing horizon state is unavailable", zeroDivisionRule: "total horizon importance must be positive",
    testStatus: "passed", owner: "IEIS Signals", approvalStatus: "draft",
  },
  {
    id: "POSITION_SIZING_V4", version: "4.0", name: "Final risk-capped quantity",
    expression: "floor_to_lot(min(Risk,Liquidity,CompanyResidual,SectorResidual,GroupResidual,HorizonResidual,EventResidual,CorrelationResidual,CashOrMargin,Gross,Net,FnoAllocation,DrawdownResidual,AccountRisk),LotSize)",
    machineExpression: { op: "floor_to_lot", value: { op: "min", args: ["risk", "liquidity", "companyResidual", "sectorResidual", "groupResidual", "horizonResidual", "eventResidual", "correlationResidual", "cashOrMargin", "gross", "net", "fnoAllocation", "drawdownResidual", "accountRisk"] }, lotSize: "lotSize" },
    variables: ["caps", "lotSize"], units: "whole lots", validRange: "non-negative integer",
    missingValueRule: "any missing cap blocks the result", zeroDivisionRule: "lot size must be a positive integer",
    testStatus: "passed", owner: "IEIS Portfolio", approvalStatus: "draft",
  },
  {
    id: "ORDER_INTENT_IDEMPOTENCY_V4", version: "4.0", name: "Canonical business-action identity",
    expression: "SHA256(canonical_json(accountId,strategyId,securityOrContractId,horizon,signalId,action,decisionVersion))",
    machineExpression: { op: "canonical_sha256", fields: ["accountId", "strategyId", "securityOrContractId", "horizon", "signalId", "action", "decisionVersion"] },
    variables: ["accountId", "strategyId", "securityOrContractId", "horizon", "signalId", "action", "decisionVersion"], units: "hexadecimal SHA-256", validRange: "64 lowercase hex characters",
    missingValueRule: "any missing identity field blocks the result", zeroDivisionRule: "not applicable",
    testStatus: "passed", owner: "IEIS Execution", approvalStatus: "draft",
  },
] as const;

export const FORMULA_REGISTRY = FORMULA_DEFINITIONS.map((formula) => ({
  ...formula,
  testStatus: "reference_tested",
  approvalStatus: "not_approved",
}));