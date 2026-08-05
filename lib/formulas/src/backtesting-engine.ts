/**
 * Backtesting Execution Engine
 * Implements point-in-time backtesting with walk-forward validation,
 * performance metrics, and comprehensive reporting as per Section 91-93 of the 7.1.2 specification.
 */

export interface BacktestConfig {
  strategy_id: string;
  start_date: Date;
  end_date: Date;
  initial_capital: number;
  risk_percent: number;
  max_position_size: number;
  max_sector_exposure: number;
  max_drawdown_allowed: number;
  slippage_bps: number;
  commission_bps: number;
  tax_rate: number;
}

export interface BacktestSignal {
  date: Date;
  security_id: string;
  action: "BUY" | "SELL" | "HOLD" | "EXIT";
  score: number;
  confidence: number;
  price: number;
  quantity: number;
}

export interface BacktestTrade {
  trade_id: string;
  security_id: string;
  entry_date: Date;
  entry_price: number;
  entry_quantity: number;
  exit_date: Date | null;
  exit_price: number | null;
  exit_quantity: number | null;
  status: "OPEN" | "CLOSED" | "PARTIAL";
  pnl: number;
  pnl_pct: number;
  holding_days: number;
}

export interface PortfolioSnapshot {
  date: Date;
  total_value: number;
  cash: number;
  positions_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_pnl: number;
  positions_count: number;
  drawdown: number;
  drawdown_pct: number;
}

export interface BacktestMetrics {
  total_return_pct: number;
  cagr: number;
  volatility: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  max_drawdown: number;
  max_drawdown_duration: number;
  win_rate: number;
  profit_factor: number;
  average_win: number;
  average_loss: number;
  consecutive_wins: number;
  consecutive_losses: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  average_holding_days: number;
  turnover: number;
  slippage_cost: number;
  commission_cost: number;
  tax_cost: number;
}

export interface WalkForwardResult {
  train_period: { start: Date; end: Date };
  validate_period: { start: Date; end: Date };
  test_period: { start: Date; end: Date };
  train_metrics: BacktestMetrics;
  validate_metrics: BacktestMetrics;
  test_metrics: BacktestMetrics;
  parameter_set: Record<string, any>;
  overfitting_probability: number;
}

/**
 * Backtesting Engine
 */
export class BacktestingEngine {
  private config: BacktestConfig;
  private trades: BacktestTrade[] = [];
  private snapshots: PortfolioSnapshot[] = [];
  private signals: BacktestSignal[] = [];

  constructor(config: BacktestConfig) {
    this.config = config;
  }

