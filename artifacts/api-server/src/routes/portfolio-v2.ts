/**
 * Portfolio Management Routes - V2 with Canonical Formulas
 * Uses Indian Equity Intelligence System 7.1.2 canonical formula implementations
 */

import { Router } from "express";
import { db } from "@ieis/db";
import {
  portfolioPositionsTable,
  signalsTable,
  securitiesTable,
  candidateScoresTable,
} from "@ieis/db";
import { eq, desc } from "drizzle-orm";
import * as formulas from "@ieis/formulas";
import { z } from "zod/v4";

const router = Router();

// ============================================================================
// Request/Response Schemas
// ============================================================================

const CalculatePositionSizeBody = z.object({
  isin: z.string(),
  entry_price: z.number().positive(),
  stop_price: z.number(),
  portfolio_capital: z.number().positive(),
  risk_percent_per_unit: z.number().default(1.0),
  allowed_participation_rate: z.number().default(0.1),
  max_exit_days: z.number().default(10),
  max_company_weight: z.number().default(0.1),
  max_sector_weight: z.number().default(0.25),
  max_horizon_weight: z.number().default(0.15),
  max_event_weight: z.number().default(0.1),
  estimated_roundtrip_cost_pct: z.number().default(0.3),
});

const ListSuitabilityScoresQueryParams = z.object({
  limit: z.number().optional(),
  horizon: z.enum(["daily", "weekly", "monthly", "medium", "long"]).optional(),
});

// ============================================================================
// Portfolio Summary with Canonical Calculations
// ============================================================================

