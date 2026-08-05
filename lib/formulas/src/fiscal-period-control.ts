/**
 * Fiscal Period Control Engine
 * Handles TTM calculations, fiscal period validation, and overlapping period detection
 * as per Section 29-30 of the 7.1.2 specification.
 */

export enum FiscalYearEnd {
  MARCH = "MARCH",
  DECEMBER = "DECEMBER",
}

export interface FiscalPeriod {
  period_id: string;
  company_id: string;
  period_start: Date;
  period_end: Date;
  fiscal_year_end: FiscalYearEnd;
  period_type: "Q1" | "Q2" | "Q3" | "Q4" | "FY" | "STUB" | "EXTENDED";
  is_restated: boolean;
  is_duplicate: boolean;
  scope: "STANDALONE" | "CONSOLIDATED";
  unit: "RUPEES" | "THOUSANDS" | "LAKHS" | "MILLIONS" | "CRORES";
}

export interface TTMCalculationResult {
  ttm_value: number;
  quarters_used: FiscalPeriod[];
  is_valid: boolean;
  validation_errors: string[];
  calculation_date: Date;
}

export interface PeriodReconciliationResult {
  has_overlap: boolean;
  has_duplicate: boolean;
  has_scope_mismatch: boolean;
  has_unit_mismatch: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * TTM (Trailing Twelve Months) Calculation
 * TTM = quarter_t + quarter_t_minus_1 + quarter_t_minus_2 + quarter_t_minus_3
 *
 * Preconditions:
 * - Same scope (STANDALONE or CONSOLIDATED)
 * - Same unit
 * - No overlap
 * - No duplicate transition quarter
 * - Comparable accounting policies
 */
export function calculateTTM(
  quarters: FiscalPeriod[],
  values: number[],
  referenceDate: Date = new Date()
): TTMCalculationResult {
  const errors: string[] = [];

  // Validate input arrays match
  if (quarters.length !== values.length) {
    errors.push("Quarters and values arrays must have same length");
    return {
      ttm_value: 0,
      quarters_used: [],
      is_valid: false,
      validation_errors: errors,
      calculation_date: referenceDate,
    };
  }

  // Need exactly 4 quarters
  if (quarters.length < 4) {
    errors.push(
      `Insufficient quarters for TTM: ${quarters.length} provided, 4 required`
    );
    return {
      ttm_value: 0,
      quarters_used: [],
      is_valid: false,
      validation_errors: errors,
      calculation_date: referenceDate,
    };
  }

  // Sort quarters by end date (most recent first)
  const sortedQuarters = quarters
    .map((q, idx) => ({ quarter: q, value: values[idx], index: idx }))
    .sort((a, b) => b.quarter.period_end.getTime() - a.quarter.period_end.getTime());

  // Select the 4 most recent quarters
  const selectedQuarters = sortedQuarters.slice(0, 4);
  const selectedValues = selectedQuarters.map((sq) => sq.value);

  // Validate scope consistency
  const scopes = new Set(selectedQuarters.map((sq) => sq.quarter.scope));
  if (scopes.size > 1) {
    errors.push("All quarters must have the same scope (STANDALONE or CONSOLIDATED)");
  }

  // Validate unit consistency
  const units = new Set(selectedQuarters.map((sq) => sq.quarter.unit));
  if (units.size > 1) {
    errors.push("All quarters must have the same unit");
  }

  // Check for overlaps
  const overlaps = checkPeriodOverlaps(selectedQuarters.map((sq) => sq.quarter));
  if (overlaps.length > 0) {
    errors.push(`Period overlaps detected: ${overlaps.join(", ")}`);
  }

  // Check for duplicate transition quarters
  const duplicates = checkDuplicateTransitionQuarters(
    selectedQuarters.map((sq) => sq.quarter)
  );
  if (duplicates.length > 0) {
    errors.push(`Duplicate transition quarters: ${duplicates.join(", ")}`);
  }

  // Check for restated periods (warning, not error)
  const restatedCount = selectedQuarters.filter((sq) => sq.quarter.is_restated).length;
  if (restatedCount > 0) {
    errors.push(
      `Warning: ${restatedCount} of 4 quarters are restated; TTM may not be comparable`
    );
  }

  const isValid = errors.length === 0;
  const ttmValue = isValid ? selectedValues.reduce((sum, v) => sum + v, 0) : 0;

  return {
    ttm_value: ttmValue,
    quarters_used: selectedQuarters.map((sq) => sq.quarter),
    is_valid: isValid,
    validation_errors: errors,
    calculation_date: referenceDate,
  };
}

/**
 * Check for overlapping periods
 */
export function checkPeriodOverlaps(periods: FiscalPeriod[]): string[] {
  const overlaps: string[] = [];

  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const p1 = periods[i];
      const p2 = periods[j];

      // Check if periods overlap
      const p1Start = p1.period_start.getTime();
      const p1End = p1.period_end.getTime();
      const p2Start = p2.period_start.getTime();
      const p2End = p2.period_end.getTime();

      const hasOverlap =
        (p1Start < p2End && p1End > p2Start) ||
        (p2Start < p1End && p2End > p1Start);

      if (hasOverlap) {
        overlaps.push(`${p1.period_id} overlaps with ${p2.period_id}`);
      }
    }
  }

  return overlaps;
}