  /**
   * Run a complete backtest
   */
  async runBacktest(
    signals: BacktestSignal[],
    priceHistory: Map<string, Map<string, number>>
  ): Promise<{
    trades: BacktestTrade[];
    snapshots: PortfolioSnapshot[];
    metrics: BacktestMetrics;
  }> {
    this.signals = signals.sort((a, b) => a.date.getTime() - b.date.getTime());
    this.trades = [];
    this.snapshots = [];

    let portfolio = this.initializePortfolio();
    let positions: Map<string, BacktestTrade> = new Map();

    for (const signal of this.signals) {
      // Get historical price at signal date
      const historicalPrices = priceHistory.get(signal.security_id);
      if (!historicalPrices) continue;

      const price = historicalPrices.get(signal.date.toISOString());
      if (!price) continue;

      // Process signal
      switch (signal.action) {
        case "BUY":
          const buyTrade = this.executeBuySignal(
            signal,
            price,
            portfolio,
            positions
          );
          if (buyTrade) {
            positions.set(buyTrade.trade_id, buyTrade);
            portfolio.cash -= buyTrade.entry_quantity * price;
            portfolio.cash -= this.calculateCosts(
              buyTrade.entry_quantity * price
            );
          }
          break;

        case "SELL":
        case "EXIT":
          const sellTrade = this.executeSellSignal(
            signal,
            price,
            portfolio,
            positions
          );
          if (sellTrade) {
            portfolio.cash += sellTrade.exit_quantity! * price;
            portfolio.cash -= this.calculateCosts(
              sellTrade.exit_quantity! * price
            );
            this.trades.push(sellTrade);
            positions.delete(sellTrade.trade_id);
          }
          break;
      }

      // Record portfolio snapshot
      const snapshot = this.createPortfolioSnapshot(
        signal.date,
        portfolio,
        positions,
        priceHistory
      );
      this.snapshots.push(snapshot);
    }

    // Close remaining positions at end of backtest
    const endDate = this.config.end_date;
    for (const [, trade] of positions) {
      const historicalPrices = priceHistory.get(trade.security_id);
      if (historicalPrices) {
        const endPrice = historicalPrices.get(endDate.toISOString());
        if (endPrice) {
          trade.exit_date = endDate;
          trade.exit_price = endPrice;
          trade.exit_quantity = trade.entry_quantity;
          trade.status = "CLOSED";
          trade.pnl =
            (endPrice - trade.entry_price) * trade.entry_quantity -
            this.calculateCosts(endPrice * trade.entry_quantity);
          trade.pnl_pct =
            ((endPrice - trade.entry_price) / trade.entry_price) * 100;
          trade.holding_days = Math.floor(
            (endDate.getTime() - trade.entry_date.getTime()) / (1000 * 60 * 60 * 24)
          );
          this.trades.push(trade);
        }
      }
    }

    const metrics = this.calculateMetrics();

    return {
      trades: this.trades,
      snapshots: this.snapshots,
      metrics,
    };
  }

  /**
   * Initialize portfolio
   */
  private initializePortfolio() {
    return {
      total_value: this.config.initial_capital,
      cash: this.config.initial_capital,
      positions_value: 0,
      unrealized_pnl: 0,
      realized_pnl: 0,
      total_pnl: 0,
      positions_count: 0,
      drawdown: 0,
      drawdown_pct: 0,
      peak_value: this.config.initial_capital,
    };
  }

  /**
   * Execute buy signal
   */
  private executeBuySignal(
    signal: BacktestSignal,
    price: number,
    portfolio: any,
    positions: Map<string, BacktestTrade>
  ): BacktestTrade | null {
    // Check if position already exists
    if (positions.has(signal.security_id)) {
      return null; // Already holding
    }

    // Calculate position size based on risk
    const riskBudget = portfolio.cash * (this.config.risk_percent / 100);
    const quantity = Math.floor(riskBudget / (price * (1 + this.calculateCostRate())));

    if (quantity <= 0 || portfolio.cash < quantity * price) {
      return null; // Insufficient capital
    }

    const trade: BacktestTrade = {
      trade_id: `${signal.security_id}-${signal.date.getTime()}`,
      security_id: signal.security_id,
      entry_date: signal.date,
      entry_price: price,
      entry_quantity: quantity,
      exit_date: null,
      exit_price: null,
      exit_quantity: null,
      status: "OPEN",
      pnl: 0,
      pnl_pct: 0,
      holding_days: 0,
    };

    return trade;
  }

  /**
   * Execute sell signal
   */
  private executeSellSignal(
    signal: BacktestSignal,
    price: number,
    portfolio: any,
    positions: Map<string, BacktestTrade>
  ): BacktestTrade | null {
    const trade = positions.get(signal.security_id);
    if (!trade) {
      return null; // No position to sell
    }

    trade.exit_date = signal.date;
    trade.exit_price = price;
    trade.exit_quantity = trade.entry_quantity;
    trade.status = "CLOSED";
    trade.pnl =
      (price - trade.entry_price) * trade.entry_quantity -
      this.calculateCosts(price * trade.entry_quantity);
    trade.pnl_pct = ((price - trade.entry_price) / trade.entry_price) * 100;
    trade.holding_days = Math.floor(
      (signal.date.getTime() - trade.entry_date.getTime()) / (1000 * 60 * 60 * 24)
    );

    return trade;
  }

