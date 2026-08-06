/**
 * Hard-Gate Trigger and Automated Alerting System
 * Implements multi-level hard gates (Block, Cap, Penalty) and comprehensive alerting
 * as per Section 38 and related requirements of the 7.1.2 specification.
 */

export enum HardGateLevel {
  BLOCK = "BLOCK", // Level 1 - Complete block
  CAP = "CAP", // Level 2 - Score cap
  PENALTY = "PENALTY", // Level 3 - Score penalty
}

export enum HardGateTrigger {
  // Level 1 - Block
  ADVERSE_AUDIT_OPINION = "ADVERSE_AUDIT_OPINION",
  DISCLAIMER_OF_OPINION = "DISCLAIMER_OF_OPINION",
  CONFIRMED_MANIPULATION = "CONFIRMED_MANIPULATION",
  CONFIRMED_FUND_DIVERSION = "CONFIRMED_FUND_DIVERSION",
  INSOLVENCY = "INSOLVENCY",
  LIQUIDATION = "LIQUIDATION",
  MATERIAL_DEFAULT = "MATERIAL_DEFAULT",
  UNRECONCILED_CRITICAL_ACCOUNTS = "UNRECONCILED_CRITICAL_ACCOUNTS",
  SEVERE_GOING_CONCERN_ISSUE = "SEVERE_GOING_CONCERN_ISSUE",
  CURRENT_SUSPENSION = "CURRENT_SUSPENSION",
  INVALID_MAPPING = "INVALID_MAPPING",
  MISSING_CRITICAL_FILING = "MISSING_CRITICAL_FILING",
  REGULATORY_PROHIBITION = "REGULATORY_PROHIBITION",
  INADEQUATE_LIQUIDITY = "INADEQUATE_LIQUIDITY",
  CATASTROPHIC_LIABILITY = "CATASTROPHIC_LIABILITY",
  MATERIAL_SOURCE_CONFLICT = "MATERIAL_SOURCE_CONFLICT",

  // Level 2 - Cap
  QUALIFIED_AUDIT = "QUALIFIED_AUDIT",
  SERIOUS_EMPHASIS_OF_MATTER = "SERIOUS_EMPHASIS_OF_MATTER",
  AUDITOR_RESIGNATION_CONCERN = "AUDITOR_RESIGNATION_CONCERN",
  MAJOR_RELATED_PARTY_EXPOSURE = "MAJOR_RELATED_PARTY_EXPOSURE",
  PLEDGE_INCREASE = "PLEDGE_INCREASE",
  REPEATED_DILUTION = "REPEATED_DILUTION",
  RATING_DOWNGRADE = "RATING_DOWNGRADE",
  RATING_AGENCY_NON_COOPERATION = "RATING_AGENCY_NON_COOPERATION",
  REPEATED_REVISED_FILINGS = "REPEATED_REVISED_FILINGS",
  LARGE_CONTINGENT_LIABILITY = "LARGE_CONTINGENT_LIABILITY",
  PERSISTENT_CASH_PROFIT_DIVERGENCE = "PERSISTENT_CASH_PROFIT_DIVERGENCE",

  // Level 3 - Penalty
  SHORT_HISTORY = "SHORT_HISTORY",
  MODERATE_CONCENTRATION = "MODERATE_CONCENTRATION",
  TEMPORARY_LEVERAGE = "TEMPORARY_LEVERAGE",
  WORKING_CAPITAL_DETERIORATION = "WORKING_CAPITAL_DETERIORATION",
  EARNINGS_INSTABILITY = "EARNINGS_INSTABILITY",
  PARTIAL_MISSING_DATA = "PARTIAL_MISSING_DATA",
}

export interface HardGateEvent {
  event_id: string;
  company_id: string;
  security_id: string;
  trigger: HardGateTrigger;
  level: HardGateLevel;
  severity: 1 | 2 | 3 | 4 | 5; // 1=low, 5=critical
  evidence: string;
  source: string;
  detected_date: Date;
  effective_date: Date;
  resolved_date: Date | null;
  resolution_notes: string | null;
  impact_on_score: number; // -100 to 0
  hard_gate_cap: number; // 0-100, null if no cap
  status: "ACTIVE" | "RESOLVED" | "PENDING_REVIEW" | "DISPUTED";
}

export interface Alert {
  alert_id: string;
  company_id: string;
  security_id: string;
  alert_type:
    | "HARD_GATE"
    | "SCORE_CHANGE"
    | "SIGNAL_CHANGE"
    | "DATA_QUALITY"
    | "LIQUIDITY"
    | "RISK"
    | "PORTFOLIO";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  message: string;
  created_date: Date;
  acknowledged_date: Date | null;
  resolved_date: Date | null;
  action_required: boolean;
  recommended_action: string | null;
  related_hard_gate_id: string | null;
  status: "NEW" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
}

