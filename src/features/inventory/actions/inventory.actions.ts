"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InventoryService } from "@/features/inventory/services/inventory.service";
import { BatchService } from "@/features/inventory/services/batch.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  adjustStockSchema,
  transferStockSchema,
} from "@/features/inventory/schemas/inventory.schemas";
import { createBatchSchema } from "@/features/inventory/schemas/batch.schemas";
import type { InventoryActionResult } from "@/features/inventory/types/inventory.types";
import type { Batch } from "@/features/inventory/types/batch.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): InventoryActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): InventoryActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  | { ok: true; userId: string }
  | { ok: false; result: InventoryActionResult<never> }
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
// Adjust stock
// ─────────────────────────────────────────────────────────────

export async function adjustStockAction(
  organizationId: string,
  formData: FormData
): Promise<InventoryActionResult<number>> {
  const parsed = adjustStockSchema.safeParse({
    productId: formData.get("productId"),
    branchId: formData.get("branchId"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "inventory.adjust");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new InventoryService(supabase);
  const result = await service.adjustStock(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/inventory");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "inventory.adjust",
      entityType: "inventory",
      entityId: parsed.data.productId,
      summary: `Adjusted stock by ${parsed.data.quantity} (new quantity ${result.data})`,
      metadata: {
        productId: parsed.data.productId,
        branchId: parsed.data.branchId,
        quantity: parsed.data.quantity,
      },
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Transfer stock
// ─────────────────────────────────────────────────────────────

export async function transferStockAction(
  organizationId: string,
  formData: FormData
): Promise<InventoryActionResult<void>> {
  const parsed = transferStockSchema.safeParse({
    productId: formData.get("productId"),
    fromBranchId: formData.get("fromBranchId"),
    toBranchId: formData.get("toBranchId"),
    quantity: formData.get("quantity"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "inventory.transfer");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new InventoryService(supabase);
  const result = await service.transferStock(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/inventory");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "inventory.transfer",
      entityType: "inventory",
      entityId: parsed.data.productId,
      summary: `Transferred ${parsed.data.quantity} unit(s) between branches`,
      metadata: {
        productId: parsed.data.productId,
        branchId: parsed.data.fromBranchId,
        toBranchId: parsed.data.toBranchId,
        quantity: parsed.data.quantity,
      },
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Create batch
// ─────────────────────────────────────────────────────────────

export async function createBatchAction(
  organizationId: string,
  formData: FormData
): Promise<InventoryActionResult<Batch>> {
  const parsed = createBatchSchema.safeParse({
    productId: formData.get("productId"),
    batchNumber: formData.get("batchNumber"),
    manufacturingDate: formData.get("manufacturingDate") || undefined,
    expiryDate: formData.get("expiryDate") || undefined,
    supplierBatch: formData.get("supplierBatch") || undefined,
    receivedQuantity: formData.get("receivedQuantity"),
    remainingQuantity: formData.get("remainingQuantity") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "inventory.adjust");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new BatchService(supabase);
  const result = await service.createBatch(
    {
      productId: parsed.data.productId,
      batchNumber: parsed.data.batchNumber,
      manufacturingDate: parsed.data.manufacturingDate || undefined,
      expiryDate: parsed.data.expiryDate || undefined,
      supplierBatch: parsed.data.supplierBatch || undefined,
      receivedQuantity: parsed.data.receivedQuantity,
      remainingQuantity: parsed.data.remainingQuantity,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/inventory/batches");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "batch.create",
      entityType: "batch",
      entityId: result.data.id,
      summary: `Created batch "${result.data.batchNumber}"`,
      metadata: {
        productId: parsed.data.productId,
        batchNumber: parsed.data.batchNumber,
      },
    });
  }

  // BatchActionResult and InventoryActionResult share the same shape; the
  // error codes are a compatible subset, so the cast is safe.
  return result as unknown as InventoryActionResult<Batch>;
}
