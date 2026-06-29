/**
 * Webhook domain types (Enterprise — outbound event delivery).
 *
 * The signing `secret` is NEVER part of the listed/read `WebhookEndpoint`
 * shape — the repository omits it. The full secret is surfaced exactly once at
 * creation via `CreatedWebhookEndpoint`, mirroring the one-time API-key reveal.
 */

export type WebhookDeliveryStatus = "pending" | "success" | "failed";

/** A stored webhook endpoint as exposed to the application — never the secret. */
export interface WebhookEndpoint {
  readonly id: string;
  readonly organizationId: string;
  readonly url: string;
  readonly description: string | null;
  readonly eventTypes: readonly string[];
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

/**
 * Result of creating an endpoint. `secret` is the only time the signing secret
 * is ever available — the UI shows it once and it can never be retrieved again.
 */
export interface CreatedWebhookEndpoint {
  readonly endpoint: WebhookEndpoint;
  readonly secret: string;
}

/**
 * Internal, server-only projection that DOES carry the secret. Only the
 * dispatch service uses this to sign payloads; it never leaves the server.
 */
export interface WebhookEndpointWithSecret {
  readonly id: string;
  readonly organizationId: string;
  readonly url: string;
  readonly secret: string;
  readonly eventTypes: readonly string[];
  readonly isActive: boolean;
}

/** A single delivery attempt record (metadata only — never the secret). */
export interface WebhookDelivery {
  readonly id: string;
  readonly organizationId: string;
  readonly endpointId: string;
  readonly eventType: string;
  readonly status: WebhookDeliveryStatus;
  readonly attempts: number;
  readonly responseStatus: number | null;
  readonly error: string | null;
  readonly createdAt: Date;
  readonly deliveredAt: Date | null;
}

export interface CreateWebhookEndpointInput {
  readonly url: string;
  readonly description?: string | null;
  readonly eventTypes: readonly string[];
  readonly isActive?: boolean;
}

export interface UpdateWebhookEndpointInput {
  readonly url?: string;
  readonly description?: string | null;
  readonly eventTypes?: readonly string[];
  readonly isActive?: boolean;
  /** Optimistic-lock token — the version the caller last observed. */
  readonly version: number;
}

/** Input to the dispatch engine. `payload` is the event body, signed as-is. */
export interface DispatchInput {
  readonly organizationId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}

export interface DispatchSummary {
  /** Number of active, subscribed endpoints the event was delivered to. */
  readonly dispatched: number;
  readonly deliveries: readonly WebhookDelivery[];
}

// ─────────────────────────────────────────────────────────────
// Event catalog — the known set of events an endpoint may subscribe to.
// ─────────────────────────────────────────────────────────────

export const WEBHOOK_EVENT_TYPES = [
  { value: "invoice.created", label: "Invoice created" },
  { value: "invoice.paid", label: "Invoice paid" },
  { value: "invoice.cancelled", label: "Invoice cancelled" },
  { value: "quotation.accepted", label: "Quotation accepted" },
  { value: "payment.received", label: "Payment received" },
  { value: "customer.created", label: "Customer created" },
  { value: "supplier.created", label: "Supplier created" },
  { value: "inventory.low_stock", label: "Inventory low stock" },
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]["value"];

export const WEBHOOK_EVENT_TYPE_VALUES: readonly string[] =
  WEBHOOK_EVENT_TYPES.map((e) => e.value);

/** Event type used by the "Send test" action. Not part of the catalog. */
export const WEBHOOK_TEST_EVENT_TYPE = "webhook.test";

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type WebhookErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "conflict"
  | "unknown";

export interface WebhookError {
  readonly code: WebhookErrorCode;
  readonly message: string;
}

export type WebhookActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: WebhookError };
