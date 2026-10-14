import { createHash } from "node:crypto";

export type SafetyErrorCode =
  | "INVALID_BOOLEAN"
  | "INVALID_INTEGER"
  | "INVALID_QUANTITY"
  | "INVALID_RESOURCE_TELEMETRY"
  | "EMERGENCY_BLOCK_ENTRIES"
  | "INVALID_TIMESTAMP"
  | "BAR_NOT_SEALED"
  | "MISSING_CAP"
  | "POLICY_NOT_APPROVED"
  | "NO_ACTION";

export class SafetyControlError extends Error {
  constructor(
    readonly code: SafetyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SafetyControlError";
  }
}

export function exactBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new SafetyControlError("INVALID_BOOLEAN", `${field} must be an exact boolean.`);
  }
  return value;
}

export function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new SafetyControlError("INVALID_INTEGER", `${field} must be a positive safe integer.`);
  }
  return value;
}

export function floorToLot(quantity: number, lotSize: number): number {
  positiveInteger(quantity, "quantity");
  positiveInteger(lotSize, "lot_size");
  return Math.floor(quantity / lotSize) * lotSize;
}

export const REQUIRED_QUANTITY_CAPS = [
  "risk",
  "liquidity",
  "companyResidual",
  "sectorResidual",
  "groupResidual",
  "horizonResidual",
  "eventResidual",
  "correlationResidual",
  "cashOrMargin",
  "gross",
  "net",
  "fnoAllocation",
  "drawdownResidual",
  "accountRisk",
] as const;

export type QuantityCaps = Record<(typeof REQUIRED_QUANTITY_CAPS)[number], number>;

export function calculateCappedQuantity(
  caps: Partial<Record<(typeof REQUIRED_QUANTITY_CAPS)[number], unknown>>,
  lotSizeValue: unknown,
): { quantity: number; bindingCap: string } {
  const lotSize = positiveInteger(lotSizeValue, "lot_size");
  const normalized: Array<{ key: string; quantity: number }> = [];
  for (const key of REQUIRED_QUANTITY_CAPS) {
    const value = caps[key];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      throw new SafetyControlError("MISSING_CAP", `${key} must be a non-negative integer residual quantity.`);
    }
    normalized.push({ key, quantity: value });
  }
  const binding = normalized.reduce((a, b) => b.quantity < a.quantity ? b : a);
  return {
    quantity: Math.floor(binding.quantity / lotSize) * lotSize,
    bindingCap: binding.key,
  };
}

export type ResourceDecision =
  | { mode: "normal"; allowNewEntries: true; requireHealthReview: false }
  | { mode: "restricted"; allowNewEntries: false; requireHealthReview: true }
  | { mode: "emergency_block_entries"; allowNewEntries: false; requireHealthReview: true };

export function evaluateDiskResourceState(input: {
  freeGb: unknown;
  reserveGb: unknown;
  hysteresisGb: unknown;
  healthReviewComplete: unknown;
}): ResourceDecision {
  let reviewed: boolean;
  try {
    reviewed = exactBoolean(input.healthReviewComplete, "health_review_complete");
  } catch {
    return { mode: "emergency_block_entries", allowNewEntries: false, requireHealthReview: true };
  }

  const values = [input.freeGb, input.reserveGb, input.hysteresisGb];
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))
    || (input.freeGb as number) < 0
    || (input.reserveGb as number) <= 0
    || (input.hysteresisGb as number) < 0) {
    return { mode: "emergency_block_entries", allowNewEntries: false, requireHealthReview: true };
  }

  const free = input.freeGb as number;
  const reserve = input.reserveGb as number;
  const hysteresis = input.hysteresisGb as number;
  if (free < reserve) {
    return { mode: "emergency_block_entries", allowNewEntries: false, requireHealthReview: true };
  }
  if (free < reserve + hysteresis || !reviewed) {
    return { mode: "restricted", allowNewEntries: false, requireHealthReview: true };
  }
  return { mode: "normal", allowNewEntries: true, requireHealthReview: false };
}

function parseZonedTimestamp(value: unknown, field: string): number {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new SafetyControlError("INVALID_TIMESTAMP", `${field} must be a timezone-aware ISO timestamp.`);
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    throw new SafetyControlError("INVALID_TIMESTAMP", `${field} must be a valid timestamp.`);
  }
  return time;
}

