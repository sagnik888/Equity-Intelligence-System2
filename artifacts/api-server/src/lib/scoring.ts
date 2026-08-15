import {
  candidateScore,
  cfoConversion,
  dataConfidence,
  freeCashFlowConversion,
  qualityAdjustedValue,
  clip,
  type SignalState,
} from "./formulas";

export type ScoreInput = {
  roicPct?: number | null;
  rocePct?: number | null;
  roePct?: number | null;
  cfoTtmCr?: number | null;
  fcfTtmCr?: number | null;
  patTtmCr?: number | null;
  ebitdaMarginPct?: number | null;
  revenueGrowth3yPct?: number | null;
  epsGrowth3yPct?: number | null;
  netDebtToEbitda?: number | null;
  interestCoverage?: number | null;
  peRatio?: number | null;
  pbRatio?: number | null;
  evEbitda?: number | null;
  fcfYieldPct?: number | null;
  dividendYieldPct?: number | null;
  medianDailyTradedValueCr?: number | null;
  promoterHoldingPct?: number | null;
  promoterPledgePct?: number | null;
  dataAgeDays?: number | null;
  historicalCoveragePct?: number | null;
  sourceCoveragePct?: number | null;
  financialReconciliationPct?: number | null;
  sourceAgreementPct?: number | null;
  parsingConfidencePct?: number | null;
  sectorModelCompletenessPct?: number | null;
  corporateActionCompletenessPct?: number | null;
  auditQualityPct?: number | null;
  relatedPartyExposurePct?: number | null;
  governancePct?: number | null;
  regulatoryCompliancePct?: number | null;
  hardGateCap?: number | null;
};

function percentileScore(
  value: number | null | undefined,
  good: number,
  bad: number,
  inverse = false,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const direction = inverse ? bad - value : value - bad;
  const span = inverse ? bad - good : good - bad;
  if (Math.abs(span) < 1e-9) return 50;
  return clip((direction / span) * 100);
}

function positiveGrowthScore(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return clip(50 + value * 2.2);
}

function qualityScore(input: ScoreInput) {
  const cfoConv = cfoConversion(input.cfoTtmCr, input.patTtmCr, 1);
  const fcfConv = freeCashFlowConversion(
    input.cfoTtmCr,
    input.cfoTtmCr != null && input.fcfTtmCr != null
      ? input.cfoTtmCr - input.fcfTtmCr
      : null,
    input.patTtmCr,
    1,
  );
  const components = [
    { name: "roic", score: percentileScore(input.roicPct, 25, 5), weight: 18 },
    { name: "roce", score: percentileScore(input.rocePct, 30, 5), weight: 8 },
    { name: "cfo_pat", score: cfoConv == null ? null : clip(cfoConv * 60), weight: 12 },
    { name: "fcf_conversion", score: fcfConv == null ? null : clip(fcfConv * 60), weight: 12 },
    { name: "operating_margin", score: percentileScore(input.ebitdaMarginPct, 25, 5), weight: 10 },
    { name: "gross_margin_stability", score: 65, weight: 5 },
    { name: "asset_turnover", score: 60, weight: 8 },
    { name: "earnings_stability", score: 65, weight: 10 },
    { name: "accrual_quality", score: cfoConv == null ? null : clip(50 + (cfoConv - 1) * 50), weight: 10 },
    { name: "incremental_returns", score: percentileScore(input.roicPct, 25, 5), weight: 7 },
  ];
  const result = dataConfidence(components);
  return { score: result.score, components, coverage: result.coverage };
}

