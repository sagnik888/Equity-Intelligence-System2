import { Router, type IRouter } from "express";
import healthRouter from "./health";
import universeRouter from "./universe";
import scoresRouter from "./scores";
import hardgatesRouter from "./hardgates";
import signalsRouter from "./signals";
import rankingsRouter from "./rankings";
import portfolioRouter from "./portfolio";
import researchRouter from "./research";
import watchlistsRouter from "./watchlists";
import backtestRouter from "./backtest";
import dashboardRouter from "./dashboard";
import auditRouter from "./audit";

// V2 Canonical Implementations
import portfolioV2Router from "./portfolio-v2";
import scoringV2Router from "./scoring";
import signalsV2Router from "./signals-v2";
import researchV2Router from "./research-v2";
import auditAlignmentRouter from "./audit-alignment";
import backtestAnalyticsRouter from "./backtest-analytics";
import hardgateAlertsRouter from "./hardgate-alerts";
import brokerIntegrationRouter from "./broker-integration";

const router: IRouter = Router();

// Legacy routes
router.use(healthRouter);
router.use(universeRouter);
router.use(scoresRouter);
router.use(hardgatesRouter);
router.use(signalsRouter);
router.use(rankingsRouter);
router.use(portfolioRouter);
router.use(researchRouter);
router.use(watchlistsRouter);
router.use(backtestRouter);
router.use(dashboardRouter);
router.use(auditRouter);

// V2 Canonical Routes (7.1.2 Implementation)
router.use("/v2/portfolio", portfolioV2Router);
router.use("/v2/scoring", scoringV2Router);
router.use("/v2/signals", signalsV2Router);
router.use("/v2/research", researchV2Router);
router.use("/v2/audit", auditAlignmentRouter);
router.use("/v2/backtest", backtestAnalyticsRouter);
router.use("/v2/alerts", hardgateAlertsRouter);
router.use("/v2/broker", brokerIntegrationRouter);

// Health check for V2
router.get("/v2/health", (req, res) => {
  res.json({
    status: "ok",
    version: "7.1.2",
    timestamp: new Date().toISOString(),
    modules: [
      "portfolio_management_v2",
      "scoring_engine_v2",
      "signal_generation_v2",
      "research_promotion_v2",
      "audit_trail_v2",
      "backtesting_v2",
      "hard_gate_monitoring_v2",
      "broker_integration_v2",
    ],
  });
});

export default router;