export interface AlertRule {
  rule_id: string;
  rule_name: string;
  condition: (data: any) => boolean;
  alert_type: Alert["alert_type"];
  severity: Alert["severity"];
  message_template: string;
  enabled: boolean;
}

/**
 * Hard-Gate Engine
 */
export class HardGateEngine {
  private events: Map<string, HardGateEvent[]> = new Map();

  /**
   * Evaluate hard gates for a security
   */
  evaluateHardGates(
    company: {
      company_id: string;
      security_id: string;
      audit_opinion?: string;
      is_insolvent?: boolean;
      is_suspended?: boolean;
      liquidity_score?: number;
      cash_profit_divergence?: number;
      pledged_shares_pct?: number;
      related_party_transactions?: number;
      contingent_liabilities?: number;
      financial_history_years?: number;
    },
    financialData: any
  ): { level: HardGateLevel | null; cap: number; penalties: number; events: HardGateEvent[] } {
    const triggeredEvents: HardGateEvent[] = [];
    let level: HardGateLevel | null = null;
    let cap = 100;
    let penalties = 0;

    // Check Level 1 (Block) triggers
    if (company.audit_opinion === "ADVERSE" || company.audit_opinion === "DISCLAIMER") {
      triggeredEvents.push(
        this.createHardGateEvent(
          company,
          company.audit_opinion === "ADVERSE"
            ? HardGateTrigger.ADVERSE_AUDIT_OPINION
            : HardGateTrigger.DISCLAIMER_OF_OPINION,
          HardGateLevel.BLOCK,
          5,
          "Adverse or disclaimer audit opinion"
        )
      );
      level = HardGateLevel.BLOCK;
    }

    if (company.is_insolvent) {
      triggeredEvents.push(
        this.createHardGateEvent(
          company,
          HardGateTrigger.INSOLVENCY,
          HardGateLevel.BLOCK,
          5,
          "Company is insolvent"
        )
      );
      level = HardGateLevel.BLOCK;
    }

    if (company.is_suspended) {
      triggeredEvents.push(
        this.createHardGateEvent(
          company,
          HardGateTrigger.CURRENT_SUSPENSION,
          HardGateLevel.BLOCK,
          5,
          "Security is currently suspended"
        )
      );
      level = HardGateLevel.BLOCK;
    }

    if (company.liquidity_score !== undefined && company.liquidity_score < 20) {
      triggeredEvents.push(
        this.createHardGateEvent(
          company,
          HardGateTrigger.INADEQUATE_LIQUIDITY,
          HardGateLevel.BLOCK,
          4,
          `Inadequate liquidity: ${company.liquidity_score}`
        )
      );
      level = HardGateLevel.BLOCK;
    }

    // Check Level 2 (Cap) triggers
    if (level !== HardGateLevel.BLOCK) {
      if (company.cash_profit_divergence !== undefined && company.cash_profit_divergence > 50) {
        triggeredEvents.push(
          this.createHardGateEvent(
            company,
            HardGateTrigger.PERSISTENT_CASH_PROFIT_DIVERGENCE,
            HardGateLevel.CAP,
            3,
            `Persistent cash-profit divergence: ${company.cash_profit_divergence}%`
          )
        );
        level = HardGateLevel.CAP;
        cap = 69;
      }

      if (company.pledged_shares_pct !== undefined && company.pledged_shares_pct > 50) {
        triggeredEvents.push(
          this.createHardGateEvent(
            company,
            HardGateTrigger.PLEDGE_INCREASE,
            HardGateLevel.CAP,
            3,
            `High promoter pledge: ${company.pledged_shares_pct}%`
          )
        );
        level = HardGateLevel.CAP;
        cap = Math.min(cap, 69);
      }

      if (
        company.related_party_transactions !== undefined &&
        company.related_party_transactions > 30
      ) {
        triggeredEvents.push(
          this.createHardGateEvent(
            company,
            HardGateTrigger.MAJOR_RELATED_PARTY_EXPOSURE,
            HardGateLevel.CAP,
            3,
            `Major related-party exposure: ${company.related_party_transactions}%`
          )
        );
        level = HardGateLevel.CAP;
        cap = Math.min(cap, 69);
      }

      if (
        company.contingent_liabilities !== undefined &&
        company.contingent_liabilities > 20
      ) {
        triggeredEvents.push(
          this.createHardGateEvent(
            company,
            HardGateTrigger.LARGE_CONTINGENT_LIABILITY,
            HardGateLevel.CAP,
            2,
            `Large contingent liability: ${company.contingent_liabilities}%`
          )
        );
        level = HardGateLevel.CAP;
        cap = Math.min(cap, 69);
      }
    }

    // Check Level 3 (Penalty) triggers
    if (level !== HardGateLevel.BLOCK && level !== HardGateLevel.CAP) {
      if (
        company.financial_history_years !== undefined &&
        company.financial_history_years < 3
      ) {
        triggeredEvents.push(
          this.createHardGateEvent(
            company,
            HardGateTrigger.SHORT_HISTORY,
            HardGateLevel.PENALTY,
            1,
            `Short financial history: ${company.financial_history_years} years`
          )
        );
        level = HardGateLevel.PENALTY;
        penalties = 10;
      }
    }

    // Store events
    if (triggeredEvents.length > 0) {
      this.events.set(company.company_id, triggeredEvents);
    }

    return { level, cap, penalties, events: triggeredEvents };
  }

