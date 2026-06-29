import type { AppSupabaseClient } from "@/lib/supabase/types";
import { MarketplaceOrdersRepository } from "@/features/marketplace-orders/repositories/marketplace-orders.repository";
import {
  PAYMENT_TRANSITIONS,
  getOrderRole,
} from "@/features/marketplace-orders/services/order-state";
import {
  defaultPaymentProvider,
  type PaymentProvider,
  type PaymentProviderContext,
} from "@/features/marketplace-orders/providers/payment-provider";
import type {
  MarketplaceOrder,
  MarketplacePayment,
  OrderActionResult,
  OrderError,
  OrderErrorCode,
  PaymentAction,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

function ok<T>(data: T): OrderActionResult<T> {
  return { success: true, data };
}

function fail(code: OrderErrorCode, message: string): OrderActionResult<never> {
  const error: OrderError = { code, message };
  return { success: false, error };
}

/** Order statuses during which escrow may be funded. */
const PAYABLE_ORDER_STATUSES: ReadonlySet<MarketplaceOrder["status"]> = new Set([
  "confirmed",
  "fulfilled",
]);

/**
 * Escrow payment service. Drives the DB payment state through the injected
 * `PaymentProvider` — the provider performs the (real or simulated) money
 * movement and the service persists the resulting state. Defaults to the
 * honest offline `ManualPaymentProvider`.
 */
export class MarketplacePaymentsService {
  private readonly repo: MarketplaceOrdersRepository;
  private readonly provider: PaymentProvider;

  constructor(
    supabase: AppSupabaseClient,
    provider: PaymentProvider = defaultPaymentProvider
  ) {
    this.repo = new MarketplaceOrdersRepository(supabase);
    this.provider = provider;
  }

  private buildContext(
    order: MarketplaceOrder,
    payment: MarketplacePayment | null
  ): PaymentProviderContext {
    return {
      paymentId: payment?.id ?? null,
      orderId: order.id,
      organizationId: order.organizationId,
      counterpartyOrganizationId: order.sellerOrganizationId,
      amount: payment?.amount ?? order.totalAmount,
      currency: payment?.currency ?? order.currency,
      externalReference: payment?.externalReference ?? null,
    };
  }

  // ── Hold (buyer funds escrow: pending → held) ──────────────

  async holdPayment(
    order: MarketplaceOrder,
    callerOrganizationId: string,
    userId: string
  ): Promise<OrderActionResult<MarketplacePayment>> {
    const role = getOrderRole(order, callerOrganizationId);
    if (role === null) {
      return fail("forbidden", "You are not a participant in this order");
    }
    if (!PAYMENT_TRANSITIONS.hold.roles.includes(role)) {
      return fail("forbidden", "Only the buyer can fund the escrow");
    }
    if (!PAYABLE_ORDER_STATUSES.has(order.status)) {
      return fail(
        "conflict",
        "The seller must confirm the order before it can be paid"
      );
    }

    const existing = await this.repo.findPaymentByOrderId(order.id);
    if (existing && existing.status !== "pending") {
      return fail(
        "conflict",
        `Payment is already ${existing.status}`
      );
    }

    // Reuse a pending payment, otherwise create one.
    const payment =
      existing ??
      (await this.repo.createPayment({
        organization_id: order.organizationId,
        counterparty_organization_id: order.sellerOrganizationId,
        order_id: order.id,
        provider: this.provider.key,
        status: "pending",
        amount: order.totalAmount,
        currency: order.currency,
        created_by: userId,
      }));

    if (!payment) {
      return fail("unknown", "Failed to initiate payment. Please try again.");
    }

    const outcome = await this.provider.authorizeHold(
      this.buildContext(order, payment)
    );

    if (!outcome.success) {
      await this.repo.updatePaymentStatus(
        payment.id,
        { status: "failed" },
        userId,
        payment.version
      );
      return fail("unknown", `Payment hold failed: ${outcome.reason}`);
    }

    return this.finalize(payment, "held", outcome.externalReference, userId);
  }

  // ── Release (buyer → seller: held → released) ──────────────

  async releasePayment(
    order: MarketplaceOrder,
    callerOrganizationId: string,
    userId: string
  ): Promise<OrderActionResult<MarketplacePayment>> {
    return this.settle(order, "release", callerOrganizationId, userId);
  }

  // ── Refund (seller → buyer: held → refunded) ───────────────

  async refundPayment(
    order: MarketplaceOrder,
    callerOrganizationId: string,
    userId: string
  ): Promise<OrderActionResult<MarketplacePayment>> {
    return this.settle(order, "refund", callerOrganizationId, userId);
  }

  /** Shared path for release/refund (both act on a `held` payment). */
  private async settle(
    order: MarketplaceOrder,
    action: Exclude<PaymentAction, "hold">,
    callerOrganizationId: string,
    userId: string
  ): Promise<OrderActionResult<MarketplacePayment>> {
    const role = getOrderRole(order, callerOrganizationId);
    if (role === null) {
      return fail("forbidden", "You are not a participant in this order");
    }

    const transition = PAYMENT_TRANSITIONS[action];
    if (!transition.roles.includes(role)) {
      return fail(
        "forbidden",
        `Only the ${transition.roles.join(" or ")} can ${action} this payment`
      );
    }

    const payment = await this.repo.findPaymentByOrderId(order.id);
    if (!payment) {
      return fail("not_found", "No payment exists for this order");
    }
    if (!transition.from.includes(payment.status)) {
      return fail("conflict", `Cannot ${action} a payment that is ${payment.status}`);
    }

    const ctx = this.buildContext(order, payment);
    const outcome =
      action === "release"
        ? await this.provider.release(ctx)
        : await this.provider.refund(ctx);

    if (!outcome.success) {
      await this.repo.updatePaymentStatus(
        payment.id,
        { status: "failed" },
        userId,
        payment.version
      );
      return fail("unknown", `Payment ${action} failed: ${outcome.reason}`);
    }

    return this.finalize(
      payment,
      transition.to,
      outcome.externalReference,
      userId
    );
  }

  /** Persists the successful provider outcome with optimistic locking. */
  private async finalize(
    payment: MarketplacePayment,
    status: MarketplacePayment["status"],
    externalReference: string | null,
    userId: string
  ): Promise<OrderActionResult<MarketplacePayment>> {
    const updated = await this.repo.updatePaymentStatus(
      payment.id,
      { status, external_reference: externalReference ?? payment.externalReference },
      userId,
      payment.version
    );

    if (!updated) {
      return fail(
        "conflict",
        "This payment was changed by someone else. Reload and try again."
      );
    }
    return ok(updated);
  }
}
