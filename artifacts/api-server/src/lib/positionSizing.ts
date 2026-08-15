import { clip } from "./formulas";

export type PositionSizingInput = {
  accountCapital: number;
  riskPercent: number;
  entryPrice: number;
  stopPrice: number;
  medianDailyTradedValueCr: number;
  allowedParticipationRate: number;
  maxExitDays: number;
  maxCompanyWeight: number;
  maxSectorWeight: number;
  maxHorizonWeight: number;
  maxCorrelationWeight: number;
  maxEventWeight: number;
  currentCompanyValue?: number;
  currentSectorValue?: number;
  currentHorizonValue?: number;
  currentCorrelationValue?: number;
  currentEventValue?: number;
  roundTripCostPct?: number;
};

export function positionSizingV2(input: PositionSizingInput) {
  const accountCapital = Math.max(0, input.accountCapital);
  const entryPrice = Math.max(0, input.entryPrice);
  const stopPrice = Math.max(0, input.stopPrice);
  const riskBudget = accountCapital * (Math.max(0, input.riskPercent) / 100);
  const roundTripCost =
    entryPrice * (Math.max(0, input.roundTripCostPct ?? 0) / 100);
  const perUnitRisk = Math.max(
    Math.abs(entryPrice - stopPrice) + roundTripCost,
    entryPrice * 0.005,
  );
  const riskPositionValue =
    perUnitRisk > 0 ? (riskBudget / perUnitRisk) * entryPrice : 0;

  const participation = clip(input.allowedParticipationRate, 0, 1);
  const liquidityCapacityValue =
    Math.max(0, input.medianDailyTradedValueCr) *
    10_000_000 *
    participation *
    Math.max(0, input.maxExitDays);
  const companyCapacityValue =
    Math.max(0, accountCapital * Math.max(0, input.maxCompanyWeight)) -
    Math.max(0, input.currentCompanyValue ?? 0);
  const sectorCapacityValue =
    Math.max(0, accountCapital * Math.max(0, input.maxSectorWeight)) -
    Math.max(0, input.currentSectorValue ?? 0);
  const horizonCapacityValue =
    Math.max(0, accountCapital * Math.max(0, input.maxHorizonWeight)) -
    Math.max(0, input.currentHorizonValue ?? 0);
  const correlationCapacityValue =
    Math.max(0, accountCapital * Math.max(0, input.maxCorrelationWeight)) -
    Math.max(0, input.currentCorrelationValue ?? 0);
  const eventCapacityValue =
    Math.max(0, accountCapital * Math.max(0, input.maxEventWeight)) -
    Math.max(0, input.currentEventValue ?? 0);

  const caps = [
    { name: "risk", value: riskPositionValue },
    { name: "liquidity", value: liquidityCapacityValue },
    { name: "company_cap", value: companyCapacityValue },
    { name: "sector_cap", value: sectorCapacityValue },
    { name: "horizon_cap", value: horizonCapacityValue },
    { name: "correlation_cap", value: correlationCapacityValue },
    { name: "event_risk_cap", value: eventCapacityValue },
  ];
  const finalPositionValue = Math.max(
    0,
    Math.min(...caps.map((cap) => cap.value)),
  );
  const finalQuantity =
    entryPrice > 0 ? Math.floor(finalPositionValue / entryPrice) : 0;
  const binding = caps.reduce(
    (minimum, cap) => (cap.value < minimum.value ? cap : minimum),
    caps[0]!,
  );
  const exitDays =
    input.medianDailyTradedValueCr > 0 && participation > 0
      ? finalPositionValue /
        (input.medianDailyTradedValueCr * 10_000_000 * participation)
      : null;

  return {
    finalQuantity,
    finalPositionValue,
    portfolioWeightPct:
      accountCapital > 0 ? (finalPositionValue / accountCapital) * 100 : 0,
    riskAmount: finalQuantity * perUnitRisk,
    quantityByRisk:
      entryPrice > 0 ? Math.floor(riskPositionValue / entryPrice) : 0,
    quantityByLiquidity:
      entryPrice > 0 ? Math.floor(liquidityCapacityValue / entryPrice) : 0,
    quantityByCompanyCap:
      entryPrice > 0 ? Math.floor(companyCapacityValue / entryPrice) : 0,
    quantityBySectorCap:
      entryPrice > 0 ? Math.floor(sectorCapacityValue / entryPrice) : 0,
    quantityByHorizonCap:
      entryPrice > 0 ? Math.floor(horizonCapacityValue / entryPrice) : 0,
    quantityByCorrelationCap:
      entryPrice > 0 ? Math.floor(correlationCapacityValue / entryPrice) : 0,
    quantityByEventRiskCap:
      entryPrice > 0 ? Math.floor(eventCapacityValue / entryPrice) : 0,
    bindingConstraint: binding.name,
    estimatedExitDays: exitDays,
    caps,
  };
}