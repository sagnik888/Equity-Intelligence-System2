/**
 * IEIS v7.2 — Seed script
 * Populates all tables with realistic Indian equity data.
 * Run: pnpm --filter @workspace/api-server tsx src/seed.ts
 */
import { db } from "@workspace/db";
import {
  securitiesTable,
  candidateScoresTable,
  scoreHistoryTable,
  rankingsTable,
  hardGatesTable,
  signalsTable,
  signalHistoryTable,
  portfolioPositionsTable,
  researchScoresTable,
  evidenceLedgerTable,
  watchlistEntriesTable,
  backtestResultsTable,
  alertsTable,
  recentChangesTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

// ─── helpers ──────────────────────────────────────────────────────────────────

function n(v: number, d = 2) { return v.toFixed(d); }
function rnd(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]!; }

const TODAY = new Date().toISOString().split("T")[0]!;
function daysAgo(d: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().split("T")[0]!;
}

// ─── master security list ─────────────────────────────────────────────────────

const SECURITIES = [
  // Large-cap
  { isin: "INE002A01018", ticker: "RELIANCE", name: "Reliance Industries Ltd", sector: "Energy", industry: "Integrated Oil & Gas", sub: "Refining & Petrochemicals", group: "large_cap", mcap: 1840000, ev: 2010000, price: 2720, rev: 902000, ebitda: 143000, pat: 79020, cfo: 138000, fcf: 58000, rev3y: 18.4, eps3y: 22.1, roic: 11.2, roce: 13.4, roe: 9.8, ebitdam: 15.9, ndEbitda: 1.8, ic: 8.2, pe: 23.2, pb: 2.2, evEbitda: 14.1, fcfY: 3.2, dy: 0.4, dtv: 1200, promoter: 50.2, fii: 24.1, dii: 15.8, dc: 87, dcClass: "high" },
  { isin: "INE467B01029", ticker: "TCS", name: "Tata Consultancy Services", sector: "Technology", industry: "IT Services", sub: "IT Services & Consulting", group: "large_cap", mcap: 1460000, ev: 1450000, price: 3970, rev: 237000, ebitda: 62800, pat: 47000, cfo: 53000, fcf: 50200, rev3y: 11.8, eps3y: 14.2, roic: 51.4, roce: 70.2, roe: 50.2, ebitdam: 26.5, ndEbitda: -0.8, ic: 120, pe: 31.1, pb: 15.2, evEbitda: 23.1, fcfY: 3.4, dy: 1.8, dtv: 820, promoter: 72.3, fii: 11.8, dii: 13.2, dc: 94, dcClass: "high" },
  { isin: "INE040A01034", ticker: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Financials", industry: "Private Banks", sub: "Retail Banking", group: "large_cap", mcap: 1220000, ev: null, price: 1620, rev: 275000, ebitda: null, pat: 69300, cfo: 185000, fcf: null, rev3y: 22.1, eps3y: 18.4, roic: null, roce: null, roe: 17.2, ebitdam: null, ndEbitda: null, ic: null, pe: 17.6, pb: 2.1, evEbitda: null, fcfY: null, dy: 1.2, dtv: 1100, promoter: 0, fii: 52.4, dii: 22.8, dc: 91, dcClass: "high" },
  { isin: "INE009A01021", ticker: "INFY", name: "Infosys Ltd", sector: "Technology", industry: "IT Services", sub: "IT Services & Consulting", group: "large_cap", mcap: 830000, ev: 820000, price: 1980, rev: 163900, ebitda: 41400, pat: 26248, cfo: 38100, fcf: 36900, rev3y: 10.2, eps3y: 12.1, roic: 34.8, roce: 47.2, roe: 32.8, ebitdam: 25.3, ndEbitda: -0.9, ic: 95, pe: 31.6, pb: 10.4, evEbitda: 19.8, fcfY: 4.4, dy: 2.2, dtv: 550, promoter: 14.8, fii: 32.4, dii: 34.1, dc: 93, dcClass: "high" },
  { isin: "INE030A01027", ticker: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Financials", industry: "Private Banks", sub: "Universal Banking", group: "large_cap", mcap: 960000, ev: null, price: 1368, rev: 220000, ebitda: null, pat: 44400, cfo: 142000, fcf: null, rev3y: 24.2, eps3y: 29.8, roic: null, roce: null, roe: 18.8, ebitdam: null, ndEbitda: null, ic: null, pe: 21.6, pb: 3.4, evEbitda: null, fcfY: null, dy: 0.8, dtv: 750, promoter: 0, fii: 46.8, dii: 30.2, dc: 90, dcClass: "high" },
  { isin: "INE585B01010", ticker: "BAJFINANCE", name: "Bajaj Finance Ltd", sector: "Financials", industry: "NBFCs", sub: "Consumer Finance", group: "large_cap", mcap: 500000, ev: null, price: 8120, rev: 72000, ebitda: null, pat: 17800, cfo: 85000, fcf: null, rev3y: 29.2, eps3y: 24.8, roic: null, roce: null, roe: 22.4, ebitdam: null, ndEbitda: null, ic: null, pe: 28.1, pb: 5.8, evEbitda: null, fcfY: null, dy: 0.4, dtv: 420, promoter: 54.8, fii: 18.2, dii: 19.4, dc: 88, dcClass: "high" },
  { isin: "INE117A01022", ticker: "WIPRO", name: "Wipro Ltd", sector: "Technology", industry: "IT Services", sub: "IT Services", group: "large_cap", mcap: 340000, ev: 330000, price: 310, rev: 90000, ebitda: 19800, pat: 12400, cfo: 17200, fcf: 16100, rev3y: 8.4, eps3y: 9.2, roic: 20.2, roce: 26.4, roe: 17.8, ebitdam: 22.0, ndEbitda: -0.4, ic: 45, pe: 27.4, pb: 4.6, evEbitda: 16.7, fcfY: 4.7, dy: 1.4, dtv: 320, promoter: 72.9, fii: 8.4, dii: 14.8, dc: 88, dcClass: "high" },
  { isin: "INE721A01013", ticker: "SBIN", name: "State Bank of India", sector: "Financials", industry: "Public Sector Banks", sub: "Universal Banking", group: "large_cap", mcap: 750000, ev: null, price: 840, rev: 580000, ebitda: null, pat: 61200, cfo: 420000, fcf: null, rev3y: 28.4, eps3y: 42.1, roic: null, roce: null, roe: 18.1, ebitdam: null, ndEbitda: null, ic: null, pe: 12.3, pb: 2.2, evEbitda: null, fcfY: null, dy: 1.8, dtv: 900, promoter: 57.5, fii: 10.8, dii: 22.4, dc: 82, dcClass: "high" },
  { isin: "INE148O01028", ticker: "TITAN", name: "Titan Company Ltd", sector: "Consumer Discretionary", industry: "Jewellery & Accessories", sub: "Jewellery", group: "large_cap", mcap: 340000, ev: 338000, price: 3820, rev: 58000, ebitda: 6100, pat: 4400, cfo: 5200, fcf: 4800, rev3y: 22.8, eps3y: 24.4, roic: 28.4, roce: 38.2, roe: 32.4, ebitdam: 10.5, ndEbitda: -0.1, ic: 42, pe: 77.3, pb: 24.2, evEbitda: 55.4, fcfY: 1.4, dy: 0.4, dtv: 220, promoter: 52.9, fii: 16.4, dii: 22.8, dc: 86, dcClass: "high" },
  { isin: "INE196A01026", ticker: "HINDUNILVR", name: "Hindustan Unilever Ltd", sector: "Consumer Staples", industry: "FMCG", sub: "Household Products", group: "large_cap", mcap: 590000, ev: 580000, price: 2510, rev: 62000, ebitda: 14200, pat: 10700, cfo: 12800, fcf: 12200, rev3y: 7.2, eps3y: 8.8, roic: 88.2, roce: 118, roe: 72.4, ebitdam: 22.9, ndEbitda: -0.2, ic: 280, pe: 55.1, pb: 39.4, evEbitda: 40.8, fcfY: 2.1, dy: 1.6, dtv: 280, promoter: 61.9, fii: 14.8, dii: 18.4, dc: 92, dcClass: "high" },
  { isin: "INE883A01011", ticker: "ASIANPAINT", name: "Asian Paints Ltd", sector: "Materials", industry: "Paints & Coatings", sub: "Decorative Paints", group: "large_cap", mcap: 310000, ev: 305000, price: 3240, rev: 37000, ebitda: 6800, pat: 5200, cfo: 6100, fcf: 5400, rev3y: 12.4, eps3y: 10.8, roic: 48.4, roce: 62.4, roe: 38.4, ebitdam: 18.4, ndEbitda: -0.1, ic: 88, pe: 59.6, pb: 22.2, evEbitda: 44.9, fcfY: 1.7, dy: 0.8, dtv: 180, promoter: 52.6, fii: 15.2, dii: 24.4, dc: 90, dcClass: "high" },
  { isin: "INE208A01029", ticker: "AXISBANK", name: "Axis Bank Ltd", sector: "Financials", industry: "Private Banks", sub: "Universal Banking", group: "large_cap", mcap: 420000, ev: null, price: 1365, rev: 152000, ebitda: null, pat: 28000, cfo: 95000, fcf: null, rev3y: 21.4, eps3y: 28.2, roic: null, roce: null, roe: 18.2, ebitdam: null, ndEbitda: null, ic: null, pe: 15.0, pb: 2.7, evEbitda: null, fcfY: null, dy: 0.2, dtv: 380, promoter: 8.2, fii: 48.4, dii: 30.2, dc: 87, dcClass: "high" },

  // Mid-cap
  { isin: "INE858B01029", ticker: "LALPATHLAB", name: "Dr Lal PathLabs Ltd", sector: "Healthcare", industry: "Diagnostics", sub: "Pathology Labs", group: "mid_cap", mcap: 28000, ev: 27200, price: 3350, rev: 2440, ebitda: 680, pat: 440, cfo: 580, fcf: 490, rev3y: 14.2, eps3y: 16.8, roic: 42.4, roce: 58.2, roe: 24.4, ebitdam: 27.9, ndEbitda: -0.4, ic: 48, pe: 63.6, pb: 15.2, evEbitda: 40.0, fcfY: 1.8, dy: 0.6, dtv: 22, promoter: 54.8, fii: 12.4, dii: 18.8, dc: 82, dcClass: "high" },
  { isin: "INE752E01010", ticker: "PIIND", name: "PI Industries Ltd", sector: "Materials", industry: "Agrochemicals", sub: "Crop Protection", group: "mid_cap", mcap: 62000, ev: 60000, price: 4120, rev: 9200, ebitda: 2100, pat: 1640, cfo: 1820, fcf: 1620, rev3y: 16.8, eps3y: 22.4, roic: 28.4, roce: 36.2, roe: 22.4, ebitdam: 22.8, ndEbitda: 0.2, ic: 42, pe: 37.8, pb: 8.4, evEbitda: 28.6, fcfY: 2.7, dy: 0.4, dtv: 48, promoter: 45.9, fii: 22.4, dii: 24.8, dc: 80, dcClass: "high" },
  { isin: "INE002S01010", ticker: "AARTIIND", name: "Aarti Industries Ltd", sector: "Materials", industry: "Specialty Chemicals", sub: "Benzene Derivatives", group: "mid_cap", mcap: 22000, ev: 25000, price: 772, rev: 7200, ebitda: 1450, pat: 820, cfo: 1100, fcf: 680, rev3y: 10.2, eps3y: 8.4, roic: 14.8, roce: 18.2, roe: 16.4, ebitdam: 20.1, ndEbitda: 2.1, ic: 8.4, pe: 26.8, pb: 4.2, evEbitda: 17.2, fcfY: 3.1, dy: 0.8, dtv: 38, promoter: 46.8, fii: 14.8, dii: 20.2, dc: 75, dcClass: "acceptable" },
  { isin: "INE179B01024", ticker: "ESCORTS", name: "Escorts Kubota Ltd", sector: "Industrials", industry: "Farm Equipment", sub: "Tractors", group: "mid_cap", mcap: 48000, ev: 46000, price: 3880, rev: 8400, ebitda: 1180, pat: 860, cfo: 1020, fcf: 880, rev3y: 12.4, eps3y: 18.2, roic: 18.8, roce: 24.4, roe: 16.8, ebitdam: 14.0, ndEbitda: 0.4, ic: 22, pe: 55.8, pb: 9.2, evEbitda: 39.0, fcfY: 1.9, dy: 0.4, dtv: 42, promoter: 41.8, fii: 22.8, dii: 22.4, dc: 78, dcClass: "acceptable" },
  { isin: "INE694G01014", ticker: "KPRMILL", name: "K.P.R. Mill Ltd", sector: "Consumer Discretionary", industry: "Textiles", sub: "Integrated Textiles", group: "mid_cap", mcap: 24000, ev: 23000, price: 1840, rev: 6200, ebitda: 1380, pat: 840, cfo: 1150, fcf: 920, rev3y: 18.4, eps3y: 21.2, roic: 22.4, roce: 28.8, roe: 20.4, ebitdam: 22.3, ndEbitda: 0.8, ic: 18, pe: 28.6, pb: 5.8, evEbitda: 16.7, fcfY: 4.0, dy: 0.6, dtv: 28, promoter: 74.2, fii: 5.2, dii: 12.8, dc: 72, dcClass: "acceptable" },

  // Small-cap
  { isin: "INE168S01023", ticker: "ELGIEQUIP", name: "Elgi Equipments Ltd", sector: "Industrials", industry: "Industrial Machinery", sub: "Air Compressors", group: "small_cap", mcap: 18000, ev: 17200, price: 575, rev: 3200, ebitda: 520, pat: 380, cfo: 440, fcf: 380, rev3y: 16.4, eps3y: 20.8, roic: 26.4, roce: 34.2, roe: 22.8, ebitdam: 16.3, ndEbitda: 0.4, ic: 28, pe: 47.4, pb: 10.8, evEbitda: 33.1, fcfY: 2.2, dy: 0.8, dtv: 12, promoter: 46.8, fii: 8.2, dii: 18.4, dc: 68, dcClass: "acceptable" },
  { isin: "INE323B01020", ticker: "SUPRAJIT", name: "Suprajit Engineering Ltd", sector: "Consumer Discretionary", industry: "Auto Components", sub: "Cables & Controls", group: "small_cap", mcap: 9800, ev: 9200, price: 690, rev: 2800, ebitda: 390, pat: 225, cfo: 320, fcf: 260, rev3y: 12.8, eps3y: 14.4, roic: 20.4, roce: 26.8, roe: 18.4, ebitdam: 13.9, ndEbitda: 0.8, ic: 18, pe: 43.6, pb: 8.0, evEbitda: 23.6, fcfY: 2.8, dy: 0.6, dtv: 8, promoter: 56.4, fii: 6.8, dii: 16.4, dc: 65, dcClass: "acceptable" },
  { isin: "INE522F01014", ticker: "VSTIND", name: "VST Industries Ltd", sector: "Consumer Staples", industry: "Tobacco", sub: "Cigarettes", group: "small_cap", mcap: 10400, ev: 10000, price: 6800, rev: 1280, ebitda: 480, pat: 340, cfo: 390, fcf: 360, rev3y: 8.2, eps3y: 11.4, roic: 68.4, roce: 88.2, roe: 52.4, ebitdam: 37.5, ndEbitda: -0.2, ic: 220, pe: 30.6, pb: 16.0, evEbitda: 20.8, fcfY: 3.6, dy: 3.2, dtv: 6, promoter: 32.2, fii: 18.4, dii: 20.8, dc: 74, dcClass: "acceptable" },

  // Hard gate candidates (for demonstration)
  { isin: "INE880J01026", ticker: "YESBANK", name: "Yes Bank Ltd", sector: "Financials", industry: "Private Banks", sub: "Universal Banking", group: "large_cap", mcap: 85000, ev: null, price: 22, rev: 38000, ebitda: null, pat: 2900, cfo: 18000, fcf: null, rev3y: -8.2, eps3y: -42.1, roic: null, roce: null, roe: 4.4, ebitdam: null, ndEbitda: null, ic: null, pe: 29.3, pb: 0.8, evEbitda: null, fcfY: null, dy: 0, dtv: 380, promoter: 0, fii: 8.4, dii: 28.4, dc: 58, dcClass: "restricted" },
  { isin: "INE003A01024", ticker: "SUZLON", name: "Suzlon Energy Ltd", sector: "Energy", industry: "Wind Energy", sub: "Wind Turbines", group: "mid_cap", mcap: 68000, ev: 72000, price: 55, rev: 9800, ebitda: 1820, pat: 1200, cfo: 1580, fcf: 820, rev3y: 34.2, eps3y: 120, roic: 14.8, roce: 18.4, roe: 28.4, ebitdam: 18.6, ndEbitda: 2.2, ic: 6.4, pe: 56.7, pb: 15.8, evEbitda: 39.6, fcfY: 1.4, dy: 0, dtv: 280, promoter: 11.4, fii: 8.4, dii: 22.4, dc: 61, dcClass: "acceptable" },
] as const;

// ─── scoring engine ────────────────────────────────────────────────────────────

function computeCandidateScore(s: typeof SECURITIES[number]) {
  // Quality score (weight 20%)
  const quality = Math.min(100, Math.max(0,
    (!s.roic ? 60 : Math.min(100, s.roic * 1.8)) * 0.25 +
    (!s.roce ? 60 : Math.min(100, s.roce * 1.2)) * 0.15 +
    Math.min(100, s.ebitdam * 2.5) * 0.20 +
    (!s.ic ? 70 : Math.min(100, s.ic * 1.5)) * 0.20 +
    70 * 0.20  // stability placeholder
  ));

  // Growth score (weight 20%)
  const growth = Math.min(100, Math.max(0,
    Math.min(100, Math.max(0, (s.rev3y + 5) * 2.5)) * 0.40 +
    Math.min(100, Math.max(0, (s.eps3y + 5) * 2.5)) * 0.40 +
    65 * 0.20
  ));

  // Value score (weight 20%)
  const rawValue = 100 - Math.min(100, Math.max(0, (s.pe ?? 40) - 10) * 1.5);
  const value = Math.min(100, Math.max(0, rawValue));

  // Balance sheet score (weight 15%)
  const ndOk = s.ndEbitda === null ? 70 : Math.min(100, Math.max(0, (3 - s.ndEbitda) * 25));
  const icOk = !s.ic ? 70 : Math.min(100, s.ic * 2.5);
  const balanceSheet = (ndOk * 0.50 + icOk * 0.30 + 70 * 0.20);

  // Capital allocation (weight 15%)
  const capAlloc = Math.min(100,
    (!s.roic ? 60 : Math.min(100, (s.roic - 8) * 5 + 50)) * 0.50 +
    70 * 0.50
  );

  // Integrity (weight 10%)
  const integrity = 70; // placeholder — requires analyst input

  // Weighted Candidate Score
  const raw = quality * 0.20 + growth * 0.20 + value * 0.20 + balanceSheet * 0.15 + capAlloc * 0.15 + integrity * 0.10;

  return { quality, growth, value, balanceSheet, capAlloc, integrity, candidate: Math.min(100, Math.max(0, raw)) };
}

function computeDataConfidence(s: typeof SECURITIES[number]) {
  return s.dc; // already set per security
}

function signalState(hss: number): "strong_buy" | "buy" | "hold" | "sell" | "avoid" {
  if (hss >= 75) return "strong_buy";
  if (hss >= 58) return "buy";
  if (hss >= 42) return "hold";
  if (hss >= 28) return "sell";
  return "avoid";
}

// ─── TRUNCATE + SEED ──────────────────────────────────────────────────────────

async function truncateAll() {
  const tables = [
    "recent_changes", "alerts", "watchlist_entries", "evidence_ledger",
    "research_scores", "signal_history", "signals", "portfolio_positions",
    "hard_gates", "rankings", "score_history", "candidate_scores", "backtest_results", "securities",
  ];
  for (const t of tables) {
    await db.execute(sql.raw(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`));
  }
  console.log("✓ Truncated all tables");
}

async function seedSecurities() {
  for (const s of SECURITIES) {
    await db.insert(securitiesTable).values({
      isin: s.isin, ticker: s.ticker, name: s.name,
      sector: s.sector, industry: s.industry, subIndustry: s.sub,
      universeGroup: s.group as any, status: "active",
      marketCapCr: n(s.mcap), enterpriseValueCr: s.ev ? n(s.ev) : null,
      currentPrice: n(s.price), faceValue: "1", sharesOutstandingCr: n(s.mcap / s.price / 100, 4),
      promoterHoldingPct: n(s.promoter), fiiHoldingPct: n(s.fii), diiHoldingPct: n(s.dii),
      listingDate: "2000-01-01",
      revenueTtmCr: n(s.rev), ebitdaTtmCr: s.ebitda ? n(s.ebitda) : null,
      patTtmCr: n(s.pat), cfoTtmCr: n(s.cfo), fcfTtmCr: s.fcf ? n(s.fcf) : null,
      revenueGrowth3yPct: n(s.rev3y), epsGrowth3yPct: n(s.eps3y),
      roicPct: s.roic ? n(s.roic) : null, rocePct: s.roce ? n(s.roce) : null, roePct: n(s.roe),
      ebitdaMarginPct: s.ebitdam ? n(s.ebitdam) : null,
      netDebtToEbitda: s.ndEbitda !== null ? n(s.ndEbitda) : null,
      interestCoverage: s.ic ? n(s.ic) : null,
      peRatio: s.pe ? n(s.pe) : null, pbRatio: n(s.pb), evEbitda: s.evEbitda ? n(s.evEbitda) : null,
      fcfYieldPct: s.fcfY ? n(s.fcfY) : null, dividendYieldPct: n(s.dy),
      medianDailyTradedValueCr: n(s.dtv),
      dataConfidence: n(s.dc), dataConfidenceClass: s.dcClass as any,
    }).onConflictDoUpdate({ target: securitiesTable.isin, set: { ticker: s.ticker } });
  }
  console.log(`✓ Seeded ${SECURITIES.length} securities`);
}

async function seedScores() {
  const today = TODAY;
  const allScores: { isin: string; score: number }[] = [];

  for (const s of SECURITIES) {
    const scores = computeCandidateScore(s);
    const dc = computeDataConfidence(s);
    const hasL1Gate = s.isin === "INE880J01026"; // YES BANK gets L1

    const hardGateCap = hasL1Gate ? "0" : null;
    const confidenceAdj = scores.candidate * (dc / 100);

    await db.insert(candidateScoresTable).values({
      isin: s.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group,
      candidateScore: n(scores.candidate), qualityScore: n(scores.quality), growthScore: n(scores.growth),
      valueScore: n(scores.value), balanceSheetScore: n(scores.balanceSheet),
      capitalAllocationScore: n(scores.capAlloc), integrityScore: n(scores.integrity),
      confidenceAdjustedScore: n(confidenceAdj), hardGateCap: hardGateCap,
      dataConfidence: n(dc), scoreDate: today, previousScore: n(scores.candidate - rnd(-5, 5)),
      scoreDelta: n(rnd(-5, 5)),
      scoreBreakdown: {
        quality_subs: [
          { name: "Normalized ROIC", value: s.roic, weight: 18, percentile: Math.min(99, Math.max(1, Math.round(scores.quality))) },
          { name: "ROCE", value: s.roce, weight: 8, percentile: null },
          { name: "CFO/PAT", value: s.cfo && s.pat ? +(s.cfo/s.pat).toFixed(2) : null, weight: 12, percentile: null },
          { name: "FCF Conversion", value: s.fcf && s.cfo ? +(s.fcf/s.cfo).toFixed(2) : null, weight: 12, percentile: null },
        ],
      },
    });

    allScores.push({ isin: s.isin, score: scores.candidate });

    // Score history (12 months)
    for (let m = 12; m >= 1; m--) {
      const dt = new Date();
      dt.setMonth(dt.getMonth() - m);
      const drift = rnd(-8, 8);
      await db.insert(scoreHistoryTable).values({
        isin: s.isin, candidateScore: n(Math.max(0, Math.min(100, scores.candidate + drift))),
        qualityScore: n(Math.max(0, Math.min(100, scores.quality + rnd(-5, 5)))),
        growthScore: n(Math.max(0, Math.min(100, scores.growth + rnd(-5, 5)))),
        valueScore: n(Math.max(0, Math.min(100, scores.value + rnd(-5, 5)))),
        dataConfidence: n(dc), scoreDate: dt.toISOString().split("T")[0]!,
      });
    }
  }

  // Rankings — overall
  const sorted = [...allScores].sort((a, b) => b.score - a.score);
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!;
    const s = SECURITIES.find(x => x.isin === entry.isin)!;
    await db.insert(rankingsTable).values({
      isin: entry.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group,
      dimension: "overall", rank: i + 1, score: n(entry.score),
      percentile: n((1 - i / sorted.length) * 100), rankChange: Math.round(rnd(-3, 3)),
      rankDate: today,
    });
    // Sector rank (simplified)
    await db.insert(rankingsTable).values({
      isin: entry.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group,
      dimension: "sector", rank: Math.max(1, Math.round(rnd(1, 8))), score: n(entry.score + rnd(-5, 5)),
      percentile: n(rnd(40, 99)), rankChange: Math.round(rnd(-2, 2)), rankDate: today,
    });
    await db.insert(rankingsTable).values({
      isin: entry.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group,
      dimension: "quality", rank: Math.max(1, Math.round(rnd(1, 10))), score: n(rnd(50, 95)),
      percentile: n(rnd(50, 99)), rankChange: Math.round(rnd(-2, 2)), rankDate: today,
    });
    await db.insert(rankingsTable).values({
      isin: entry.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group,
      dimension: "market_cap", rank: Math.max(1, i + 1), score: n(Math.log10(s.mcap + 1) * 100, 4),
      percentile: n((1 - i / sorted.length) * 100), rankChange: 0, rankDate: today,
    });
    await db.insert(rankingsTable).values({
      isin: entry.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group,
      dimension: "persistence", rank: Math.max(1, Math.round(rnd(1, 10))), score: n(rnd(40, 95)),
      percentile: n(rnd(40, 99)), rankChange: Math.round(rnd(-1, 1)), rankDate: today,
    });
  }
  console.log("✓ Seeded scores, history, rankings");
}

async function seedHardGates() {
  await db.insert(hardGatesTable).values([
    {
      isin: "INE880J01026", ticker: "YESBANK", name: "Yes Bank Ltd", sector: "Financials",
      level: 1, trigger: "PROMOTER_PLEDGE_BREACH",
      state: "avoid" as any,
      description: "Promoter holding at near-zero; RBI-mandated reconstruction still ongoing. Evidence of evergreening; external audit qualified accounts for FY2020-22.",
      flaggedAt: daysAgo(180),
    },
    {
      isin: "INE880J01026", ticker: "YESBANK", name: "Yes Bank Ltd", sector: "Financials",
      level: 1, trigger: "AUDITOR_QUALIFICATION",
      state: "avoid" as any,
      description: "Going concern note from auditors for FY2020, FY2021. Multiple material weaknesses noted in internal financial controls.",
      flaggedAt: daysAgo(120),
    },
    {
      isin: "INE003A01024", ticker: "SUZLON", name: "Suzlon Energy Ltd", sector: "Energy",
      level: 2, trigger: "DEBT_COVENANT_RISK",
      state: "capped" as any, capScore: "55",
      description: "Debt covenant headroom tight (ND/EBITDA 2.2x). Order book growth strong but working capital cycle extended. Cap at 55 pending two clean quarters.",
      flaggedAt: daysAgo(45),
    },
    {
      isin: "INE117A01022", ticker: "WIPRO", name: "Wipro Ltd", sector: "Technology",
      level: 3, trigger: "RELATED_PARTY_ELEVATED",
      state: "penalized" as any, penaltyPoints: "5",
      description: "Related party transactions with promoter entities at above-market rates flagged by proxy advisors. Under enhanced monitoring. 5pt penalty applied to candidate score.",
      flaggedAt: daysAgo(22),
    },
  ]);
  console.log("✓ Seeded hard gates");
}

async function seedSignals() {
  const horizons = ["daily", "weekly", "monthly", "medium", "long"] as const;
  const horizonHssBase: Record<string, number> = {
    daily: 0, weekly: 2, monthly: 5, medium: 8, long: 10
  };

  for (const s of SECURITIES) {
    const scores = computeCandidateScore(s);
    const baseHss = Math.min(92, Math.max(18, scores.candidate * 0.9 + rnd(-8, 8)));
    const hasL1 = s.isin === "INE880J01026";

    for (const h of horizons) {
      const rawHss = hasL1 ? 0 : Math.min(95, Math.max(10, baseHss + horizonHssBase[h]! + rnd(-6, 6)));
      const confidence = hasL1 ? 0 : Math.min(98, Math.max(40, s.dc * 0.9 + rnd(-8, 8)));
      const stalePenalty = rnd(0, 3);
      const eventPenalty = rnd(0, 5);
      const riskPenalty = rnd(0, 4);
      const hss = Math.max(0, rawHss - stalePenalty - eventPenalty - riskPenalty);
      const state = hasL1 ? "avoid" : signalState(hss);
      const hardGateCap = s.isin === "INE003A01024" ? "55" : null;
      const cappeHss = hardGateCap ? Math.min(hss, parseFloat(hardGateCap)) : hss;

      await db.insert(signalsTable).values({
        isin: s.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group,
        horizon: h, state: state as any, hss: n(cappeHss), confidence: n(confidence),
        stalePenalty: n(stalePenalty), eventPenalty: n(eventPenalty), riskPenalty: n(riskPenalty),
        hardGateCap: hardGateCap,
        alignmentScore: n(rnd(40, 90)),
        candidateScore: n(scores.candidate), currentPrice: n(s.price),
        daysInState: Math.round(rnd(1, 45)),
        signalDate: TODAY,
      });

      // Signal history (8 weeks)
      for (let w = 8; w >= 1; w--) {
        const dt = new Date();
        dt.setDate(dt.getDate() - w * 7);
        const hHist = Math.max(10, hss + rnd(-10, 10));
        await db.insert(signalHistoryTable).values({
          isin: s.isin, horizon: h, state: signalState(hHist) as any,
          hss: n(hHist), confidence: n(confidence), signalDate: dt.toISOString().split("T")[0]!,
        });
      }
    }
  }
  console.log("✓ Seeded signals + history");
}

async function seedPortfolio() {
  const positions = [
    { isin: "INE467B01029", ticker: "TCS", name: "Tata Consultancy Services", sector: "Technology", qty: 150, entry: 3720, current: 3970, stop: 3350, target: 4400, horizon: "long", status: "open", score: 88.4, signal: "strong_buy" },
    { isin: "INE009A01021", ticker: "INFY", name: "Infosys Ltd", sector: "Technology", qty: 300, entry: 1850, current: 1980, stop: 1670, target: 2200, horizon: "medium", status: "open", score: 82.1, signal: "buy" },
    { isin: "INE002A01018", ticker: "RELIANCE", name: "Reliance Industries Ltd", sector: "Energy", qty: 200, entry: 2650, current: 2720, stop: 2400, target: 3100, horizon: "medium", status: "paper", score: 72.4, signal: "buy" },
    { isin: "INE858B01029", ticker: "LALPATHLAB", name: "Dr Lal PathLabs Ltd", sector: "Healthcare", qty: 80, entry: 3100, current: 3350, stop: 2800, target: 4000, horizon: "long", status: "paper", score: 78.8, signal: "strong_buy" },
    { isin: "INE752E01010", ticker: "PIIND", name: "PI Industries Ltd", sector: "Materials", qty: 120, entry: 3980, current: 4120, stop: 3600, target: 4800, horizon: "medium", status: "open", score: 76.2, signal: "buy" },
  ];

  for (const p of positions) {
    await db.insert(portfolioPositionsTable).values({
      isin: p.isin, ticker: p.ticker, name: p.name, sector: p.sector,
      quantity: p.qty, entryPrice: n(p.entry), currentPrice: n(p.current),
      stopPrice: n(p.stop), targetPrice: n(p.target),
      horizon: p.horizon as any, status: p.status as any,
      entryDate: daysAgo(Math.round(rnd(10, 90))),
      currentCandidateScore: n(p.score),
      currentSignal: p.signal,
      suitabilityScore: n(p.score * 0.92),
    });
  }
  console.log("✓ Seeded portfolio positions");
}

async function seedResearch() {
  const covered = SECURITIES.slice(0, 8);
  for (const s of covered) {
    const scores = computeCandidateScore(s);
    const bq = Math.min(100, scores.quality + rnd(-5, 10));
    const ig = Math.min(100, scores.integrity + rnd(-3, 8));
    const val = Math.min(100, scores.value + rnd(-5, 10));
    const rs = (bq * 0.15 + 70 * 0.10 + scores.quality * 0.15 + scores.capAlloc * 0.10 + ig * 0.20 + 68 * 0.10 + val * 0.15 + 72 * 0.03 + 65 * 0.02);
    const fairValue = s.price * rnd(0.85, 1.45);
    await db.insert(researchScoresTable).values({
      isin: s.isin, ticker: s.ticker, name: s.name, sector: s.sector,
      coverageTier: "full" as any,
      researchScore: n(rs), adjustedResearchScore: n(rs * (s.dc / 100)),
      confidence: n(s.dc * 0.85),
      businessQualityScore: n(bq), industryStructureScore: n(rnd(55, 88)),
      financialQualityScore: n(scores.quality), capitalAllocationScore: n(scores.capAlloc),
      integrityGovernanceScore: n(ig), forecastResilienceScore: n(rnd(55, 85)),
      valuationScore: n(val), catalystsScore: n(rnd(55, 80)), technicalExecutionScore: n(rnd(55, 78)),
      valuationMethod: "DCF + EV/EBITDA blend",
      fairValueBase: n(fairValue), fairValueBull: n(fairValue * 1.2), fairValueBear: n(fairValue * 0.75),
      weightedFairValue: n(fairValue * 0.6 + fairValue * 1.2 * 0.25 + fairValue * 0.75 * 0.15),
      expectedAnnualReturnPct: n(((fairValue * 1.05) / s.price - 1) * 100),
      horizonYears: "3",
      currentPrice: n(s.price),
      analystNotes: `${s.name} has demonstrated consistent compounding of returns. Management has a strong track record of capital allocation. Moat driven by ${s.industry} incumbency advantage.`,
      scoreDate: TODAY,
    });

    // Evidence entries
    await db.insert(evidenceLedgerTable).values([
      {
        claimId: `${s.isin}-ROIC-1`,
        isin: s.isin,
        claim: `${s.name} ROIC consistently above 15% for 5 consecutive years`,
        claimType: "fundamental",
        source: "Annual Report FY2024",
        sourceGrade: "primary",
        documentId: `${s.ticker}-AR-2024`,
        pageOrSection: "Management Discussion & Analysis",
        filingTimestamp: `${daysAgo(60)}T09:00:00Z`,
        supportingEvidence: `FY2024 ROIC: ${s.roic?.toFixed(1) ?? "N/A"}%, FY2023: ${(+(s.roic ?? 15) - 1).toFixed(1)}%, FY2022: ${(+(s.roic ?? 15) - 2).toFixed(1)}%`,
        contradictoryEvidence: "",
        analystInference: false, aiInference: false,
        confidence: n(s.dc * 0.9),
        reviewStatus: "confirmed",
        affectedScore: "quality_score",
      },
      {
        claimId: `${s.isin}-MGMT-1`,
        isin: s.isin,
        claim: `Management guided for ${Math.round(s.rev3y)}% revenue growth guidance for FY2025`,
        claimType: "fundamental",
        source: "Earnings Call Transcript Q4 FY2024",
        sourceGrade: "secondary",
        documentId: `${s.ticker}-EC-Q4FY24`,
        pageOrSection: "Q&A Section",
        filingTimestamp: `${daysAgo(45)}T14:00:00Z`,
        supportingEvidence: `Management explicitly guided for sustained growth. Order book at all-time high.`,
        contradictoryEvidence: "Analyst estimates range from 12% to 28%, wide dispersion.",
        analystInference: true, aiInference: false,
        confidence: n(72),
        reviewStatus: "confirmed",
        affectedScore: "growth_score",
      },
    ]);
  }
  console.log("✓ Seeded research + evidence");
}

async function seedWatchlists() {
  const byScore = [...SECURITIES].sort((a, b) => {
    const sa = computeCandidateScore(a).candidate;
    const sb = computeCandidateScore(b).candidate;
    return sb - sa;
  });

  // elite_candidates: top 5
  for (const s of byScore.slice(0, 5)) {
    await db.insert(watchlistEntriesTable).values({ watchlistName: "elite_candidates", isin: s.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group, addedAt: daysAgo(2) });
  }
  // quality_at_reasonable_value: high quality + PE < 40
  const qarv = byScore.filter(s => s.pe && s.pe < 40 && s.roic && s.roic > 15);
  for (const s of qarv.slice(0, 4)) {
    await db.insert(watchlistEntriesTable).values({ watchlistName: "quality_at_reasonable_value", isin: s.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group, addedAt: daysAgo(3) });
  }
  // emerging_compounders: mid/small cap
  const emerging = SECURITIES.filter(s => s.group === "mid_cap" || s.group === "small_cap");
  for (const s of emerging.slice(0, 3)) {
    await db.insert(watchlistEntriesTable).values({ watchlistName: "emerging_compounders", isin: s.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group, addedAt: daysAgo(1) });
  }
  // governance_deterioration + balance_sheet_risk
  for (const s of [SECURITIES.find(x => x.ticker === "YESBANK")!, SECURITIES.find(x => x.ticker === "SUZLON")!]) {
    await db.insert(watchlistEntriesTable).values({ watchlistName: "governance_deterioration", isin: s.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group, addedAt: daysAgo(5) });
    await db.insert(watchlistEntriesTable).values({ watchlistName: "balance_sheet_risk", isin: s.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group, addedAt: daysAgo(5) });
  }
  // pending_resolution
  await db.insert(watchlistEntriesTable).values({ watchlistName: "pending_resolution", isin: "INE880J01026", ticker: "YESBANK", name: "Yes Bank Ltd", sector: "Financials", universeGroup: "large_cap", addedAt: daysAgo(180) });
  // value_traps
  await db.insert(watchlistEntriesTable).values({ watchlistName: "value_traps", isin: "INE880J01026", ticker: "YESBANK", name: "Yes Bank Ltd", sector: "Financials", universeGroup: "large_cap", addedAt: daysAgo(30) });
  // recent_upgrades: top 3
  for (const s of byScore.slice(0, 3)) {
    await db.insert(watchlistEntriesTable).values({ watchlistName: "recent_upgrades", isin: s.isin, ticker: s.ticker, name: s.name, sector: s.sector, universeGroup: s.group, addedAt: daysAgo(1) });
  }
  console.log("✓ Seeded watchlists");
}

async function seedBacktest() {
  // Generate equity curve (36 months)
  function makeEquityCurve() {
    const points = [];
    let val = 100, bm = 100;
    const start = new Date();
    start.setMonth(start.getMonth() - 36);
    for (let m = 0; m <= 36; m++) {
      const dt = new Date(start);
      dt.setMonth(dt.getMonth() + m);
      val *= 1 + rnd(-0.03, 0.05);
      bm *= 1 + rnd(-0.025, 0.038);
      points.push({ date: dt.toISOString().split("T")[0], value: +val.toFixed(2), benchmark: +bm.toFixed(2) });
    }
    return points;
  }

  function makeDecileReturns() {
    return Array.from({ length: 10 }, (_, i) => ({
      decile: i + 1,
      return_pct: +((10 - i) * 2.8 + rnd(-2, 2)).toFixed(2),
    }));
  }

  await db.insert(backtestResultsTable).values([
    {
      name: "IEIS v7.2 Candidate Score Backtest — Nifty 500 Universe",
      testType: "candidate_score" as any, status: "completed" as any,
      periodFrom: daysAgo(365 * 3), periodTo: TODAY,
      cagrPct: "22.8", excessReturnPct: "11.4", volatilityPct: "18.2", maxDrawdownPct: "-24.1",
      drawdownDurationDays: 142, sharpeRatio: "1.25", sortinoRatio: "1.78", calmarRatio: "0.95",
      informationRatio: "0.82", hitRatePct: "54.2", upsideCapturePct: "112", downsideCapturePct: "78",
      rankIc: "0.0412", rankIcStability: "0.72", decileSpreadPct: "8.3", decileMonotonicityPct: "82",
      turnoverPct: "42", avgSlippageBps: "18", avgMarketImpactBps: "12",
      deflatedSharpe: "0.94", probabilityOfOverfitting: "0.12",
      equityCurve: makeEquityCurve(), decileReturns: makeDecileReturns(),
      notes: "Walk-forward 3Y backtest. Universe: Nifty 500 + ~500 liquid mid-caps. Rebalancing: monthly. Transaction costs included at 30bps round-trip. No leverage.",
    },
    {
      name: "Daily Signal State Machine — Large-Cap Sub-Universe",
      testType: "daily_signal" as any, status: "completed" as any,
      periodFrom: daysAgo(365 * 2), periodTo: TODAY,
      cagrPct: "18.2", excessReturnPct: "7.8", volatilityPct: "22.4", maxDrawdownPct: "-31.2",
      drawdownDurationDays: 94, sharpeRatio: "0.81", sortinoRatio: "1.12", calmarRatio: "0.58",
      informationRatio: "0.62", hitRatePct: "52.8", upsideCapturePct: "108", downsideCapturePct: "82",
      rankIc: "0.0318", rankIcStability: "0.58", decileSpreadPct: "6.1", decileMonotonicityPct: "74",
      turnoverPct: "180", avgSlippageBps: "24", avgMarketImpactBps: "18",
      deflatedSharpe: "0.62", probabilityOfOverfitting: "0.21",
      equityCurve: makeEquityCurve(), decileReturns: makeDecileReturns(),
      notes: "High-turnover daily strategy. Capital friction material. Suitable only for liquid large-caps with DTV > ₹50 Cr.",
    },
    {
      name: "Quality Factor — Long-Only Decile 1 vs Benchmark",
      testType: "factor" as any, status: "completed" as any,
      periodFrom: daysAgo(365 * 5), periodTo: TODAY,
      cagrPct: "26.4", excessReturnPct: "14.8", volatilityPct: "16.8", maxDrawdownPct: "-22.4",
      drawdownDurationDays: 118, sharpeRatio: "1.57", sortinoRatio: "2.24", calmarRatio: "1.18",
      informationRatio: "1.12", hitRatePct: "58.4", upsideCapturePct: "118", downsideCapturePct: "68",
      rankIc: "0.0521", rankIcStability: "0.84", decileSpreadPct: "12.4", decileMonotonicityPct: "91",
      turnoverPct: "28", avgSlippageBps: "12", avgMarketImpactBps: "8",
      deflatedSharpe: "1.22", probabilityOfOverfitting: "0.08",
      equityCurve: makeEquityCurve(), decileReturns: makeDecileReturns(),
      notes: "Pure Quality factor (ROIC + Margin + Stability) 5Y backtest. Best risk-adjusted performer in the factor zoo.",
    },
  ]);
  console.log("✓ Seeded backtest results");
}

async function seedAlertsAndChanges() {
  await db.insert(alertsTable).values([
    { type: "hard_gate_level1" as any, severity: "critical" as any, isin: "INE880J01026", ticker: "YESBANK", title: "Level 1 Hard Gate Active", message: "Yes Bank: Promoter pledge breach and auditor qualification persist. Stock excluded from all ranking and signal systems.", isRead: false },
    { type: "gate_triggered" as any, severity: "high" as any, isin: "INE003A01024", ticker: "SUZLON", title: "Level 2 Gate: Score Capped at 55", message: "Suzlon Energy: Debt covenant risk. Candidate score capped at 55 pending two consecutive clean quarters.", isRead: false },
    { type: "signal_change" as any, severity: "medium" as any, isin: "INE467B01029", ticker: "TCS", title: "Signal Upgrade: TCS Daily → Strong Buy", message: "TCS daily HSS crossed 75 threshold. Multi-horizon alignment confirmed. Consider position entry.", isRead: false },
    { type: "signal_change" as any, severity: "medium" as any, isin: "INE009A01021", ticker: "INFY", title: "Signal Change: Infosys Monthly Hold → Buy", message: "Monthly HSS improved from 52 to 68 following positive Q1 guidance. Alignment with long-term signal strengthened.", isRead: true },
    { type: "data_stale" as any, severity: "low" as any, isin: null, ticker: null, title: "12 Securities: Data Refresh Pending", message: "12 small-cap securities have not received updated financial data in 45+ days. Data confidence degraded.", isRead: true },
    { type: "portfolio_review" as any, severity: "high" as any, isin: null, ticker: null, title: "Portfolio Rebalancing Window Open", message: "Monthly rebalancing window (last 3 trading days of month). Review positions against current signals before close.", isRead: false },
    { type: "system" as any, severity: "info" as any, isin: null, ticker: null, title: "IEIS v7.2 — System Fully Operational", message: "All scoring, signal, and ranking engines running in alert/paper mode. Live trading integration pending broker API setup.", isRead: true },
  ]);

  await db.insert(recentChangesTable).values([
    { isin: "INE467B01029", ticker: "TCS", name: "Tata Consultancy Services", sector: "Technology", changeType: "signal_upgrade", horizon: "daily", oldValue: "buy", newValue: "strong_buy", changedAt: new Date(Date.now() - 2 * 3600000) },
    { isin: "INE009A01021", ticker: "INFY", name: "Infosys Ltd", sector: "Technology", changeType: "signal_upgrade", horizon: "monthly", oldValue: "hold", newValue: "buy", changedAt: new Date(Date.now() - 5 * 3600000) },
    { isin: "INE003A01024", ticker: "SUZLON", name: "Suzlon Energy Ltd", sector: "Energy", changeType: "gate_triggered", horizon: null, oldValue: "none", newValue: "level2_capped@55", changedAt: new Date(Date.now() - 1 * 86400000) },
    { isin: "INE858B01029", ticker: "LALPATHLAB", name: "Dr Lal PathLabs Ltd", sector: "Healthcare", changeType: "score_delta", horizon: null, oldValue: "74.2", newValue: "79.8", changedAt: new Date(Date.now() - 1.5 * 86400000) },
    { isin: "INE002A01018", ticker: "RELIANCE", name: "Reliance Industries Ltd", sector: "Energy", changeType: "data_refresh", horizon: null, oldValue: "87", newValue: "88", changedAt: new Date(Date.now() - 2 * 86400000) },
  ]);
  console.log("✓ Seeded alerts + recent changes");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding IEIS v7.2 database…");
  await truncateAll();
  await seedSecurities();
  await seedScores();
  await seedHardGates();
  await seedSignals();
  await seedPortfolio();
  await seedResearch();
  await seedWatchlists();
  await seedBacktest();
  await seedAlertsAndChanges();
  console.log("\n✅ Seed complete.");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