function growthScore(input: ScoreInput) {
  const components = [
    { name: "revenue_5y", score: positiveGrowthScore(input.revenueGrowth3yPct), weight: 20 },
    { name: "revenue_3y", score: positiveGrowthScore(input.revenueGrowth3yPct), weight: 15 },
    { name: "revenue_ttm", score: positiveGrowthScore(input.revenueGrowth3yPct), weight: 10 },
    { name: "eps_5y", score: positiveGrowthScore(input.epsGrowth3yPct), weight: 20 },
    { name: "fcf_growth", score: positiveGrowthScore(input.epsGrowth3yPct), weight: 15 },
    { name: "growth_consistency", score: 65, weight: 10 },
    { name: "per_share_growth", score: positiveGrowthScore(input.epsGrowth3yPct), weight: 10 },
  ];
  const result = dataConfidence(components);
  return { score: result.score, components, coverage: result.coverage };
}

function valueScore(input: ScoreInput, quality: number) {
  const components = [
    { name: "ev_ebit", score: percentileScore(input.evEbitda, 10, 35, true), weight: 25 },
    { name: "fcf_yield", score: percentileScore(input.fcfYieldPct, 8, 0), weight: 25 },
    { name: "pe", score: percentileScore(input.peRatio, 12, 60, true), weight: 20 },
    { name: "ev_ebitda", score: percentileScore(input.evEbitda, 10, 45, true), weight: 15 },
    { name: "pb", score: percentileScore(input.pbRatio, 2, 25, true), weight: 15 },
  ];
  const result = dataConfidence(components);
  return {
    score: result.score,
    adjustedScore: qualityAdjustedValue(result.score, quality),
    components,
    coverage: result.coverage,
  };
}

function balanceSheetScore(input: ScoreInput) {
  const components = [
    { name: "net_debt_ebitda", score: percentileScore(input.netDebtToEbitda, 0, 4, true), weight: 35 },
    { name: "interest_coverage", score: percentileScore(input.interestCoverage, 15, 1), weight: 30 },
    { name: "current_ratio", score: 65, weight: 20 },
    { name: "debt_trend", score: 65, weight: 15 },
  ];
  const result = dataConfidence(components);
  return { score: result.score, components, coverage: result.coverage };
}

function capitalAllocationScore(input: ScoreInput) {
  const components = [
    { name: "roic_vs_wacc", score: percentileScore(input.roicPct, 25, 5), weight: 30 },
    { name: "capex_quality", score: 65, weight: 25 },
    { name: "dividend_track_record", score: percentileScore(input.dividendYieldPct, 2, 0), weight: 20 },
    { name: "buyback_quality", score: 60, weight: 15 },
    { name: "m_and_a_track_record", score: 60, weight: 10 },
  ];
  const result = dataConfidence(components);
  return { score: result.score, components, coverage: result.coverage };
}

function integrityScore(input: ScoreInput) {
  const components = [
    { name: "audit_quality", score: input.auditQualityPct ?? 70, weight: 30 },
    { name: "related_party_exposure", score: input.relatedPartyExposurePct ?? 70, weight: 25 },
    {
      name: "promoter_pledge",
      score: input.promoterPledgePct == null ? 70 : percentileScore(input.promoterPledgePct, 0, 50, true),
      weight: 20,
    },
    { name: "governance", score: input.governancePct ?? 70, weight: 15 },
    { name: "regulatory_compliance", score: input.regulatoryCompliancePct ?? 70, weight: 10 },
  ];
  const result = dataConfidence(components);
  return { score: result.score, components, coverage: result.coverage };
}

export function calculateDataConfidence(input: ScoreInput) {
  const age = input.dataAgeDays ?? 0;
  const freshness = age <= 45 ? 100 : Math.max(0, 100 - (age - 45) * 2);
  const result = dataConfidence([
    { name: "primary_source_coverage", score: input.sourceCoveragePct ?? 50, weight: 20 },
    { name: "financial_reconciliation", score: input.financialReconciliationPct ?? 50, weight: 18 },
    { name: "data_freshness", score: freshness, weight: 15 },
    { name: "historical_coverage", score: input.historicalCoveragePct ?? 50, weight: 12 },
    { name: "source_agreement", score: input.sourceAgreementPct ?? 50, weight: 12 },
    { name: "parsing_confidence", score: input.parsingConfidencePct ?? 50, weight: 8 },
    { name: "sector_model_completeness", score: input.sectorModelCompletenessPct ?? 50, weight: 8 },
    { name: "corporate_action_completeness", score: input.corporateActionCompletenessPct ?? 50, weight: 7 },
  ]);
  return {
    score: result.score,
    coverage: result.coverage,
    breakdown: result.breakdown,
    class:
      result.score >= 85 ? "high" :
      result.score >= 70 ? "acceptable" :
      result.score >= 55 ? "restricted" :
      result.score >= 40 ? "limited" : "insufficient",
  } as const;
}

