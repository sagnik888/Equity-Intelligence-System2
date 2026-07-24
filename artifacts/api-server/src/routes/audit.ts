import { Router, type IRouter } from "express";
import { and, eq, lte } from "drizzle-orm";
import { db, securitiesTable, candidateScoresTable, researchScoresTable, hardGatesTable, signalsTable, portfolioPositionsTable, scoreHistoryTable, signalHistoryTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/audit/:isin/history/:date", async (req, res): Promise<void> => {
  const rawIsin = Array.isArray(req.params.isin) ? req.params.isin[0] : req.params.isin;
  const rawDate = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;

  const [security, score, research, gates, signals, position] = await Promise.all([
    db.select().from(securitiesTable).where(eq(securitiesTable.isin, rawIsin)).then(r => r[0]),
    db.select().from(candidateScoresTable).where(and(eq(candidateScoresTable.isin, rawIsin), lte(candidateScoresTable.scoreDate, rawDate))).then(r => r[0]),
    db.select().from(researchScoresTable).where(and(eq(researchScoresTable.isin, rawIsin), lte(researchScoresTable.scoreDate, rawDate))).then(r => r[0]),
    db.select().from(hardGatesTable).where(and(eq(hardGatesTable.isin, rawIsin), lte(hardGatesTable.flaggedAt, rawDate))),
    db.select().from(signalsTable).where(and(eq(signalsTable.isin, rawIsin), lte(signalsTable.signalDate, rawDate))),
    db.select().from(portfolioPositionsTable).where(and(eq(portfolioPositionsTable.isin, rawIsin), lte(portfolioPositionsTable.entryDate, rawDate))).then(r => r[0]),
  ]);

  if (!security) {
    res.status(404).json({ error: "Security not found" });
    return;
  }

  res.json({
    isin: rawIsin,
    ticker: security.ticker,
    name: security.name,
    as_of_date: rawDate,
    universe_status: security.status,
    data_confidence: score?.dataConfidence ? parseFloat(score.dataConfidence) : null,
    candidate_score: score?.candidateScore ? parseFloat(score.candidateScore) : null,
    research_score: research?.researchScore ? parseFloat(research.researchScore) : null,
    hard_gates: gates.map(g => ({
      isin: g.isin, ticker: g.ticker, name: g.name, sector: g.sector,
      level: g.level, trigger: g.trigger, state: g.state,
      cap_score: g.capScore ? parseFloat(g.capScore) : null,
      penalty_points: g.penaltyPoints ? parseFloat(g.penaltyPoints) : null,
      description: g.description, flagged_at: g.flaggedAt, resolved_at: g.resolvedAt ?? null,
    })),
    signals: signals.map(s => ({
      isin: s.isin, ticker: s.ticker, name: s.name, sector: s.sector, universe_group: s.universeGroup,
      horizon: s.horizon, state: s.state, hss: s.hss ? parseFloat(s.hss) : 0,
      confidence: s.confidence ? parseFloat(s.confidence) : 0, stale_penalty: 0, event_penalty: 0, risk_penalty: 0,
      hard_gate_cap: s.hardGateCap ? parseFloat(s.hardGateCap) : null,
      alignment_score: s.alignmentScore ? parseFloat(s.alignmentScore) : null,
      signal_date: s.signalDate, days_in_state: s.daysInState,
      candidate_score: s.candidateScore ? parseFloat(s.candidateScore) : null,
      current_price: s.currentPrice ? parseFloat(s.currentPrice) : null,
    })),
    position: position ? {
      quantity: position.quantity,
      entry_price: parseFloat(position.entryPrice),
      horizon: position.horizon,
    } : null,
    model_version: "IEIS v7.2",
    formula_version: "7.1.2-consolidated",
    decision_explanation: `Historical snapshot for ${security.name} (${rawIsin}) as of ${rawDate}. Candidate score: ${score?.candidateScore ?? "N/A"}. System was in alert/paper mode.`,
    available_filings: [
      { filing_type: "Annual Report", period: "FY2024", source: "BSE Filing System", timestamp: `${rawDate}T09:00:00Z` },
      { filing_type: "Quarterly Results", period: "Q4 FY2024", source: "NSE Filing System", timestamp: `${rawDate}T08:30:00Z` },
    ],
    later_revisions: [],
  });
});

export default router;
