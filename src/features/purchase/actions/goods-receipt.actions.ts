"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GoodsReceiptService } from "@/features/purchase/services/goods-receipt.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { createGoodsReceiptSchema } from "@/features/purchase/schemas/goods-receipt.schemas";
import type {
  GoodsReceiptActionResult,
  GoodsReceiptWithItems,
} from "@/features/purchase/types/goods-receipt.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): GoodsReceiptActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): GoodsReceiptActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

/** Safely parses the JSON-encoded `items` form field. */
function parseItems(value: FormDataEntryValue | null): unknown[] | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Builds the schema-shaped candidate object from a goods receipt FormData. */
function readFormCandidate(formData: FormData): Record<string, unknown> {
  return {
    purchaseOrderId: formData.get("purchaseOrderId") || undefined,
    branchId: formData.get("branchId") || undefined,
    receivedDate: formData.get("receivedDate") || undefined,
    notes: formData.get("notes") || undefined,
    items: parseItems(formData.get("items")) ?? [],
  };
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
  | { ok: false; result: GoodsReceiptActionResult<never> }
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
// Create
// ─────────────────────────────────────────────────────────────

export async function createGoodsReceiptAction(
  organizationId: string,
  formData: FormData
): Promise<GoodsReceiptActionResult<GoodsReceiptWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Received line items are missing or malformed");
  }

  const parsed = createGoodsReceiptSchema.safeParse(readFormCandidate(formData));
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "purchase.receive");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new GoodsReceiptService(supabase);
  const result = await service.createGoodsReceipt(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${result.data.purchaseOrderId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "goods_receipt.create",
      entityType: "goods_receipt",
      entityId: result.data.id,
      summary: `Recorded goods receipt ${result.data.grnNumber}`,
    });
  }
  return result;
}
