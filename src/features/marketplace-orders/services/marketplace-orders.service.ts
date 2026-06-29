import type { AppSupabaseClient } from "@/lib/supabase/types";
import { MarketplaceOrdersRepository } from "@/features/marketplace-orders/repositories/marketplace-orders.repository";
import {
  ORDER_TRANSITIONS,
  getOrderRole,
} from "@/features/marketplace-orders/services/order-state";
import type {
  MarketplaceOrder,
  OrderAction,
  OrderActionResult,
  OrderError,
  OrderErrorCode,
  OrderListParams,
  OrderListResult,
  OrderWithPayment,
  PlaceOrderInput,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

function ok<T>(data: T): OrderActionResult<T> {
  return { success: true, data };
}

function fail(code: OrderErrorCode, message: string): OrderActionResult<never> {
  const error: OrderError = { code, message };
  return { success: false, error };
}

/** Trims an optional string and converts "" → null. */
function nz(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeCurrency(value: string | undefined): string {
  const trimmed = value?.trim().toUpperCase();
  return trimmed && trimmed.length === 3 ? trimmed : "INR";
}

const STATUS_LABEL: Record<MarketplaceOrder["status"], string> = {
  pending: "pending",
  confirmed: "confirmed",
  cancelled: "cancelled",
  fulfilled: "fulfilled",
  completed: "completed",
};

export class MarketplaceOrdersService {
  private readonly repo: MarketplaceOrdersRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new MarketplaceOrdersRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listOrders(
    organizationId: string,
    params?: OrderListParams
  ): Promise<OrderListResult> {
    return this.repo.listOrders(organizationId, params);
  }

  async getOrder(id: string): Promise<OrderActionResult<MarketplaceOrder>> {
    const order = await this.repo.findOrderById(id);
    if (!order) {
      return fail("not_found", "Order not found");
    }
    return ok(order);
  }

  async getOrderWithPayment(
    id: string
  ): Promise<OrderActionResult<OrderWithPayment>> {
    const order = await this.repo.findOrderById(id);
    if (!order) {
      return fail("not_found", "Order not found");
    }
    const payment = await this.repo.findPaymentByOrderId(id);
    return ok({ order, payment });
  }

  // ── Place (buyer) ──────────────────────────────────────────

  async placeOrder(
    input: PlaceOrderInput,
    buyerOrganizationId: string,
    userId: string
  ): Promise<OrderActionResult<MarketplaceOrder>> {
    if (input.sellerOrganizationId === buyerOrganizationId) {
      return fail("forbidden", "You cannot place an order with your own organization");
    }

    const quantity = Math.trunc(input.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return fail("validation", "Quantity must be at least 1");
    }
    if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
      return fail("validation", "Unit price is invalid");
    }

    const totalAmount = Number((quantity * input.unitPrice).toFixed(2));

    const order = await this.repo.createOrder({
      organization_id: buyerOrganizationId,
      seller_organization_id: input.sellerOrganizationId,
      listing_id: nz(input.listingId),
      status: "pending",
      quantity,
      total_amount: totalAmount,
      currency: normalizeCurrency(input.currency),
      notes: nz(input.notes),
      created_by: userId,
    });

    if (!order) {
      return fail("unknown", "Failed to place order. Please try again.");
    }
    return ok(order);
  }

  // ── Transition (state machine) ─────────────────────────────

  /**
   * Drives a single order transition. Enforces, in order:
   *  1. the order exists,
   *  2. the caller is a participant (buyer or seller),
   *  3. the action is legal from the current status (else conflict),
   *  4. the caller's role may perform it (else forbidden),
   *  5. the optimistic-lock version still matches (else conflict).
   */
  async transitionOrder(
    orderId: string,
    action: OrderAction,
    callerOrganizationId: string,
    userId: string,
    expectedVersion: number
  ): Promise<OrderActionResult<MarketplaceOrder>> {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      return fail("not_found", "Order not found");
    }

    const role = getOrderRole(order, callerOrganizationId);
    if (role === null) {
      return fail("forbidden", "You are not a participant in this order");
    }

    const transition = ORDER_TRANSITIONS[action];

    if (!transition.from.includes(order.status)) {
      return fail(
        "conflict",
        `Cannot ${action} an order that is ${STATUS_LABEL[order.status]}`
      );
    }

    if (!transition.roles.includes(role)) {
      return fail(
        "forbidden",
        `Only the ${transition.roles.join(" or ")} can ${action} this order`
      );
    }

    const updated = await this.repo.updateOrderStatus(
      orderId,
      transition.to,
      userId,
      expectedVersion
    );

    if (!updated) {
      return fail(
        "conflict",
        "This order was changed by someone else. Reload and try again."
      );
    }
    return ok(updated);
  }
}