export function evaluateCandleSeal(input: {
  calendarConfirmed: unknown;
  observationsComplete: unknown;
  checksumVerified: unknown;
  sourceConflict: unknown;
  intervalEnd: unknown;
  providerWatermark: unknown;
  sealDelaySeconds: unknown;
}) {
  const calendarConfirmed = exactBoolean(input.calendarConfirmed, "calendar_confirmed");
  const observationsComplete = exactBoolean(input.observationsComplete, "observations_complete");
  const checksumVerified = exactBoolean(input.checksumVerified, "checksum_verified");
  const sourceConflict = exactBoolean(input.sourceConflict, "source_conflict");
  const intervalEndMs = parseZonedTimestamp(input.intervalEnd, "interval_end");
  const watermarkMs = parseZonedTimestamp(input.providerWatermark, "provider_watermark");
  const delay = input.sealDelaySeconds;
  if (typeof delay !== "number" || !Number.isSafeInteger(delay) || delay < 0) {
    throw new SafetyControlError("INVALID_INTEGER", "seal_delay_seconds must be a non-negative integer.");
  }
  const sealed = calendarConfirmed
    && observationsComplete
    && checksumVerified
    && !sourceConflict
    && watermarkMs >= intervalEndMs + delay * 1000;
  return {
    sealed,
    previewOnly: !sealed,
    reason: sealed ? null : "bar finality or source integrity checks did not pass",
  };
}

export type CasPhase =
  | "normal_continuous"
  | "reference_transition"
  | "cas_collection"
  | "cas_limit_only"
  | "random_close_block"
  | "cas_matching"
  | "post_cas_transition"
  | "post_close_unsupported"
  | "market_closed";

export function classifyNseSessionPhase(input: {
  istTime: string;
  segment: "cash_equity" | "equity_derivatives";
  casEligible: unknown;
  calendarOpen: unknown;
  orderType: unknown;
  brokerPolicyConfirmed: unknown;
}) {
  const casEligible = exactBoolean(input.casEligible, "cas_eligible");
  const calendarOpen = exactBoolean(input.calendarOpen, "calendar_open");
  const brokerPolicyConfirmed = exactBoolean(input.brokerPolicyConfirmed, "broker_policy_confirmed");
  const supportedOrderTypes = ["market", "limit", "stop", "iceberg"];
  if (typeof input.orderType !== "string" || !supportedOrderTypes.includes(input.orderType)) {
    throw new SafetyControlError("NO_ACTION", "order_type must be a supported, broker-confirmed order type.");
  }
  if (!/^\d{2}:\d{2}$/.test(input.istTime)) {
    throw new SafetyControlError("INVALID_TIMESTAMP", "ist_time must use HH:mm.");
  }
  const [hours, minutes] = input.istTime.split(":").map(Number);
  if (hours! > 23 || minutes! > 59) {
    throw new SafetyControlError("INVALID_TIMESTAMP", "ist_time is outside the valid time range.");
  }
  const minute = hours! * 60 + minutes!;
  const t = (hour: number, min: number) => hour * 60 + min;
  const result = (
    phase: CasPhase,
    sessionOpen: boolean,
    allowedOrderTypes: readonly string[] = supportedOrderTypes,
  ) => {
    const orderTypeAllowed = sessionOpen && allowedOrderTypes.includes(input.orderType as string);
    const newEntriesAllowed = orderTypeAllowed && brokerPolicyConfirmed;
    return {
      phase,
      orderTypeAllowed,
      brokerPolicyConfirmed,
      newEntriesAllowed,
      stopOrdersAllowed: newEntriesAllowed && input.orderType === "stop",
    };
  };
  if (!calendarOpen) return result("market_closed", false);
  if (input.segment === "equity_derivatives") {
    const open = minute >= t(9, 15) && minute < t(15, 40);
    return result(open ? "normal_continuous" : "market_closed", open);
  }
  if (input.segment !== "cash_equity") {
    throw new SafetyControlError("NO_ACTION", "Unsupported exchange segment.");
  }
  if (!casEligible) {
    const open = minute >= t(9, 15) && minute < t(15, 30);
    return result(open ? "normal_continuous" : "market_closed", open);
  }
  if (minute >= t(9, 15) && minute < t(15, 15)) return result("normal_continuous", true);
  if (minute < t(15, 20) && minute >= t(15, 15)) return result("reference_transition", false);
  if (minute < t(15, 25) && minute >= t(15, 20)) return result("cas_collection", true, ["limit", "market"]);
  if (minute < t(15, 28) && minute >= t(15, 25)) return result("cas_limit_only", true, ["limit"]);
  if (minute < t(15, 30) && minute >= t(15, 28)) return result("random_close_block", false);
  if (minute < t(15, 35) && minute >= t(15, 30)) return result("cas_matching", false);
  if (minute < t(15, 50) && minute >= t(15, 35)) return result("post_cas_transition", false);
  if (minute < t(16, 0) && minute >= t(15, 50)) return result("post_close_unsupported", false);
  return result("market_closed", false);
}

