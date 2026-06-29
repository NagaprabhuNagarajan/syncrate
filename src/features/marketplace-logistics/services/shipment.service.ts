import type { AppSupabaseClient } from "@/lib/supabase/types";
import { ShipmentRepository } from "@/features/marketplace-logistics/repositories/shipment.repository";
import { getLogisticsProvider } from "@/features/marketplace-logistics/providers";
import type {
  AdvanceShipmentInput,
  CreateShipmentInput,
  Shipment,
  ShipmentActionResult,
  ShipmentError,
  ShipmentErrorCode,
  ShipmentParty,
  ShipmentStatus,
  ShipmentTransitionTarget,
} from "@/features/marketplace-logistics/types/logistics.types";

// ─────────────────────────────────────────────────────────────
// State machine — pure, exhaustively testable
// ─────────────────────────────────────────────────────────────

/**
 * Allowed status transitions. A shipment is created in `pending`; `delivered`
 * and `cancelled` are terminal.
 */
export const SHIPMENT_TRANSITIONS: Readonly<
  Record<ShipmentStatus, readonly ShipmentTransitionTarget[]>
> = {
  pending: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

/**
 * Which party may drive each transition target:
 *  - `in_transit` / `cancelled` — only the SHIPPER (seller).
 *  - `delivered` — the SHIPPER or the RECIPIENT (buyer confirms delivery).
 */
export const TRANSITION_ALLOWED_PARTIES: Readonly<
  Record<ShipmentTransitionTarget, readonly ShipmentParty[]>
> = {
  in_transit: ["shipper"],
  delivered: ["shipper", "recipient"],
  cancelled: ["shipper"],
};

/** True when `to` is a legal next status from `from`. */
export function canTransition(
  from: ShipmentStatus,
  to: ShipmentStatus
): boolean {
  return (SHIPMENT_TRANSITIONS[from] as readonly ShipmentStatus[]).includes(to);
}

/** True when `party` is permitted to set the shipment to `to`. */
export function partyCanSetStatus(
  party: ShipmentParty,
  to: ShipmentTransitionTarget
): boolean {
  return TRANSITION_ALLOWED_PARTIES[to].includes(party);
}

/**
 * Resolves which side of a two-party shipment an org is, or `null` if it is
 * neither the shipper nor the recipient (i.e. not a participant).
 */
export function resolveParty(
  callerOrgId: string,
  shipment: Pick<Shipment, "organizationId" | "counterpartyOrganizationId">
): ShipmentParty | null {
  if (callerOrgId === shipment.organizationId) {
    return "shipper";
  }
  if (callerOrgId === shipment.counterpartyOrganizationId) {
    return "recipient";
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Result helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): ShipmentActionResult<T> {
  return { success: true, data };
}

function fail(
  code: ShipmentErrorCode,
  message: string
): ShipmentActionResult<never> {
  const error: ShipmentError = { code, message };
  return { success: false, error };
}

function nz(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class ShipmentService {
  private readonly repo: ShipmentRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new ShipmentRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listShipments(
    organizationId: string,
    params?: Parameters<ShipmentRepository["listForOrg"]>[1]
  ): ReturnType<ShipmentRepository["listForOrg"]> {
    return this.repo.listForOrg(organizationId, params);
  }

  async getShipment(id: string): Promise<ShipmentActionResult<Shipment>> {
    const shipment = await this.repo.findById(id);
    if (!shipment) {
      return fail("not_found", "Shipment not found");
    }
    return ok(shipment);
  }

  // ── Create ─────────────────────────────────────────────────

  /**
   * Creates a shipment for a marketplace order. Only the order's SELLER may do
   * this: the shipment's owner (`organization_id`) is the seller and the
   * recipient (`counterparty_organization_id`) is the buyer. The persisted
   * carrier/tracking/provider fields come from the logistics provider.
   */
  async createShipment(
    input: CreateShipmentInput,
    callerOrgId: string,
    userId: string
  ): Promise<ShipmentActionResult<Shipment>> {
    const order = await this.repo.findOrderById(input.orderId);
    if (!order) {
      return fail("not_found", "Order not found");
    }

    // PARTICIPANT GUARD: only the order's seller may create a shipment for it.
    if (order.sellerOrganizationId !== callerOrgId) {
      return fail(
        "forbidden",
        "Only the seller of this order can create a shipment"
      );
    }

    const provider = getLogisticsProvider(input.provider);
    const draft = await provider.createShipment({
      orderId: input.orderId,
      carrier: input.carrier ?? null,
      trackingNumber: input.trackingNumber ?? null,
    });

    const shipment = await this.repo.create({
      organization_id: callerOrgId,
      counterparty_organization_id: order.buyerOrganizationId,
      order_id: order.id,
      provider: draft.provider,
      carrier: draft.carrier,
      tracking_number: draft.trackingNumber,
      status: draft.status,
      notes: nz(input.notes),
      created_by: userId,
    });

    if (!shipment) {
      return fail("unknown", "Failed to create shipment. Please try again.");
    }
    return ok(shipment);
  }

  // ── Advance status (state machine + participant guard + lock) ──

  /**
   * Advances a shipment through its lifecycle. Enforces, in order:
   *  1. participant guard — caller must be the shipper or recipient;
   *  2. valid transition — guarded by {@link SHIPMENT_TRANSITIONS};
   *  3. party permission — guarded by {@link TRANSITION_ALLOWED_PARTIES}
   *     (only the seller advances; the buyer may confirm delivery);
   *  4. optimistic lock — the update only matches the expected version.
   * Sets `shipped_at` on `in_transit` and `delivered_at` on `delivered`.
   */
  async advanceStatus(
    shipmentId: string,
    input: AdvanceShipmentInput,
    callerOrgId: string,
    userId: string
  ): Promise<ShipmentActionResult<Shipment>> {
    const shipment = await this.repo.findById(shipmentId);
    if (!shipment) {
      return fail("not_found", "Shipment not found");
    }

    const party = resolveParty(callerOrgId, shipment);
    if (!party) {
      return fail("forbidden", "You are not a participant in this shipment");
    }

    if (!canTransition(shipment.status, input.status)) {
      return fail(
        "invalid_transition",
        `A ${shipment.status} shipment cannot be marked ${input.status}`
      );
    }

    if (!partyCanSetStatus(party, input.status)) {
      return fail(
        "forbidden",
        party === "recipient"
          ? "Only the seller can perform this action"
          : "This action is not permitted for your organization"
      );
    }

    const patch = buildStatusPatch(input.status, shipment);

    const updated = await this.repo.updateStatus(
      shipmentId,
      patch,
      userId,
      input.version
    );

    if (!updated) {
      return fail(
        "conflict",
        "This shipment was changed by someone else. Reload and try again."
      );
    }
    return ok(updated);
  }
}

// ─────────────────────────────────────────────────────────────
// Patch builder — stamps timestamps on the relevant transitions
// ─────────────────────────────────────────────────────────────

function buildStatusPatch(
  status: ShipmentTransitionTarget,
  shipment: Shipment
): Record<string, unknown> {
  const patch: Record<string, unknown> = { status };
  const now = new Date().toISOString();

  if (status === "in_transit" && shipment.shippedAt === null) {
    patch.shipped_at = now;
  }
  if (status === "delivered") {
    if (shipment.shippedAt === null) {
      patch.shipped_at = now;
    }
    patch.delivered_at = now;
  }
  return patch;
}
