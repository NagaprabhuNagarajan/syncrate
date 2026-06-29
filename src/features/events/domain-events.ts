/**
 * Catalog of domain event types emitted by business actions.
 *
 * A single shared list keeps emitters (domain actions), webhook subscriptions,
 * and workflow triggers in agreement on the exact event-type strings. Adding a
 * new trigger point means adding its constant here and emitting it.
 */

export const DOMAIN_EVENTS = {
  INVOICE_CREATED: "invoice.created",
  INVOICE_POSTED: "invoice.posted",
  PURCHASE_INVOICE_CREATED: "purchase_invoice.created",
  CUSTOMER_PAYMENT_RECORDED: "payment.customer.recorded",
  SUPPLIER_PAYMENT_RECORDED: "payment.supplier.recorded",
} as const;

export type DomainEventType =
  (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

/** Every catalogued event type, for UI multiselects and validation. */
export const DOMAIN_EVENT_TYPES: readonly DomainEventType[] =
  Object.values(DOMAIN_EVENTS);
