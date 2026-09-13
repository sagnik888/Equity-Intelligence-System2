import { Router, type IRouter } from "express";
import { and, eq, lte, desc } from "drizzle-orm";
import { db, securitiesTable, candidateScoresTable, researchScoresTable, hardGatesTable, signalsTable, portfolioPositionsTable, scoreHistoryTable, signalHistoryTable } from "@workspace/db";
import { FORMULA_VERSION } from "../lib/formulas";

const router: IRouter = Router();

router.get("/audit/:isin/history/:date", async (req, res): Promise<void> => {
  const rawIsin = Array.isArray(req.params.isin) ? req.params.isin[0] : req.params.isin;
  const rawDate = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;

  const [security, score, research, gates, signals, position] = await Promise.all([
    db.select().from(securitiesTable).where(eq(securitiesTable.isin, rawIsin)).then(r => r[0]),
     db.select().from(candidateScoresTable).where(and(eq(candidateScoresTable.isin, rawIsin), lte(candidateScoresTable.scoreDate, rawDate))).orderBy(desc(candidateScoresTable.scoreDate)).limit(1).then(r => r[0]),
     db.select().from(researchScoresTable).where(and(eq(researchScoresTable.isin, rawIsin), lte(researchScoresTable.scoreDate, rawDate))).orderBy(desc(researchScoresTable.scoreDate)).limit(1).then(r => r[0]),
     db.select().from(hardGatesTable).where(and(eq(hardGatesTable.isin, rawIsin), lte(hardGatesTable.flaggedAt, rawDate))).orderBy(desc(hardGatesTable.flaggedAt)),
     db.select().from(signalsTable).where(and(eq(signalsTable.isin, rawIsin), lte(signalsTable.signalDate, rawDate))).orderBy(desc(signalsTable.signalDate)),
     db.select().from(portfolioPositionsTable).where(and(eq(portfolioPositionsTable.isin, rawIsin), lte(portfolioPositionsTable.entryDate, rawDate))).orderBy(desc(portfolioPositionsTable.entryDate)).limit(1).then(r => r[0]),
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
     formula_version: FORMULA_VERSION,
     decision_explanation: `Historical snapshot for ${security.name} (${rawIsin}) as of ${rawDate}. Values are limited to records whose effective dates are on or before the requested date; unavailable source filings are not fabricated.`,
     available_filings: [],
    later_revisions: [],
  });
});

export default router;
