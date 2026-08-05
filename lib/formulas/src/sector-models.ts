/**
 * Sector-Specific Analytical Models
 * Implements 13+ specialized scoring models for different industry sectors
 * as per Section 47-48 of the 7.1.2 specification.
 */

export enum SectorType {
  BANK = "BANK",
  NBFC = "NBFC",
  LIFE_INSURANCE = "LIFE_INSURANCE",
  GENERAL_INSURANCE = "GENERAL_INSURANCE",
  IT = "IT",
  PHARMA = "PHARMA",
  MANUFACTURING = "MANUFACTURING",
  CONSUMER = "CONSUMER",
  UTILITIES = "UTILITIES",
  CYCLICAL = "CYCLICAL",
  REIT = "REIT",
  INVIT = "INVIT",
  HOLDING_COMPANY = "HOLDING_COMPANY",
  SME = "SME",
}

export interface SectorMetrics {
  sector: SectorType;
  metrics: Record<string, number>;
  scores: Record<string, number>;
  compositeScore: number;
  riskFlags: string[];
}

/**
 * Bank Sector Model
 * Key metrics: RoA, Sustainable RoE, NIM, Cost-to-Income, Deposit Growth, CASA,
 * Loan Growth, GNPA, NNPA, Slippages, Credit Cost, Provision Coverage, CET1, CRAR,
 * Liquidity Coverage, Unsecured Lending, Sector Concentration, P/B, Residual Income
 */
export class BankSectorModel {
  static calculateRoA(netProfit: number, totalAssets: number): number {
    if (totalAssets <= 0) return 0;
    return (netProfit / totalAssets) * 100;
  }

  static calculateSustainableRoE(
    netProfit: number,
    equity: number,
    retentionRatio: number
  ): number {
    if (equity <= 0) return 0;
    const roe = (netProfit / equity) * 100;
    return roe * retentionRatio;
  }

  static calculateNIM(
    interestIncome: number,
    interestExpense: number,
    averageAssets: number
  ): number {
    if (averageAssets <= 0) return 0;
    return ((interestIncome - interestExpense) / averageAssets) * 100;
  }

  static calculateCostToIncomeRatio(
    operatingExpenses: number,
    operatingIncome: number
  ): number {
    if (operatingIncome <= 0) return 100;
    return (operatingExpenses / operatingIncome) * 100;
  }

  static calculateGNPA(grossNPA: number, totalAdvances: number): number {
    if (totalAdvances <= 0) return 0;
    return (grossNPA / totalAdvances) * 100;
  }

  static calculateNNPA(netNPA: number, totalAdvances: number): number {
    if (totalAdvances <= 0) return 0;
    return (netNPA / totalAdvances) * 100;
  }

  static calculateProvisionCoverage(
    provisions: number,
    grossNPA: number
  ): number {
    if (grossNPA <= 0) return 0;
    return (provisions / grossNPA) * 100;
  }

  static calculateCASA(
    currentSavingsAccounts: number,
    totalDeposits: number
  ): number {
    if (totalDeposits <= 0) return 0;
    return (currentSavingsAccounts / totalDeposits) * 100;
  }

  static calculateCRARRatio(
    capitalFunds: number,
    riskWeightedAssets: number
  ): number {
    if (riskWeightedAssets <= 0) return 0;
    return (capitalFunds / riskWeightedAssets) * 100;
  }

