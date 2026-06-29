"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { MarketplaceOrdersService } from "@/features/marketplace-orders/services/marketplace-orders.service";
import { MarketplacePaymentsService } from "@/features/marketplace-orders/services/marketplace-payments.service";
import { getOrderRole } from "@/features/marketplace-orders/services/order-state";
import {
  orderActionSchema,
  paymentActionSchema,
  placeOrderSchema,
} from "@/features/marketplace-orders/schemas/marketplace-orders.schemas";
import type {
  MarketplaceOrder,
  MarketplacePayment,
  OrderActionResult,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

const ORDERS_PATH = "/marketplace/orders";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): OrderActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): OrderActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

function notFound(message: string): OrderActionResult<never> {
  return { success: false, error: { code: "not_found", message } };
}

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
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
  | { ok: true; userId: string }
  | { ok: false; result: OrderActionResult<never> }
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

// ─────────────────────────────────────────────────────────────
// Place order (buyer)
// ─────────────────────────────────────────────────────────────

export async function placeOrderAction(
  organizationId: string,
  formData: FormData
): Promise<OrderActionResult<MarketplaceOrder>> {
  const parsed = placeOrderSchema.safeParse({
    sellerOrganizationId: formData.get("sellerOrganizationId"),
    listingId: nonEmpty(formData.get("listingId")),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    currency: nonEmpty(formData.get("currency")),
    notes: nonEmpty(formData.get("notes")),
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  // Participant guard: a buyer cannot order from their own organization.
  if (parsed.data.sellerOrganizationId === organizationId) {
    return forbidden("You cannot place an order with your own organization");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.order");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new MarketplaceOrdersService(supabase);
  const result = await service.placeOrder(
    {
      sellerOrganizationId: parsed.data.sellerOrganizationId,
      listingId: parsed.data.listingId || undefined,
      quantity: parsed.data.quantity,
      unitPrice: parsed.data.unitPrice,
      currency: parsed.data.currency || undefined,
      notes: parsed.data.notes || undefined,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(ORDERS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "marketplace.order_placed",
      entityType: "marketplace_order",
      entityId: result.data.id,
      summary: `Placed order for ${result.data.quantity} unit(s)`,
      metadata: {
        sellerOrganizationId: result.data.sellerOrganizationId,
        totalAmount: result.data.totalAmount,
        currency: result.data.currency,
      },
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Order transition (confirm / cancel / fulfil / complete)
// ─────────────────────────────────────────────────────────────

export async function transitionOrderAction(
  organizationId: string,
  orderId: string,
  action: string,
  version: number
): Promise<OrderActionResult<MarketplaceOrder>> {
  const parsed = orderActionSchema.safeParse({ action, version });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.order");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new MarketplaceOrdersService(supabase);

  // Participant guard: the caller's org must be the buyer or the seller.
  const existing = await service.getOrder(orderId);
  if (!existing.success) {
    return existing;
  }
  if (getOrderRole(existing.data, organizationId) === null) {
    return forbidden("You are not a participant in this order");
  }

  const result = await service.transitionOrder(
    orderId,
    parsed.data.action,
    organizationId,
    auth.userId,
    parsed.data.version
  );

  if (result.success) {
    revalidatePath(ORDERS_PATH);
    revalidatePath(`${ORDERS_PATH}/${orderId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: `marketplace.order_${parsed.data.action}`,
      entityType: "marketplace_order",
      entityId: orderId,
      summary: `Order ${parsed.data.action} → ${result.data.status}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Payment action (hold / release / refund)
// ─────────────────────────────────────────────────────────────

export async function paymentAction(
  organizationId: string,
  orderId: string,
  action: string
): Promise<OrderActionResult<MarketplacePayment>> {
  const parsed = paymentActionSchema.safeParse({ action });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.order");
  if (!auth.ok) {
    return auth.result;
  }

  const orderService = new MarketplaceOrdersService(supabase);
  const existing = await orderService.getOrder(orderId);
  if (!existing.success) {
    return notFound("Order not found");
  }

  const order = existing.data;
  // Participant guard: the caller's org must be the buyer or the seller.
  if (getOrderRole(order, organizationId) === null) {
    return forbidden("You are not a participant in this order");
  }

  const payments = new MarketplacePaymentsService(supabase);

  let result: OrderActionResult<MarketplacePayment>;
  if (parsed.data.action === "hold") {
    result = await payments.holdPayment(order, organizationId, auth.userId);
  } else if (parsed.data.action === "release") {
    result = await payments.releasePayment(order, organizationId, auth.userId);
  } else {
    result = await payments.refundPayment(order, organizationId, auth.userId);
  }

  if (result.success) {
    revalidatePath(ORDERS_PATH);
    revalidatePath(`${ORDERS_PATH}/${orderId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: `marketplace.payment_${parsed.data.action}`,
      entityType: "marketplace_payment",
      entityId: result.data.id,
      summary: `Payment ${parsed.data.action} → ${result.data.status}`,
      metadata: {
        orderId,
        provider: result.data.provider,
        externalReference: result.data.externalReference,
      },
    });
  }
  return result;
}
