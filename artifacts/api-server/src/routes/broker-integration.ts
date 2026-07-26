/**
 * Broker Integration and Order Generation Routes
 * Implements order generation, broker communication, and execution lifecycle
 */

import { Router } from "express";
import { db } from "@ieis/db";
import {
  brokerOrderTable,
  brokerFillTable,
  brokerConfigTable,
  securitiesTable,
  signalsTable,
} from "@ieis/db";
import { eq, desc } from "drizzle-orm";
import * as formulas from "@ieis/formulas";
import { z } from "zod/v4";
import crypto from "crypto";

const router = Router();

// ============================================================================
// Request/Response Schemas
// ============================================================================

const GenerateOrderBody = z.object({
  isin: z.string(),
  horizon: z.enum(["daily", "weekly", "monthly", "medium", "long"]),
  signal_id: z.string(),
  order_type: z.enum(["market", "limit", "stop_loss", "stop_loss_limit"]),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  stop_price: z.number().positive().optional(),
  broker: z.enum(["upstox", "angel_one", "paper_trading"]),
  strategy: z.string().optional(),
  entry_reason: z.string().optional(),
});

const SubmitOrderBody = z.object({
  order_id: z.string(),
  broker: z.enum(["upstox", "angel_one", "paper_trading"]),
});

const RecordFillBody = z.object({
  order_id: z.string(),
  broker_fill_id: z.string(),
  quantity: z.number().positive(),
  price: z.number().positive(),
  commission: z.number().optional(),
  tax: z.number().optional(),
});

