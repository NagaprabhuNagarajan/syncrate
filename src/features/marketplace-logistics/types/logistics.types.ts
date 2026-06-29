/**
 * Marketplace logistics (shipment) domain types.
 *
 * A shipment is a TWO-PARTY record: the shipper (seller) creates it for a
 * marketplace order and the recipient (buyer) can view it. Both parties see the
 * row under two-party RLS, but only certain transitions are allowed per party
 * (see `shipment.service`).
 *
 * The carrier integration is abstracted behind {@link LogisticsProvider}. The
 * honest default is a fully manual provider (no external HTTP); a real carrier
 * integration implements the same interface later.
 */

export type ShipmentStatus =
  | "pending"
  | "in_transit"
  | "delivered"
  | "cancelled";

/** A target status of a transition — `pending` is only ever the initial state. */
export type ShipmentTransitionTarget = Exclude<ShipmentStatus, "pending">;

/** Which side of a two-party shipment the caller's organization is. */
export type ShipmentParty = "shipper" | "recipient";

/** Known logistics provider keys. Only the manual provider exists today. */
export type LogisticsProviderKey = "manual";

// ─────────────────────────────────────────────────────────────
// Domain record (camelCase, mapped from the DB row)
// ─────────────────────────────────────────────────────────────

export interface Shipment {
  readonly id: string;
  /** Shipper / seller organization (the row owner). */
  readonly organizationId: string;
  /** Recipient / buyer organization. */
  readonly counterpartyOrganizationId: string;
  readonly orderId: string;
  readonly provider: string;
  readonly carrier: string | null;
  readonly trackingNumber: string | null;
  readonly status: ShipmentStatus;
  readonly shippedAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  /** Optimistic-lock token. */
  readonly version: number;
}

/**
 * Minimal projection of a marketplace order needed to authorize and seed a
 * shipment. Visible to both parties under the order's two-party RLS.
 */
export interface ShipmentOrderRef {
  readonly id: string;
  /** Buyer organization (the order owner) → becomes the shipment recipient. */
  readonly buyerOrganizationId: string;
  /** Seller organization → becomes the shipment shipper (row owner). */
  readonly sellerOrganizationId: string;
  readonly status: string;
}

// ─────────────────────────────────────────────────────────────
// Logistics provider abstraction (interface only — implementations are
// server-only and live under `providers/`)
// ─────────────────────────────────────────────────────────────

export interface CreateShipmentRequest {
  readonly orderId: string;
  readonly carrier?: string | null;
  readonly trackingNumber?: string | null;
}

/**
 * The fields a provider produces for a new shipment. The manual provider simply
 * echoes the user-entered carrier/tracking and starts in `pending`; a real
 * carrier would call its API and return a carrier-issued tracking number.
 */
export interface ProviderShipmentDraft {
  readonly provider: LogisticsProviderKey;
  readonly carrier: string | null;
  readonly trackingNumber: string | null;
  readonly status: ShipmentStatus;
}

/**
 * The result of polling a provider for live status. The manual provider has no
 * external source of truth, so it returns `status: null` and an honest detail
 * message indicating the status must be advanced by hand.
 */
export interface ProviderStatusResult {
  readonly status: ShipmentStatus | null;
  readonly detail: string;
}

/**
 * Carrier-agnostic logistics integration point.
 *
 * Implementations are server-only. The default {@link } ManualLogisticsProvider
 * performs no network I/O; a real carrier adapter implements the same surface.
 */
export interface LogisticsProvider {
  readonly key: LogisticsProviderKey;
  /** Prepares the persisted fields for a new shipment. */
  createShipment(input: CreateShipmentRequest): Promise<ProviderShipmentDraft>;
  /** Polls live status. Manual providers report that there is none. */
  getStatus(trackingNumber: string | null): Promise<ProviderStatusResult>;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateShipmentInput {
  readonly orderId: string;
  readonly provider?: LogisticsProviderKey;
  readonly carrier?: string;
  readonly trackingNumber?: string;
  readonly notes?: string;
}

export interface AdvanceShipmentInput {
  readonly status: ShipmentTransitionTarget;
  /** Optimistic-lock token the row was loaded with. */
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// List params / results
// ─────────────────────────────────────────────────────────────

export interface ShipmentListParams {
  readonly status?: ShipmentStatus;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ShipmentListResult {
  readonly items: readonly Shipment[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type ShipmentErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "invalid_transition"
  | "conflict"
  | "unknown";

export interface ShipmentError {
  readonly code: ShipmentErrorCode;
  readonly message: string;
}

export type ShipmentActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: ShipmentError };
