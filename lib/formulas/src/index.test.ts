/**
 * Test suite for Indian Equity Intelligence System Canonical Formulas
 * Tests validate formula implementations against specification requirements
 */

import * as formulas from "./index";

describe("Data Quality, Reconciliation, and Liquidity Formulas", () => {
  describe("relativeDifference", () => {
    it("should compute relative difference correctly", () => {
      expect(formulas.relativeDifference(100, 110)).toBeCloseTo(0.0909, 3);
      expect(formulas.relativeDifference(100, 100)).toBe(0);
      expect(formulas.relativeDifference(0, 0, 1)).toBe(0);
    });

    it("should use epsilon as denominator floor", () => {
      const result = formulas.relativeDifference(0.0001, 0.0002, 0.001);
      expect(result).toBeCloseTo(0.0001 / 0.001, 3);
    });
  });

  describe("dataConfidence", () => {
    it("should compute weighted average correctly", () => {
      const scores = { quality: 80, growth: 60, value: 70 };
      const weights = { quality: 0.4, growth: 0.3, value: 0.3 };
      const result = formulas.dataConfidence(scores, weights);
      // Expected: (0.4*80 + 0.3*60 + 0.3*70) / (0.4+0.3+0.3) * 100 = 71
      expect(result).toBeCloseTo(71, 1);
    });

    it("should return neutral score for empty components", () => {
      expect(formulas.dataConfidence({}, {})).toBe(50);
    });

    it("should clip result to 0-100", () => {
      const scores = { a: 150 };
      const weights = { a: 1 };
      expect(formulas.dataConfidence(scores, weights)).toBe(100);
    });
  });

  describe("exitDays", () => {
    it("should compute exit days correctly", () => {
      const result = formulas.exitDays(1000000, 100000, 0.1, 1000);
      // denominator = max(100000 * 0.1, 1000) = 10000
      // exitDays = 1000000 / 10000 = 100
      expect(result).toBe(100);
    });

    it("should use minimum liquidity denominator", () => {
      const result = formulas.exitDays(1000000, 1000, 0.01, 100000);
      // denominator = max(1000 * 0.01, 100000) = 100000
      // exitDays = 1000000 / 100000 = 10
      expect(result).toBe(10);
    });
  });

  describe("tradingContinuity", () => {
    it("should compute trading continuity correctly", () => {
      expect(formulas.tradingContinuity(200, 250)).toBeCloseTo(0.8, 1);
    });

    it("should clip result to 0-1", () => {
      expect(formulas.tradingContinuity(300, 250)).toBe(1);
      expect(formulas.tradingContinuity(-10, 250)).toBe(0);
    });

    it("should throw for non-positive expected trading days", () => {
      expect(() => formulas.tradingContinuity(100, 0)).toThrow();
    });
  });

  describe("coverageShrinkage", () => {
    it("should apply coverage shrinkage correctly", () => {
      const result = formulas.coverageShrinkage(80, 0.5, 1.0, 50);
      // coverage = 0.5, adjusted = 50 + 0.5 * (80 - 50) = 65
      expect(result).toBe(65);
    });

    it("should return neutral score when coverage is zero", () => {
      const result = formulas.coverageShrinkage(80, 0, 1.0, 50);
      expect(result).toBe(50);
    });
  });

  describe("freshnessFactor", () => {
    it("should compute freshness factor correctly", () => {
      const result = formulas.freshnessFactor(10, 5, 0.1);
      // excessAge = 5, factor = exp(-0.1 * 5) = exp(-0.5)
      expect(result).toBeCloseTo(Math.exp(-0.5), 5);
    });

    it("should return 1 when age is within allowed", () => {
      expect(formulas.freshnessFactor(3, 5, 0.1)).toBeCloseTo(1, 5);
    });
  });
});

