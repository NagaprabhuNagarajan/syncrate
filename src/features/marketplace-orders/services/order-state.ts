/**
 * Pure state-machine definitions for marketplace orders + escrow payments.
 *
 * This module has NO runtime dependencies (no Supabase, no server-only), so it
 * is safe to import from both server services and client components — the UI
 * uses it to decide which action buttons to render, and the services use it to
 * authorize transitions before touching the database.
 */
import type {
  MarketplaceOrder,
  OrderAction,
  OrderRole,
  OrderStatus,
  PaymentAction,
  PaymentStatus,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

// ─────────────────────────────────────────────────────────────
// Order transitions
// ─────────────────────────────────────────────────────────────

export interface OrderTransition {
  readonly action: OrderAction;
  /** Statuses the order must currently be in for this action. */
  readonly from: readonly OrderStatus[];
  readonly to: OrderStatus;
  /** Which party may perform it. */
  readonly roles: readonly OrderRole[];
}

/**
 * The full order lifecycle:
 *   pending → confirmed → fulfilled → completed
 *   pending/confirmed → cancelled (terminal)
 *
 *  - confirm  : seller accepts the order            (pending → confirmed)
 *  - cancel   : either party backs out              (pending|confirmed → cancelled)
 *  - fulfil   : seller ships/delivers               (confirmed → fulfilled)
 *  - complete : buyer confirms receipt              (fulfilled → completed)
 */
export const ORDER_TRANSITIONS: Record<OrderAction, OrderTransition> = {
  confirm: {
    action: "confirm",
    from: ["pending"],
    to: "confirmed",
    roles: ["seller"],
  },
  cancel: {
    action: "cancel",
    from: ["pending", "confirmed"],
    to: "cancelled",
    roles: ["buyer", "seller"],
  },
  fulfil: {
    action: "fulfil",
    from: ["confirmed"],
    to: "fulfilled",
    roles: ["seller"],
  },
  complete: {
    action: "complete",
    from: ["fulfilled"],
    to: "completed",
    roles: ["buyer"],
  },
};

export const ORDER_ACTIONS = Object.keys(ORDER_TRANSITIONS) as OrderAction[];

/** The caller's role relative to an order, or `null` if not a participant. */
export function getOrderRole(
  order: Pick<MarketplaceOrder, "organizationId" | "sellerOrganizationId">,
  organizationId: string
): OrderRole | null {
  if (order.organizationId === organizationId) {
    return "buyer";
  }
  if (order.sellerOrganizationId === organizationId) {
    return "seller";
  }
  return null;
}

/** Whether `action` is legal from `status` for `role`. */
export function canPerformOrderAction(
  action: OrderAction,
  status: OrderStatus,
  role: OrderRole
): boolean {
  const t = ORDER_TRANSITIONS[action];
  return t.from.includes(status) && t.roles.includes(role);
}

/** The actions a given role may take on an order in a given status. */
export function getAvailableOrderActions(
  status: OrderStatus,
  role: OrderRole
): OrderAction[] {
  return ORDER_ACTIONS.filter((action) =>
    canPerformOrderAction(action, status, role)
  );
}

// ─────────────────────────────────────────────────────────────
// Payment (escrow) transitions
// ─────────────────────────────────────────────────────────────

export interface PaymentTransition {
  readonly action: PaymentAction;
  readonly from: readonly PaymentStatus[];
  readonly to: PaymentStatus;
  readonly roles: readonly OrderRole[];
}

/**
 * Escrow lifecycle:
 *   pending → held → released | refunded   (failed is a sink on provider error)
 *
 *  - hold    : buyer (payer) funds the escrow        (pending → held)
 *  - release : buyer releases escrow to the seller   (held → released)
 *  - refund  : seller (payee) returns funds to buyer (held → refunded)
 */
export const PAYMENT_TRANSITIONS: Record<PaymentAction, PaymentTransition> = {
  hold: {
    action: "hold",
    from: ["pending"],
    to: "held",
    roles: ["buyer"],
  },
  release: {
    action: "release",
    from: ["held"],
    to: "released",
    roles: ["buyer"],
  },
  refund: {
    action: "refund",
    from: ["held"],
    to: "refunded",
    roles: ["seller"],
  },
};

export const PAYMENT_ACTIONS = Object.keys(
  PAYMENT_TRANSITIONS
) as PaymentAction[];

export function canPerformPaymentAction(
  action: PaymentAction,
  status: PaymentStatus,
  role: OrderRole
): boolean {
  const t = PAYMENT_TRANSITIONS[action];
  return t.from.includes(status) && t.roles.includes(role);
}

/**
 * Payment actions available for the current payment state + role. When no
 * payment exists yet (`status` is `null`), only the buyer may `hold` (the act
 * of funding escrow, which creates the payment).
 */
export function getAvailablePaymentActions(
  status: PaymentStatus | null,
  role: OrderRole
): PaymentAction[] {
  if (status === null) {
    return role === "buyer" ? ["hold"] : [];
  }
  return PAYMENT_ACTIONS.filter((action) =>
    canPerformPaymentAction(action, status, role)
  );
}
