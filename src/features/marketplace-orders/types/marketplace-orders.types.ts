/**
 * Marketplace orders + payments domain types.
 *
 * Two-party records: every order/payment links a BUYER org
 * (`organizationId`) and a SELLER org (`sellerOrganizationId` /
 * payment `counterpartyOrganizationId`). RLS makes the row visible to both
 * parties; the application layer additionally enforces participant + role
 * guards (a seller can confirm, only a buyer can pay, etc.).
 */

// ─────────────────────────────────────────────────────────────
// Order lifecycle
// ─────────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "fulfilled"
  | "completed";

/** A transition verb invoked against an order. */
export type OrderAction = "confirm" | "cancel" | "fulfil" | "complete";

/** Which party a caller is, relative to a given order. */
export type OrderRole = "buyer" | "seller";

export interface MarketplaceOrder {
  readonly id: string;
  /** Buyer organization (the org that placed the order). */
  readonly organizationId: string;
  /** Seller organization (the listing owner). */
  readonly sellerOrganizationId: string;
  readonly listingId: string | null;
  readonly status: OrderStatus;
  readonly quantity: number;
  readonly totalAmount: number;
  readonly currency: string;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  /** Optimistic-lock token. */
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Payment (escrow) lifecycle
// ─────────────────────────────────────────────────────────────

export type PaymentStatus =
  | "pending"
  | "held"
  | "released"
  | "refunded"
  | "failed";

/** A transition verb invoked against a payment. */
export type PaymentAction = "hold" | "release" | "refund";

export interface MarketplacePayment {
  readonly id: string;
  /** Payer organization (buyer). */
  readonly organizationId: string;
  /** Payee organization (seller). */
  readonly counterpartyOrganizationId: string;
  readonly orderId: string;
  /** Provider key, e.g. "manual". */
  readonly provider: string;
  readonly status: PaymentStatus;
  readonly amount: number;
  readonly currency: string;
  /** Whatever a real PSP would return (auth id, charge id…). */
  readonly externalReference: string | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface PlaceOrderInput {
  /** The seller org the buyer is ordering from. */
  readonly sellerOrganizationId: string;
  readonly listingId?: string;
  readonly quantity: number;
  /** Unit price (the buyer already has this from browse). */
  readonly unitPrice: number;
  readonly currency?: string;
  readonly notes?: string;
}

// ─────────────────────────────────────────────────────────────
// List params / results
// ─────────────────────────────────────────────────────────────

/** Which side of the trade to show. */
export type OrderPerspective = "all" | "buying" | "selling";

export interface OrderListParams {
  readonly perspective?: OrderPerspective;
  readonly status?: OrderStatus;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface OrderListResult {
  readonly items: readonly MarketplaceOrder[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** An order paired with its payment, for the detail view. */
export interface OrderWithPayment {
  readonly order: MarketplaceOrder;
  readonly payment: MarketplacePayment | null;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type OrderErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "conflict"
  | "unknown";

export interface OrderError {
  readonly code: OrderErrorCode;
  readonly message: string;
}

export type OrderActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: OrderError };