describe("Scoring, Quality, Growth, Valuation, and Research Formulas", () => {
  describe("candidateScore", () => {
    it("should compute candidate score with data confidence adjustment", () => {
      const scores = { quality: 80, growth: 70, value: 60 };
      const weights = { quality: 0.4, growth: 0.3, value: 0.3 };
      const dataConfidence = 80;
      const result = formulas.candidateScore(scores, weights, dataConfidence);
      // raw = (0.4*80 + 0.3*70 + 0.3*60) / 1.0 = 72
      // adjusted = 50 + (72 - 50) * (80/100) = 50 + 17.6 = 67.6
      expect(result).toBeCloseTo(67.6, 1);
    });

    it("should apply hard gate cap", () => {
      const scores = { a: 100 };
      const weights = { a: 1 };
      const result = formulas.candidateScore(scores, weights, 100, 60);
      expect(result).toBe(60);
    });
  });

  describe("cfoConversion", () => {
    it("should compute CFO conversion correctly", () => {
      const result = formulas.cfoConversion(1000000, 500000, 100000);
      // denominator = max(500000, 100000) = 500000
      // conversion = 1000000 / 500000 = 2.0
      expect(result).toBe(2.0);
    });

    it("should use denominator floor", () => {
      const result = formulas.cfoConversion(1000000, 50000, 100000);
      // denominator = max(50000, 100000) = 100000
      // conversion = 1000000 / 100000 = 10.0
      expect(result).toBe(10.0);
    });
  });

  describe("fcfConversion", () => {
    it("should compute FCF conversion correctly", () => {
      const result = formulas.fcfConversion(1000000, 200000, 500000, 100000);
      // fcf = 1000000 - 200000 = 800000
      // denominator = max(500000, 100000) = 500000
      // conversion = 800000 / 500000 = 1.6
      expect(result).toBe(1.6);
    });
  });

  describe("accrualRatio", () => {
    it("should compute accrual ratio correctly", () => {
      const result = formulas.accrualRatio(1000000, 800000, 5000000, 1000000);
      // accrual = (1000000 - 800000) / max(5000000, 1000000) = 200000 / 5000000
      expect(result).toBeCloseTo(0.04, 2);
    });
  });

  describe("perShareCAGR", () => {
    it("should compute per-share CAGR correctly", () => {
      // Beginning: 100 metric / 1000 shares = 0.1 per share
      // Ending: 200 metric / 1000 shares = 0.2 per share
      // CAGR over 5 years = (0.2/0.1)^(1/5) - 1
      const result = formulas.perShareCAGR(100, 200, 1000, 1000, 5);
      const expected = Math.pow(2, 1 / 5) - 1;
      expect(result).toBeCloseTo(expected, 3);
    });

    it("should throw for invalid inputs", () => {
      expect(() => formulas.perShareCAGR(100, 200, 0, 1000, 5)).toThrow();
      expect(() => formulas.perShareCAGR(100, 200, 1000, 1000, 0)).toThrow();
    });
  });

  describe("valueQualityAdjustment", () => {
    it("should adjust value score with quality factor", () => {
      const result = formulas.valueQualityAdjustment(80, 60);
      // qualityFactor = 0.5 + 0.5 * (60/100) = 0.8
      // adjusted = 80 * 0.8 = 64
      expect(result).toBe(64);
    });

    it("should have factor range 0.5-1.0", () => {
      expect(formulas.valueQualityAdjustment(100, 0)).toBe(50);
      expect(formulas.valueQualityAdjustment(100, 100)).toBe(100);
    });
  });

  describe("roiic", () => {
    it("should compute ROIIC correctly", () => {
      const result = formulas.roiic(500000, 2000000, 1000000);
      // denominator = max(2000000, 1000000) = 2000000
      // roiic = 500000 / 2000000 = 0.25
      expect(result).toBe(0.25);
    });
  });

  describe("compositeRank", () => {
    it("should compute composite rank with correct weights", () => {
      const result = formulas.compositeRank(80, 70, 60, 75);
      // = 0.5*80 + 0.25*70 + 0.15*60 + 0.1*75
      // = 40 + 17.5 + 9 + 7.5 = 74
      expect(result).toBe(74);
    });
  });

  describe("promotionScore", () => {
    it("should compute promotion score with correct weights", () => {
      const result = formulas.promotionScore(80, 70, 75, 65, 80, 60, 55);
      // = 0.45*80 + 0.15*70 + 0.1*75 + 0.1*65 + 0.1*80 + 0.05*60 + 0.05*55
      // = 36 + 10.5 + 7.5 + 6.5 + 8 + 3 + 2.75 = 74.25
      expect(result).toBeCloseTo(74.25, 1);
    });
  });

  describe("researchScore", () => {
    it("should compute research score with confidence adjustment", () => {
      const scores = { fundamental: 80, technical: 70 };
      const weights = { fundamental: 0.6, technical: 0.4 };
      const result = formulas.researchScore(scores, weights, 85);
      // raw = (0.6*80 + 0.4*70) / 1.0 = 76
      // adjusted = 50 + (76 - 50) * (85/100) = 50 + 22.1 = 72.1
      expect(result).toBeCloseTo(72.1, 1);
    });
  });
});