  /**
   * Create a hard gate event
   */
  private createHardGateEvent(
    company: any,
    trigger: HardGateTrigger,
    level: HardGateLevel,
    severity: 1 | 2 | 3 | 4 | 5,
    evidence: string
  ): HardGateEvent {
    return {
      event_id: `HG-${company.company_id}-${Date.now()}`,
      company_id: company.company_id,
      security_id: company.security_id,
      trigger,
      level,
      severity,
      evidence,
      source: "SYSTEM_EVALUATION",
      detected_date: new Date(),
      effective_date: new Date(),
      resolved_date: null,
      resolution_notes: null,
      impact_on_score: level === HardGateLevel.BLOCK ? -100 : level === HardGateLevel.CAP ? -20 : -5,
      hard_gate_cap: level === HardGateLevel.CAP ? 69 : null,
      status: "ACTIVE",
    };
  }

  /**
   * Get active hard gates for a security
   */
  getActiveHardGates(companyId: string): HardGateEvent[] {
    const events = this.events.get(companyId) || [];
    return events.filter((e) => e.status === "ACTIVE");
  }

  /**
   * Resolve a hard gate event
   */
  resolveHardGate(eventId: string, notes: string): void {
    for (const [, events] of this.events) {
      const event = events.find((e) => e.event_id === eventId);
      if (event) {
        event.status = "RESOLVED";
        event.resolved_date = new Date();
        event.resolution_notes = notes;
      }
    }
  }
}

/**
 * Alert Engine
 */
