/**
 * Indian Equity Intelligence System 7.1.2 - Canonical Formula Implementations
 * All formulas follow the official specification with V2 corrections
 */

// ============================================================================
// A. Data Quality, Reconciliation, and Liquidity Formulas
// ============================================================================

/**
 * RELATIVE_DIFFERENCE_V2 - Relative difference between two values
 * Canonical: RelativeDifference = abs(x1 - x2) / max(abs(x1), abs(x2), epsilon)
 */
export function relativeDifference(x1: number, x2: number, epsilon: number = 0.001): number {
  const denominator = Math.max(Math.abs(x1), Math.abs(x2), epsilon);
  return Math.abs(x1 - x2) / denominator;
}

/**
 * DATA_CONFIDENCE_V2 - Data Confidence score
 * Canonical: DataConfidence = sum(weight[k] * component_score[k]) / sum(weight[k])
 * Output: 0-100 (mandatory normalization)
 */
export function dataConfidence(
  componentScores: Record<string, number>,
  weights: Record<string, number>,
  epsilon: number = 0.001
): number {
  const keys = Object.keys(componentScores);
  if (keys.length === 0) return 50; // neutral score

  let weightedSum = 0;
  let totalWeight = 0;

  for (const key of keys) {
    const score = componentScores[key] ?? 50;
    const weight = weights[key] ?? 0;
    weightedSum += weight * score;
    totalWeight += weight;
  }

  if (totalWeight < epsilon) return 50; // neutral if no weights
  return Math.min(100, Math.max(0, (weightedSum / totalWeight) * 100));
}

/**
 * REQUIRED_MEDIAN_ADV_V2 - Required median average daily volume
 * Canonical: RequiredMedianADV = PlannedPositionValue / MaximumParticipationRate
 */
export function requiredMedianADV(
  plannedPositionValue: number,
  maximumParticipationRate: number
): number {
  if (maximumParticipationRate <= 0) {
    throw new Error("MaximumParticipationRate must be greater than zero");
  }
  return plannedPositionValue / maximumParticipationRate;
}

/**
 * EXIT_DAYS_V2 - Estimated exit days
 * Canonical: ExitDays = PositionValue / max(MedianDailyTradedValue * AllowedParticipationRate, MinimumLiquidityDenominator)
 */
export function exitDays(
  positionValue: number,
  medianDailyTradedValue: number,
  allowedParticipationRate: number,
  minimumLiquidityDenominator: number = 1000
): number {
  const denominator = Math.max(
    medianDailyTradedValue * allowedParticipationRate,
    minimumLiquidityDenominator
  );
  if (denominator <= 0) return 0;
  return positionValue / denominator;
}

/**
 * TRADING_CONTINUITY_V2 - Trading continuity
 * Canonical: TradingContinuity = DaysWithValidTrades / ExpectedTradingDays
 * Result: clipped to 0-1
 */
export function tradingContinuity(
  daysWithValidTrades: number,
  expectedTradingDays: number
): number {
  if (expectedTradingDays <= 0) {
    throw new Error("ExpectedTradingDays must be positive");
  }
  return Math.min(1, Math.max(0, daysWithValidTrades / expectedTradingDays));
}

/**
 * COVERAGE_SHRINKAGE_V2 - Coverage and shrinkage to neutral
 * Canonical:
 *   Coverage = clip(AvailableMetricWeight / RequiredMetricWeight, 0, 1)
 *   AdjustedScore = NeutralScore + Coverage * (RawScore - NeutralScore)
 *   NeutralScore = 50
 */
export function coverageShrinkage(
  rawScore: number,
  availableMetricWeight: number,
  requiredMetricWeight: number,
  neutralScore: number = 50
): number {
  if (requiredMetricWeight <= 0) return neutralScore;
  const coverage = Math.min(1, Math.max(0, availableMetricWeight / requiredMetricWeight));
  const adjustedScore = neutralScore + coverage * (rawScore - neutralScore);
  return Math.min(100, Math.max(0, adjustedScore));
}

/**
 * FRESHNESS_FACTOR_V2 - Staleness decay
 * Canonical:
 *   ExcessAge = max(0, ActualAge - AllowedAge)
 *   FreshnessFactor = exp(-DecayRate * ExcessAge)
 */
