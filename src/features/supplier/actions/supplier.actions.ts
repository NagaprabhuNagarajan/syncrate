"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SupplierService } from "@/features/supplier/services/supplier.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { csvToObjects } from "@/utils/csv";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "@/features/supplier/schemas/supplier.schemas";
import type {
  Supplier,
  SupplierActionResult,
  SupplierImportResult,
} from "@/features/supplier/types/supplier.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): SupplierActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): SupplierActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

function parseTags(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
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
  | { ok: false; result: SupplierActionResult<never> }
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

export async function createSupplierAction(
  organizationId: string,
  formData: FormData
): Promise<SupplierActionResult<Supplier>> {
  const parsed = createSupplierSchema.safeParse({
    code: formData.get("code") || undefined,
    name: formData.get("name"),
    contactPerson: formData.get("contactPerson") || undefined,
    gstNumber: formData.get("gstNumber") || undefined,
    panNumber: formData.get("panNumber") || undefined,
    mobile: formData.get("mobile") || undefined,
    email: formData.get("email") || undefined,
    website: formData.get("website") || undefined,
    addressLine1: formData.get("addressLine1") || undefined,
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    pincode: formData.get("pincode") || undefined,
    country: formData.get("country") || undefined,
    bankAccountName: formData.get("bankAccountName") || undefined,
    bankAccountNumber: formData.get("bankAccountNumber") || undefined,
    bankIfsc: formData.get("bankIfsc") || undefined,
    bankName: formData.get("bankName") || undefined,
    upiId: formData.get("upiId") || undefined,
    paymentTermsDays: formData.get("paymentTermsDays") || undefined,
    openingBalance: formData.get("openingBalance") || undefined,
    rating: formData.get("rating") || undefined,
    tags: parseTags(formData.get("tags")),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "supplier.create");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SupplierService(supabase);
  const result = await service.createSupplier(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/suppliers");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "supplier.create",
      entityType: "supplier",
      entityId: result.data.id,
      summary: `Created supplier "${result.data.name}" (${result.data.code})`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateSupplierAction(
  organizationId: string,
  supplierId: string,
  formData: FormData
): Promise<SupplierActionResult<Supplier>> {
  const parsed = updateSupplierSchema.safeParse({
    code: formData.get("code") || undefined,
    name: formData.get("name") || undefined,
    contactPerson: formData.get("contactPerson") || undefined,
    gstNumber: formData.get("gstNumber") || undefined,
    panNumber: formData.get("panNumber") || undefined,
    mobile: formData.get("mobile") || undefined,
    email: formData.get("email") || undefined,
    website: formData.get("website") || undefined,
    addressLine1: formData.get("addressLine1") || undefined,
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    pincode: formData.get("pincode") || undefined,
    country: formData.get("country") || undefined,
    bankAccountName: formData.get("bankAccountName") || undefined,
    bankAccountNumber: formData.get("bankAccountNumber") || undefined,
    bankIfsc: formData.get("bankIfsc") || undefined,
    bankName: formData.get("bankName") || undefined,
    upiId: formData.get("upiId") || undefined,
    paymentTermsDays: formData.get("paymentTermsDays") || undefined,
    openingBalance: formData.get("openingBalance") || undefined,
    rating: formData.get("rating") || undefined,
    tags: formData.has("tags") ? parseTags(formData.get("tags")) : undefined,
    notes: formData.get("notes") || undefined,
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "supplier.update");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SupplierService(supabase);
  const result = await service.updateSupplier(
    supplierId,
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${supplierId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "supplier.update",
      entityType: "supplier",
      entityId: supplierId,
      summary: `Updated supplier "${result.data.name}" (${result.data.code})`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Archive
// ─────────────────────────────────────────────────────────────

export async function archiveSupplierAction(
  organizationId: string,
  supplierId: string
): Promise<SupplierActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "supplier.archive");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SupplierService(supabase);
  const result = await service.archiveSupplier(supplierId, auth.userId);

  if (result.success) {
    revalidatePath("/suppliers");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "supplier.archive",
      entityType: "supplier",
      entityId: supplierId,
      summary: "Archived supplier",
    });
  }
  return result;
}

export async function restoreSupplierAction(
  organizationId: string,
  supplierId: string
): Promise<SupplierActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "supplier.update");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SupplierService(supabase);
  const result = await service.restoreSupplier(supplierId, auth.userId);

  if (result.success) {
    revalidatePath("/suppliers");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "supplier.restore",
      entityType: "supplier",
      entityId: supplierId,
      summary: "Restored supplier",
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Export (CSV)
// ─────────────────────────────────────────────────────────────

export async function exportSuppliersAction(
  organizationId: string
): Promise<SupplierActionResult<string>> {
  const supabase = await createServerSupabaseClient();
  // Suppliers have no dedicated export permission seeded; reuse view access.
  const auth = await authorize(supabase, organizationId, "supplier.view");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SupplierService(supabase);
  const csv = await service.exportSuppliersCsv(organizationId);

  await new AuditService(supabase).log({
    organizationId,
    actorUserId: auth.userId,
    action: "supplier.export",
    entityType: "supplier",
    summary: "Exported suppliers to CSV",
  });

  return { success: true, data: csv };
}

// ─────────────────────────────────────────────────────────────
// Import (CSV)
// ─────────────────────────────────────────────────────────────

export async function importSuppliersAction(
  organizationId: string,
  csvText: string
): Promise<SupplierActionResult<SupplierImportResult>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "supplier.create");
  if (!auth.ok) {
    return auth.result;
  }

  const { rows } = csvToObjects(csvText);
  const service = new SupplierService(supabase);
  const summary = await service.importSuppliers(
    rows,
    organizationId,
    auth.userId
  );

  revalidatePath("/suppliers");
  await new AuditService(supabase).log({
    organizationId,
    actorUserId: auth.userId,
    action: "supplier.import",
    entityType: "supplier",
    summary: "Imported suppliers from CSV",
    metadata: {
      created: summary.created,
      skipped: summary.skipped,
      errorCount: summary.errors.length,
    },
  });

  return { success: true, data: summary };
}
