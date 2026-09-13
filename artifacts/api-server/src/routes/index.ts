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
import governanceRouter from "./governance";

const router: IRouter = Router();

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
router.use(governanceRouter);

export default router;
