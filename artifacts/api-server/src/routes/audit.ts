import { Router, type IRouter } from "express";
import { and, eq, lte, desc, gt } from "drizzle-orm";
import { db, securitiesTable, candidateScoresTable, researchScoresTable, hardGatesTable, signalsTable, portfolioPositionsTable, pointInTimeFactsTable, rawDataRecordsTable } from "@workspace/db";
import { FORMULA_VERSION } from "../lib/formulas";

const router: IRouter = Router();

router.get("/audit/:isin/history/:date", async (req, res): Promise<void> => {
  const rawIsin = Array.isArray(req.params.isin) ? req.params.isin[0] : req.params.isin;
  const rawDate = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;

  const [security, score, research, gates, signals, position, filings, revisions] = await Promise.all([
    db.select().from(securitiesTable).where(eq(securitiesTable.isin, rawIsin)).then(r => r[0]),
     db.select().from(candidateScoresTable).where(and(eq(candidateScoresTable.isin, rawIsin), lte(candidateScoresTable.scoreDate, rawDate))).orderBy(desc(candidateScoresTable.scoreDate)).limit(1).then(r => r[0]),
     db.select().from(researchScoresTable).where(and(eq(researchScoresTable.isin, rawIsin), lte(researchScoresTable.scoreDate, rawDate))).orderBy(desc(researchScoresTable.scoreDate)).limit(1).then(r => r[0]),
     db.select().from(hardGatesTable).where(and(eq(hardGatesTable.isin, rawIsin), lte(hardGatesTable.flaggedAt, rawDate))).orderBy(desc(hardGatesTable.flaggedAt)),
     db.select().from(signalsTable).where(and(eq(signalsTable.isin, rawIsin), lte(signalsTable.signalDate, rawDate))).orderBy(desc(signalsTable.signalDate)),
     db.select().from(portfolioPositionsTable).where(and(eq(portfolioPositionsTable.isin, rawIsin), lte(portfolioPositionsTable.entryDate, rawDate))).orderBy(desc(portfolioPositionsTable.entryDate)).limit(1).then(r => r[0]),
      db.select().from(rawDataRecordsTable).where(eq(rawDataRecordsTable.documentId, rawIsin)).orderBy(desc(rawDataRecordsTable.capturedAt)),
      db.select().from(pointInTimeFactsTable).where(and(eq(pointInTimeFactsTable.isin, rawIsin), gt(pointInTimeFactsTable.revisionAt, new Date(`${rawDate}T23:59:59Z`)))).orderBy(pointInTimeFactsTable.revisionAt),
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
       confidence: s.confidence ? parseFloat(s.confidence) : 0,
       stale_penalty: s.stalePenalty ? parseFloat(s.stalePenalty) : 0,
       event_penalty: s.eventPenalty ? parseFloat(s.eventPenalty) : 0,
       risk_penalty: s.riskPenalty ? parseFloat(s.riskPenalty) : 0,
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
     available_filings: filings.map(f => ({
       document_id: f.documentId,
       provider_id: f.providerId,
       captured_at: f.capturedAt.toISOString(),
       parsing_status: f.parsingStatus,
       payload_hash: f.payloadHash,
     })),
     later_revisions: revisions.map(f => ({
       fact_key: f.factKey,
       revision_at: f.revisionAt?.toISOString() ?? null,
       source_document_id: f.sourceDocumentId,
       reconciliation_status: f.reconciliationStatus,
     })),
  });
});

export default router;
