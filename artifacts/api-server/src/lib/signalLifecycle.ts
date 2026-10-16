export type SignalLifecycleState =
  | "not_eligible"
  | "insufficient_data"
  | "preview_only"
  | "ready"
  | "entry_pending"
  | "active"
  | "exit_pending"
  | "closed"
  | "cooldown";

export type SignalLifecycleEvent =
  | "refresh"
  | "entry_intent_created"
  | "position_confirmed"
  | "exit_triggered"
  | "position_closed"
  | "cooldown_elapsed";

export type SignalLifecycleInput = {
  currentState: SignalLifecycleState;
  event: SignalLifecycleEvent;
  sourceStatus: "licensed" | "demo" | "unknown";
  completedBar: unknown;
  sealedData: unknown;
  dataComplete: unknown;
  noLevel1Gate: unknown;
  approvedStrategy: unknown;
  confidenceThresholdConfigured: unknown;
  confidenceMet: unknown;
  hysteresisMet: unknown;
  paperTradingAccepted: unknown;
  positionConfirmed: unknown;
  exitConditionMet: unknown;
  positionClosed: unknown;
  confirmationCount: unknown;
  requiredConfirmations: unknown;
  now: unknown;
  validUntil: unknown;
  cooldownUntil: unknown;
  effectiveExecutionMode: unknown;
  intentId: unknown;
};

export type SignalLifecycleResult = {
  state: SignalLifecycleState;
  transitioned: boolean;
  actionEligible: false;
  reason: string;
};

function result(
  previous: SignalLifecycleState,
  state: SignalLifecycleState,
  reason: string,
): SignalLifecycleResult {
  return { state, transitioned: state !== previous, actionEligible: false, reason };
}

function validZonedTime(value: unknown): number | null {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function exactFlags(input: SignalLifecycleInput): boolean {
  return [
    input.completedBar,
    input.sealedData,
    input.dataComplete,
    input.noLevel1Gate,
    input.approvedStrategy,
    input.confidenceThresholdConfigured,
    input.confidenceMet,
    input.hysteresisMet,
    input.paperTradingAccepted,
    input.positionConfirmed,
    input.exitConditionMet,
    input.positionClosed,
  ].every((value) => typeof value === "boolean");
}

/**
 * A read-only lifecycle decision. It can move a candidate through research
 * states, but it never creates orders or makes a signal actionable.
 */
export function advanceSignalLifecycle(input: SignalLifecycleInput): SignalLifecycleResult {
  const previous = input.currentState;

  if (input.sourceStatus === "demo") {
    return result(previous, "preview_only", "Demo-source signals remain research previews.");
  }
  if (input.sourceStatus !== "licensed") {
    return result(previous, "insufficient_data", "Source entitlement is unknown; lifecycle cannot advance.");
  }
  if (!exactFlags(input)) {
    return result(previous, "insufficient_data", "A required lifecycle safety flag is missing or is not an exact boolean.");
  }
  if (input.completedBar !== true || input.sealedData !== true || input.dataComplete !== true) {
    return result(previous, "insufficient_data", "A completed, sealed bar and complete required inputs are needed.");
  }
  if (
    input.noLevel1Gate !== true
    || input.approvedStrategy !== true
    || input.confidenceThresholdConfigured !== true
    || input.confidenceMet !== true
  ) {
    return result(previous, "not_eligible", "A hard gate, strategy approval, or configured confidence check blocks eligibility.");
  }

  if (
    typeof input.confirmationCount !== "number"
    || !Number.isSafeInteger(input.confirmationCount)
    || input.confirmationCount < 0
    || typeof input.requiredConfirmations !== "number"
    || !Number.isSafeInteger(input.requiredConfirmations)
    || input.requiredConfirmations <= 0
  ) {
    return result(previous, "insufficient_data", "Confirmation counts must be verified positive integers.");
  }
  if (input.confirmationCount < input.requiredConfirmations) {
    return result(previous, "not_eligible", "The configured confirmation count has not been reached.");
  }

  const now = validZonedTime(input.now);
  const validUntil = validZonedTime(input.validUntil);
  const cooldownUntil = input.cooldownUntil === null
    ? null
    : validZonedTime(input.cooldownUntil);
  if (now === null || validUntil === null || (input.cooldownUntil !== null && cooldownUntil === null)) {
    return result(previous, "insufficient_data", "Timezone-aware current, validity, and cooldown timestamps are required.");
  }

  if (input.effectiveExecutionMode !== "alert_only" && input.effectiveExecutionMode !== "paper_trading") {
    return result(previous, "not_eligible", "Unsupported effective execution mode; no lifecycle action is permitted.");
  }

  if (now >= validUntil) {
    if (previous === "active") {
      return result(previous, "active", "Signal validity expired; the existing position requires separate exit review.");
    }
    if (cooldownUntil !== null && cooldownUntil > now) {
      return result(previous, "cooldown", "Signal validity expired and the configured cooldown is still active.");
    }
    return result(previous, "closed", "Signal validity period expired.");
  }

  if (previous === "closed") {
    return cooldownUntil !== null && cooldownUntil > now
      ? result(previous, "cooldown", "A closed signal remains in its configured cooldown.")
      : result(previous, "closed", "Closed signals require a new signal identity.");
  }

  if (previous === "cooldown") {
    if (cooldownUntil === null || cooldownUntil > now) {
      return result(previous, "cooldown", "Cooldown has not elapsed or its end time is missing.");
    }
    return input.hysteresisMet === true
      ? result(previous, "ready", "Cooldown elapsed and hysteresis plus confirmation checks pass.")
      : result(previous, "not_eligible", "Cooldown elapsed, but the hysteresis condition is not met.");
  }

  const paperModeAccepted =
    input.effectiveExecutionMode === "paper_trading"
    && input.paperTradingAccepted === true;
  const hasIntent = typeof input.intentId === "string" && input.intentId.trim().length > 0;

  switch (input.event) {
    case "entry_intent_created":
      return previous === "ready" && paperModeAccepted && hasIntent
        ? result(previous, "entry_pending", "A separately accepted paper intent is recorded; no order is sent by this evaluator.")
        : result(previous, previous, "Entry transition requires a ready signal, accepted paper mode, and a durable intent reference.");

    case "position_confirmed":
      return previous === "entry_pending" && paperModeAccepted && hasIntent && input.positionConfirmed === true
        ? result(previous, "active", "Paper position confirmation is recorded.")
        : result(previous, previous, "Active state requires a confirmed position and accepted paper intent.");

    case "exit_triggered":
      return previous === "active" && paperModeAccepted && hasIntent && input.exitConditionMet === true
        ? result(previous, "exit_pending", "A paper exit condition is recorded; no order is sent by this evaluator.")
        : result(previous, previous, "Exit transition requires an active position, verified exit condition, and accepted paper intent.");

    case "position_closed":
      if ((previous === "exit_pending" || previous === "active") && paperModeAccepted && input.positionClosed === true) {
        return cooldownUntil !== null && cooldownUntil > now
          ? result(previous, "cooldown", "Paper position is closed; the configured cooldown is active.")
          : result(previous, "closed", "Paper position closure is confirmed.");
      }
      return result(previous, previous, "Closed state requires confirmed paper position closure.");

    case "cooldown_elapsed":
    case "refresh":
      if (previous === "entry_pending" || previous === "active" || previous === "exit_pending") {
        return result(previous, previous, "Existing paper lifecycle state is preserved pending explicit position evidence.");
      }
      return result(previous, "ready", "Source, eligibility, confidence, confirmation, and validity checks pass.");
  }
}