export function checkTradeSignalEligibility(input: {
  licensedSource: unknown;
  sealedData: unknown;
  noLevel1Gate: unknown;
  approvedStrategy: unknown;
  dataConfidence: unknown;
  minimumDataConfidence: unknown;
  signalConfidence: unknown;
  minimumSignalConfidence: unknown;
}) {
  const flags = {
    licensedSource: exactBoolean(input.licensedSource, "licensed_source"),
    sealedData: exactBoolean(input.sealedData, "sealed_data"),
    noLevel1Gate: exactBoolean(input.noLevel1Gate, "no_level1_gate"),
    approvedStrategy: exactBoolean(input.approvedStrategy, "approved_strategy"),
  };
  const numbers = [input.dataConfidence, input.minimumDataConfidence, input.signalConfidence, input.minimumSignalConfidence];
  if (numbers.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new SafetyControlError("NO_ACTION", "Confidence scores and approved minimums must be finite values from 0 to 100.");
  }
  const eligible = Object.values(flags).every(Boolean)
    && (input.dataConfidence as number) >= (input.minimumDataConfidence as number)
    && (input.signalConfidence as number) >= (input.minimumSignalConfidence as number);
  return {
    eligible,
    status: eligible ? "eligible" as const : "no_action" as const,
    checks: {
      ...flags,
      minimumDataConfidenceMet: (input.dataConfidence as number) >= (input.minimumDataConfidence as number),
      minimumSignalConfidenceMet: (input.signalConfidence as number) >= (input.minimumSignalConfidence as number),
    },
  };
}

export function canonicalBusinessActionKey(input: {
  accountId: string;
  strategyId: string;
  securityOrContractId: string;
  horizon: string;
  signalId: string;
  action: string;
  decisionVersion: string;
}) {
  const entries = Object.entries(input);
  if (entries.some(([, value]) => typeof value !== "string" || value.trim().length === 0)) {
    throw new SafetyControlError("NO_ACTION", "Every business-action identity field is required.");
  }
  const canonical = JSON.stringify({
    accountId: input.accountId.trim(),
    strategyId: input.strategyId.trim(),
    securityOrContractId: input.securityOrContractId.trim(),
    horizon: input.horizon.trim(),
    signalId: input.signalId.trim(),
    action: input.action.trim(),
    decisionVersion: input.decisionVersion.trim(),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function actionableScoreV3(input: {
  rawScore: number;
  confidence: number;
  eligible: boolean;
  hardGateCap?: number | null;
}) {
  const eligible = exactBoolean(input.eligible, "eligible");
  const values = [input.rawScore, input.confidence];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new SafetyControlError("NO_ACTION", "Raw score and confidence must be finite values from 0 to 100.");
  }
  if (input.hardGateCap != null && (!Number.isFinite(input.hardGateCap) || input.hardGateCap < 0 || input.hardGateCap > 100)) {
    throw new SafetyControlError("NO_ACTION", "Hard-gate cap must be a finite value from 0 to 100.");
  }
  if (!eligible) return null;
  const uncertaintyEstimate = 50 + (input.rawScore - 50) * (input.confidence / 100);
  return Math.max(0, Math.min(input.rawScore, uncertaintyEstimate, input.hardGateCap ?? 100));
}
