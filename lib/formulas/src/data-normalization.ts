/**
 * Data Normalization Engine
 * Handles financial statement reconciliation, unit conversion, scope separation,
 * and point-in-time data management as per Section 20-32 of the 7.1.2 specification.
 */

export enum ReconciliationState {
  MATCHED = "MATCHED",
  MATCHED_WITH_TOLERANCE = "MATCHED_WITH_TOLERANCE",
  SOURCE_DELAY = "SOURCE_DELAY",
  SCOPE_DIFFERENCE = "SCOPE_DIFFERENCE",
  UNIT_DIFFERENCE = "UNIT_DIFFERENCE",
  REVISION_DIFFERENCE = "REVISION_DIFFERENCE",
  CORPORATE_ACTION_DIFFERENCE = "CORPORATE_ACTION_DIFFERENCE",
  TIMESTAMP_DIFFERENCE = "TIMESTAMP_DIFFERENCE",
  MATERIAL_CONFLICT = "MATERIAL_CONFLICT",
  MISSING_PRIMARY = "MISSING_PRIMARY",
  QUARANTINED = "QUARANTINED",
  MANUAL_REVIEW = "MANUAL_REVIEW",
}

export enum FinancialUnit {
  RUPEES = "RUPEES",
  THOUSANDS = "THOUSANDS",
  LAKHS = "LAKHS",
  MILLIONS = "MILLIONS",
  CRORES = "CRORES",
}

export enum FinancialScope {
  STANDALONE = "STANDALONE",
  CONSOLIDATED = "CONSOLIDATED",
}

export interface FinancialFact {
  company_id: string;
  metric_name: string;
  period_end: Date;
  filing_date: Date;
  scope: FinancialScope;
  reported_value: number;
  reported_unit: FinancialUnit;
  normalized_value: number;
  normalized_unit: FinancialUnit;
  source_id: string;
  source_grade: "A" | "B" | "C" | "D" | "E";
  document_hash: string;
  valid_from: Date;
  valid_to: Date | null;
  revision_of_record_id: string | null;
}

export interface ReconciliationResult {
  state: ReconciliationState;
  source1_value: number;
  source2_value: number;
  relative_difference: number;
  tolerance_threshold: number;
  passed: boolean;
  notes: string;
}

export interface NormalizedEarnings {
  reported_value: number;
  adjustments: EarningsAdjustment[];
  normalized_value: number;
}

export interface EarningsAdjustment {
  type: string;
  amount: number;
  reason: string;
  source: string;
  confidence: number;
}

/**
 * Relative Difference Formula (RELATIVE_DIFFERENCE_V2)
 * RelativeDifference = abs(x1 - x2) / max(abs(x1), abs(x2), epsilon)
 */
export function relativeDifference(
  x1: number,
  x2: number,
  epsilon: number = 0.01
): number {
  const denominator = Math.max(Math.abs(x1), Math.abs(x2), epsilon);
  if (denominator === 0) return 0;
  return Math.abs(x1 - x2) / denominator;
}

/**
 * Unit Conversion Engine
 * Converts financial values between different Indian rupee units
 */
export function convertUnit(
  value: number,
  fromUnit: FinancialUnit,
  toUnit: FinancialUnit
): number {
  if (fromUnit === toUnit) return value;

  const unitMultipliers: Record<FinancialUnit, number> = {
    [FinancialUnit.RUPEES]: 1,
    [FinancialUnit.THOUSANDS]: 1_000,
    [FinancialUnit.LAKHS]: 100_000,
    [FinancialUnit.MILLIONS]: 1_000_000,
    [FinancialUnit.CRORES]: 10_000_000,
  };

  const fromMultiplier = unitMultipliers[fromUnit];
  const toMultiplier = unitMultipliers[toUnit];

  return (value * fromMultiplier) / toMultiplier;
}

/**
 * Balance Sheet Reconciliation
 * BalanceSheetDifference = Assets - (Liabilities + Equity)
 */