  /**
   * Calculate trading costs (slippage, commission, tax)
   */
  private calculateCosts(tradeValue: number): number {
    const slippage = (tradeValue * this.config.slippage_bps) / 10000;
    const commission = (tradeValue * this.config.commission_bps) / 10000;
    const tax = (tradeValue * this.config.tax_rate) / 100;
    return slippage + commission + tax;
  }

  /**
   * Get cost rate as percentage
   */
  private calculateCostRate(): number {
    return (
      (this.config.slippage_bps + this.config.commission_bps) / 10000 +
      this.config.tax_rate / 100
    );
  }

  /**
   * Create portfolio snapshot
   */
  private createPortfolioSnapshot(
    date: Date,
    portfolio: any,
    positions: Map<string, BacktestTrade>,
    priceHistory: Map<string, Map<string, number>>
  ): PortfolioSnapshot {
    let positionsValue = 0;
    let unrealizedPnL = 0;

    for (const [, trade] of positions) {
      const historicalPrices = priceHistory.get(trade.security_id);
      if (historicalPrices) {
        const currentPrice = historicalPrices.get(date.toISOString());
        if (currentPrice) {
          const positionValue = currentPrice * trade.entry_quantity;
          positionsValue += positionValue;
          unrealizedPnL +=
            (currentPrice - trade.entry_price) * trade.entry_quantity;
        }
      }
    }

    const totalValue = portfolio.cash + positionsValue;
    const drawdown = Math.max(0, portfolio.peak_value - totalValue);
    const drawdownPct = (drawdown / portfolio.peak_value) * 100;

    if (totalValue > portfolio.peak_value) {
      portfolio.peak_value = totalValue;
    }

    return {
      date,
      total_value: totalValue,
      cash: portfolio.cash,
      positions_value: positionsValue,
      unrealized_pnl: unrealizedPnL,
      realized_pnl: portfolio.realized_pnl,
      total_pnl: unrealizedPnL + portfolio.realized_pnl,
      positions_count: positions.size,
      drawdown,
      drawdown_pct: drawdownPct,
    };
  }

  /**
   * Calculate comprehensive backtest metrics
   */
  private calculateMetrics(): BacktestMetrics {
    if (this.snapshots.length === 0) {
      return this.getEmptyMetrics();
    }

    const startValue = this.config.initial_capital;
    const endValue = this.snapshots[this.snapshots.length - 1].total_value;
    const totalReturn = ((endValue - startValue) / startValue) * 100;

    // CAGR
    const years =
      (this.snapshots[this.snapshots.length - 1].date.getTime() -
        this.snapshots[0].date.getTime()) /
      (1000 * 60 * 60 * 24 * 365);
    const cagr =
      years > 0
        ? (Math.pow(endValue / startValue, 1 / years) - 1) * 100
        : totalReturn;

    // Volatility
    const returns = this.calculateDailyReturns();
    const volatility = this.calculateStandardDeviation(returns) * Math.sqrt(252);

    // Sharpe Ratio
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const sharpeRatio = (avgReturn * 252 - 5) / volatility; // Assuming 5% risk-free rate

    // Sortino Ratio
    const downside Returns = returns.filter((r) => r < 0);
    const downsideVolatility =
      this.calculateStandardDeviation(downside Returns) * Math.sqrt(252);
    const sortinoRatio = (avgReturn * 252 - 5) / downsideVolatility;

    // Max Drawdown
    const { maxDrawdown, maxDrawdownDuration } = this.calculateMaxDrawdown();

    // Calmar Ratio
    const calmarRatio = cagr / Math.abs(maxDrawdown);

    // Win Rate
    const { winRate, profitFactor, avgWin, avgLoss, consecutiveWins, consecutiveLosses } =
      this.calculateWinMetrics();

    // Turnover
    const turnover = this.calculateTurnover();

    // Costs
    const { slippageCost, commissionCost, taxCost } = this.calculateCosts();

    return {
      total_return_pct: totalReturn,
      cagr,
      volatility,
      sharpe_ratio: sharpeRatio,
      sortino_ratio: sortinoRatio,
      calmar_ratio: calmarRatio,
      max_drawdown: maxDrawdown,
      max_drawdown_duration: maxDrawdownDuration,
      win_rate: winRate,
      profit_factor: profitFactor,
      average_win: avgWin,
      average_loss: avgLoss,
      consecutive_wins: consecutiveWins,
      consecutive_losses: consecutiveLosses,
      total_trades: this.trades.length,
      winning_trades: this.trades.filter((t) => t.pnl > 0).length,
      losing_trades: this.trades.filter((t) => t.pnl < 0).length,
      average_holding_days:
        this.trades.length > 0
          ? this.trades.reduce((sum, t) => sum + t.holding_days, 0) /
            this.trades.length
          : 0,
      turnover,
      slippage_cost: slippageCost,
      commission_cost: commissionCost,
      tax_cost: taxCost,
    };
  }