export function evaluateHardGates(input: ScoreInput) {
  const gates: Array<{
    level: 1 | 2 | 3;
    trigger: string;
    state: "avoid" | "pending_resolution" | "capped" | "penalized";
    capScore?: number;
    penaltyPoints?: number;
    description: string;
  }> = [];

  if ((input.promoterPledgePct ?? 0) >= 50) {
    gates.push({
      level: 1,
      trigger: "PROMOTER_PLEDGE_BREACH",
      state: "avoid",
      capScore: 0,
      description: "Promoter pledge exceeds the Level 1 threshold.",
    });
  }
  if ((input.dataAgeDays ?? 0) > 365) {
    gates.push({
      level: 1,
      trigger: "DATA_TOO_STALE",
      state: "pending_resolution",
      capScore: 0,
      description: "Required data is beyond the maximum permitted age.",
    });
  }
  if ((input.netDebtToEbitda ?? 0) > 4 || (input.interestCoverage != null && input.interestCoverage < 1.5)) {
    gates.push({
      level: 2,
      trigger: "BALANCE_SHEET_RISK",
      state: "capped",
      capScore: 69,
      description: "Leverage or interest coverage exceeds the Level 2 threshold.",
    });
  }
  if ((input.promoterPledgePct ?? 0) >= 20) {
    gates.push({
      level: 3,
      trigger: "PROMOTER_PLEDGE_ELEVATED",
      state: "penalized",
      penaltyPoints: 5,
      description: "Elevated promoter pledge requires a score penalty and monitoring.",
    });
  }

  const level1 = gates.some((gate) => gate.level === 1);
  const caps = gates
    .filter((gate) => gate.capScore != null)
    .map((gate) => gate.capScore!);
  return {
    gates,
    effectiveCap: level1 ? 0 : caps.length ? Math.min(...caps) : 100,
    effectiveState: level1 ? "avoid" : gates[0]?.state ?? null,
    penaltyPoints: gates.reduce((total, gate) => total + (gate.penaltyPoints ?? 0), 0),
  };
}

export function calculateCandidateScore(input: ScoreInput) {
  const quality = qualityScore(input);
  const growth = growthScore(input);
  const value = valueScore(input, quality.score);
  const balanceSheet = balanceSheetScore(input);
  const capitalAllocation = capitalAllocationScore(input);
  const integrity = integrityScore(input);
  const dc = calculateDataConfidence(input);
  const gates = evaluateHardGates(input);
  const components = [
    { name: "quality", score: quality.score, weight: 20 },
    { name: "growth", score: growth.score, weight: 20 },
    { name: "value", score: value.adjustedScore, weight: 20 },
    { name: "balance_sheet", score: balanceSheet.score, weight: 15 },
    { name: "capital_allocation", score: capitalAllocation.score, weight: 15 },
    { name: "integrity", score: integrity.score, weight: 10 },
  ];
  const final = candidateScore({
    components,
    dataConfidence: dc.score,
    hardGateCap: gates.effectiveCap,
  });
  return {
    ...final,
    dataConfidence: dc,
    gates,
    components: {
      quality,
      growth,
      value,
      balanceSheet,
      capitalAllocation,
      integrity,
    },
  };
}

export type CandidateResult = ReturnType<typeof calculateCandidateScore>;
export type CandidateState = SignalState;