const ListOrdersQueryParams = z.object({
  isin: z.string().optional(),
  status: z.string().optional(),
  broker: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

// ============================================================================
// Order Generation
// ============================================================================

router.post("/orders/generate", async (req, res): Promise<void> => {
  try {
    const parsed = GenerateOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const {
      isin,
      horizon,
      signal_id,
      order_type,
      side,
      quantity,
      price,
      stop_price,
      broker,
      strategy,
      entry_reason,
    } = parsed.data;

    // Get security information
    const [security] = await db
      .select()
      .from(securitiesTable)
      .where(eq(securitiesTable.isin, isin));

    if (!security) {
      res.status(404).json({ error: "Security not found" });
      return;
    }

    // Generate idempotency key for duplicate protection
    const idempotencyKey = formulas.idempotencyKey(
      isin,
      horizon,
      signal_id,
      side,
      new Date().toISOString().split("T")[0]
    );

    // Check if order already exists with this idempotency key
    const existingOrders = await db
      .select()
      .from(brokerOrderTable)
      .where(eq(brokerOrderTable.idempotency_key, idempotencyKey));

    if (existingOrders.length > 0) {
      res.status(409).json({
        error: "Duplicate order detected",
        existing_order_id: existingOrders[0].order_id,
      });
      return;
    }

    const orderId = `ORD_${isin}_${Date.now()}`;

    // Insert order
    const [inserted] = await db
      .insert(brokerOrderTable)
      .values({
        order_id: orderId,
        idempotency_key: idempotencyKey,
        broker,
        isin,
        ticker: security.ticker,
        name: security.name,
        horizon,
        signal_id,
        order_type,
        side,
        quantity: quantity.toString(),
        price: price ? price.toString() : undefined,
        stop_price: stop_price ? stop_price.toString() : undefined,
        strategy,
        entry_reason,
      })
      .returning();

    res.status(201).json({
      order_id: orderId,
      idempotency_key: idempotencyKey,
      isin,
      ticker: security.ticker,
      side,
      quantity,
      order_type,
      status: "signal_confirmed",
      created_at: inserted.created_at,
    });
  } catch (error) {
    console.error("Error generating order:", error);
    res.status(500).json({ error: "Failed to generate order" });
  }
});

// ============================================================================
// Risk Check and Order Preview
// ============================================================================

router.post("/orders/:order_id/risk-check", async (req, res): Promise<void> => {
  try {
    const { order_id } = req.params;
    const { position_suitability_score, liquidity_check_passed } = req.body;

    const [order] = await db
      .select()
      .from(brokerOrderTable)
      .where(eq(brokerOrderTable.order_id, order_id));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Update order with risk check results
    const [updated] = await db
      .update(brokerOrderTable)
      .set({
        status: "risk_checked",
        position_suitability_score: position_suitability_score ? position_suitability_score.toString() : undefined,
        liquidity_check_passed,
        updated_at: new Date(),
      })
      .where(eq(brokerOrderTable.order_id, order_id))
      .returning();

    res.json({
      order_id,
      status: "risk_checked",
      position_suitability_score,
      liquidity_check_passed,
      ready_for_submission: liquidity_check_passed && position_suitability_score >= 50,
    });
  } catch (error) {
    console.error("Error performing risk check:", error);
    res.status(500).json({ error: "Failed to perform risk check" });
  }
});

// ============================================================================
// Submit Order to Broker
// ============================================================================

router.post("/orders/:order_id/submit", async (req, res): Promise<void> => {
  try {
    const { order_id } = req.params;
    const parsed = SubmitOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { broker } = parsed.data;

    const [order] = await db
      .select()
      .from(brokerOrderTable)
      .where(eq(brokerOrderTable.order_id, order_id));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Get broker configuration
    const [brokerConfig] = await db
      .select()
      .from(brokerConfigTable)
      .where(eq(brokerConfigTable.broker, broker as any));

    if (!brokerConfig || !brokerConfig.enabled) {
      res.status(400).json({ error: "Broker not configured or disabled" });
      return;
    }

    // Simulate broker submission
    const brokerOrderId = `BR_${broker.toUpperCase()}_${Date.now()}`;
    const brokerReference = `REF_${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

    // Update order
    const [updated] = await db
      .update(brokerOrderTable)
      .set({
        status: "submitted",
        submitted_at: new Date(),
        broker_order_id: brokerOrderId,
        broker_reference: brokerReference,
        updated_at: new Date(),
      })
      .where(eq(brokerOrderTable.order_id, order_id))
      .returning();

    res.json({
      order_id,
      broker_order_id: brokerOrderId,
      broker_reference: brokerReference,
      status: "submitted",
      submitted_at: updated.submitted_at,
      message: `Order submitted to ${broker}`,
    });
  } catch (error) {
    console.error("Error submitting order:", error);
    res.status(500).json({ error: "Failed to submit order" });
  }
});

// ============================================================================
// Record Fill
// ============================================================================

router.post("/orders/:order_id/fill", async (req, res): Promise<void> => {
  try {
    const { order_id } = req.params;
    const parsed = RecordFillBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { broker_fill_id, quantity, price, commission, tax } = parsed.data;

    const [order] = await db
      .select()
      .from(brokerOrderTable)
      .where(eq(brokerOrderTable.order_id, order_id));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const fillId = `FILL_${order_id}_${Date.now()}`;

    // Record fill
    const [fill] = await db
      .insert(brokerFillTable)
      .values({
        fill_id: fillId,
        order_id,
        broker: order.broker,
        broker_fill_id,
        isin: order.isin,
        ticker: order.ticker,
        quantity: quantity.toString(),
        price: price.toString(),
        commission: commission ? commission.toString() : undefined,
        tax: tax ? tax.toString() : undefined,
        filled_at: new Date(),
      })
      .returning();

    // Update order status
    const filledQuantity = (parseFloat(order.filled_quantity || "0") + quantity).toString();
    const totalQuantity = parseFloat(order.quantity);
    const newStatus = parseFloat(filledQuantity) >= totalQuantity ? "filled" : "partially_filled";

    const [updated] = await db
      .update(brokerOrderTable)
      .set({
        status: newStatus as any,
        filled_quantity: filledQuantity,
        average_fill_price: price.toString(),
        filled_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(brokerOrderTable.order_id, order_id))
      .returning();

    res.status(201).json({
      fill_id: fillId,
      order_id,
      quantity,
      price,
      commission,
      tax,
      order_status: newStatus,
      filled_at: fill.filled_at,
    });
  } catch (error) {
    console.error("Error recording fill:", error);
    res.status(500).json({ error: "Failed to record fill" });
  }
});

// ============================================================================
// List Orders
// ============================================================================

router.get("/orders", async (req, res): Promise<void> => {
  try {
    const query = ListOrdersQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    let dbQuery = db.select().from(brokerOrderTable);

    if (query.data.isin) {
      dbQuery = dbQuery.where(eq(brokerOrderTable.isin, query.data.isin));
    }

    if (query.data.status) {
      dbQuery = dbQuery.where(eq(brokerOrderTable.status, query.data.status as any));
    }

    if (query.data.broker) {
      dbQuery = dbQuery.where(eq(brokerOrderTable.broker, query.data.broker as any));
    }

    dbQuery = dbQuery.orderBy(desc(brokerOrderTable.created_at));

    const limit = query.data.limit ?? 50;
    const offset = query.data.offset ?? 0;

    const orders = await dbQuery.limit(limit).offset(offset);

    const items = orders.map((o) => ({
      order_id: o.order_id,
      isin: o.isin,
      ticker: o.ticker,
      side: o.side,
      quantity: parseFloat(o.quantity),
      price: o.price ? parseFloat(o.price) : null,
      status: o.status,
      broker: o.broker,
      horizon: o.horizon,
      created_at: o.created_at,
      submitted_at: o.submitted_at,
      filled_at: o.filled_at,
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ============================================================================
// Broker Failover
// ============================================================================

router.post("/orders/:order_id/failover", async (req, res): Promise<void> => {
  try {
    const { order_id } = req.params;

    const [order] = await db
      .select()
      .from(brokerOrderTable)
      .where(eq(brokerOrderTable.order_id, order_id));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Increment failover count
    const failoverCount = (parseFloat(order.failover_count || "0") + 1).toString();

    const [updated] = await db
      .update(brokerOrderTable)
      .set({
        failover_count: failoverCount,
        last_failover_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(brokerOrderTable.order_id, order_id))
      .returning();

    res.json({
      order_id,
      failover_count: parseFloat(failoverCount),
      last_failover_at: updated.last_failover_at,
      message: "Failover recorded. Order can be resubmitted.",
    });
  } catch (error) {
    console.error("Error recording failover:", error);
    res.status(500).json({ error: "Failed to record failover" });
  }
});

// ============================================================================
// Broker Configuration
// ============================================================================

router.get("/broker/config/:broker", async (req, res): Promise<void> => {
  try {
    const { broker } = req.params;

    const [config] = await db
      .select()
      .from(brokerConfigTable)
      .where(eq(brokerConfigTable.broker, broker as any));

    if (!config) {
      res.status(404).json({ error: "Broker configuration not found" });
      return;
    }

    res.json({
      broker: config.broker,
      static_ip: config.static_ip,
      algo_registered: config.algo_registered,
      max_order_value: config.max_order_value ? parseFloat(config.max_order_value) : null,
      rate_limit_orders_per_minute: config.rate_limit_orders_per_minute ? parseFloat(config.rate_limit_orders_per_minute) : null,
      order_split_size: config.order_split_size ? parseFloat(config.order_split_size) : null,
      enabled: config.enabled,
    });
  } catch (error) {
    console.error("Error fetching broker config:", error);
    res.status(500).json({ error: "Failed to fetch broker config" });
  }
});

export default router;
