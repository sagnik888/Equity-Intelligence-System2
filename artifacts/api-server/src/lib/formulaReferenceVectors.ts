import type { FormulaReferenceId } from "./formulaReference";

export type FormulaReferenceVector = {
  id: FormulaReferenceId;
  args: Record<string, unknown>;
  expected: number | string | null;
  requiredArguments: string[];
};

export const FORMULA_REFERENCE_VECTORS: FormulaReferenceVector[] = [
  { id: "RELATIVE_DIFFERENCE_V2", args: { x1: 100, x2: 110, epsilon: 1e-9 }, expected: 10 / 110, requiredArguments: ["x1", "x2", "epsilon"] },
  { id: "DATA_CONFIDENCE_V2", args: { components: [{ score: 80, weight: 1 }, { score: 60, weight: 1 }] }, expected: 70, requiredArguments: ["components"] },
  { id: "REQUIRED_MEDIAN_ADV_V2", args: { plannedPositionValue: 1_000_000, maximumParticipationRate: 0.1 }, expected: 10_000_000, requiredArguments: ["plannedPositionValue", "maximumParticipationRate"] },
  { id: "EXIT_DAYS_V2", args: { positionValue: 1_000_000, medianDailyTradedValue: 100_000, allowedParticipationRate: 0.1, minimumLiquidityDenominator: 1_000 }, expected: 100, requiredArguments: ["positionValue", "medianDailyTradedValue", "allowedParticipationRate", "minimumLiquidityDenominator"] },
  { id: "TRADING_CONTINUITY_V2", args: { daysWithValidTrades: 18, expectedTradingDays: 20 }, expected: 0.9, requiredArguments: ["daysWithValidTrades", "expectedTradingDays"] },
  { id: "COVERAGE_SHRINKAGE_V2", args: { rawScore: 80, availableMetricWeight: 3, requiredMetricWeight: 4 }, expected: 72.5, requiredArguments: ["rawScore", "availableMetricWeight", "requiredMetricWeight"] },
  { id: "FRESHNESS_FACTOR_V2", args: { actualAge: 10, allowedAge: 5, decayRate: 0.2 }, expected: Math.exp(-1), requiredArguments: ["actualAge", "allowedAge", "decayRate"] },
  { id: "CANDIDATE_SCORE_V3", args: { eligible: true, rawScore: 90, confidence: 50, hardGateCap: 80 }, expected: 70, requiredArguments: ["eligible", "rawScore", "confidence", "hardGateCap"] },
  { id: "CFO_CONVERSION_V2", args: { cfo: 120, normalizedPat: 100, patDenominatorFloor: 1 }, expected: 1.2, requiredArguments: ["cfo", "normalizedPat", "patDenominatorFloor"] },
  { id: "FCF_CONVERSION_V2", args: { cfo: 120, maintenanceCapex: 20, normalizedPat: 100, patDenominatorFloor: 1 }, expected: 1, requiredArguments: ["cfo", "maintenanceCapex", "normalizedPat", "patDenominatorFloor"] },
  { id: "ACCRUAL_RATIO_V2", args: { normalizedPat: 120, cfo: 100, averageOperatingAssets: 500, assetFloor: 10 }, expected: 0.04, requiredArguments: ["normalizedPat", "cfo", "averageOperatingAssets", "assetFloor"] },
  { id: "PER_SHARE_CAGR_V2", args: { beginningMetric: 1_000, endingMetric: 2_000, beginningDilutedShares: 10, endingDilutedShares: 10, years: 2 }, expected: Math.sqrt(2) - 1, requiredArguments: ["beginningMetric", "endingMetric", "beginningDilutedShares", "endingDilutedShares", "years"] },
  { id: "VALUE_QUALITY_ADJUSTMENT_V2", args: { valueScore: 80, qualityScore: 80 }, expected: 72, requiredArguments: ["valueScore", "qualityScore"] },
  { id: "ROIIC_V2", args: { changeInNopat: 20, changeInInvestedCapital: 100, capitalChangeFloor: 1 }, expected: 0.2, requiredArguments: ["changeInNopat", "changeInInvestedCapital", "capitalChangeFloor"] },
  { id: "COMPOSITE_RANK_V2", args: { overallPercentile: 80, sectorPercentile: 70, sizePercentile: 60, rankPersistenceScore: 50 }, expected: 71.5, requiredArguments: ["overallPercentile", "sectorPercentile", "sizePercentile", "rankPersistenceScore"] },
  { id: "PROMOTION_SCORE_V2", args: { candidateScore: 80, sectorPercentile: 70, dataConfidence: 90, rankPersistence: 60, liquidityScore: 80, eventPriority: 40, portfolioPriority: 50 }, expected: 74, requiredArguments: ["candidateScore", "sectorPercentile", "dataConfidence", "rankPersistence", "liquidityScore", "eventPriority", "portfolioPriority"] },
  { id: "RESEARCH_SCORE_V3", args: { researchEligible: true, rawResearchScore: 90, researchConfidence: 50, researchHardCap: 80 }, expected: 70, requiredArguments: ["researchEligible", "rawResearchScore", "researchConfidence", "researchHardCap"] },
  { id: "WEIGHTED_FAIR_VALUE_V2", args: { scenarios: [{ probability: 0.25, fairValue: 100 }, { probability: 0.75, fairValue: 200 }] }, expected: 175, requiredArguments: ["scenarios"] },
  { id: "EXPECTED_ANNUAL_RETURN_V2", args: { weightedFairValue: 120, expectedDividends: 10, currentPrice: 100, horizonYears: 2 }, expected: Math.sqrt(1.3) - 1, requiredArguments: ["weightedFairValue", "expectedDividends", "currentPrice", "horizonYears"] },
  { id: "HORIZON_SCORE_V2", args: { components: [{ score: 80, weight: 1 }, { score: 60, weight: 1 }] }, expected: 70, requiredArguments: ["components"] },
  { id: "SIGNAL_CONFIDENCE_V3", args: { horizon: "long", components: { data: 100, model: 100, regime: 100, liquidity: 100, research: 100, feature_coverage: 100, stability: 100 } }, expected: 100, requiredArguments: ["horizon", "components"] },
  { id: "FINAL_HSS_V3", args: { horizonEligible: true, rawHss: 90, signalConfidence: 50, hardGateCap: 80, stalePenalty: 1, eventPenalty: 2, riskPenalty: 3 }, expected: 64, requiredArguments: ["horizonEligible", "rawHss", "signalConfidence", "hardGateCap", "stalePenalty", "eventPenalty", "riskPenalty"] },
  { id: "ALIGNMENT_SCORE_V2", args: { horizons: [{ importance: 1, state: "strong_buy" }, { importance: 1, state: "hold" }, { importance: 2, state: "avoid" }] }, expected: -0.25, requiredArguments: ["horizons"] },
  { id: "POSITION_SUITABILITY_V2", args: { expectedAnnualizedReturn: 0.15, requiredReturn: 0.1, positiveReturnReference: 0.2, researchConfidence: 90, liquidityScore: 80, severeDownsidePct: 20, downsideReferencePct: 20, annualizedVolatilityPct: 30, volatilityReferencePct: 30, averagePortfolioCorrelation: 0.6, correlationLimit: 0.4, eventRiskScore: 20 }, expected: 3.125, requiredArguments: ["expectedAnnualizedReturn", "requiredReturn", "positiveReturnReference", "researchConfidence", "liquidityScore", "severeDownsidePct", "downsideReferencePct", "annualizedVolatilityPct", "volatilityReferencePct", "averagePortfolioCorrelation", "correlationLimit", "eventRiskScore"] },
  { id: "POSITION_SIZING_V4", args: { caps: { risk: 57, liquidity: 53, companyResidual: 60, sectorResidual: 52, groupResidual: 70, horizonResidual: 75, eventResidual: 65, correlationResidual: 55, cashOrMargin: 54, gross: 100, net: 90, fnoAllocation: 80, drawdownResidual: 50, accountRisk: 52 }, lotSize: 25 }, expected: 50, requiredArguments: ["caps", "lotSize"] },
  { id: "ORDER_INTENT_IDEMPOTENCY_V4", args: { accountId: "acct-1", strategyId: "strategy-1", securityOrContractId: "isin-demo-1", horizon: "long", signalId: "signal-1", action: "enter", decisionVersion: "decision-v1" }, expected: "dea2c275dc7d3e7361d241a629cfb6d3508b7e19fea2b67d2f8fb3517344b956", requiredArguments: ["accountId", "strategyId", "securityOrContractId", "horizon", "signalId", "action", "decisionVersion"] },
];
