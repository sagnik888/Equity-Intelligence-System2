import {
  classifySignal,
  horizonSignalScore,
  type SignalState,
} from "./formulas";
import type { CandidateResult } from "./scoring";

export type Horizon = "daily" | "weekly" | "monthly" | "medium" | "long";

export type SignalInput = {
  horizon: Horizon;
  candidate: CandidateResult;
  dataConfidence: number;
  researchConfidence?: number | null;
  liquidityConfidence?: number | null;
  regimeConfidence?: number | null;
  modelConfidence?: number | null;
  featureCoverage?: number | null;
  signalStability?: number | null;
  momentum?: number | null;
  earningsMomentum?: number | null;
  valuation?: number | null;
  technicalTrend?: number | null;
  governance?: number | null;
  eventRisk?: number;
  staleDays?: number;
  riskPenalty?: number;
  hardGateCap?: number | null;
};

const HORIZON_WEIGHTS: Record<Horizon, number[]> = {
  daily: [0.25, 0.2, 0.15, 0.15, 0.15, 0.1],
  weekly: [0.25, 0.2, 0.2, 0.15, 0.1, 0.1],
  monthly: [0.3, 0.2, 0.2, 0.1, 0.1, 0.1],
  medium: [0.35, 0.15, 0.15, 0.1, 0.15, 0.1],
  long: [0.35, 0.15, 0.15, 0.1, 0.15, 0.1],
};

export function calculateSignal(input: SignalInput) {
  const weights = HORIZON_WEIGHTS[input.horizon];
  const candidate = input.candidate;
  const rawComponents = [
    candidate.components.quality.score,
    candidate.components.growth.score,
    candidate.components.value.adjustedScore,
    input.momentum ?? input.technicalTrend,
    input.earningsMomentum ?? candidate.components.growth.score,
    input.valuation ?? candidate.components.value.adjustedScore,
  ];
  const components = rawComponents.map((score, index) => ({
    score,
    weight: weights[index] ?? 0,
  }));

  const confidenceComponents = [
    input.dataConfidence,
    input.modelConfidence ?? 75,
    input.regimeConfidence ?? 70,
    input.liquidityConfidence ?? 70,
    input.researchConfidence ?? (input.horizon === "long" ? null : 70),
    input.featureCoverage ?? 70,
    input.signalStability ?? 70,
  ];
  const stalePenalty = Math.max(0, (input.staleDays ?? 0) - 3) * 1.25;
  const eventPenalty = Math.max(0, input.eventRisk ?? 0);
  const result = horizonSignalScore({
    components,
    confidenceComponents,
    stalePenalty,
    eventPenalty,
    riskPenalty: input.riskPenalty ?? 0,
    hardGateCap: input.hardGateCap ?? candidate.gates.effectiveCap,
  });

  return {
    ...result,
    state: classifySignal(result.finalScore) as SignalState,
    penalties: {
      stale: stalePenalty,
      event: eventPenalty,
      risk: input.riskPenalty ?? 0,
    },
    confidenceComponents,
  };
}

export function crossHorizonAlignment(
  states: Array<{ horizon: Horizon; state: SignalState }>,
) {
  const direction: Record<SignalState, number> = {
    strong_buy: 1,
    buy: 0.75,
    accumulate: 0.5,
    watch: 0.2,
    hold: 0,
    reduce: -0.5,
    avoid: -1,
  };
  const weights: Record<Horizon, number> = {
    daily: 0.1,
    weekly: 0.15,
    monthly: 0.25,
    medium: 0.25,
    long: 0.25,
  };
  const totalWeight = states.reduce(
    (total, item) => total + (weights[item.horizon] ?? 0),
    0,
  );
  const score =
    totalWeight > 0
      ? states.reduce(
          (total, item) =>
            total + (weights[item.horizon] ?? 0) * direction[item.state],
          0,
        ) / totalWeight
      : 0;
  return {
    score,
    state:
      score >= 0.65
        ? "strong_buy"
        : score >= 0.25
          ? "buy"
          : score <= -0.65
            ? "avoid"
            : score < -0.25
              ? "reduce"
              : "hold",
  } as const;
}

/**
 * Hysteresis-aware transition. A score can preview a new state, but must
 * cross the wider entry/exit threshold before the persisted state changes.
 */
export function transitionSignalState(
  current: SignalState | null,
  nextScore: number,
  confirmationBars: number,
  requiredBars = 1,
) {
  const next = classifySignal(nextScore);
  if (!current || current === next) {
    return { state: next, changed: current !== next, confirmed: true };
  }
  const isImprovement =
    ["avoid", "reduce", "hold", "watch", "accumulate", "buy", "strong_buy"].indexOf(next) >
    ["avoid", "reduce", "hold", "watch", "accumulate", "buy", "strong_buy"].indexOf(current);
  const threshold = isImprovement ? requiredBars + 1 : requiredBars;
  const confirmed = confirmationBars >= threshold;
  return {
    state: confirmed ? next : current,
    changed: confirmed,
    confirmed,
  };
}