/**
 * Check for duplicate transition quarters
 * A transition quarter is a quarter that appears in multiple fiscal years
 */
export function checkDuplicateTransitionQuarters(
  periods: FiscalPeriod[]
): string[] {
  const duplicates: string[] = [];
  const quarterMap = new Map<string, FiscalPeriod[]>();

  periods.forEach((period) => {
    const quarterKey = `${period.period_type}-${period.period_start.toISOString()}-${period.period_end.toISOString()}`;
    if (!quarterMap.has(quarterKey)) {
      quarterMap.set(quarterKey, []);
    }
    quarterMap.get(quarterKey)!.push(period);
  });

  quarterMap.forEach((periodList, key) => {
    if (periodList.length > 1) {
      duplicates.push(`${key} appears ${periodList.length} times`);
    }
  });

  return duplicates;
}

/**
 * Reconcile periods for consistency
 */
export function reconcilePeriods(
  periods: FiscalPeriod[]
): PeriodReconciliationResult {
  const result: PeriodReconciliationResult = {
    has_overlap: false,
    has_duplicate: false,
    has_scope_mismatch: false,
    has_unit_mismatch: false,
    errors: [],
    warnings: [],
  };

  // Check for overlaps
  const overlaps = checkPeriodOverlaps(periods);
  if (overlaps.length > 0) {
    result.has_overlap = true;
    result.errors.push(...overlaps);
  }

  // Check for duplicates
  const duplicates = checkDuplicateTransitionQuarters(periods);
  if (duplicates.length > 0) {
    result.has_duplicate = true;
    result.errors.push(...duplicates);
  }

  // Check for scope mismatch
  const scopes = new Set(periods.map((p) => p.scope));
  if (scopes.size > 1) {
    result.has_scope_mismatch = true;
    result.warnings.push(
      `Multiple scopes detected: ${Array.from(scopes).join(", ")}`
    );
  }

  // Check for unit mismatch
  const units = new Set(periods.map((p) => p.unit));
  if (units.size > 1) {
    result.has_unit_mismatch = true;
    result.warnings.push(`Multiple units detected: ${Array.from(units).join(", ")}`);
  }

  // Check for restated periods
  const restatedPeriods = periods.filter((p) => p.is_restated);
  if (restatedPeriods.length > 0) {
    result.warnings.push(
      `${restatedPeriods.length} restated periods detected; comparability may be affected`
    );
  }

  return result;
}

/**
 * Calculate fiscal year for a given date
 */
export function getFiscalYear(
  date: Date,
  fiscalYearEnd: FiscalYearEnd
): number {
  const month = date.getMonth() + 1; // 1-indexed
  const year = date.getFullYear();

  if (fiscalYearEnd === FiscalYearEnd.MARCH) {
    // FY Apr-Mar: Apr 2023 is FY2024
    return month >= 4 ? year + 1 : year;
  } else {
    // FY Jan-Dec: Jan 2023 is FY2023
    return year;
  }
}

/**
 * Get fiscal period boundaries
 */
export function getFiscalPeriodBoundaries(
  fiscalYear: number,
  quarter: 1 | 2 | 3 | 4,
  fiscalYearEnd: FiscalYearEnd
): { start: Date; end: Date } {
  let startMonth: number;
  let startYear: number;
  let endMonth: number;
  let endYear: number;

  if (fiscalYearEnd === FiscalYearEnd.MARCH) {
    // FY Apr-Mar
    startYear = fiscalYear - 1;
    startMonth = 3 + quarter * 3; // Q1: Jun, Q2: Sep, Q3: Dec, Q4: Mar
    if (startMonth > 12) {
      startYear += 1;
      startMonth -= 12;
    }
    endYear = startYear;
    endMonth = startMonth;
  } else {
    // FY Jan-Dec
    startYear = fiscalYear;
    startMonth = (quarter - 1) * 3 + 1; // Q1: Jan, Q2: Apr, Q3: Jul, Q4: Oct
    endYear = startYear;
    endMonth = startMonth + 2;
  }

  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth, 0); // Last day of month

  return { start, end };
}