  /**
   * Calculate daily returns
   */
  private calculateDailyReturns(): number[] {
    const returns: number[] = [];
    for (let i = 1; i < this.snapshots.length; i++) {
      const prevValue = this.snapshots[i - 1].total_value;
      const currValue = this.snapshots[i].total_value;
      const dailyReturn = (currValue - prevValue) / prevValue;
      returns.push(dailyReturn);
    }
    return returns;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate max drawdown
   */
  private calculateMaxDrawdown(): {
    maxDrawdown: number;
    maxDrawdownDuration: number;
  } {
    let maxDrawdown = 0;
    let maxDrawdownDuration = 0;
    let peak = this.config.initial_capital;
    let drawdownStart = 0;

    for (let i = 0; i < this.snapshots.length; i++) {
      const value = this.snapshots[i].total_value;
      if (value > peak) {
        peak = value;
        drawdownStart = i;
      }

      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownDuration = i - drawdownStart;
      }
    }

    return { maxDrawdown: maxDrawdown * 100, maxDrawdownDuration };
  }

  /**
   * Calculate win metrics
   */
  private calculateWinMetrics(): {
    winRate: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    consecutiveWins: number;
    consecutiveLosses: number;
  } {
    const winningTrades = this.trades.filter((t) => t.pnl > 0);
    const losingTrades = this.trades.filter((t) => t.pnl < 0);

    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0);

    const winRate =
      this.trades.length > 0
        ? (winningTrades.length / this.trades.length) * 100
        : 0;

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss =
      losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    // Calculate consecutive wins/losses
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;

    for (const trade of this.trades) {
      if (trade.pnl > 0) {
        consecutiveWins++;
        consecutiveLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
      } else if (trade.pnl < 0) {
        consecutiveLosses++;
        consecutiveWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
      }
    }

    return {
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      consecutiveWins: maxConsecutiveWins,
      consecutiveLosses: maxConsecutiveLosses,
    };
  }

  /**
   * Calculate turnover
   */
  private calculateTurnover(): number {
    let totalTradeValue = 0;
    for (const trade of this.trades) {
      totalTradeValue += trade.entry_quantity * trade.entry_price;
      if (trade.exit_price) {
        totalTradeValue += trade.exit_quantity! * trade.exit_price;
      }
    }
    return (totalTradeValue / this.config.initial_capital) * 100;
  }

  /**
   * Calculate costs
   */
  private calculateCosts(): {
    slippageCost: number;
    commissionCost: number;
    taxCost: number;
  } {
    let slippageCost = 0;
    let commissionCost = 0;
    let taxCost = 0;

    for (const trade of this.trades) {
      const entryValue = trade.entry_quantity * trade.entry_price;
      slippageCost += (entryValue * this.config.slippage_bps) / 10000;
      commissionCost += (entryValue * this.config.commission_bps) / 10000;
      taxCost += (entryValue * this.config.tax_rate) / 100;

      if (trade.exit_price) {
        const exitValue = trade.exit_quantity! * trade.exit_price;
        slippageCost += (exitValue * this.config.slippage_bps) / 10000;
        commissionCost += (exitValue * this.config.commission_bps) / 10000;
        taxCost += (exitValue * this.config.tax_rate) / 100;
      }
    }

    return { slippageCost, commissionCost, taxCost };
  }

  /**
   * Get empty metrics
   */
  private getEmptyMetrics(): BacktestMetrics {
    return {
      total_return_pct: 0,
      cagr: 0,
      volatility: 0,
      sharpe_ratio: 0,
      sortino_ratio: 0,
      calmar_ratio: 0,
      max_drawdown: 0,
      max_drawdown_duration: 0,
      win_rate: 0,
      profit_factor: 0,
      average_win: 0,
      average_loss: 0,
      consecutive_wins: 0,
      consecutive_losses: 0,
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      average_holding_days: 0,
      turnover: 0,
      slippage_cost: 0,
      commission_cost: 0,
      tax_cost: 0,
    };
  }
}

