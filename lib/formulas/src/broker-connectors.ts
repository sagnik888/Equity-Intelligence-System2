/**
 * Broker API Connectors and Failover Logic
 * Implements connectors for Upstox and Angel One with order lifecycle management,
 * duplicate protection, and failover logic as per Section 9, 78-80 of the 7.1.2 specification.
 */

export enum BrokerType {
  UPSTOX = "UPSTOX",
  ANGEL_ONE = "ANGEL_ONE",
}

export enum OrderStatus {
  SIGNAL_CONFIRMED = "SIGNAL_CONFIRMED",
  RISK_CHECKED = "RISK_CHECKED",
  ORDER_PREVIEWED = "ORDER_PREVIEWED",
  APPROVED = "APPROVED",
  SUBMISSION_PENDING = "SUBMISSION_PENDING",
  SUBMITTED = "SUBMITTED",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  PARTIALLY_FILLED = "PARTIALLY_FILLED",
  FILLED = "FILLED",
  POSITION_RECONCILED = "POSITION_RECONCILED",
  REJECTED = "REJECTED",
  CANCEL_PENDING = "CANCEL_PENDING",
  CANCELLED = "CANCELLED",
  STALE = "STALE",
  ORPHANED = "ORPHANED",
  BROKER_UNKNOWN = "BROKER_UNKNOWN",
  MANUAL_REVIEW = "MANUAL_REVIEW",
}

export interface BrokerOrder {
  order_id: string;
  security_id: string;
  isin: string;
  broker_symbol: string;
  action: "BUY" | "SELL";
  quantity: number;
  price: number;
  order_type: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
  product: "MIS" | "CNC" | "NRML";
  validity: "DAY" | "IOC" | "GTC";
  status: OrderStatus;
  idempotency_key: string;
  broker_order_id: string | null;
  broker_confirmation_reference: string | null;
  created_at: Date;
  submitted_at: Date | null;
  filled_at: Date | null;
  filled_quantity: number;
  filled_price: number | null;
  average_price: number | null;
  commission: number;
  tax: number;
  total_cost: number;
  pnl: number | null;
  error_message: string | null;
  retry_count: number;
  last_retry_at: Date | null;
}

export interface BrokerConfig {
  broker_type: BrokerType;
  api_key: string;
  api_secret: string;
  access_token?: string;
  refresh_token?: string;
  base_url: string;
  timeout_ms: number;
  retry_attempts: number;
  retry_backoff_ms: number;
  rate_limit_requests_per_minute: number;
  static_ip_required: boolean;
  static_ip_address?: string;
  algo_registration_required: boolean;
  algo_id?: string;
  strategy_id?: string;
}

export interface BrokerInstrument {
  broker_instrument_id: string;
  isin: string;
  symbol: string;
  name: string;
  exchange: "NSE" | "BSE";
  segment: "EQ" | "FO" | "CD";
  lot_size: number;
  tick_size: number;
  is_suspended: boolean;
  is_delisted: boolean;
  trading_session: string;
}

/**
 * Base Broker Connector
 */
export abstract class BrokerConnector {
  protected config: BrokerConfig;
  protected orders: Map<string, BrokerOrder> = new Map();
  protected instruments: Map<string, BrokerInstrument> = new Map();
  protected rateLimitCounter = 0;
  protected lastRateLimitReset = Date.now();

  constructor(config: BrokerConfig) {
    this.config = config;
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  abstract authenticate(): Promise<boolean>;
  abstract submitOrder(order: BrokerOrder): Promise<{ success: boolean; broker_order_id?: string; error?: string }>;
  abstract cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }>;
  abstract getOrderStatus(orderId: string): Promise<{ status: OrderStatus; filled_quantity?: number; filled_price?: number }>;
  abstract getPositions(): Promise<any[]>;
  abstract getHoldings(): Promise<any[]>;
  abstract getInstruments(): Promise<BrokerInstrument[]>;
  abstract getQuote(symbol: string): Promise<{ price: number; bid: number; ask: number; volume: number }>;

