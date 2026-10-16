import {
  accrualRatio,
  cfoConversion,
  expectedAnnualizedReturn,
  freshnessFactor,
  freeCashFlowConversion,
  relativeDifference,
  weightedFairValue,
  weightedMean,
} from "./formulas";
import {
  calculateCappedQuantity,
  canonicalBusinessActionKey,
  REQUIRED_QUANTITY_CAPS,
  actionableScoreV3,
} from "./safetyControls";

/**
 * Offline reference implementation of the 7.1.4 formula allowlist.
 * Dispatch is by exact ID to hand-written functions. Expression text is
 * descriptive metadata only and is never parsed or evaluated.
 */
export const FORMULA_REFERENCE_IDS = [
  "RELATIVE_DIFFERENCE_V2",
  "DATA_CONFIDENCE_V2",
  "REQUIRED_MEDIAN_ADV_V2",
  "EXIT_DAYS_V2",
  "TRADING_CONTINUITY_V2",
  "COVERAGE_SHRINKAGE_V2",
  "FRESHNESS_FACTOR_V2",
  "CANDIDATE_SCORE_V3",
  "CFO_CONVERSION_V2",
  "FCF_CONVERSION_V2",
  "ACCRUAL_RATIO_V2",
  "PER_SHARE_CAGR_V2",
  "VALUE_QUALITY_ADJUSTMENT_V2",
  "ROIIC_V2",
  "COMPOSITE_RANK_V2",
  "PROMOTION_SCORE_V2",
  "RESEARCH_SCORE_V3",
  "WEIGHTED_FAIR_VALUE_V2",
  "EXPECTED_ANNUAL_RETURN_V2",
  "HORIZON_SCORE_V2",
  "SIGNAL_CONFIDENCE_V3",
  "FINAL_HSS_V3",
  "ALIGNMENT_SCORE_V2",
  "POSITION_SUITABILITY_V2",
  "POSITION_SIZING_V4",
  "ORDER_INTENT_IDEMPOTENCY_V4",
] as const;

export type FormulaReferenceId = (typeof FORMULA_REFERENCE_IDS)[number];
export type FormulaReferenceResult = number | string | null;
type InputMap = Record<string, unknown>;

export class FormulaReferenceError extends Error {
  constructor(
    readonly code: "INVALID_INPUT" | "MISSING_ARGUMENT" | "UNSUPPORTED_FORMULA",
    message: string,
  ) {
    super(message);
    this.name = "FormulaReferenceError";
  }
}

function inputMap(value: unknown): InputMap {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new FormulaReferenceError("INVALID_INPUT", "Formula arguments must be a named object.");
  }
  return value as InputMap;
}

function requireFields(args: InputMap, fields: readonly string[]): void {
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(args, field) || args[field] == null) {
      throw new FormulaReferenceError("MISSING_ARGUMENT", `Missing required formula argument: ${field}.`);
    }
  }
}

