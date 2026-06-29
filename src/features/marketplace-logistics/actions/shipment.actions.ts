"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ShipmentService } from "@/features/marketplace-logistics/services/shipment.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  advanceShipmentSchema,
  createShipmentSchema,
} from "@/features/marketplace-logistics/schemas/shipment.schemas";
import type {
  Shipment,
  ShipmentActionResult,
} from "@/features/marketplace-logistics/types/logistics.types";

const SHIPMENTS_PATH = "/marketplace/shipments";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): ShipmentActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): ShipmentActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

/**
 * Resolves the caller, verifies org membership, and checks a permission.
 * Returns the authenticated userId on success.
 */
async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  { ok: true; userId: string } | { ok: false; result: ShipmentActionResult<never> }
> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { ok: false, result: forbidden("Not authenticated") };
  }

  const orgService = new OrganizationService(supabase);
  const context = await orgService.getOrganizationContext(
    organizationId,
    authData.user.id
  );
  if (!context) {
    return {
      ok: false,
      result: forbidden("You do not have access to this organization"),
    };
  }
  if (!context.permissions.includes(permission)) {
    return {
      ok: false,
      result: forbidden("You do not have permission to perform this action"),
    };
  }

  return { ok: true, userId: authData.user.id };
}

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

// ─────────────────────────────────────────────────────────────
// Create shipment (seller only — enforced in the service)
// ─────────────────────────────────────────────────────────────

export async function createShipmentAction(
  organizationId: string,
  formData: FormData
): Promise<ShipmentActionResult<Shipment>> {
  const parsed = createShipmentSchema.safeParse({
    orderId: formData.get("orderId"),
    provider: nonEmpty(formData.get("provider")),
    carrier: nonEmpty(formData.get("carrier")),
    trackingNumber: nonEmpty(formData.get("trackingNumber")),
    notes: nonEmpty(formData.get("notes")),
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.order");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ShipmentService(supabase);
  const result = await service.createShipment(
    {
      orderId: parsed.data.orderId,
      provider: parsed.data.provider,
      carrier: parsed.data.carrier || undefined,
      trackingNumber: parsed.data.trackingNumber || undefined,
      notes: parsed.data.notes || undefined,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(SHIPMENTS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "marketplace.shipment_create",
      entityType: "marketplace_shipment",
      entityId: result.data.id,
      summary: `Created shipment for order ${result.data.orderId}`,
      metadata: {
        orderId: result.data.orderId,
        provider: result.data.provider,
        recipientOrganizationId: result.data.counterpartyOrganizationId,
      },
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Advance status (participant guard enforced in the service)
// ─────────────────────────────────────────────────────────────

export async function advanceShipmentAction(
  organizationId: string,
  shipmentId: string,
  status: string,
  version: number
): Promise<ShipmentActionResult<Shipment>> {
  const parsed = advanceShipmentSchema.safeParse({ status, version });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.order");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ShipmentService(supabase);
  const result = await service.advanceStatus(
    shipmentId,
    { status: parsed.data.status, version: parsed.data.version },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(SHIPMENTS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: `marketplace.shipment_${parsed.data.status}`,
      entityType: "marketplace_shipment",
      entityId: shipmentId,
      summary: `Marked shipment ${parsed.data.status}`,
      metadata: { status: parsed.data.status, orderId: result.data.orderId },
    });
  }
  return result;
}