  /**
   * Check rate limits
   */
  protected async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceReset = now - this.lastRateLimitReset;

    // Reset counter every minute
    if (timeSinceReset > 60000) {
      this.rateLimitCounter = 0;
      this.lastRateLimitReset = now;
    }

    // Check if we've exceeded the limit
    if (
      this.rateLimitCounter >=
      this.config.rate_limit_requests_per_minute
    ) {
      const waitTime = 60000 - timeSinceReset;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.rateLimitCounter = 0;
      this.lastRateLimitReset = Date.now();
    }

    this.rateLimitCounter++;
  }

  /**
   * Generate idempotency key
   */
  protected generateIdempotencyKey(
    securityId: string,
    horizon: string,
    signalId: string,
    action: string,
    tradeDate: Date
  ): string {
    const components = [
      securityId,
      horizon,
      signalId,
      action,
      tradeDate.toISOString().split("T")[0],
    ];
    return components.join("|");
  }

  /**
   * Submit order with retry logic
   */
  async submitOrderWithRetry(order: BrokerOrder): Promise<BrokerOrder> {
    let lastError: string | null = null;

    for (let attempt = 0; attempt < this.config.retry_attempts; attempt++) {
      try {
        if (attempt > 0) {
          const backoffTime =
            this.config.retry_backoff_ms * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }

        const result = await this.submitOrder(order);

        if (result.success) {
          order.status = OrderStatus.SUBMITTED;
          order.broker_order_id = result.broker_order_id || null;
          order.submitted_at = new Date();
          order.retry_count = attempt;
          this.orders.set(order.order_id, order);
          return order;
        } else {
          lastError = result.error || "Unknown error";
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
      }
    }

    order.status = OrderStatus.REJECTED;
    order.error_message = lastError;
    order.retry_count = this.config.retry_attempts;
    this.orders.set(order.order_id, order);
    return order;
  }

  /**
   * Reconcile order after broker failover
   */
  async reconcileOrderAfterFailover(
    orderId: string
  ): Promise<{ reconciled: boolean; actualFill?: number; actualPrice?: number }> {
    const order = this.orders.get(orderId);
    if (!order) {
      return { reconciled: false };
    }

    try {
      // Step 1: Query original order
      if (order.broker_order_id) {
        const status = await this.getOrderStatus(order.broker_order_id);
        if (status.filled_quantity !== undefined) {
          order.filled_quantity = status.filled_quantity;
          order.filled_price = status.filled_price || null;
          order.status = status.status;
          return {
            reconciled: true,
            actualFill: status.filled_quantity,
            actualPrice: status.filled_price,
          };
        }
      }

      // Step 2: Query order history
      const positions = await this.getPositions();
      const matchingPosition = positions.find(
        (p) => p.isin === order.isin && p.action === order.action
      );

      if (matchingPosition) {
        order.filled_quantity = matchingPosition.quantity;
        order.filled_price = matchingPosition.average_price;
        order.status = OrderStatus.FILLED;
        return {
          reconciled: true,
          actualFill: matchingPosition.quantity,
          actualPrice: matchingPosition.average_price,
        };
      }

      // Step 3: Calculate remainder if partial fill
      if (order.filled_quantity > 0) {
        order.status = OrderStatus.PARTIALLY_FILLED;
        return {
          reconciled: true,
          actualFill: order.filled_quantity,
          actualPrice: order.filled_price || undefined,
        };
      }

      order.status = OrderStatus.BROKER_UNKNOWN;
      return { reconciled: false };
    } catch (error) {
      order.status = OrderStatus.MANUAL_REVIEW;
      return { reconciled: false };
    }
  }

  /**
   * Get stored order
   */
  getOrder(orderId: string): BrokerOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all orders
   */
  getAllOrders(): BrokerOrder[] {
    return Array.from(this.orders.values());
  }
}

/**
 * Upstox Broker Connector
 */
