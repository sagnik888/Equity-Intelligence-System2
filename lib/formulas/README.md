# Indian Equity Intelligence System - Canonical Formulas Library

## Overview

This library contains the complete implementation of all canonical formulas defined in the **Indian Equity Intelligence System 7.1.2 Consolidated Formula-Safe Master Specification**. All formulas follow the V2 corrections and are production-ready for use across the system.

## Formula Categories

### A. Data Quality, Reconciliation, and Liquidity

- **`relativeDifference()`** - Relative difference between two values with epsilon floor
- **`dataConfidence()`** - Weighted data confidence score (0-100)
- **`requiredMedianADV()`** - Required median average daily volume
- **`exitDays()`** - Estimated exit days with liquidity constraints
- **`tradingContinuity()`** - Trading continuity ratio (0-1)
- **`coverageShrinkage()`** - Coverage-based score adjustment with neutral shrinkage
- **`freshnessFactor()`** - Staleness decay factor with exponential decay

### B. Scoring, Quality, Growth, Valuation, and Research

- **`candidateScore()`** - Comprehensive candidate score with data confidence adjustment
- **`cfoConversion()`** - Cash flow from operations conversion ratio
- **`fcfConversion()`** - Free cash flow conversion ratio
- **`accrualRatio()`** - Earnings quality accrual measure
- **`perShareCAGR()`** - Per-share compound annual growth rate
- **`valueQualityAdjustment()`** - Value-trap adjustment with quality factor
- **`roiic()`** - Return on incremental invested capital
- **`compositeRank()`** - Composite ranking score with weighted percentiles
- **`promotionScore()`** - Deep-research promotion score
- **`researchScore()`** - Deep research score with confidence adjustment

### C. Valuation Scenarios and Multi-Horizon Signals

- **`weightedFairValue()`** - Probability-weighted fair value across scenarios
- **`expectedAnnualReturn()`** - Expected annualized return including dividends
- **`horizonScore()`** - Raw horizon signal score
- **`signalConfidence()`** - Signal confidence using geometric mean
- **`finalHSS()`** - Final horizon signal score with penalties
- **`alignmentScore()`** - Cross-horizon alignment score

### D. Portfolio Suitability, Position Sizing, and Execution Identity

- **`positionSuitability()`** - Portfolio suitability with comprehensive penalty factors
- **`positionSizing()`** - Risk- and capacity-constrained position sizing
- **`idempotencyKey()`** - Duplicate-order protection key generation

## Usage Examples

### Computing a Candidate Score

```typescript
import * as formulas from "@ieis/formulas";

const componentScores = {
  quality: 80,
  growth: 70,
  value: 65,
  balanceSheet: 75,
  capitalAllocation: 72,
  integrity: 70,
};

const weights = {
  quality: 0.20,
  growth: 0.20,
  value: 0.20,
  balanceSheet: 0.15,
  capitalAllocation: 0.15,
  integrity: 0.10,
};

const dataConfidenceScore = 85;
const hardGateCap = 95;

const score = formulas.candidateScore(
  componentScores,
  weights,
  dataConfidenceScore,
  hardGateCap
);

console.log(`Candidate Score: ${score}`); // Output: ~72.4
```

### Computing Position Sizing

```typescript
const sizing = formulas.positionSizing(
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

console.log(`Final Quantity: ${sizing.finalQuantity}`);
console.log(`Binding Constraint: ${sizing.bindingConstraint}`);
console.log(`Estimated Exit Days: ${sizing.estimatedExitDays}`);
```

### Computing Final Horizon Signal Score

```typescript
const hss = formulas.finalHSS(
  75, // rawHorizonScore
  85, // signalConfidence
  5, // stalePenalty
  3, // eventPenalty
  2, // riskPenalty
  100 // hardGateCap
);

const signalState = formulas.hssToSignalState(hss);
console.log(`HSS: ${hss}, Signal: ${signalState}`); // Output: HSS: 62.75, Signal: buy
```

## Key Features

### Canonical Formulas
All formulas strictly follow the V7.1.2 specification with the following guarantees:
- **Correct scaling**: All scores and confidence values are 0-100 unless explicitly defined as 0-1 factors
- **Denominator floors**: All division operations include safety floors to prevent division by zero
- **Range clipping**: Results are clipped to valid ranges (0-100 for scores, 0-1 for factors)
- **Mandatory normalization**: Weighted sums are normalized by actual weight totals

### Error Handling
Functions include comprehensive error handling:
- Validation of input ranges and constraints
- Meaningful error messages for invalid inputs
- Safe fallback values for edge cases

### Type Safety
Full TypeScript support with:
- Strict type definitions for all parameters and return values
- Comprehensive interface definitions for complex return types
- JSDoc documentation for all public functions

## Testing

The library includes comprehensive test coverage for all formulas:

```bash
npm test
```

Tests validate:
- Correct formula calculations against specification
- Edge cases and boundary conditions
- Error handling and validation
- Consistency across related formulas

## Integration

### With API Server

```typescript
import * as formulas from "@ieis/formulas";

// In your API route handler
const candidateScore = formulas.candidateScore(
  componentScores,
  weights,
  dataConfidence,
  hardGateCap
);

// Store in database
await db.insert(candidateScoresTable).values({
  isin,
  candidateScore,
  // ... other fields
});
```

### With Data Processing Pipeline

```typescript
import * as formulas from "@ieis/formulas";

// Process security data
for (const security of securities) {
  const hss = formulas.finalHSS(
    rawHorizonScore,
    signalConfidence,
    stalePenalty,
    eventPenalty,
    riskPenalty
  );

  const signalState = formulas.hssToSignalState(hss);
  
  // Update signal in database
  await updateSignal(security.isin, signalState, hss);
}
```

## Specification Reference

All formulas are defined in the official specification document:
- **Document**: Indian Equity Intelligence System 7.1.2 Consolidated Formula-Safe Master Specification
- **Version**: 7.1.2
- **Formula Authority**: Corrected formulas in the 7.1.1 source and supplied formula-corrections changelog

## Constants and Defaults

| Parameter | Default Value | Unit | Description |
|-----------|---------------|------|-------------|
| `epsilon` | 0.001 | - | Denominator floor for relative difference |
| `neutralScore` | 50 | 0-100 | Neutral score for coverage shrinkage |
| `patDenominatorFloor` | 1,000,000 | INR | PAT denominator floor |
| `assetFloor` | 1,000,000 | INR | Asset denominator floor |
| `capitalChangeFloor` | 1,000,000 | INR | Capital change denominator floor |
| `minimumLiquidityDenominator` | 1,000 | INR | Minimum liquidity denominator |
| `positiveReturnReference` | 15 | % | Reference return for suitability |

## Performance Considerations

- All formulas are optimized for single-pass computation
- No external dependencies required
- Suitable for real-time calculation in production systems
- Batch processing recommended for large security universes

## Contributing

When adding new formulas or modifying existing ones:
1. Ensure strict adherence to the specification
2. Add comprehensive tests for all code paths
3. Update documentation with examples
4. Include error handling and validation
5. Maintain backward compatibility where possible

## License

MIT

## Author

Manus AI - Indian Equity Intelligence System Development Team