export class AlertEngine {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];

  /**
   * Register an alert rule
   */
  registerRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  /**
   * Evaluate all rules and generate alerts
   */
  evaluateRules(data: any): Alert[] {
    const generatedAlerts: Alert[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      try {
        if (rule.condition(data)) {
          const alert: Alert = {
            alert_id: `ALERT-${Date.now()}-${Math.random()}`,
            company_id: data.company_id,
            security_id: data.security_id,
            alert_type: rule.alert_type,
            severity: rule.severity,
            title: rule.rule_name,
            message: rule.message_template,
            created_date: new Date(),
            acknowledged_date: null,
            resolved_date: null,
            action_required: rule.severity === "CRITICAL" || rule.severity === "HIGH",
            recommended_action: null,
            related_hard_gate_id: null,
            status: "NEW",
          };

          generatedAlerts.push(alert);
          this.alerts.push(alert);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.rule_id}:`, error);
      }
    }

    return generatedAlerts;
  }

  /**
   * Create a hard-gate alert
   */
  createHardGateAlert(event: HardGateEvent): Alert {
    const severityMap: Record<number, Alert["severity"]> = {
      1: "LOW",
      2: "MEDIUM",
      3: "HIGH",
      4: "CRITICAL",
      5: "CRITICAL",
    };

    const alert: Alert = {
      alert_id: `ALERT-${event.event_id}`,
      company_id: event.company_id,
      security_id: event.security_id,
      alert_type: "HARD_GATE",
      severity: severityMap[event.severity],
      title: `Hard Gate: ${event.trigger}`,
      message: event.evidence,
      created_date: event.detected_date,
      acknowledged_date: null,
      resolved_date: null,
      action_required: event.level === HardGateLevel.BLOCK,
      recommended_action:
        event.level === HardGateLevel.BLOCK
          ? "EXCLUDE_FROM_PORTFOLIO"
          : event.level === HardGateLevel.CAP
            ? "REDUCE_POSITION_SIZE"
            : "MONITOR",
      related_hard_gate_id: event.event_id,
      status: "NEW",
    };

    this.alerts.push(alert);
    return alert;
  }

  /**
   * Create a score change alert
   */
  createScoreChangeAlert(
    companyId: string,
    securityId: string,
    scoreType: string,
    oldScore: number,
    newScore: number
  ): Alert | null {
    const change = Math.abs(newScore - oldScore);

    // Only alert if change is significant (>15 points)
    if (change < 15) return null;

    const severity =
      change > 30 ? "CRITICAL" : change > 20 ? "HIGH" : "MEDIUM";

    const alert: Alert = {
      alert_id: `ALERT-${companyId}-${Date.now()}`,
      company_id: companyId,
      security_id: securityId,
      alert_type: "SCORE_CHANGE",
      severity: severity as Alert["severity"],
      title: `${scoreType} Score Changed`,
      message: `${scoreType} score changed from ${oldScore.toFixed(1)} to ${newScore.toFixed(1)} (change: ${change > 0 ? "+" : ""}${change.toFixed(1)})`,
      created_date: new Date(),
      acknowledged_date: null,
      resolved_date: null,
      action_required: severity === "CRITICAL",
      recommended_action: "REVIEW",
      related_hard_gate_id: null,
      status: "NEW",
    };

    this.alerts.push(alert);
    return alert;
  }

  /**
   * Create a signal change alert
   */
  createSignalChangeAlert(
    companyId: string,
    securityId: string,
    horizon: string,
    oldSignal: string,
    newSignal: string
  ): Alert {
    const alert: Alert = {
      alert_id: `ALERT-${companyId}-${Date.now()}`,
      company_id: companyId,
      security_id: securityId,
      alert_type: "SIGNAL_CHANGE",
      severity: "MEDIUM",
      title: `${horizon} Signal Changed`,
      message: `${horizon} signal changed from ${oldSignal} to ${newSignal}`,
      created_date: new Date(),
      acknowledged_date: null,
      resolved_date: null,
      action_required: true,
      recommended_action: "REVIEW_POSITION",
      related_hard_gate_id: null,
      status: "NEW",
    };

    this.alerts.push(alert);
    return alert;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.alert_id === alertId);
    if (alert) {
      alert.acknowledged_date = new Date();
      alert.status = "ACKNOWLEDGED";
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.alert_id === alertId);
    if (alert) {
      alert.resolved_date = new Date();
      alert.status = "RESOLVED";
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(companyId?: string): Alert[] {
    return this.alerts.filter(
      (a) =>
        (a.status === "NEW" || a.status === "ACKNOWLEDGED") &&
        (!companyId || a.company_id === companyId)
    );
  }

  /**
   * Get critical alerts
   */
  getCriticalAlerts(): Alert[] {
    return this.alerts.filter(
      (a) =>
        a.severity === "CRITICAL" &&
        (a.status === "NEW" || a.status === "ACKNOWLEDGED")
    );
  }
}

/**
 * Default Alert Rules
 */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    rule_id: "RULE_SCORE_DROP",
    rule_name: "Candidate Score Drop",
    condition: (data) => data.candidate_score_change < -20,
    alert_type: "SCORE_CHANGE",
    severity: "HIGH",
    message_template: "Candidate score has dropped significantly",
    enabled: true,
  },
  {
    rule_id: "RULE_LIQUIDITY_LOW",
    rule_name: "Low Liquidity",
    condition: (data) => data.liquidity_score < 30,
    alert_type: "LIQUIDITY",
    severity: "MEDIUM",
    message_template: "Liquidity score is below acceptable threshold",
    enabled: true,
  },
  {
    rule_id: "RULE_DATA_QUALITY_LOW",
    rule_name: "Low Data Confidence",
    condition: (data) => data.data_confidence < 50,
    alert_type: "DATA_QUALITY",
    severity: "MEDIUM",
    message_template: "Data confidence is below acceptable threshold",
    enabled: true,
  },
  {
    rule_id: "RULE_SIGNAL_REVERSAL",
    rule_name: "Signal Reversal",
    condition: (data) =>
      data.previous_signal === "BUY" && data.current_signal === "SELL",
    alert_type: "SIGNAL_CHANGE",
    severity: "HIGH",
    message_template: "Signal has reversed from Buy to Sell",
    enabled: true,
  },
  {
    rule_id: "RULE_PORTFOLIO_CONCENTRATION",
    rule_name: "High Portfolio Concentration",
    condition: (data) => data.portfolio_concentration > 80,
    alert_type: "PORTFOLIO",
    severity: "MEDIUM",
    message_template: "Portfolio concentration is above acceptable level",
    enabled: true,
  },
  {
    rule_id: "RULE_DRAWDOWN_WARNING",
    rule_name: "Drawdown Warning",
    condition: (data) => data.portfolio_drawdown > 15,
    alert_type: "RISK",
    severity: "HIGH",
    message_template: "Portfolio drawdown exceeds warning threshold",
    enabled: true,
  },
];