describe("Valuation Scenarios and Multi-Horizon Signals", () => {
  describe("weightedFairValue", () => {
    it("should compute weighted fair value correctly", () => {
      const scenarios = [
        { probability: 0.3, fairValue: 100 },
        { probability: 0.5, fairValue: 120 },
        { probability: 0.2, fairValue: 80 },
      ];
      const result = formulas.weightedFairValue(scenarios);
      // = 0.3*100 + 0.5*120 + 0.2*80 = 30 + 60 + 16 = 106
      expect(result).toBe(106);
    });

    it("should throw if probabilities don't sum to 1", () => {
      const scenarios = [
        { probability: 0.3, fairValue: 100 },
        { probability: 0.3, fairValue: 120 },
      ];
      expect(() => formulas.weightedFairValue(scenarios)).toThrow();
    });
  });

  describe("expectedAnnualReturn", () => {
    it("should compute expected annualized return correctly", () => {
      const result = formulas.expectedAnnualReturn(110, 5, 100, 1);
      // expectedValue = 110 + 5 = 115
      // return = (115/100)^(1/1) - 1 = 0.15
      expect(result).toBeCloseTo(0.15, 3);
    });

    it("should throw for invalid inputs", () => {
      expect(() => formulas.expectedAnnualReturn(110, 5, 0, 1)).toThrow();
      expect(() => formulas.expectedAnnualReturn(110, 5, 100, 0)).toThrow();
    });
  });

  describe("horizonScore", () => {
    it("should compute horizon score correctly", () => {
      const scores = { momentum: 75, valuation: 65 };
      const weights = { momentum: 0.6, valuation: 0.4 };
      const result = formulas.horizonScore(scores, weights);
      // = (0.6*75 + 0.4*65) / 1.0 = 71
      expect(result).toBe(71);
    });
  });

  describe("signalConfidence", () => {
    it("should compute geometric mean correctly", () => {
      const components = [80, 90, 100];
      const result = formulas.signalConfidence(components);
      // geometric mean = (0.8 * 0.9 * 1.0)^(1/3) * 100
      const gm = Math.pow(0.8 * 0.9 * 1.0, 1 / 3);
      expect(result).toBeCloseTo(gm * 100, 1);
    });

    it("should return 0 if any component is 0", () => {
      expect(formulas.signalConfidence([80, 0, 100])).toBe(0);
    });
  });

  describe("finalHSS", () => {
    it("should compute final HSS with penalties", () => {
      const result = formulas.finalHSS(75, 90, 5, 3, 2, 100);
      // confidenceAdjusted = 50 + (75 - 50) * (90/100) = 72.5
      // penalized = 72.5 - 5 - 3 - 2 = 62.5
      expect(result).toBe(62.5);
    });

    it("should apply hard gate cap", () => {
      const result = formulas.finalHSS(80, 100, 0, 0, 0, 70);
      expect(result).toBe(70);
    });
  });

  describe("alignmentScore", () => {
    it("should compute alignment score correctly", () => {
      const directions = { daily: 1.0, weekly: 0.5, monthly: -0.5 };
      const importances = { daily: 0.2, weekly: 0.3, monthly: 0.5 };
      const result = formulas.alignmentScore(directions, importances);
      // = (0.2*1.0 + 0.3*0.5 + 0.5*(-0.5)) / 1.0 = 0.2 + 0.15 - 0.25 = 0.1
      expect(result).toBeCloseTo(0.1, 3);
    });
  });
});