export function reconcileBalanceSheet(
  assets: number,
  liabilities: number,
  equity: number,
  tolerance: number = 0.01
): ReconciliationResult {
  const difference = assets - (liabilities + equity);
  const relativeDiff = relativeDifference(
    assets,
    liabilities + equity,
    tolerance
  );

  return {
    state:
      Math.abs(difference) <= tolerance * assets
        ? ReconciliationState.MATCHED
        : ReconciliationState.MATERIAL_CONFLICT,
    source1_value: assets,
    source2_value: liabilities + equity,
    relative_difference: relativeDiff,
    tolerance_threshold: tolerance,
    passed: Math.abs(difference) <= tolerance * assets,
    notes: `Balance sheet difference: ${difference}. Relative difference: ${(relativeDiff * 100).toFixed(2)}%`,
  };
}

/**
 * Cash Flow Reconciliation
 * ExpectedClosingCash = OpeningCash + NetCashFlow
 */
export function reconcileCashFlow(
  openingCash: number,
  netCashFlow: number,
  reportedClosingCash: number,
  tolerance: number = 0.02
): ReconciliationResult {
  const expectedClosingCash = openingCash + netCashFlow;
  const difference = reportedClosingCash - expectedClosingCash;
  const relativeDiff = relativeDifference(
    reportedClosingCash,
    expectedClosingCash,
    tolerance
  );

  return {
    state:
      Math.abs(difference) <= tolerance * Math.abs(openingCash)
        ? ReconciliationState.MATCHED_WITH_TOLERANCE
        : ReconciliationState.MATERIAL_CONFLICT,
    source1_value: reportedClosingCash,
    source2_value: expectedClosingCash,
    relative_difference: relativeDiff,
    tolerance_threshold: tolerance,
    passed: Math.abs(difference) <= tolerance * Math.abs(openingCash),
    notes: `Cash flow difference: ${difference}. Expected: ${expectedClosingCash}, Reported: ${reportedClosingCash}`,
  };
}

/**
 * EPS Reconciliation
 * Validates EPS calculation: EPS = PAT / DilutedShares
 */
export function reconcileEPS(
  pat: number,
  dilutedShares: number,
  reportedEPS: number,
  tolerance: number = 0.01
): ReconciliationResult {
  if (dilutedShares <= 0) {
    return {
      state: ReconciliationState.QUARANTINED,
      source1_value: reportedEPS,
      source2_value: 0,
      relative_difference: 1,
      tolerance_threshold: tolerance,
      passed: false,
      notes: "Invalid diluted shares count",
    };
  }

  const calculatedEPS = pat / dilutedShares;
  const relativeDiff = relativeDifference(reportedEPS, calculatedEPS, 0.01);

  return {
    state:
      relativeDiff <= tolerance
        ? ReconciliationState.MATCHED
        : ReconciliationState.MATERIAL_CONFLICT,
    source1_value: reportedEPS,
    source2_value: calculatedEPS,
    relative_difference: relativeDiff,
    tolerance_threshold: tolerance,
    passed: relativeDiff <= tolerance,
    notes: `EPS reconciliation: Reported=${reportedEPS}, Calculated=${calculatedEPS.toFixed(2)}`,
  };
}

/**
 * Normalized Earnings Adjustment
 * Maintains reported value, adjustments, and normalized value
 */
export function calculateNormalizedEarnings(
  reportedPAT: number,
  adjustments: EarningsAdjustment[]
): NormalizedEarnings {
  const totalAdjustments = adjustments.reduce((sum, adj) => sum + adj.amount, 0);
  const normalizedValue = reportedPAT + totalAdjustments;

  return {
    reported_value: reportedPAT,
    adjustments,
    normalized_value: normalizedValue,
  };
}

/**
 * Common Earnings Adjustments
 */
export const EARNINGS_ADJUSTMENT_TYPES = {
  EXCEPTIONAL_GAIN: "EXCEPTIONAL_GAIN",
  ASSET_SALE: "ASSET_SALE",
  ONE_TIME_TAX: "ONE_TIME_TAX",
  IMPAIRMENT: "IMPAIRMENT",
  ACQUISITION_CHARGE: "ACQUISITION_CHARGE",
  DISCONTINUED_OPERATION: "DISCONTINUED_OPERATION",
  FX_EFFECT: "FX_EFFECT",
  REVALUATION: "REVALUATION",
  STOCK_COMPENSATION: "STOCK_COMPENSATION",
  CAPITALIZED_EXPENSE: "CAPITALIZED_EXPENSE",
  LEASE_ADJUSTMENT: "LEASE_ADJUSTMENT",
  MINORITY_INTEREST: "MINORITY_INTEREST",
  ASSOCIATE_INCOME: "ASSOCIATE_INCOME",
  ONE_TIME_PROVISION: "ONE_TIME_PROVISION",
  RESTRUCTURING_COST: "RESTRUCTURING_COST",
};