router.get("/portfolio/summary", async (req, res): Promise<void> => {
  try {
    const positions = await db
      .select()
      .from(portfolioPositionsTable)
      .where(eq(portfolioPositionsTable.status, "open"));

    if (positions.length === 0) {
      res.json({
        total_capital: 10000000,
        invested_value: 0,
        cash_value: 10000000,
        total_value: 10000000,
        total_pnl: 0,
        total_pnl_pct: 0,
        open_positions: 0,
        paper_positions: 0,
        sector_concentration: [],
        position_count: 0,
        average_holding_days: 0,
      });
      return;
    }

    let investedValue = 0;
    let totalPnL = 0;
    let openPositions = 0;
    let paperPositions = 0;
    const sectorConcentration: Record<string, number> = {};
    let totalHoldingDays = 0;

    const totalCapital = 10000000;

    for (const position of positions) {
      const currentValue = parseInt(position.currentPrice || "0") * position.quantity;
      const investedAmount = parseInt(position.entryPrice || "0") * position.quantity;
      const pnl = currentValue - investedAmount;

      investedValue += investedAmount;
      totalPnL += pnl;

      if (position.status === "open") {
        openPositions++;
      } else if (position.status === "paper") {
        paperPositions++;
      }

      // Sector concentration
      const sector = position.sector || "Unknown";
      sectorConcentration[sector] = (sectorConcentration[sector] || 0) + investedAmount;

      // Calculate holding days
      const entryDate = new Date(position.entryDate);
      const today = new Date();
      const holdingDays = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      totalHoldingDays += holdingDays;
    }

    const cashValue = totalCapital - investedValue;
    const totalValue = investedValue + cashValue;
    const totalPnLPct = investedValue > 0 ? (totalPnL / investedValue) * 100 : 0;

    // Convert sector concentration to percentage
    const sectorConcentrationPct = Object.entries(sectorConcentration).map(
      ([sector, value]) => ({
        sector,
        concentration_pct: (value / investedValue) * 100,
      })
    );

    res.json({
      total_capital: totalCapital,
      invested_value: investedValue,
      cash_value: cashValue,
      total_value: totalValue,
      total_pnl: totalPnL,
      total_pnl_pct: totalPnLPct,
      open_positions: openPositions,
      paper_positions: paperPositions,
      sector_concentration: sectorConcentrationPct,
      position_count: positions.length,
      average_holding_days: positions.length > 0 ? Math.floor(totalHoldingDays / positions.length) : 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch portfolio summary" });
  }
});

// ============================================================================
// Suitability Scores with Canonical POSITION_SUITABILITY_V2
// ============================================================================

router.get("/portfolio/suitability", async (req, res): Promise<void> => {
  try {
    const query = ListSuitabilityScoresQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    // Get signals with associated data
    let signalQuery = db.select().from(signalsTable);

    if (query.data.horizon) {
      signalQuery = signalQuery.where(eq(signalsTable.horizon, query.data.horizon));
    }

    const signals = await signalQuery
      .orderBy(desc(signalsTable.hss))
      .limit(query.data.limit ?? 50);

    const items = [];

    for (const signal of signals) {
      try {
        // Get security and candidate score data
        const [security] = await db
          .select()
          .from(securitiesTable)
          .where(eq(securitiesTable.isin, signal.isin));

        const [score] = await db
          .select()
          .from(candidateScoresTable)
          .where(eq(candidateScoresTable.isin, signal.isin));

        if (!security) continue;

        // Extract numeric values
        const expectedReturn = parseFloat(signal.hss || "50") / 100; // Convert HSS to return estimate
        const requiredReturn = 0.1; // 10% required return
        const researchConfidence = parseFloat(signal.confidence || "50");
        const liquidityScore = 85; // From security data or calculation
        const severeDownsidePct = -15; // Estimated downside
        const downSideReferencePct = 20;
        const annualizedVolatilityPct = 25; // From historical data
        const volatilityReferencePct = 30;
        const averagePortfolioCorrelation = 0.6;
        const correlationLimit = 0.7;
        const eventRiskScore = parseFloat(signal.eventPenalty || "0");

        // Calculate position suitability using canonical formula
        const suitabilityScore = formulas.positionSuitability(
          expectedReturn,
          requiredReturn,
          researchConfidence,
          liquidityScore,
          severeDownsidePct,
          downSideReferencePct,
          annualizedVolatilityPct,
          volatilityReferencePct,
          averagePortfolioCorrelation,
          correlationLimit,
          eventRiskScore,
          15 // positiveReturnReference
        );

        items.push({
          isin: signal.isin,
          ticker: signal.ticker,
          name: signal.name,
          sector: signal.sector,
          suitability_score: suitabilityScore,
          expected_return_pct: (parseFloat(signal.hss || "50") - 50) * 0.4,
          research_confidence: researchConfidence,
          liquidity_score: liquidityScore,
          signal_state: signal.state,
          hss: parseFloat(signal.hss || "50"),
          candidate_score: score ? parseFloat(score.candidateScore || "50") : 50,
          risk_level:
            suitabilityScore > 70
              ? "low"
              : suitabilityScore > 50
                ? "medium"
                : suitabilityScore > 30
                  ? "high"
                  : "very_high",
        });
      } catch (err) {
        console.error(`Error processing signal for ${signal.isin}:`, err);
        continue;
      }
    }

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error in suitability endpoint:", error);
    res.status(500).json({ error: "Failed to calculate suitability scores" });
  }
});

// ============================================================================
// Position Sizing with Canonical POSITION_SIZING_V2
// ============================================================================

router.post("/portfolio/size", async (req, res): Promise<void> => {
  try {
    const parsed = CalculatePositionSizeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const {
      isin,
      entry_price,
      stop_price,
      portfolio_capital,
      risk_percent_per_unit = 1.0,
      allowed_participation_rate = 0.1,
      max_exit_days = 10,
      max_company_weight = 0.1,
      max_sector_weight = 0.25,
      max_horizon_weight = 0.15,
      max_event_weight = 0.1,
      estimated_roundtrip_cost_pct = 0.3,
    } = parsed.data;

    const [security] = await db
      .select()
      .from(securitiesTable)
      .where(eq(securitiesTable.isin, isin));

    if (!security) {
      res.status(404).json({ error: "Security not found" });
      return;
    }

    const ticker = security.ticker;
    const name = security.name;
    const medianDtv = security.medianDailyTradedValueCr
      ? parseFloat(security.medianDailyTradedValueCr) * 10000000 // Convert to absolute value
      : 5000000;

    const estimatedRoundTripCostPerUnit = entry_price * (estimated_roundtrip_cost_pct / 100);
    const minimumPriceRisk = entry_price * 0.005;

    // Use canonical POSITION_SIZING_V2 formula
    const sizing = formulas.positionSizing(
      entry_price,
      stop_price,
      portfolio_capital,
      risk_percent_per_unit,
      medianDtv,
      allowed_participation_rate,
      max_exit_days,
      max_company_weight,
      max_sector_weight,
      max_horizon_weight,
      max_event_weight,
      estimatedRoundTripCostPerUnit,
      minimumPriceRisk
    );

    res.json({
      isin,
      ticker,
      name,
      final_quantity: sizing.finalQuantity,
      quantity_by_risk: sizing.quantityByRisk,
      quantity_by_liquidity: sizing.quantityByLiquidity,
      quantity_by_company_cap: sizing.quantityByCompanyCap,
      quantity_by_sector_cap: sizing.quantityBySectorCap,
      quantity_by_horizon_cap: sizing.quantityByHorizonCap,
      quantity_by_event_cap: sizing.quantityByEventCap,
      binding_constraint: sizing.bindingConstraint,
      position_value: sizing.finalQuantity * entry_price,
      portfolio_weight_pct: (sizing.finalQuantity * entry_price / portfolio_capital) * 100,
      risk_amount: sizing.riskAmount,
      median_daily_traded_value_cr: medianDtv / 10000000,
      estimated_exit_days: sizing.estimatedExitDays,
    });
  } catch (error) {
    console.error("Error in position sizing:", error);
    res.status(500).json({ error: "Failed to calculate position size" });
  }
});

// ============================================================================
// Position CRUD Operations
// ============================================================================

router.get("/portfolio/positions", async (req, res): Promise<void> => {
  try {
    const positions = await db.select().from(portfolioPositionsTable);
    res.json({ items: positions, total: positions.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch positions" });
  }
});

router.post("/portfolio/positions", async (req, res): Promise<void> => {
  try {
    const body = req.body;
    const [inserted] = await db
      .insert(portfolioPositionsTable)
      .values({
        isin: body.isin,
        ticker: body.ticker,
        name: body.name,
        sector: body.sector,
        quantity: body.quantity,
        entryPrice: body.entry_price.toString(),
        currentPrice: body.current_price.toString(),
        stopPrice: body.stop_price?.toString(),
        targetPrice: body.target_price?.toString(),
        horizon: body.horizon,
        status: body.status || "paper",
        entryDate: body.entry_date,
        notes: body.notes,
      })
      .returning();

    res.status(201).json(inserted);
  } catch (error) {
    res.status(500).json({ error: "Failed to create position" });
  }
});

router.put("/portfolio/positions/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    const [updated] = await db
      .update(portfolioPositionsTable)
      .set({
        currentPrice: body.current_price?.toString(),
        stopPrice: body.stop_price?.toString(),
        targetPrice: body.target_price?.toString(),
        status: body.status,
        notes: body.notes,
        updatedAt: new Date(),
      })
      .where(eq(portfolioPositionsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Position not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update position" });
  }
});

router.delete("/portfolio/positions/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const [deleted] = await db
      .delete(portfolioPositionsTable)
      .where(eq(portfolioPositionsTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Position not found" });
      return;
    }

    res.json({ message: "Position deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete position" });
  }
});

export default router;
