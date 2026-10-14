import assert from "node:assert/strict";
import test from "node:test";
import {
  actionableScoreV3,
  calculateCappedQuantity,
  canonicalBusinessActionKey,
  checkTradeSignalEligibility,
  classifyNseSessionPhase,
  evaluateCandleSeal,
  evaluateDiskResourceState,
  exactBoolean,
  floorToLot,
} from "./safetyControls";

test("exact boolean validation rejects coercible values", () => {
  assert.equal(exactBoolean(false, "flag"), false);
  for (const value of [0, 1, "true", "false", null, undefined]) {
    assert.throws(() => exactBoolean(value, "flag"), { code: "INVALID_BOOLEAN" });
  }
});

test("lot sizes are positive integers and quantities round down to whole lots", () => {
  assert.equal(floorToLot(199, 100), 100);
  assert.equal(floorToLot(99, 100), 0);
  assert.throws(() => floorToLot(10, 0), { code: "INVALID_INTEGER" });
  assert.throws(() => floorToLot(10.5, 1), { code: "INVALID_INTEGER" });
  assert.throws(() => floorToLot(10, 1.5), { code: "INVALID_INTEGER" });
});

test("quantity is the minimum of every required integer cap, rounded to lot size", () => {
  const caps = {
    risk: 999,
    liquidity: 999,
    companyResidual: 999,
    sectorResidual: 999,
    groupResidual: 999,
    horizonResidual: 999,
    eventResidual: 999,
    correlationResidual: 999,
    cashOrMargin: 999,
    gross: 999,
    net: 999,
    fnoAllocation: 999,
    drawdownResidual: 999,
    accountRisk: 157,
  };
  assert.deepEqual(calculateCappedQuantity(caps, 10), { quantity: 150, bindingCap: "accountRisk" });
  assert.throws(() => calculateCappedQuantity({ ...caps, accountRisk: undefined }, 10), { code: "MISSING_CAP" });
});

test("invalid or unreviewed disk telemetry blocks new entries", () => {
  assert.equal(evaluateDiskResourceState({
    freeGb: null, reserveGb: 2, hysteresisGb: 1, healthReviewComplete: true,
  }).mode, "emergency_block_entries");
  assert.equal(evaluateDiskResourceState({
    freeGb: 1, reserveGb: 2, hysteresisGb: 1, healthReviewComplete: true,
  }).mode, "emergency_block_entries");
  assert.equal(evaluateDiskResourceState({
    freeGb: 2.5, reserveGb: 2, hysteresisGb: 1, healthReviewComplete: true,
  }).mode, "restricted");
  assert.equal(evaluateDiskResourceState({
    freeGb: 4, reserveGb: 2, hysteresisGb: 1, healthReviewComplete: false,
  }).mode, "restricted");
  assert.equal(evaluateDiskResourceState({
    freeGb: 4, reserveGb: 2, hysteresisGb: 1, healthReviewComplete: true,
  }).mode, "normal");
});

test("candles are sealed only when exact flags and provider watermark pass", () => {
  const base = {
    calendarConfirmed: true,
    observationsComplete: true,
    checksumVerified: true,
    sourceConflict: false,
    intervalEnd: "2026-10-15T09:30:00+05:30",
    providerWatermark: "2026-10-15T09:30:15+05:30",
    sealDelaySeconds: 10,
  };
  assert.equal(evaluateCandleSeal(base).sealed, true);
  assert.equal(evaluateCandleSeal({ ...base, sourceConflict: true }).sealed, false);
  assert.equal(evaluateCandleSeal({ ...base, providerWatermark: "2026-10-15T09:30:09+05:30" }).sealed, false);
  assert.throws(() => evaluateCandleSeal({ ...base, checksumVerified: 1 }), { code: "INVALID_BOOLEAN" });
  assert.throws(() => evaluateCandleSeal({ ...base, intervalEnd: "2026-10-15T09:30:00" }), { code: "INVALID_TIMESTAMP" });
});

test("trade eligibility requires every prerequisite and thresholds", () => {
  const base = {
    licensedSource: true,
    sealedData: true,
    noLevel1Gate: true,
    approvedStrategy: true,
    dataConfidence: 90,
    minimumDataConfidence: 70,
    signalConfidence: 85,
    minimumSignalConfidence: 80,
  };
  assert.equal(checkTradeSignalEligibility(base).eligible, true);
  assert.equal(checkTradeSignalEligibility({ ...base, licensedSource: false }).status, "no_action");
  assert.throws(() => checkTradeSignalEligibility({ ...base, approvedStrategy: "true" }), { code: "INVALID_BOOLEAN" });
});

test("NSE session phases apply CAS boundaries and require broker order-policy confirmation", () => {
  const base = {
    segment: "cash_equity" as const,
    casEligible: true,
    calendarOpen: true,
    brokerPolicyConfirmed: true,
  };
  assert.deepEqual(
    classifyNseSessionPhase({ ...base, istTime: "15:20", orderType: "market" }),
    {
      phase: "cas_collection",
      orderTypeAllowed: true,
      brokerPolicyConfirmed: true,
      newEntriesAllowed: true,
      stopOrdersAllowed: false,
    },
  );
  assert.equal(classifyNseSessionPhase({ ...base, istTime: "15:25", orderType: "market" }).newEntriesAllowed, false);
  assert.equal(classifyNseSessionPhase({ ...base, istTime: "15:25", orderType: "limit" }).newEntriesAllowed, true);
  assert.equal(classifyNseSessionPhase({ ...base, istTime: "15:28", orderType: "limit" }).newEntriesAllowed, false);
  assert.equal(classifyNseSessionPhase({ ...base, istTime: "15:20", orderType: "limit", brokerPolicyConfirmed: false }).newEntriesAllowed, false);
  assert.equal(classifyNseSessionPhase({ ...base, istTime: "15:20", orderType: "iceberg" }).orderTypeAllowed, false);
  assert.throws(() => classifyNseSessionPhase({ ...base, istTime: "15:20", orderType: "market", calendarOpen: 1 }), { code: "INVALID_BOOLEAN" });
});

test("actionable score is unavailable until eligible, and uncertainty cannot inflate it", () => {
  assert.equal(actionableScoreV3({ rawScore: 90, confidence: 50, eligible: false }), null);
  assert.equal(actionableScoreV3({ rawScore: 90, confidence: 50, eligible: true }), 70);
  assert.equal(actionableScoreV3({ rawScore: 90, confidence: 90, eligible: true, hardGateCap: 60 }), 60);
});

test("business-action identity is deterministic and changes with decision inputs", () => {
  const identity = {
    accountId: "acct-1",
    strategyId: "strat-1",
    securityOrContractId: "INE000A01010",
    horizon: "weekly",
    signalId: "signal-1",
    action: "buy",
    decisionVersion: "v1",
  };
  const key = canonicalBusinessActionKey(identity);
  assert.equal(canonicalBusinessActionKey(identity), key);
  assert.notEqual(canonicalBusinessActionKey({ ...identity, decisionVersion: "v2" }), key);
  assert.throws(() => canonicalBusinessActionKey({ ...identity, accountId: " " }), { code: "NO_ACTION" });
});