/**
 * Corporate Action Adjustment
 * Adjusts historical prices and share counts for corporate actions
 */
export interface CorporateAction {
  type:
    | "DIVIDEND"
    | "SPLIT"
    | "BONUS"
    | "RIGHTS"
    | "BUYBACK"
    | "MERGER"
    | "DEMERGER";
  ratio: number;
  exDate: Date;
  recordDate: Date;
}

export function adjustForCorporateAction(
  historicalPrice: number,
  historicalShares: number,
  action: CorporateAction
): { adjustedPrice: number; adjustedShares: number } {
  let adjustedPrice = historicalPrice;
  let adjustedShares = historicalShares;

  switch (action.type) {
    case "SPLIT":
      adjustedPrice = historicalPrice / action.ratio;
      adjustedShares = historicalShares * action.ratio;
      break;
    case "BONUS":
      adjustedPrice = historicalPrice / (1 + action.ratio);
      adjustedShares = historicalShares * (1 + action.ratio);
      break;
    case "DIVIDEND":
      // Dividend adjustments are typically made to price
      adjustedPrice = historicalPrice - action.ratio;
      break;
    case "RIGHTS":
      adjustedPrice =
        (historicalPrice * historicalShares + action.ratio * 0) /
        (historicalShares + action.ratio);
      adjustedShares = historicalShares + action.ratio;
      break;
  }

  return { adjustedPrice, adjustedShares };
}

/**
 * Data Confidence Component Scoring
 * Evaluates quality of financial data based on source, timeliness, and completeness
 */
export interface DataConfidenceComponent {
  name: string;
  score: number; // 0-100
  weight: number;
}

export function calculateDataConfidence(
  components: DataConfidenceComponent[]
): number {
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return 50;

  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);
  const confidence = weightedSum / totalWeight;

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Coverage Shrinkage Formula (COVERAGE_SHRINKAGE_V2)
 * Shrinks scores toward neutral when data is incomplete
 */
export function applyCoverageShrinkage(
  rawScore: number,
  availableMetricWeight: number,
  requiredMetricWeight: number,
  neutralScore: number = 50
): number {
  if (requiredMetricWeight <= 0) return neutralScore;

  const coverage = Math.max(0, Math.min(1, availableMetricWeight / requiredMetricWeight));
  const adjustedScore = neutralScore + coverage * (rawScore - neutralScore);

  return Math.max(0, Math.min(100, adjustedScore));
}

/**
 * Staleness Decay Formula (FRESHNESS_FACTOR_V2)
 * Applies exponential decay to stale data
 */
export function calculateFreshnessFactor(
  actualAgeInDays: number,
  allowedAgeInDays: number,
  decayRate: number = 0.1
): number {
  const excessAge = Math.max(0, actualAgeInDays - allowedAgeInDays);
  const freshnessFactor = Math.exp(-decayRate * excessAge);
  return Math.max(0, Math.min(1, freshnessFactor));
}

/**
 * Missing Data Treatment Classification
 */
export enum DataCompleteness {
  FULL = "FULL", // 90-100%
  ACCEPTABLE = "ACCEPTABLE", // 80-89.99%
  RESTRICTED = "RESTRICTED", // 70-79.99%
  LIMITED = "LIMITED", // 50-69.99%
  INSUFFICIENT = "INSUFFICIENT", // Below 50%
}

export function classifyDataCompleteness(
  coverage: number
): DataCompleteness {
  if (coverage >= 0.9) return DataCompleteness.FULL;
  if (coverage >= 0.8) return DataCompleteness.ACCEPTABLE;
  if (coverage >= 0.7) return DataCompleteness.RESTRICTED;
  if (coverage >= 0.5) return DataCompleteness.LIMITED;
  return DataCompleteness.INSUFFICIENT;
}