function numberArg(
  args: InputMap,
  field: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number {
  const value = args[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new FormulaReferenceError("INVALID_INPUT", `${field} must be a finite number.`);
  }
  if (options.integer && !Number.isSafeInteger(value)) {
    throw new FormulaReferenceError("INVALID_INPUT", `${field} must be a safe integer.`);
  }
  if (options.min !== undefined && value < options.min) {
    throw new FormulaReferenceError("INVALID_INPUT", `${field} must be at least ${options.min}.`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new FormulaReferenceError("INVALID_INPUT", `${field} must be at most ${options.max}.`);
  }
  return value;
}

function booleanArg(args: InputMap, field: string): boolean {
  if (typeof args[field] !== "boolean") {
    throw new FormulaReferenceError("INVALID_INPUT", `${field} must be an exact boolean.`);
  }
  return args[field] as boolean;
}

function recordArg(args: InputMap, field: string): InputMap {
  return inputMap(args[field]);
}

function arrayArg(args: InputMap, field: string): unknown[] {
  if (!Array.isArray(args[field]) || (args[field] as unknown[]).length === 0) {
    throw new FormulaReferenceError("INVALID_INPUT", `${field} must be a non-empty array.`);
  }
  return args[field] as unknown[];
}

function weightedComponents(args: InputMap, field: string) {
  return arrayArg(args, field).map((item, index) => {
    const component = inputMap(item);
    requireFields(component, ["score", "weight"]);
    return {
      value: numberArg(component, "score", { min: 0, max: 100 }),
      weight: numberArg(component, "weight", { min: 0 }),
      name: typeof component.name === "string" ? component.name : `component_${index + 1}`,
    };
  });
}

const signalConfidenceKeys: Record<string, readonly string[]> = {
  daily: ["data", "model", "regime", "liquidity", "feature_coverage", "stability"],
  weekly: ["data", "model", "regime", "liquidity", "feature_coverage", "stability"],
  monthly: ["data", "model", "regime", "liquidity", "feature_coverage", "stability"],
  medium: ["data", "model", "regime", "liquidity", "research", "feature_coverage", "stability"],
  long: ["data", "model", "regime", "liquidity", "research", "feature_coverage", "stability"],
};

const directionValues: Record<string, number> = {
  strong_buy: 1,
  buy: 0.75,
  accumulate: 0.5,
  watch: 0.25,
  hold: 0,
  reduce: -0.5,
  exit: -0.75,
  avoid: -1,
};

function evaluateKnownFormula(id: FormulaReferenceId, args: InputMap): FormulaReferenceResult {
  switch (id) {
    case "RELATIVE_DIFFERENCE_V2":
      requireFields(args, ["x1", "x2", "epsilon"]);
      return relativeDifference(
        numberArg(args, "x1"),
        numberArg(args, "x2"),
        numberArg(args, "epsilon", { min: Number.MIN_VALUE }),
      );

    case "DATA_CONFIDENCE_V2": {
      requireFields(args, ["components"]);
      const components = weightedComponents(args, "components");
      const result = weightedMean(components, 50);
      return result.score;
    }

    case "REQUIRED_MEDIAN_ADV_V2": {
      requireFields(args, ["plannedPositionValue", "maximumParticipationRate"]);
      const value = numberArg(args, "plannedPositionValue", { min: 0 });
      const rate = numberArg(args, "maximumParticipationRate", { min: Number.MIN_VALUE, max: 1 });
      return value / rate;
    }

    case "EXIT_DAYS_V2": {
      requireFields(args, ["positionValue", "medianDailyTradedValue", "allowedParticipationRate", "minimumLiquidityDenominator"]);
      const position = numberArg(args, "positionValue", { min: 0 });
      const medianValue = numberArg(args, "medianDailyTradedValue", { min: 0 });
      const participation = numberArg(args, "allowedParticipationRate", { min: Number.MIN_VALUE, max: 1 });
      const floor = numberArg(args, "minimumLiquidityDenominator", { min: Number.MIN_VALUE });
      return position / Math.max(medianValue * participation, floor);
    }

    case "TRADING_CONTINUITY_V2": {
      requireFields(args, ["daysWithValidTrades", "expectedTradingDays"]);
      const valid = numberArg(args, "daysWithValidTrades", { min: 0, integer: true });
      const expected = numberArg(args, "expectedTradingDays", { min: 1, integer: true });
      return Math.min(1, Math.max(0, valid / expected));
    }

    case "COVERAGE_SHRINKAGE_V2": {
      requireFields(args, ["rawScore", "availableMetricWeight", "requiredMetricWeight"]);
      const raw = numberArg(args, "rawScore", { min: 0, max: 100 });
      const available = numberArg(args, "availableMetricWeight", { min: 0 });
      const required = numberArg(args, "requiredMetricWeight", { min: Number.MIN_VALUE });
      const coverage = Math.min(1, available / required);
      return 50 + coverage * (raw - 50);
    }

    case "FRESHNESS_FACTOR_V2": {
      requireFields(args, ["actualAge", "allowedAge", "decayRate"]);
      const actualAge = numberArg(args, "actualAge", { min: 0 });
      const allowedAge = numberArg(args, "allowedAge", { min: 0 });
      const decayRate = numberArg(args, "decayRate", { min: 0 });
      return freshnessFactor(actualAge, allowedAge, decayRate);
    }

    case "CANDIDATE_SCORE_V3":
      requireFields(args, ["eligible", "rawScore", "confidence", "hardGateCap"]);
      return actionableScoreV3({
        eligible: booleanArg(args, "eligible"),
        rawScore: numberArg(args, "rawScore", { min: 0, max: 100 }),
        confidence: numberArg(args, "confidence", { min: 0, max: 100 }),
        hardGateCap: numberArg(args, "hardGateCap", { min: 0, max: 100 }),
      });

    case "CFO_CONVERSION_V2": {
      requireFields(args, ["cfo", "normalizedPat", "patDenominatorFloor"]);
      const pat = numberArg(args, "normalizedPat");
      const cfo = numberArg(args, "cfo");
      const floor = numberArg(args, "patDenominatorFloor", { min: Number.MIN_VALUE });
      return pat < 0 ? null : cfoConversion(cfo, pat, floor);
    }

    case "FCF_CONVERSION_V2": {
      requireFields(args, ["cfo", "maintenanceCapex", "normalizedPat", "patDenominatorFloor"]);
      const pat = numberArg(args, "normalizedPat");
      const cfo = numberArg(args, "cfo");
      const capex = numberArg(args, "maintenanceCapex");
      const floor = numberArg(args, "patDenominatorFloor", { min: Number.MIN_VALUE });
      return pat < 0 ? null : freeCashFlowConversion(cfo, capex, pat, floor);
    }

    case "ACCRUAL_RATIO_V2":
      requireFields(args, ["normalizedPat", "cfo", "averageOperatingAssets", "assetFloor"]);
      return accrualRatio(
        numberArg(args, "normalizedPat"),
        numberArg(args, "cfo"),
        numberArg(args, "averageOperatingAssets"),
        numberArg(args, "assetFloor", { min: Number.MIN_VALUE }),
      );

    case "PER_SHARE_CAGR_V2": {
      requireFields(args, ["beginningMetric", "endingMetric", "beginningDilutedShares", "endingDilutedShares", "years"]);
      const beginningMetric = numberArg(args, "beginningMetric");
      const endingMetric = numberArg(args, "endingMetric");
      const beginningShares = numberArg(args, "beginningDilutedShares", { min: Number.MIN_VALUE });
      const endingShares = numberArg(args, "endingDilutedShares", { min: Number.MIN_VALUE });
      const years = numberArg(args, "years", { min: Number.MIN_VALUE });
      const beginningPerShare = beginningMetric / beginningShares;
      const endingPerShare = endingMetric / endingShares;
      if (beginningPerShare <= 0 || endingPerShare <= 0) return null;
      return Math.pow(endingPerShare / beginningPerShare, 1 / years) - 1;
    }

    case "VALUE_QUALITY_ADJUSTMENT_V2": {
      requireFields(args, ["valueScore", "qualityScore"]);
      const value = numberArg(args, "valueScore", { min: 0, max: 100 });
      const quality = numberArg(args, "qualityScore", { min: 0, max: 100 });
      return value * (0.5 + 0.5 * (quality / 100));
    }

    case "ROIIC_V2": {
      requireFields(args, ["changeInNopat", "changeInInvestedCapital", "capitalChangeFloor"]);
      const nopatChange = numberArg(args, "changeInNopat");
      const capitalChange = numberArg(args, "changeInInvestedCapital");
      const floor = numberArg(args, "capitalChangeFloor", { min: Number.MIN_VALUE });
      // Capital contraction needs a reviewed classification; do not turn it into a positive ratio.
      if (capitalChange <= 0) return null;
      return nopatChange / Math.max(Math.abs(capitalChange), floor);
    }

    case "COMPOSITE_RANK_V2": {
      requireFields(args, ["overallPercentile", "sectorPercentile", "sizePercentile", "rankPersistenceScore"]);
      return 0.5 * numberArg(args, "overallPercentile", { min: 0, max: 100 })
        + 0.25 * numberArg(args, "sectorPercentile", { min: 0, max: 100 })
        + 0.15 * numberArg(args, "sizePercentile", { min: 0, max: 100 })
        + 0.1 * numberArg(args, "rankPersistenceScore", { min: 0, max: 100 });
    }

    case "PROMOTION_SCORE_V2": {
      requireFields(args, ["candidateScore", "sectorPercentile", "dataConfidence", "rankPersistence", "liquidityScore", "eventPriority", "portfolioPriority"]);
      return 0.45 * numberArg(args, "candidateScore", { min: 0, max: 100 })
        + 0.15 * numberArg(args, "sectorPercentile", { min: 0, max: 100 })
        + 0.1 * numberArg(args, "dataConfidence", { min: 0, max: 100 })
        + 0.1 * numberArg(args, "rankPersistence", { min: 0, max: 100 })
        + 0.1 * numberArg(args, "liquidityScore", { min: 0, max: 100 })
        + 0.05 * numberArg(args, "eventPriority", { min: 0, max: 100 })
        + 0.05 * numberArg(args, "portfolioPriority", { min: 0, max: 100 });
    }

    case "RESEARCH_SCORE_V3":
      requireFields(args, ["researchEligible", "rawResearchScore", "researchConfidence", "researchHardCap"]);
      return actionableScoreV3({
        eligible: booleanArg(args, "researchEligible"),
        rawScore: numberArg(args, "rawResearchScore", { min: 0, max: 100 }),
        confidence: numberArg(args, "researchConfidence", { min: 0, max: 100 }),
        hardGateCap: numberArg(args, "researchHardCap", { min: 0, max: 100 }),
      });

    case "WEIGHTED_FAIR_VALUE_V2": {
      requireFields(args, ["scenarios"]);
      const scenarios = arrayArg(args, "scenarios").map((item) => {
        const scenario = inputMap(item);
        requireFields(scenario, ["probability", "fairValue"]);
        return {
          probability: numberArg(scenario, "probability", { min: 0, max: 1 }),
          fairValue: numberArg(scenario, "fairValue", { min: Number.MIN_VALUE }),
        };
      });
      const probabilityTotal = scenarios.reduce((total, item) => total + item.probability, 0);
      if (Math.abs(probabilityTotal - 1) > 1e-9) {
        throw new FormulaReferenceError("INVALID_INPUT", "Scenario probabilities must total 1 within tolerance.");
      }
      return weightedFairValue(scenarios);
    }

    case "EXPECTED_ANNUAL_RETURN_V2":
      requireFields(args, ["weightedFairValue", "expectedDividends", "currentPrice", "horizonYears"]);
      return expectedAnnualizedReturn(
        numberArg(args, "weightedFairValue"),
        numberArg(args, "expectedDividends"),
        numberArg(args, "currentPrice", { min: Number.MIN_VALUE }),
        numberArg(args, "horizonYears", { min: Number.MIN_VALUE }),
      );

    case "HORIZON_SCORE_V2": {
      requireFields(args, ["components"]);
      const components = weightedComponents(args, "components");
      return weightedMean(components, 50).score;
    }

    case "SIGNAL_CONFIDENCE_V3": {
      requireFields(args, ["horizon", "components"]);
      const horizon = args.horizon;
      if (typeof horizon !== "string" || !Object.prototype.hasOwnProperty.call(signalConfidenceKeys, horizon)) {
        throw new FormulaReferenceError("INVALID_INPUT", "horizon must be daily, weekly, monthly, medium, or long.");
      }
      const components = recordArg(args, "components");
      const keys = signalConfidenceKeys[horizon]!;
      requireFields(components, keys);
      const values = keys.map((key) => numberArg(components, key, { min: 0, max: 100 }) / 100);
      const product = values.reduce((total, value) => total * value, 1);
      return 100 * Math.pow(product, 1 / keys.length);
    }

    case "FINAL_HSS_V3": {
      requireFields(args, ["horizonEligible", "rawHss", "signalConfidence", "hardGateCap", "stalePenalty", "eventPenalty", "riskPenalty"]);
      const eligible = booleanArg(args, "horizonEligible");
      const raw = numberArg(args, "rawHss", { min: 0, max: 100 });
      const confidence = numberArg(args, "signalConfidence", { min: 0, max: 100 });
      const cap = numberArg(args, "hardGateCap", { min: 0, max: 100 });
      const stale = numberArg(args, "stalePenalty", { min: 0 });
      const event = numberArg(args, "eventPenalty", { min: 0 });
      const risk = numberArg(args, "riskPenalty", { min: 0 });
      if (!eligible) return null;
      const confidenceAdjusted = 50 + (raw - 50) * (confidence / 100);
      return Math.max(0, Math.min(100, Math.min(raw, confidenceAdjusted, cap) - stale - event - risk));
    }

    case "ALIGNMENT_SCORE_V2": {
      requireFields(args, ["horizons"]);
      const horizons = arrayArg(args, "horizons").map((item) => {
        const horizon = inputMap(item);
        requireFields(horizon, ["importance", "state"]);
        const importance = numberArg(horizon, "importance", { min: 0 });
        const state = horizon.state;
        if (typeof state !== "string" || !Object.prototype.hasOwnProperty.call(directionValues, state)) {
          throw new FormulaReferenceError("INVALID_INPUT", "Each horizon state must be a recognized signal state.");
        }
        return { importance, direction: directionValues[state]! };
      });
      const totalImportance = horizons.reduce((total, item) => total + item.importance, 0);
      if (totalImportance <= 0) {
        throw new FormulaReferenceError("INVALID_INPUT", "Total horizon importance must be positive.");
      }
      return horizons.reduce((total, item) => total + item.importance * item.direction, 0) / totalImportance;
    }

    case "POSITION_SUITABILITY_V2": {
      requireFields(args, [
        "expectedAnnualizedReturn", "requiredReturn", "positiveReturnReference",
        "researchConfidence", "liquidityScore", "severeDownsidePct", "downsideReferencePct",
        "annualizedVolatilityPct", "volatilityReferencePct", "averagePortfolioCorrelation",
        "correlationLimit", "eventRiskScore",
      ]);
      const expectedReturn = numberArg(args, "expectedAnnualizedReturn");
      const requiredReturn = numberArg(args, "requiredReturn");
      const returnReference = numberArg(args, "positiveReturnReference", { min: Number.MIN_VALUE });
      const confidence = numberArg(args, "researchConfidence", { min: 0, max: 100 }) / 100;
      const liquidity = numberArg(args, "liquidityScore", { min: 0, max: 100 }) / 100;
      const severeDownside = numberArg(args, "severeDownsidePct");
      const downsideReference = numberArg(args, "downsideReferencePct", { min: Number.MIN_VALUE });
      const volatility = numberArg(args, "annualizedVolatilityPct", { min: 0 });
      const volatilityReference = numberArg(args, "volatilityReferencePct", { min: Number.MIN_VALUE });
      const averageCorrelation = numberArg(args, "averagePortfolioCorrelation", { min: -1, max: 1 });
      const correlationLimit = numberArg(args, "correlationLimit", { min: -1, max: 1 });
      const eventRisk = numberArg(args, "eventRiskScore", { min: 0, max: 100 });
      const returnScore = Math.min(1, Math.max(0, (expectedReturn - requiredReturn) / returnReference));
      const downsidePenalty = 1 + Math.abs(severeDownside) / downsideReference;
      const volatilityPenalty = 1 + volatility / volatilityReference;
      const correlationPenalty = 1 + Math.max(0, averageCorrelation - correlationLimit);
      const eventPenalty = 1 + eventRisk / 100;
      const raw = 100 * returnScore * confidence * liquidity
        / (downsidePenalty * volatilityPenalty * correlationPenalty * eventPenalty);
      return Math.min(100, Math.max(0, raw));
    }

    case "POSITION_SIZING_V4": {
      requireFields(args, ["caps", "lotSize"]);
      const caps = recordArg(args, "caps");
      const capValues: Record<string, unknown> = {};
      for (const key of REQUIRED_QUANTITY_CAPS) {
        if (!Object.prototype.hasOwnProperty.call(caps, key) || caps[key] == null) {
          throw new FormulaReferenceError("MISSING_ARGUMENT", `Missing required formula cap: ${key}.`);
        }
        capValues[key] = numberArg(caps, key, { min: 0, integer: true });
      }
      const result = calculateCappedQuantity(capValues, numberArg(args, "lotSize", { min: 1, integer: true }));
      return result.quantity;
    }

    case "ORDER_INTENT_IDEMPOTENCY_V4":
      requireFields(args, [
        "accountId", "strategyId", "securityOrContractId", "horizon",
        "signalId", "action", "decisionVersion",
      ]);
      for (const key of ["accountId", "strategyId", "securityOrContractId", "horizon", "signalId", "action", "decisionVersion"]) {
        if (typeof args[key] !== "string" || (args[key] as string).trim() === "") {
          throw new FormulaReferenceError("INVALID_INPUT", `${key} must be a non-empty string.`);
        }
      }
      return canonicalBusinessActionKey(args as {
        accountId: string;
        strategyId: string;
        securityOrContractId: string;
        horizon: string;
        signalId: string;
        action: string;
        decisionVersion: string;
      });
  }
}

export function evaluateFormulaReference(id: string, rawArgs: unknown): FormulaReferenceResult {
  if (!FORMULA_REFERENCE_IDS.includes(id as FormulaReferenceId)) {
    throw new FormulaReferenceError("UNSUPPORTED_FORMULA", `Formula is not in the 7.1.4 allowlist: ${id}.`);
  }
  return evaluateKnownFormula(id as FormulaReferenceId, inputMap(rawArgs));
}