export function freshnessFactor(
  actualAge: number,
  allowedAge: number,
  decayRate: number
): number {
  const excessAge = Math.max(0, actualAge - allowedAge);
  return Math.exp(-decayRate * excessAge);
}

// ============================================================================
// B. Scoring, Quality, Growth, Valuation, and Research Formulas
// ============================================================================

/**
 * CANDIDATE_SCORE_V2 - Candidate Score
 * Canonical:
 *   RawCandidateScore = sum(component_weight[j] * component_score[j]) / sum(component_weight[j])
 *   AdjustedCandidateScore = 50 + (RawCandidateScore - 50) * (DataConfidence / 100)
 *   FinalCandidateScore = clip(min(AdjustedCandidateScore, HardGateCap), 0, 100)
 */
export function candidateScore(
  componentScores: Record<string, number>,
  weights: Record<string, number>,
  dataConfidence: number,
  hardGateCap: number = 100
): number {
  const keys = Object.keys(componentScores);
  if (keys.length === 0) return 50;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const key of keys) {
    const score = componentScores[key] ?? 50;
    const weight = weights[key] ?? 0;
    weightedSum += weight * score;
    totalWeight += weight;
  }

  if (totalWeight <= 0) return 50;

  const rawScore = weightedSum / totalWeight;
  const adjustedScore = 50 + (rawScore - 50) * (dataConfidence / 100);
  const finalScore = Math.min(adjustedScore, hardGateCap);

  return Math.min(100, Math.max(0, finalScore));
}

/**
 * CFO_CONVERSION_V2 - CFO conversion
 * Canonical: CFOConversion = CFO / max(abs(NormalizedPAT), PATDenominatorFloor)
 */
export function cfoConversion(
  cfo: number,
  normalizedPAT: number,
  patDenominatorFloor: number = 1000000
): number {
  const denominator = Math.max(Math.abs(normalizedPAT), patDenominatorFloor);
  if (denominator <= 0) return 0;
  return cfo / denominator;
}

/**
 * FCF_CONVERSION_V2 - FCF conversion
 * Canonical:
 *   FreeCashFlow = CFO - MaintenanceCapex
 *   FCFConversion = FreeCashFlow / max(abs(NormalizedPAT), PATDenominatorFloor)
 */
export function fcfConversion(
  cfo: number,
  maintenanceCapex: number,
  normalizedPAT: number,
  patDenominatorFloor: number = 1000000
): number {
  const fcf = cfo - maintenanceCapex;
  const denominator = Math.max(Math.abs(normalizedPAT), patDenominatorFloor);
  if (denominator <= 0) return 0;
  return fcf / denominator;
}

/**
 * ACCRUAL_RATIO_V2 - Accrual ratio (earnings quality)
 * Canonical: AccrualRatio = (NormalizedPAT - CFO) / max(abs(AverageOperatingAssets), AssetFloor)
 */
export function accrualRatio(
  normalizedPAT: number,
  cfo: number,
  averageOperatingAssets: number,
  assetFloor: number = 1000000
): number {
  const denominator = Math.max(Math.abs(averageOperatingAssets), assetFloor);
  if (denominator <= 0) return 0;
  return (normalizedPAT - cfo) / denominator;
}

/**
 * PER_SHARE_CAGR_V2 - Per-share growth (CAGR)
 * Canonical:
 *   BeginningPerShare = BeginningMetric / BeginningDilutedShares
 *   EndingPerShare = EndingMetric / EndingDilutedShares
 *   PerShareCAGR = (EndingPerShare / BeginningPerShare)^(1 / Years) - 1
 */
export function perShareCAGR(
  beginningMetric: number,
  endingMetric: number,
  beginningDilutedShares: number,
  endingDilutedShares: number,
  years: number
): number {
  if (years <= 0) {
    throw new Error("Years must be greater than zero");
  }
  if (beginningDilutedShares <= 0 || endingDilutedShares <= 0) {
    throw new Error("Diluted shares must be positive");
  }

  const beginningPerShare = beginningMetric / beginningDilutedShares;
  const endingPerShare = endingMetric / endingDilutedShares;

  if (beginningPerShare <= 0) {
    return 0; // Cannot compute CAGR with negative/zero base
  }

  return Math.pow(endingPerShare / beginningPerShare, 1 / years) - 1;
}