  static scoreBankMetrics(metrics: Record<string, number>): SectorMetrics {
    const scores: Record<string, number> = {};

    // RoA scoring (higher is better, target 1-1.5%)
    scores.roA = Math.min(100, (metrics.roA / 1.5) * 100);

    // Sustainable RoE scoring (higher is better, target 15-20%)
    scores.sustainableRoE = Math.min(100, (metrics.sustainableRoE / 20) * 100);

    // NIM scoring (higher is better, target 2.5-3.5%)
    scores.nim = Math.min(100, (metrics.nim / 3.5) * 100);

    // Cost-to-Income scoring (lower is better, target 40-50%)
    scores.costToIncome = Math.max(0, 100 - (metrics.costToIncome / 50) * 100);

    // GNPA scoring (lower is better, target <2%)
    scores.gnpa = Math.max(0, 100 - (metrics.gnpa / 5) * 100);

    // NNPA scoring (lower is better, target <1%)
    scores.nnpa = Math.max(0, 100 - (metrics.nnpa / 2) * 100);

    // Provision Coverage scoring (higher is better, target >70%)
    scores.provisionCoverage = Math.min(100, (metrics.provisionCoverage / 70) * 100);

    // CASA scoring (higher is better, target >40%)
    scores.casa = Math.min(100, (metrics.casa / 40) * 100);

    // CRAR scoring (higher is better, target >12%)
    scores.crar = Math.min(100, (metrics.crar / 12) * 100);

    // Composite score
    const weights = {
      roA: 0.15,
      sustainableRoE: 0.15,
      nim: 0.15,
      costToIncome: 0.15,
      gnpa: 0.15,
      provisionCoverage: 0.1,
      casa: 0.1,
      crar: 0.05,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    const riskFlags: string[] = [];
    if (metrics.gnpa > 5) riskFlags.push("High GNPA");
    if (metrics.costToIncome > 60) riskFlags.push("High Cost-to-Income");
    if (metrics.crar < 10) riskFlags.push("Low CRAR");

    return {
      sector: SectorType.BANK,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * NBFC/HFC Sector Model
 * Key metrics: AUM Growth, Spread, NIM, Cost of Funds, Borrowing Mix, ALM,
 * Stage 2, Stage 3, Collection Efficiency, Credit Cost, Capital Adequacy, Liquidity,
 * Securitization, P/B, Residual Income
 */
export class NBFCSectorModel {
  static calculateAUMGrowth(currentAUM: number, previousAUM: number): number {
    if (previousAUM <= 0) return 0;
    return ((currentAUM - previousAUM) / previousAUM) * 100;
  }

  static calculateSpread(
    lendingRate: number,
    borrowingRate: number
  ): number {
    return (lendingRate - borrowingRate) * 100;
  }

  static calculateNIM(
    interestIncome: number,
    interestExpense: number,
    averageAssets: number
  ): number {
    if (averageAssets <= 0) return 0;
    return ((interestIncome - interestExpense) / averageAssets) * 100;
  }

  static calculateCollectionEfficiency(
    collectionsReceived: number,
    collectionsExpected: number
  ): number {
    if (collectionsExpected <= 0) return 0;
    return (collectionsReceived / collectionsExpected) * 100;
  }

  static calculateStage3Ratio(stage3Assets: number, totalAssets: number): number {
    if (totalAssets <= 0) return 0;
    return (stage3Assets / totalAssets) * 100;
  }

  static scoreNBFCMetrics(metrics: Record<string, number>): SectorMetrics {
    const scores: Record<string, number> = {};

    scores.aumGrowth = Math.min(100, (metrics.aumGrowth / 25) * 100);
    scores.spread = Math.min(100, (metrics.spread / 3) * 100);
    scores.nim = Math.min(100, (metrics.nim / 5) * 100);
    scores.collectionEfficiency = Math.min(100, metrics.collectionEfficiency);
    scores.stage3Ratio = Math.max(0, 100 - (metrics.stage3Ratio / 5) * 100);

    const weights = {
      aumGrowth: 0.25,
      spread: 0.2,
      nim: 0.2,
      collectionEfficiency: 0.2,
      stage3Ratio: 0.15,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    const riskFlags: string[] = [];
    if (metrics.stage3Ratio > 5) riskFlags.push("High Stage 3 Assets");
    if (metrics.collectionEfficiency < 90) riskFlags.push("Low Collection Efficiency");

    return {
      sector: SectorType.NBFC,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * Life Insurance Sector Model
 * Key metrics: APE Growth, VNB Growth, VNB Margin, Embedded-Value Growth,
 * Persistency, Product Mix, Protection Share, Distribution, Solvency, Expense Efficiency
 */
export class LifeInsuranceSectorModel {
  static calculateAPEGrowth(currentAPE: number, previousAPE: number): number {
    if (previousAPE <= 0) return 0;
    return ((currentAPE - previousAPE) / previousAPE) * 100;
  }

  static calculateVNBMargin(vnb: number, ape: number): number {
    if (ape <= 0) return 0;
    return (vnb / ape) * 100;
  }

  static calculatePersistency(
    policiesInForceYear2: number,
    policiesIssuedYear1: number
  ): number {
    if (policiesIssuedYear1 <= 0) return 0;
    return (policiesInForceYear2 / policiesIssuedYear1) * 100;
  }

  static calculateSolvencyRatio(
    solvencyMargin: number,
    requiredMargin: number
  ): number {
    if (requiredMargin <= 0) return 0;
    return (solvencyMargin / requiredMargin) * 100;
  }

  static scoreLifeInsuranceMetrics(
    metrics: Record<string, number>
  ): SectorMetrics {
    const scores: Record<string, number> = {};

    scores.apeGrowth = Math.min(100, (metrics.apeGrowth / 20) * 100);
    scores.vnbMargin = Math.min(100, (metrics.vnbMargin / 25) * 100);
    scores.persistency = Math.min(100, (metrics.persistency / 80) * 100);
    scores.solvencyRatio = Math.min(100, (metrics.solvencyRatio / 150) * 100);

    const weights = {
      apeGrowth: 0.3,
      vnbMargin: 0.3,
      persistency: 0.2,
      solvencyRatio: 0.2,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    const riskFlags: string[] = [];
    if (metrics.persistency < 70) riskFlags.push("Low Persistency");
    if (metrics.solvencyRatio < 100) riskFlags.push("Low Solvency Ratio");

    return {
      sector: SectorType.LIFE_INSURANCE,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * IT Sector Model
 * Key metrics: Constant-Currency Growth, Deal Wins, Backlog, Client Concentration,
 * Attrition, Utilization, Revenue per Employee, EBIT Margin, Recurring Revenue, Cash Conversion
 */
export class ITSectorModel {
  static calculateConstantCurrencyGrowth(
    reportedGrowth: number,
    currencyHeadwind: number
  ): number {
    return reportedGrowth + currencyHeadwind;
  }

  static calculateClientConcentration(
    topClientRevenue: number,
    totalRevenue: number
  ): number {
    if (totalRevenue <= 0) return 0;
    return (topClientRevenue / totalRevenue) * 100;
  }

  static calculateUtilization(
    billableHours: number,
    totalAvailableHours: number
  ): number {
    if (totalAvailableHours <= 0) return 0;
    return (billableHours / totalAvailableHours) * 100;
  }

  static calculateRevenuePerEmployee(
    totalRevenue: number,
    employeeCount: number
  ): number {
    if (employeeCount <= 0) return 0;
    return totalRevenue / employeeCount;
  }

  static scoreITMetrics(metrics: Record<string, number>): SectorMetrics {
    const scores: Record<string, number> = {};

    scores.ccGrowth = Math.min(100, (metrics.ccGrowth / 15) * 100);
    scores.clientConcentration = Math.max(0, 100 - (metrics.clientConcentration / 25) * 100);
    scores.utilization = Math.min(100, (metrics.utilization / 75) * 100);
    scores.ebitMargin = Math.min(100, (metrics.ebitMargin / 22) * 100);
    scores.cashConversion = Math.min(100, (metrics.cashConversion / 100) * 100);

    const weights = {
      ccGrowth: 0.25,
      clientConcentration: 0.2,
      utilization: 0.2,
      ebitMargin: 0.2,
      cashConversion: 0.15,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    const riskFlags: string[] = [];
    if (metrics.clientConcentration > 25) riskFlags.push("High Client Concentration");
    if (metrics.utilization < 70) riskFlags.push("Low Utilization");

    return {
      sector: SectorType.IT,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * Pharma Sector Model
 * Key metrics: Regulatory History, Product Concentration, Domestic/Export Mix,
 * R&D Intensity, R&D Productivity, Approvals, Pipeline, Specialty Mix, Price Erosion
 */
export class PharmaSectorModel {
  static calculateRDIntensity(rdExpense: number, totalRevenue: number): number {
    if (totalRevenue <= 0) return 0;
    return (rdExpense / totalRevenue) * 100;
  }

  static calculateRDProductivity(
    newProductRevenue: number,
    rdExpense: number
  ): number {
    if (rdExpense <= 0) return 0;
    return newProductRevenue / rdExpense;
  }

  static calculateProductConcentration(
    topProductRevenue: number,
    totalRevenue: number
  ): number {
    if (totalRevenue <= 0) return 0;
    return (topProductRevenue / totalRevenue) * 100;
  }

  static calculateDomesticExportMix(
    domesticRevenue: number,
    exportRevenue: number
  ): number {
    const totalRevenue = domesticRevenue + exportRevenue;
    if (totalRevenue <= 0) return 0;
    return (domesticRevenue / totalRevenue) * 100;
  }

  static scorePharmaMetrics(metrics: Record<string, number>): SectorMetrics {
    const scores: Record<string, number> = {};

    scores.rdIntensity = Math.min(100, (metrics.rdIntensity / 8) * 100);
    scores.rdProductivity = Math.min(100, (metrics.rdProductivity / 5) * 100);
    scores.productConcentration = Math.max(0, 100 - (metrics.productConcentration / 40) * 100);
    scores.domesticExportMix = Math.min(100, (metrics.domesticExportMix / 60) * 100);

    const weights = {
      rdIntensity: 0.25,
      rdProductivity: 0.25,
      productConcentration: 0.25,
      domesticExportMix: 0.25,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    const riskFlags: string[] = [];
    if (metrics.productConcentration > 40) riskFlags.push("High Product Concentration");
    if (metrics.rdIntensity < 5) riskFlags.push("Low R&D Intensity");

    return {
      sector: SectorType.PHARMA,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * Manufacturing Sector Model
 * Key metrics: Capacity Utilization, Order Book, Book-to-Bill, Capex Productivity,
 * Input Sensitivity, Working-Capital Cycle, Customer Concentration, Exports, Operating Leverage
 */
export class ManufacturingSectorModel {
  static calculateCapacityUtilization(
    currentProduction: number,
    installedCapacity: number
  ): number {
    if (installedCapacity <= 0) return 0;
    return (currentProduction / installedCapacity) * 100;
  }

  static calculateBookToBill(orderBook: number, annualRevenue: number): number {
    if (annualRevenue <= 0) return 0;
    return orderBook / annualRevenue;
  }

  static calculateWorkingCapitalCycle(
    daysInventory: number,
    daysReceivable: number,
    daysPayable: number
  ): number {
    return daysInventory + daysReceivable - daysPayable;
  }

  static scoreManufacturingMetrics(
    metrics: Record<string, number>
  ): SectorMetrics {
    const scores: Record<string, number> = {};

    scores.capacityUtilization = Math.min(100, (metrics.capacityUtilization / 85) * 100);
    scores.bookToBill = Math.min(100, (metrics.bookToBill / 1.5) * 100);
    scores.workingCapitalCycle = Math.max(0, 100 - (metrics.workingCapitalCycle / 90) * 100);

    const weights = {
      capacityUtilization: 0.35,
      bookToBill: 0.35,
      workingCapitalCycle: 0.3,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    const riskFlags: string[] = [];
    if (metrics.capacityUtilization < 60) riskFlags.push("Low Capacity Utilization");
    if (metrics.workingCapitalCycle > 90) riskFlags.push("High Working Capital Cycle");

    return {
      sector: SectorType.MANUFACTURING,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * Consumer Sector Model
 * Key metrics: Volume, Pricing, Mix, Distribution, Rural/Urban Exposure,
 * Market Share, Gross Margin, Advertising, Same-Store Sales, Working Capital
 */
export class ConsumerSectorModel {
  static calculateSameStoreSalesGrowth(
    currentSSS: number,
    previousSSS: number
  ): number {
    if (previousSSS <= 0) return 0;
    return ((currentSSS - previousSSS) / previousSSS) * 100;
  }

  static calculateDistributionReach(
    pointsOfSale: number,
    targetMarket: number
  ): number {
    if (targetMarket <= 0) return 0;
    return (pointsOfSale / targetMarket) * 100;
  }

  static scoreConsumerMetrics(metrics: Record<string, number>): SectorMetrics {
    const scores: Record<string, number> = {};

    scores.volumeGrowth = Math.min(100, (metrics.volumeGrowth / 15) * 100);
    scores.grossMargin = Math.min(100, (metrics.grossMargin / 50) * 100);
    scores.sss = Math.min(100, (metrics.sss / 10) * 100);
    scores.distributionReach = Math.min(100, (metrics.distributionReach / 80) * 100);

    const weights = {
      volumeGrowth: 0.25,
      grossMargin: 0.3,
      sss: 0.25,
      distributionReach: 0.2,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    const riskFlags: string[] = [];
    if (metrics.sss < 0) riskFlags.push("Negative Same-Store Sales");
    if (metrics.grossMargin < 30) riskFlags.push("Low Gross Margin");

    return {
      sector: SectorType.CONSUMER,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * Utilities Sector Model
 * Key metrics: Regulated Asset Base, Allowed Return, Availability, Plant Load Factor,
 * Fuel Security, Receivables, Counterparty Quality, Regulatory Assets, Debt Service, Tariff Orders
 */
export class UtilitiesSectorModel {
  static calculatePlantLoadFactor(
    actualGeneration: number,
    maximumCapacity: number,
    hoursInPeriod: number
  ): number {
    if (maximumCapacity * hoursInPeriod <= 0) return 0;
    return (actualGeneration / (maximumCapacity * hoursInPeriod)) * 100;
  }

  static calculateDebtServiceCoverage(
    operatingCashFlow: number,
    debtService: number
  ): number {
    if (debtService <= 0) return 0;
    return operatingCashFlow / debtService;
  }

  static scoreUtilitiesMetrics(metrics: Record<string, number>): SectorMetrics {
    const scores: Record<string, number> = {};

    scores.plf = Math.min(100, (metrics.plf / 85) * 100);
    scores.dscr = Math.min(100, (metrics.dscr / 2) * 100);
    scores.receivablesDaysOutstanding = Math.max(0, 100 - (metrics.receivablesDaysOutstanding / 90) * 100);

    const weights = {
      plf: 0.35,
      dscr: 0.35,
      receivablesDaysOutstanding: 0.3,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    const riskFlags: string[] = [];
    if (metrics.plf < 60) riskFlags.push("Low Plant Load Factor");
    if (metrics.dscr < 1.2) riskFlags.push("Low Debt Service Coverage");

    return {
      sector: SectorType.UTILITIES,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * Cyclicals Sector Model
 * Key metrics: Production, Realization, Cash Cost, Cost Curve, Utilization,
 * Commodity Sensitivity, Hedging, Mid-Cycle Margin, Net Debt, Replacement Cost, Reserve Life
 */
export class CyclicalsSectorModel {
  static calculateCashCostPerUnit(
    totalCashCost: number,
    productionVolume: number
  ): number {
    if (productionVolume <= 0) return 0;
    return totalCashCost / productionVolume;
  }

  static calculateRealizationPerUnit(
    totalRevenue: number,
    productionVolume: number
  ): number {
    if (productionVolume <= 0) return 0;
    return totalRevenue / productionVolume;
  }

  static calculateMidCycleMargin(
    realization: number,
    cashCost: number
  ): number {
    return realization - cashCost;
  }

  static scoreCyclicalsMetrics(metrics: Record<string, number>): SectorMetrics {
    const scores: Record<string, number> = {};

    scores.production = Math.min(100, (metrics.production / 100) * 100);
    scores.realization = Math.min(100, (metrics.realization / 150) * 100);
    scores.cashCost = Math.max(0, 100 - (metrics.cashCost / 100) * 100);
    scores.midCycleMargin = Math.min(100, (metrics.midCycleMargin / 50) * 100);

    const weights = {
      production: 0.25,
      realization: 0.3,
      cashCost: 0.25,
      midCycleMargin: 0.2,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    const riskFlags: string[] = [];
    if (metrics.midCycleMargin < 20) riskFlags.push("Low Mid-Cycle Margin");
    if (metrics.production < 70) riskFlags.push("Low Production");

    return {
      sector: SectorType.CYCLICAL,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * REIT/InvIT Sector Model
 * Key metrics: NOI, Occupancy, Tenant Concentration, WALE, Rent Escalation,
 * Distribution per Unit, LTV, Interest Coverage, NAV, Sponsor Quality
 */
export class REITInvITSectorModel {
  static calculateNOI(
    rentalIncome: number,
    operatingExpenses: number
  ): number {
    return rentalIncome - operatingExpenses;
  }

  static calculateOccupancyRate(
    occupiedArea: number,
    totalArea: number
  ): number {
    if (totalArea <= 0) return 0;
    return (occupiedArea / totalArea) * 100;
  }

  static calculateLTV(debtOutstanding: number, propertyValue: number): number {
    if (propertyValue <= 0) return 0;
    return (debtOutstanding / propertyValue) * 100;
  }

  static scoreREITMetrics(metrics: Record<string, number>): SectorMetrics {
    const scores: Record<string, number> = {};

    scores.occupancy = Math.min(100, (metrics.occupancy / 95) * 100);
    scores.ltv = Math.max(0, 100 - (metrics.ltv / 60) * 100);
    scores.interestCoverage = Math.min(100, (metrics.interestCoverage / 3) * 100);

    const weights = {
      occupancy: 0.35,
      ltv: 0.35,
      interestCoverage: 0.3,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    const riskFlags: string[] = [];
    if (metrics.occupancy < 80) riskFlags.push("Low Occupancy");
    if (metrics.ltv > 60) riskFlags.push("High LTV");

    return {
      sector: SectorType.REIT,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * Holding Company Sector Model
 * Key metrics: SOTP, Listed Investments, Unlisted Investments, Cross-Holdings,
 * Parent Debt, Central Costs, Capital Allocation, Holding Discount
 */
export class HoldingCompanySectorModel {
  static calculateSOTP(
    listedInvestmentValue: number,
    unlistedInvestmentValue: number,
    parentValue: number
  ): number {
    return listedInvestmentValue + unlistedInvestmentValue + parentValue;
  }

  static calculateHoldingDiscount(
    sotp: number,
    marketCap: number
  ): number {
    if (sotp <= 0) return 0;
    return ((sotp - marketCap) / sotp) * 100;
  }

  static scoreHoldingCompanyMetrics(
    metrics: Record<string, number>
  ): SectorMetrics {
    const scores: Record<string, number> = {};

    scores.sotp = Math.min(100, (metrics.sotp / 150) * 100);
    scores.holdingDiscount = Math.max(0, 100 - (metrics.holdingDiscount / 40) * 100);
    scores.capitalAllocation = Math.min(100, (metrics.capitalAllocation / 100) * 100);

    const weights = {
      sotp: 0.4,
      holdingDiscount: 0.35,
      capitalAllocation: 0.25,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    const riskFlags: string[] = [];
    if (metrics.holdingDiscount > 40) riskFlags.push("High Holding Discount");

    return {
      sector: SectorType.HOLDING_COMPANY,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * SME Sector Model
 * Applies stricter controls and higher thresholds
 */
export class SMESectorModel {
  static applySMEPenalties(baseScore: number): number {
    // SMEs receive 15% penalty to account for higher risk
    return baseScore * 0.85;
  }

  static scoreSMEMetrics(metrics: Record<string, number>): SectorMetrics {
    const scores: Record<string, number> = {};

    // SME scoring is more conservative
    scores.revenueGrowth = Math.min(100, (metrics.revenueGrowth / 20) * 100);
    scores.profitability = Math.min(100, (metrics.profitability / 10) * 100);
    scores.liquidity = Math.min(100, (metrics.liquidity / 1.5) * 100);

    const weights = {
      revenueGrowth: 0.3,
      profitability: 0.4,
      liquidity: 0.3,
    };

    let compositeScore = 0;
    Object.entries(weights).forEach(([metric, weight]) => {
      compositeScore += (scores[metric] || 0) * weight;
    });

    // Apply SME penalty
    compositeScore = this.applySMEPenalties(compositeScore);

    const riskFlags: string[] = [];
    riskFlags.push("SME: Higher risk profile");
    if (metrics.liquidity < 1.2) riskFlags.push("Low Liquidity");

    return {
      sector: SectorType.SME,
      metrics,
      scores,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      riskFlags,
    };
  }
}

/**
 * Sector Router
 * Assigns the appropriate sector model based on company characteristics
 */
export function assignSectorModel(company: {
  is_bank?: boolean;
  is_nbfc_or_hfc?: boolean;
  is_life_insurer?: boolean;
  is_general_insurer?: boolean;
  is_reit?: boolean;
  is_invit?: boolean;
  is_holding_company?: boolean;
  is_cyclical?: boolean;
  is_sme?: boolean;
  operating_sector?: string;
}): SectorType {
  if (company.is_bank) return SectorType.BANK;
  if (company.is_nbfc_or_hfc) return SectorType.NBFC;
  if (company.is_life_insurer) return SectorType.LIFE_INSURANCE;
  if (company.is_general_insurer) return SectorType.GENERAL_INSURANCE;
  if (company.is_reit) return SectorType.REIT;
  if (company.is_invit) return SectorType.INVIT;
  if (company.is_holding_company) return SectorType.HOLDING_COMPANY;
  if (company.is_cyclical) return SectorType.CYCLICAL;
  if (company.is_sme) return SectorType.SME;

  // Map operating sector to model
  const sectorMap: Record<string, SectorType> = {
    IT: SectorType.IT,
    PHARMA: SectorType.PHARMA,
    MANUFACTURING: SectorType.MANUFACTURING,
    CONSUMER: SectorType.CONSUMER,
    UTILITIES: SectorType.UTILITIES,
  };

  return sectorMap[company.operating_sector || ""] || SectorType.MANUFACTURING;
}