export class UpstoxConnector extends BrokerConnector {
  async authenticate(): Promise<boolean> {
    try {
      // Upstox OAuth2 authentication
      // In production, implement actual OAuth2 flow
      return true;
    } catch (error) {
      console.error("Upstox authentication failed:", error);
      return false;
    }
  }

  async submitOrder(order: BrokerOrder): Promise<{ success: boolean; broker_order_id?: string; error?: string }> {
    await this.checkRateLimit();

    try {
      // Validate static IP if required
      if (this.config.static_ip_required && !this.config.static_ip_address) {
        return { success: false, error: "Static IP required but not configured" };
      }

      // Prepare Upstox order request
      const upstoxOrder = {
        instrument_key: order.broker_symbol,
        quantity: order.quantity,
        order_type: order.order_type,
        transaction_type: order.action,
        price: order.price,
        product: order.product,
        validity: order.validity,
        tag: order.idempotency_key,
        // Add strategy identifier if algo registration required
        ...(this.config.algo_registration_required && {
          strategy_identifier: this.config.strategy_id,
        }),
      };

      // In production, make actual API call
      // const response = await fetch(`${this.config.base_url}/orders`, {
      //   method: 'POST',
      //   headers: { 'Authorization': `Bearer ${this.config.access_token}` },
      //   body: JSON.stringify(upstoxOrder),
      //   timeout: this.config.timeout_ms,
      // });

      // Mock response for now
      const brokerOrderId = `UPSTOX-${Date.now()}`;
      return { success: true, broker_order_id: brokerOrderId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    await this.checkRateLimit();

    try {
      const order = this.orders.get(orderId);
      if (!order || !order.broker_order_id) {
        return { success: false, error: "Order not found" };
      }

      // In production, make actual API call to cancel
      order.status = OrderStatus.CANCELLED;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getOrderStatus(
    orderId: string
  ): Promise<{ status: OrderStatus; filled_quantity?: number; filled_price?: number }> {
    await this.checkRateLimit();

    try {
      // In production, make actual API call
      const order = this.orders.get(orderId);
      if (!order) {
        return { status: OrderStatus.BROKER_UNKNOWN };
      }

      return {
        status: order.status,
        filled_quantity: order.filled_quantity,
        filled_price: order.filled_price || undefined,
      };
    } catch (error) {
      return { status: OrderStatus.BROKER_UNKNOWN };
    }
  }

  async getPositions(): Promise<any[]> {
    await this.checkRateLimit();
    // In production, fetch from Upstox API
    return [];
  }

  async getHoldings(): Promise<any[]> {
    await this.checkRateLimit();
    // In production, fetch from Upstox API
    return [];
  }

  async getInstruments(): Promise<BrokerInstrument[]> {
    await this.checkRateLimit();
    // In production, fetch from Upstox API
    return [];
  }

  async getQuote(symbol: string): Promise<{ price: number; bid: number; ask: number; volume: number }> {
    await this.checkRateLimit();
    // In production, fetch from Upstox API
    return { price: 0, bid: 0, ask: 0, volume: 0 };
  }
}

/**
 * Angel One Broker Connector
 */
export class AngelOneConnector extends BrokerConnector {
  async authenticate(): Promise<boolean> {
    try {
      // Angel One SmartAPI authentication
      // In production, implement actual authentication
      return true;
    } catch (error) {
      console.error("Angel One authentication failed:", error);
      return false;
    }
  }

  async submitOrder(order: BrokerOrder): Promise<{ success: boolean; broker_order_id?: string; error?: string }> {
    await this.checkRateLimit();

    try {
      // Validate static IP if required
      if (this.config.static_ip_required && !this.config.static_ip_address) {
        return { success: false, error: "Static IP required but not configured" };
      }

      // Prepare Angel One order request
      const angelOrder = {
        mode: "FULL",
        exchangeTokens: order.broker_symbol,
        transactionType: order.action,
        orderType: order.order_type,
        quantity: order.quantity,
        price: order.price,
        productType: order.product,
        duration: order.validity,
        tag: order.idempotency_key,
      };

      // In production, make actual API call
      // const response = await fetch(`${this.config.base_url}/order/place`, {
      //   method: 'POST',
      //   headers: { 'Authorization': `Bearer ${this.config.access_token}` },
      //   body: JSON.stringify(angelOrder),
      //   timeout: this.config.timeout_ms,
      // });

      // Mock response for now
      const brokerOrderId = `ANGEL-${Date.now()}`;
      return { success: true, broker_order_id: brokerOrderId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    await this.checkRateLimit();

    try {
      const order = this.orders.get(orderId);
      if (!order || !order.broker_order_id) {
        return { success: false, error: "Order not found" };
      }

      // In production, make actual API call to cancel
      order.status = OrderStatus.CANCELLED;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getOrderStatus(
    orderId: string
  ): Promise<{ status: OrderStatus; filled_quantity?: number; filled_price?: number }> {
    await this.checkRateLimit();

    try {
      const order = this.orders.get(orderId);
      if (!order) {
        return { status: OrderStatus.BROKER_UNKNOWN };
      }

      return {
        status: order.status,
        filled_quantity: order.filled_quantity,
        filled_price: order.filled_price || undefined,
      };
    } catch (error) {
      return { status: OrderStatus.BROKER_UNKNOWN };
    }
  }

  async getPositions(): Promise<any[]> {
    await this.checkRateLimit();
    // In production, fetch from Angel One API
    return [];
  }

  async getHoldings(): Promise<any[]> {
    await this.checkRateLimit();
    // In production, fetch from Angel One API
    return [];
  }

  async getInstruments(): Promise<BrokerInstrument[]> {
    await this.checkRateLimit();
    // In production, fetch from Angel One API
    return [];
  }

  async getQuote(symbol: string): Promise<{ price: number; bid: number; ask: number; volume: number }> {
    await this.checkRateLimit();
    // In production, fetch from Angel One API
    return { price: 0, bid: 0, ask: 0, volume: 0 };
  }
}

/**
 * Broker Failover Manager
 */
export class BrokerFailoverManager {
  private primaryBroker: BrokerConnector;
  private secondaryBroker: BrokerConnector | null;
  private orders: Map<string, BrokerOrder> = new Map();

  constructor(
    primaryBroker: BrokerConnector,
    secondaryBroker?: BrokerConnector
  ) {
    this.primaryBroker = primaryBroker;
    this.secondaryBroker = secondaryBroker || null;
  }

  /**
   * Submit order with failover
   */
  async submitOrderWithFailover(order: BrokerOrder): Promise<BrokerOrder> {
    // Try primary broker
    let result = await this.primaryBroker.submitOrderWithRetry(order);

    if (result.status === OrderStatus.SUBMITTED) {
      this.orders.set(order.order_id, result);
      return result;
    }

    // If primary fails and secondary exists, try secondary
    if (this.secondaryBroker) {
      console.log(
        `Primary broker failed for order ${order.order_id}, attempting secondary broker`
      );
      result = await this.secondaryBroker.submitOrderWithRetry(order);
      if (result.status === OrderStatus.SUBMITTED) {
        this.orders.set(order.order_id, result);
        return result;
      }
    }

    return result;
  }

  /**
   * Reconcile order after failover
   */
  async reconcileOrderAfterFailover(orderId: string): Promise<BrokerOrder | null> {
    const order = this.orders.get(orderId);
    if (!order) return null;

    // Try primary broker first
    const primaryResult = await this.primaryBroker.reconcileOrderAfterFailover(
      orderId
    );

    if (primaryResult.reconciled) {
      return order;
    }

    // If primary fails, try secondary
    if (this.secondaryBroker) {
      const secondaryResult =
        await this.secondaryBroker.reconcileOrderAfterFailover(orderId);
      if (secondaryResult.reconciled) {
        return order;
      }
    }

    return null;
  }

  /**
   * Get order
   */
  getOrder(orderId: string): BrokerOrder | undefined {
    return this.orders.get(orderId);
  }
}