/**
 * VALUE_QUALITY_ADJUSTMENT_V2 - Value-trap adjustment
 * Canonical:
 *   QualityFactor = 0.50 + 0.50 * (QualityScore / 100)
 *   AdjustedValueScore = ValueScore * QualityFactor
 */
export function valueQualityAdjustment(
  valueScore: number,
  qualityScore: number
): number {
  const qualityFactor = 0.5 + 0.5 * (qualityScore / 100);
  return valueScore * qualityFactor;
}

/**
 * ROIIC_V2 - Return on incremental invested capital
 * Canonical: ROIIC = ChangeInNOPAT / max(abs(ChangeInInvestedCapital), CapitalChangeFloor)
 */
export function roiic(
  changeInNOPAT: number,
  changeInInvestedCapital: number,
  capitalChangeFloor: number = 1000000
): number {
  const denominator = Math.max(Math.abs(changeInInvestedCapital), capitalChangeFloor);
  if (denominator <= 0) return 0;
  return changeInNOPAT / denominator;
}

/**
 * COMPOSITE_RANK_V2 - Composite rank
 * Canonical: CompositeRankScore = 0.50 * OverallPercentile + 0.25 * SectorPercentile + 0.15 * SizePercentile + 0.10 * RankPersistenceScore
 */
export function compositeRank(
  overallPercentile: number,
  sectorPercentile: number,
  sizePercentile: number,
  rankPersistenceScore: number
): number {
  return (
    0.5 * overallPercentile +
    0.25 * sectorPercentile +
    0.15 * sizePercentile +
    0.1 * rankPersistenceScore
  );
}

/**
 * PROMOTION_SCORE_V2 - Deep-research promotion score
 * Canonical: PromotionScore = 0.45 * CandidateScore + 0.15 * SectorPercentile + 0.10 * DataConfidence + 0.10 * RankPersistence + 0.10 * LiquidityScore + 0.05 * EventPriority + 0.05 * PortfolioPriority
 */
export function promotionScore(
  candidateScore: number,
  sectorPercentile: number,
  dataConfidence: number,
  rankPersistence: number,
  liquidityScore: number,
  eventPriority: number,
  portfolioPriority: number
): number {
  return (
    0.45 * candidateScore +
    0.15 * sectorPercentile +
    0.1 * dataConfidence +
    0.1 * rankPersistence +
    0.1 * liquidityScore +
    0.05 * eventPriority +
    0.05 * portfolioPriority
  );
}

/**
 * RESEARCH_SCORE_V2 - Deep Research Score
 * Canonical:
 *   RawResearchScore = sum(weight[j] * component_score[j]) / sum(weight[j])
 *   AdjustedResearchScore = 50 + (RawResearchScore - 50) * (ResearchConfidence / 100)
 */
export function researchScore(
  componentScores: Record<string, number>,
  weights: Record<string, number>,
  researchConfidence: number
): number {
  const keys = Object.keys(componentScores);
  if (keys.length === 0) return 50;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const key of keys) {
    const score = componentScores[key] ?? 50;
    const weight = weights[key] ?? 0;
    weightedSum += weight * score;
    totalWeight += weight;
  }

  if (totalWeight <= 0) return 50;

  const rawScore = weightedSum / totalWeight;
  const adjustedScore = 50 + (rawScore - 50) * (researchConfidence / 100);

  return Math.min(100, Math.max(0, adjustedScore));
}

// ============================================================================
// C. Valuation Scenarios and Multi-Horizon Signals
// ============================================================================

/**
 * WEIGHTED_FAIR_VALUE_V2 - Probability-weighted fair value
 * Canonical:
 *   WeightedFairValue = sum(ScenarioProbability[s] * ScenarioFairValue[s])
 *   sum(ScenarioProbability[s]) = 1.0
 */
export function weightedFairValue(
  scenarios: Array<{ probability: number; fairValue: number }>
): number {
  let totalProbability = 0;
  let weightedValue = 0;

  for (const scenario of scenarios) {
    if (scenario.probability < 0) {
      throw new Error("Scenario probabilities must be non-negative");
    }
    totalProbability += scenario.probability;
    weightedValue += scenario.probability * scenario.fairValue;
  }

  const tolerance = 0.01;
  if (Math.abs(totalProbability - 1.0) > tolerance) {
    throw new Error(
      `Scenario probabilities must sum to 1.0, got ${totalProbability}`
    );
  }

  return weightedValue;
}

