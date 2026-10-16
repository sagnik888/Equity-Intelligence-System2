import assert from "node:assert/strict";
import test from "node:test";
import { advanceSignalLifecycle, type SignalLifecycleInput } from "./signalLifecycle";

const base: SignalLifecycleInput = {
  currentState: "preview_only",
  event: "refresh",
  sourceStatus: "licensed",
  completedBar: true,
  sealedData: true,
  dataComplete: true,
  noLevel1Gate: true,
  approvedStrategy: true,
  confidenceThresholdConfigured: true,
  confidenceMet: true,
  hysteresisMet: true,
  paperTradingAccepted: false,
  positionConfirmed: false,
  exitConditionMet: false,
  positionClosed: false,
  confirmationCount: 3,
  requiredConfirmations: 3,
  now: "2026-10-16T10:00:00+05:30",
  validUntil: "2026-10-17T10:00:00+05:30",
  cooldownUntil: null,
  effectiveExecutionMode: "alert_only",
  intentId: null,
};

test("demo and unknown sources can never advance beyond preview/unavailable", () => {
  assert.equal(advanceSignalLifecycle({ ...base, sourceStatus: "demo" }).state, "preview_only");
  assert.equal(advanceSignalLifecycle({ ...base, sourceStatus: "unknown" }).state, "insufficient_data");
});

test("unsealed, incomplete, gated, or under-confirmed signals fail closed", () => {
  assert.equal(advanceSignalLifecycle({ ...base, sealedData: false }).state, "insufficient_data");
  assert.equal(advanceSignalLifecycle({ ...base, dataComplete: false }).state, "insufficient_data");
  assert.equal(advanceSignalLifecycle({ ...base, noLevel1Gate: false }).state, "not_eligible");
  assert.equal(advanceSignalLifecycle({ ...base, confidenceThresholdConfigured: false }).state, "not_eligible");
  assert.equal(advanceSignalLifecycle({ ...base, confirmationCount: 2 }).state, "not_eligible");
  assert.equal(advanceSignalLifecycle({ ...base, approvedStrategy: "true" }).state, "insufficient_data");
});

test("eligible signals become ready but never actionable", () => {
  const result = advanceSignalLifecycle(base);
  assert.equal(result.state, "ready");
  assert.equal(result.actionEligible, false);
});

test("expiry closes a signal or starts a configured cooldown without closing an open position", () => {
  assert.equal(advanceSignalLifecycle({
    ...base,
    currentState: "ready",
    now: "2026-10-18T10:00:00+05:30",
  }).state, "closed");
  assert.equal(advanceSignalLifecycle({
    ...base,
    currentState: "ready",
    now: "2026-10-18T10:00:00+05:30",
    cooldownUntil: "2026-10-19T10:00:00+05:30",
  }).state, "cooldown");
  const active = advanceSignalLifecycle({
    ...base,
    currentState: "active",
    now: "2026-10-18T10:00:00+05:30",
  });
  assert.equal(active.state, "active");
  assert.match(active.reason, /existing position requires separate exit review/);
});

test("cooldown re-entry requires expiry, hysteresis, and confirmations", () => {
  assert.equal(advanceSignalLifecycle({
    ...base,
    currentState: "cooldown",
    cooldownUntil: "2026-10-16T09:00:00+05:30",
  }).state, "ready");
  assert.equal(advanceSignalLifecycle({
    ...base,
    currentState: "cooldown",
    cooldownUntil: "2026-10-16T09:00:00+05:30",
    hysteresisMet: false,
  }).state, "not_eligible");
  assert.equal(advanceSignalLifecycle({
    ...base,
    currentState: "cooldown",
    cooldownUntil: "2026-10-16T11:00:00+05:30",
  }).state, "cooldown");
});

test("entry, active, exit, and close transitions require accepted paper evidence", () => {
  const paper = { ...base, effectiveExecutionMode: "paper_trading", paperTradingAccepted: true, intentId: "intent-1" };
  assert.equal(advanceSignalLifecycle({ ...paper, currentState: "ready", event: "entry_intent_created" }).state, "entry_pending");
  assert.equal(advanceSignalLifecycle({ ...base, currentState: "ready", event: "entry_intent_created" }).state, "ready");
  assert.equal(advanceSignalLifecycle({
    ...paper, currentState: "entry_pending", event: "position_confirmed", positionConfirmed: true,
  }).state, "active");
  assert.equal(advanceSignalLifecycle({
    ...paper, currentState: "active", event: "exit_triggered", exitConditionMet: true,
  }).state, "exit_pending");
  assert.equal(advanceSignalLifecycle({
    ...paper, currentState: "exit_pending", event: "position_closed", positionClosed: true,
  }).state, "closed");
});

test("invalid timestamps and unsupported modes do not advance lifecycle", () => {
  assert.equal(advanceSignalLifecycle({ ...base, validUntil: "2026-10-17T10:00:00" }).state, "insufficient_data");
  assert.equal(advanceSignalLifecycle({ ...base, effectiveExecutionMode: "automatic" }).state, "not_eligible");
});