/**
 * Walk-Forward Testing Engine
 */
export class WalkForwardTester {
  /**
   * Run walk-forward test
   */
  static runWalkForwardTest(
    config: BacktestConfig,
    signals: BacktestSignal[],
    priceHistory: Map<string, Map<string, number>>,
    trainYears: number = 5,
    validateYears: number = 1,
    testYears: number = 1
  ): WalkForwardResult[] {
    const results: WalkForwardResult[] = [];

    const startDate = config.start_date;
    const endDate = config.end_date;

    let currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const trainEnd = new Date(currentDate);
      trainEnd.setFullYear(trainEnd.getFullYear() + trainYears);

      const validateEnd = new Date(trainEnd);
      validateEnd.setFullYear(validateEnd.getFullYear() + validateYears);

      const testEnd = new Date(validateEnd);
      testEnd.setFullYear(testEnd.getFullYear() + testYears);

      if (testEnd > endDate) break;

      // Filter signals for each period
      const trainSignals = signals.filter(
        (s) => s.date >= currentDate && s.date < trainEnd
      );
      const validateSignals = signals.filter(
        (s) => s.date >= trainEnd && s.date < validateEnd
      );
      const testSignals = signals.filter(
        (s) => s.date >= validateEnd && s.date < testEnd
      );

      // Run backtests
      const trainEngine = new BacktestingEngine(config);
      const trainResult = trainEngine.runBacktest(trainSignals, priceHistory);

      const validateEngine = new BacktestingEngine(config);
      const validateResult = validateEngine.runBacktest(
        validateSignals,
        priceHistory
      );

      const testEngine = new BacktestingEngine(config);
      const testResult = testEngine.runBacktest(testSignals, priceHistory);

      // Calculate overfitting probability
      const overfittingProbability = this.calculateOverfittingProbability(
        trainResult.metrics,
        testResult.metrics
      );

      results.push({
        train_period: { start: currentDate, end: trainEnd },
        validate_period: { start: trainEnd, end: validateEnd },
        test_period: { start: validateEnd, end: testEnd },
        train_metrics: trainResult.metrics,
        validate_metrics: validateResult.metrics,
        test_metrics: testResult.metrics,
        parameter_set: {},
        overfitting_probability: overfittingProbability,
      });

      // Roll forward
      currentDate = new Date(validateEnd);
    }

    return results;
  }

  /**
   * Calculate overfitting probability
   */
  private static calculateOverfittingProbability(
    trainMetrics: BacktestMetrics,
    testMetrics: BacktestMetrics
  ): number {
    const sharpeRatioDifference = Math.abs(
      trainMetrics.sharpe_ratio - testMetrics.sharpe_ratio
    );
    const returnDifference = Math.abs(
      trainMetrics.total_return_pct - testMetrics.total_return_pct
    );

    // Simplified overfitting probability
    const probability =
      (sharpeRatioDifference * 0.5 + returnDifference * 0.01) / 100;
    return Math.min(1, probability);
  }
}