/**
 * EXPECTED_ANNUAL_RETURN_V2 - Expected annualized return
 * Canonical:
 *   ExpectedValueAtHorizon = WeightedFairValue + ExpectedDividends
 *   ExpectedAnnualizedReturn = (ExpectedValueAtHorizon / CurrentPrice)^(1 / HorizonYears) - 1
 */
export function expectedAnnualReturn(
  weightedFairValue: number,
  expectedDividends: number,
  currentPrice: number,
  horizonYears: number
): number {
  if (currentPrice <= 0) {
    throw new Error("CurrentPrice must be positive");
  }
  if (horizonYears <= 0) {
    throw new Error("HorizonYears must be positive");
  }

  const expectedValueAtHorizon = weightedFairValue + expectedDividends;
  return Math.pow(expectedValueAtHorizon / currentPrice, 1 / horizonYears) - 1;
}

/**
 * HORIZON_SCORE_V2 - Raw Horizon Signal Score
 * Canonical: RawHorizonScore = sum(HorizonWeight[k] * ComponentScore[k]) / sum(HorizonWeight[k])
 */
export function horizonScore(
  componentScores: Record<string, number>,
  horizonWeights: Record<string, number>
): number {
  const keys = Object.keys(componentScores);
  if (keys.length === 0) return 50;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const key of keys) {
    const score = componentScores[key] ?? 50;
    const weight = horizonWeights[key] ?? 0;
    weightedSum += weight * score;
    totalWeight += weight;
  }

  if (totalWeight <= 0) return 50;

  return Math.min(100, Math.max(0, weightedSum / totalWeight));
}

/**
 * SIGNAL_CONFIDENCE_V2 - Signal confidence (geometric mean)
 * Canonical:
 *   ConfidenceProduct = product(ConfidenceComponent[j] / 100)
 *   SignalConfidence = 100 * ConfidenceProduct^(1 / NumberOfComponents)
 */
export function signalConfidence(
  confidenceComponents: number[]
): number {
  if (confidenceComponents.length === 0) return 50;

  // Clip all components to 0-100
  const clipped = confidenceComponents.map((c) =>
    Math.min(100, Math.max(0, c))
  );

  // If any component is zero, the geometric mean collapses to zero
  if (clipped.some((c) => c === 0)) {
    return 0;
  }

  // Compute geometric mean
  const product = clipped.reduce((acc, c) => acc * (c / 100), 1);
  const geometricMean = Math.pow(product, 1 / clipped.length);

  return Math.min(100, Math.max(0, 100 * geometricMean));
}

/**
 * FINAL_HSS_V2 - Final horizon score
 * Canonical:
 *   ConfidenceAdjustedHSS = 50 + (RawHorizonScore - 50) * (SignalConfidence / 100)
 *   PenalizedHSS = ConfidenceAdjustedHSS - StalePenalty - EventPenalty - RiskPenalty
 *   FinalHSS = clip(min(PenalizedHSS, HardGateCap), 0, 100)
 */
export function finalHSS(
  rawHorizonScore: number,
  signalConfidence: number,
  stalePenalty: number = 0,
  eventPenalty: number = 0,
  riskPenalty: number = 0,
  hardGateCap: number = 100
): number {
  const confidenceAdjustedHSS =
    50 + (rawHorizonScore - 50) * (signalConfidence / 100);
  const penalizedHSS =
    confidenceAdjustedHSS - stalePenalty - eventPenalty - riskPenalty;
  const finalScore = Math.min(penalizedHSS, hardGateCap);

  return Math.min(100, Math.max(0, finalScore));
}

/**
 * ALIGNMENT_SCORE_V2 - Cross-horizon alignment
 * Canonical: AlignmentScore = sum(HorizonImportance[h] * DirectionValue[h]) / sum(HorizonImportance[h])
 * DirectionValue: +1.00 Strong Buy, +0.50 Buy, 0.00 Hold, -0.50 Sell, -1.00 Avoid
 */