describe("Portfolio Suitability, Position Sizing, and Execution Identity", () => {
  describe("positionSuitability", () => {
    it("should compute position suitability correctly", () => {
      const result = formulas.positionSuitability(
        0.20, // expectedAnnualizedReturn 20%
        0.10, // requiredReturn 10%
        80, // researchConfidence
        85, // liquidityScore
        -15, // severeDownsidePct
        20, // downSideReferencePct
        25, // annualizedVolatilityPct
        30, // volatilityReferencePct
        0.6, // averagePortfolioCorrelation
        0.7, // correlationLimit
        10, // eventRiskScore
        15 // positiveReturnReference
      );
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe("positionSizing", () => {
    it("should compute position sizing with all constraints", () => {
      const result = formulas.positionSizing(
        100, // entryPrice
        90, // stopPrice
        1000000, // portfolioCapital
        2, // riskPercent
        100000, // medianDailyTradedValue
        0.1, // allowedParticipationRate
        10, // maxExitDays
        0.05, // maxCompanyWeight
        0.2, // maxSectorWeight
        0.15, // maxHorizonWeight
        0.1, // maxEventWeight
        0.3 // estimatedRoundTripCostPerUnit
      );

      expect(result.finalQuantity).toBeGreaterThanOrEqual(0);
      expect(result.quantityByRisk).toBeGreaterThanOrEqual(0);
      expect(result.quantityByLiquidity).toBeGreaterThanOrEqual(0);
      expect(result.bindingConstraint).toBeTruthy();
    });
  });

  describe("idempotencyKey", () => {
    it("should generate consistent idempotency keys", () => {
      const key1 = formulas.idempotencyKey("ISIN001", "monthly", "SIG001", "BUY", "2024-01-01");
      const key2 = formulas.idempotencyKey("ISIN001", "monthly", "SIG001", "BUY", "2024-01-01");
      expect(key1).toBe(key2);
    });

    it("should generate different keys for different inputs", () => {
      const key1 = formulas.idempotencyKey("ISIN001", "monthly", "SIG001", "BUY", "2024-01-01");
      const key2 = formulas.idempotencyKey("ISIN002", "monthly", "SIG001", "BUY", "2024-01-01");
      expect(key1).not.toBe(key2);
    });
  });
});

describe("Utility Functions", () => {
  describe("hssToSignalState", () => {
    it("should map HSS to signal states correctly", () => {
      expect(formulas.hssToSignalState(80)).toBe("strong_buy");
      expect(formulas.hssToSignalState(65)).toBe("buy");
      expect(formulas.hssToSignalState(50)).toBe("hold");
      expect(formulas.hssToSignalState(35)).toBe("sell");
      expect(formulas.hssToSignalState(10)).toBe("avoid");
    });
  });

  describe("signalStateToDirectionValue", () => {
    it("should map signal states to direction values", () => {
      expect(formulas.signalStateToDirectionValue("strong_buy")).toBe(1.0);
      expect(formulas.signalStateToDirectionValue("buy")).toBe(0.5);
      expect(formulas.signalStateToDirectionValue("hold")).toBe(0.0);
      expect(formulas.signalStateToDirectionValue("sell")).toBe(-0.5);
      expect(formulas.signalStateToDirectionValue("avoid")).toBe(-1.0);
    });
  });

  describe("clip", () => {
    it("should clip values to range", () => {
      expect(formulas.clip(50, 0, 100)).toBe(50);
      expect(formulas.clip(150, 0, 100)).toBe(100);
      expect(formulas.clip(-10, 0, 100)).toBe(0);
    });
  });
});
