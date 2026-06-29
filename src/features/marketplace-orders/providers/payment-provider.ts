import "server-only";

import type { PaymentAction } from "@/features/marketplace-orders/types/marketplace-orders.types";

/**
 * Provider-abstracted escrow payments.
 *
 * SECURITY/ARCHITECTURE: this module is `server-only`. A real PSP integration
 * (Razorpay, Stripe Connect, an escrow partner…) would make outbound HTTP
 * calls from an implementation of `PaymentProvider`; keeping the module
 * server-only guarantees secrets and network calls never leak into a client
 * bundle. The default `ManualPaymentProvider` is the HONEST offline default:
 * it performs NO external calls and simply records the state transition,
 * returning a synthetic reference so the rest of the system behaves
 * identically to a real provider. A real provider implements the same
 * interface and is swapped in by key — no call-site changes required.
 */

/** Context handed to every provider operation. */
export interface PaymentProviderContext {
  /** The persisted payment id, when one already exists. */
  readonly paymentId: string | null;
  readonly orderId: string;
  /** Payer (buyer) org. */
  readonly organizationId: string;
  /** Payee (seller) org. */
  readonly counterpartyOrganizationId: string;
  readonly amount: number;
  readonly currency: string;
  /** Reference returned by a prior operation (e.g. the hold auth id). */
  readonly externalReference: string | null;
}

/** Outcome of a provider operation. */
export type PaymentProviderOutcome =
  | { readonly success: true; readonly externalReference: string | null }
  | { readonly success: false; readonly reason: string };

/**
 * Drives the money movement for one escrow lifecycle:
 *   authorizeHold → release | refund
 * Implementations must be idempotent-safe at the call site (the service guards
 * state transitions before invoking them).
 */
export interface PaymentProvider {
  /** Stable key persisted on the payment row, e.g. "manual". */
  readonly key: string;
  /** Authorize + capture funds into escrow (pending → held). */
  authorizeHold(ctx: PaymentProviderContext): Promise<PaymentProviderOutcome>;
  /** Release escrowed funds to the seller (held → released). */
  release(ctx: PaymentProviderContext): Promise<PaymentProviderOutcome>;
  /** Return escrowed funds to the buyer (held → refunded). */
  refund(ctx: PaymentProviderContext): Promise<PaymentProviderOutcome>;
}

/** Provider key for the offline manual default. */
export const MANUAL_PROVIDER_KEY = "manual";

/**
 * Builds a synthetic, human-readable reference for a manually recorded
 * transition. This is NOT an external system id — it is a local marker that
 * stands in for whatever a real provider would return.
 */
function manualReference(action: PaymentAction, ctx: PaymentProviderContext): string {
  const suffix = ctx.paymentId ?? ctx.orderId;
  return `manual:${action}:${suffix}`;
}

/**
 * The default provider: records the transition with no external calls.
 * Always succeeds — there is no remote system that can fail.
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly key = MANUAL_PROVIDER_KEY;

  async authorizeHold(
    ctx: PaymentProviderContext
  ): Promise<PaymentProviderOutcome> {
    return { success: true, externalReference: manualReference("hold", ctx) };
  }

  async release(ctx: PaymentProviderContext): Promise<PaymentProviderOutcome> {
    return {
      success: true,
      externalReference: manualReference("release", ctx),
    };
  }

  async refund(ctx: PaymentProviderContext): Promise<PaymentProviderOutcome> {
    return { success: true, externalReference: manualReference("refund", ctx) };
  }
}

/** The provider used by default across the app. */
export const defaultPaymentProvider: PaymentProvider = new ManualPaymentProvider();