export function alignmentScore(
  horizonDirections: Record<string, number>,
  horizonImportances: Record<string, number>
): number {
  const horizons = Object.keys(horizonDirections);
  if (horizons.length === 0) return 0;

  let weightedSum = 0;
  let totalImportance = 0;

  for (const horizon of horizons) {
    const direction = horizonDirections[horizon] ?? 0;
    const importance = horizonImportances[horizon] ?? 0;
    weightedSum += importance * direction;
    totalImportance += importance;
  }

  if (totalImportance <= 0) return 0;

  return weightedSum / totalImportance;
}

// ============================================================================
// D. Portfolio Suitability, Position Sizing, and Execution Identity
// ============================================================================

/**
 * POSITION_SUITABILITY_V2 - Portfolio suitability
 * Comprehensive formula with multiple penalty factors
 */
export function positionSuitability(
  expectedAnnualizedReturn: number,
  requiredReturn: number,
  researchConfidence: number,
  liquidityScore: number,
  severeDownsidePct: number,
  downSideReferencePct: number,
  annualizedVolatilityPct: number,
  volatilityReferencePct: number,
  averagePortfolioCorrelation: number,
  correlationLimit: number,
  eventRiskScore: number,
  positiveReturnReference: number = 15
): number {
  // Return score
  const expectedExcessReturn = expectedAnnualizedReturn - requiredReturn;
  const returnScore = Math.min(
    1,
    Math.max(0, expectedExcessReturn / positiveReturnReference)
  );

  // Confidence and liquidity factors
  const confidenceFactor = researchConfidence / 100;
  const liquidityFactor = liquidityScore / 100;

  // Penalty factors
  const downSidePenalty =
    1 + Math.abs(severeDownsidePct) / downSideReferencePct;
  const volatilityPenalty =
    1 + annualizedVolatilityPct / volatilityReferencePct;
  const correlationExcess = Math.max(
    0,
    averagePortfolioCorrelation - correlationLimit
  );
  const correlationPenalty = 1 + correlationExcess;
  const eventPenalty = 1 + eventRiskScore / 100;

  // Raw suitability
  const rawSuitability =
    (100 * returnScore * confidenceFactor * liquidityFactor) /
    (downSidePenalty * volatilityPenalty * correlationPenalty * eventPenalty);

  return Math.min(100, Math.max(0, rawSuitability));
}

/**
 * POSITION_SIZING_V2 - Risk- and capacity-constrained quantity
 * Returns detailed breakdown of constraints and final quantity
 */
export interface PositionSizingResult {
  finalQuantity: number;
  quantityByRisk: number;
  quantityByLiquidity: number;
  quantityByCompanyCap: number;
  quantityBySectorCap: number;
  quantityByHorizonCap: number;
  quantityByEventCap: number;
  bindingConstraint: string;
  riskAmount: number;
  estimatedExitDays: number;
}