/**
 * Validate fiscal period consistency
 */
export function validateFiscalPeriodConsistency(
  periods: FiscalPeriod[]
): { isConsistent: boolean; errors: string[] } {
  const errors: string[] = [];

  if (periods.length === 0) {
    return { isConsistent: true, errors: [] };
  }

  // All periods should have same fiscal year end
  const fiscalYearEnds = new Set(periods.map((p) => p.fiscal_year_end));
  if (fiscalYearEnds.size > 1) {
    errors.push(
      `Inconsistent fiscal year ends: ${Array.from(fiscalYearEnds).join(", ")}`
    );
  }

  // Check for gaps in quarterly data
  const sortedPeriods = [...periods].sort(
    (a, b) => a.period_end.getTime() - b.period_end.getTime()
  );

  for (let i = 1; i < sortedPeriods.length; i++) {
    const prev = sortedPeriods[i - 1];
    const curr = sortedPeriods[i];

    // Expected gap between quarters is approximately 90 days
    const daysBetween =
      (curr.period_start.getTime() - prev.period_end.getTime()) /
      (1000 * 60 * 60 * 24);

    if (daysBetween > 120 && daysBetween < 60) {
      errors.push(
        `Unexpected gap between ${prev.period_id} and ${curr.period_id}: ${daysBetween} days`
      );
    }
  }

  return {
    isConsistent: errors.length === 0,
    errors,
  };
}

/**
 * Detect and handle stub periods
 * A stub period is a partial fiscal period (e.g., 2 months instead of 3)
 */
export function isStubPeriod(period: FiscalPeriod): boolean {
  const durationInDays =
    (period.period_end.getTime() - period.period_start.getTime()) /
    (1000 * 60 * 60 * 24);

  // Normal quarter is ~90 days; stub is significantly different
  return durationInDays < 60 || durationInDays > 120;
}

/**
 * Annualize a quarterly metric
 */
export function annualizeQuarterlyMetric(
  quarterlyValue: number,
  numberOfQuarters: number = 1
): number {
  if (numberOfQuarters <= 0 || numberOfQuarters > 4) {
    throw new Error("numberOfQuarters must be between 1 and 4");
  }
  return quarterlyValue * (4 / numberOfQuarters);
}

/**
 * Calculate growth rate between two periods
 */
export function calculateGrowthRate(
  currentValue: number,
  previousValue: number,
  periods: number = 1
): number {
  if (previousValue === 0) {
    return currentValue > 0 ? 1 : -1; // Undefined growth
  }

  const cagr = Math.pow(currentValue / previousValue, 1 / periods) - 1;
  return cagr;
}

/**
 * CAGR Calculation
 * CAGR = (EndingValue / BeginningValue) ^ (1 / Years) - 1
 */
export function calculateCAGR(
  beginningValue: number,
  endingValue: number,
  years: number
): number | null {
  // Validation
  if (beginningValue <= 0 || endingValue < 0 || years <= 0) {
    return null; // Invalid CAGR
  }

  const cagr = Math.pow(endingValue / beginningValue, 1 / years) - 1;
  return cagr;
}

/**
 * Per-Share CAGR Calculation
 * Accounts for share dilution
 */
export function calculatePerShareCAGR(
  beginningMetric: number,
  beginningDilutedShares: number,
  endingMetric: number,
  endingDilutedShares: number,
  years: number
): number | null {
  if (
    beginningDilutedShares <= 0 ||
    endingDilutedShares <= 0 ||
    beginningMetric <= 0 ||
    endingMetric < 0 ||
    years <= 0
  ) {
    return null;
  }

  const beginningPerShare = beginningMetric / beginningDilutedShares;
  const endingPerShare = endingMetric / endingDilutedShares;

  if (beginningPerShare <= 0) {
    return null;
  }

  const cagr = Math.pow(endingPerShare / beginningPerShare, 1 / years) - 1;
  return cagr;
}