export function positionSizing(
  entryPrice: number,
  stopPrice: number,
  portfolioCapital: number,
  riskPercent: number,
  medianDailyTradedValue: number,
  allowedParticipationRate: number,
  maxExitDays: number,
  maxCompanyWeight: number,
  maxSectorWeight: number,
  maxHorizonWeight: number,
  maxEventWeight: number,
  estimatedRoundTripCostPerUnit: number = 0,
  minimumPriceRisk: number = 0
): PositionSizingResult {
  // Risk-based quantity
  const riskBudget = portfolioCapital * (riskPercent / 100);
  const perUnitRisk =
    Math.abs(entryPrice - stopPrice) + estimatedRoundTripCostPerUnit;
  const effectiveRisk = Math.max(perUnitRisk, minimumPriceRisk);
  const quantityByRisk = Math.floor(riskBudget / Math.max(effectiveRisk, 0.01));

  // Liquidity-based quantity
  const liquidityCapacityValue =
    medianDailyTradedValue * allowedParticipationRate * maxExitDays;
  const quantityByLiquidity = Math.floor(
    liquidityCapacityValue / Math.max(entryPrice, 0.01)
  );

  // Company cap-based quantity
  const quantityByCompanyCap = Math.floor(
    (portfolioCapital * maxCompanyWeight) / Math.max(entryPrice, 0.01)
  );

  // Sector cap-based quantity
  const quantityBySectorCap = Math.floor(
    (portfolioCapital * maxSectorWeight) / Math.max(entryPrice, 0.01)
  );

  // Horizon cap-based quantity
  const quantityByHorizonCap = Math.floor(
    (portfolioCapital * maxHorizonWeight) / Math.max(entryPrice, 0.01)
  );

  // Event cap-based quantity
  const quantityByEventCap = Math.floor(
    (portfolioCapital * maxEventWeight) / Math.max(entryPrice, 0.01)
  );

  // Final quantity is the minimum of all constraints
  const finalQuantity = Math.max(
    0,
    Math.min(
      quantityByRisk,
      quantityByLiquidity,
      quantityByCompanyCap,
      quantityBySectorCap,
      quantityByHorizonCap,
      quantityByEventCap
    )
  );

  // Determine binding constraint
  const constraints = [
    { name: "risk", value: quantityByRisk },
    { name: "liquidity", value: quantityByLiquidity },
    { name: "company_cap", value: quantityByCompanyCap },
    { name: "sector_cap", value: quantityBySectorCap },
    { name: "horizon_cap", value: quantityByHorizonCap },
    { name: "event_cap", value: quantityByEventCap },
  ];

  const bindingConstraint = constraints.reduce((min, c) =>
    c.value < min.value ? c : min
  );

  // Estimated exit days
  const estimatedExitDays =
    finalQuantity > 0 && medianDailyTradedValue > 0
      ? (finalQuantity * entryPrice) /
        (medianDailyTradedValue * allowedParticipationRate)
      : 0;

  return {
    finalQuantity,
    quantityByRisk,
    quantityByLiquidity,
    quantityByCompanyCap,
    quantityBySectorCap,
    quantityByHorizonCap,
    quantityByEventCap,
    bindingConstraint: bindingConstraint.name,
    riskAmount: finalQuantity * effectiveRisk,
    estimatedExitDays,
  };
}

/**
 * IDEMPOTENCY_KEY_V1 - Duplicate-order protection key
 * Canonical: IdempotencyKey = security_id + horizon + signal_id + action + trade_date
 */
export function idempotencyKey(
  securityId: string,
  horizon: string,
  signalId: string,
  action: string,
  tradeDate: string
): string {
  const delimiter = "|";
  const key = [securityId, horizon, signalId, action, tradeDate].join(
    delimiter
  );
  // Use simple hash for consistency (can be enhanced with crypto module if needed)
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36) + "|" + key;
}

// ============================================================================
// Helper Functions and Utilities
// ============================================================================

/**
 * Map HSS (Horizon Signal Score) to signal state
 * DirectionValue: +1.00 Strong Buy, +0.50 Buy, 0.00 Hold, -0.50 Sell, -1.00 Avoid
 */
export function hssToSignalState(
  hss: number
): "strong_buy" | "buy" | "hold" | "sell" | "avoid" {
  if (hss >= 75) return "strong_buy";
  if (hss >= 58) return "buy";
  if (hss >= 42) return "hold";
  if (hss >= 28) return "sell";
  return "avoid";
}

/**
 * Map signal state to direction value
 */
export function signalStateToDirectionValue(
  state: string
): number {
  switch (state.toLowerCase()) {
    case "strong_buy":
      return 1.0;
    case "buy":
      return 0.5;
    case "hold":
      return 0.0;
    case "sell":
      return -0.5;
    case "avoid":
      return -1.0;
    default:
      return 0.0;
  }
}

/**
 * Clip value to range [min, max]
 */
export function clip(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default {
  // Data Quality
  relativeDifference,
  dataConfidence,
  requiredMedianADV,
  exitDays,
  tradingContinuity,
  coverageShrinkage,
  freshnessFactor,

  // Scoring
  candidateScore,
  cfoConversion,
  fcfConversion,
  accrualRatio,
  perShareCAGR,
  valueQualityAdjustment,
  roiic,
  compositeRank,
  promotionScore,
  researchScore,

  // Valuation & Signals
  weightedFairValue,
  expectedAnnualReturn,
  horizonScore,
  signalConfidence,
  finalHSS,
  alignmentScore,

  // Portfolio Management
  positionSuitability,
  positionSizing,
  idempotencyKey,

  // Utilities
  hssToSignalState,
  signalStateToDirectionValue,
  clip,
};
