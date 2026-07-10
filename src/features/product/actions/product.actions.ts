"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProductService } from "@/features/product/services/product.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createProductSchema,
  updateProductSchema,
} from "@/features/product/schemas/product.schemas";
import { csvToObjects } from "@/utils/csv";
import type {
  Product,
  ProductActionResult,
  ProductImportResult,
} from "@/features/product/types/product.types";

function forbidden(message: string): ProductActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): ProductActionResult<never> {
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

async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  { ok: true; userId: string } | { ok: false; result: ProductActionResult<never> }
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

function rawFromForm(formData: FormData) {
  const gstRates = formData
    .getAll("gstRates")
    .map(String)
    .filter((v) => v !== "");
  return {
    code: formData.get("code") || undefined,
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    type: formData.get("type") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    brandId: formData.get("brandId") || undefined,
    unitId: formData.get("unitId") || undefined,
    manufacturer: formData.get("manufacturer") || undefined,
    hsnCode: formData.get("hsnCode") || undefined,
    gstRate: formData.get("gstRate") || undefined,
    gstRates: gstRates.length > 0 ? gstRates : undefined,
    taxInclusive: formData.get("taxInclusive") === "on" ? true : undefined,
    trackInventory:
      formData.get("trackInventory") === "on" ? true : undefined,
    purchasePrice: formData.get("purchasePrice") || undefined,
    sellingPrice: formData.get("sellingPrice") || undefined,
    dealerPrice: formData.get("dealerPrice") || undefined,
    wholesalePrice: formData.get("wholesalePrice") || undefined,
    retailPrice: formData.get("retailPrice") || undefined,
    minSellingPrice: formData.get("minSellingPrice") || undefined,
    sku: formData.get("sku") || undefined,
    barcode: formData.get("barcode") || undefined,
    qrCode: formData.get("qrCode") || undefined,
    reorderLevel: formData.get("reorderLevel") || undefined,
    maxStock: formData.get("maxStock") || undefined,
    openingStock: formData.get("openingStock") || undefined,
    preferredSupplierId: formData.get("preferredSupplierId") || undefined,
    tags: parseTags(formData.get("tags")),
  };
}

export async function createProductAction(
  organizationId: string,
  formData: FormData
): Promise<ProductActionResult<Product>> {
  const parsed = createProductSchema.safeParse(rawFromForm(formData));
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "product.create");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ProductService(supabase);
  const result = await service.createProduct(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/products");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "product.create",
      entityType: "product",
      entityId: result.data.id,
      summary: `Created product "${result.data.name}" (${result.data.code})`,
    });
  }
  return result;
}

export async function updateProductAction(
  organizationId: string,
  productId: string,
  formData: FormData
): Promise<ProductActionResult<Product>> {
  const parsed = updateProductSchema.safeParse({
    ...rawFromForm(formData),
    status: formData.get("status") || undefined,
    tags: formData.has("tags") ? parseTags(formData.get("tags")) : undefined,
  });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "product.update");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ProductService(supabase);
  const result = await service.updateProduct(
    productId,
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "product.update",
      entityType: "product",
      entityId: productId,
      summary: `Updated product "${result.data.name}"`,
    });
  }
  return result;
}

export async function archiveProductAction(
  organizationId: string,
  productId: string
): Promise<ProductActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "product.delete");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ProductService(supabase);
  const result = await service.archiveProduct(productId, auth.userId);

  if (result.success) {
    revalidatePath("/products");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "product.archive",
      entityType: "product",
      entityId: productId,
      summary: "Archived product",
    });
  }
  return result;
}

export async function restoreProductAction(
  organizationId: string,
  productId: string
): Promise<ProductActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "product.update");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ProductService(supabase);
  const result = await service.restoreProduct(productId, auth.userId);

  if (result.success) {
    revalidatePath("/products");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "product.restore",
      entityType: "product",
      entityId: productId,
      summary: "Restored product",
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Export (CSV)
// ─────────────────────────────────────────────────────────────

export async function exportProductsAction(
  organizationId: string
): Promise<ProductActionResult<string>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "product.export");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ProductService(supabase);
  const csv = await service.exportProductsCsv(organizationId);

  await new AuditService(supabase).log({
    organizationId,
    actorUserId: auth.userId,
    action: "product.export",
    entityType: "product",
    summary: "Exported products to CSV",
  });

  return { success: true, data: csv };
}

// ─────────────────────────────────────────────────────────────
// Import (CSV)
// ─────────────────────────────────────────────────────────────

export async function importProductsAction(
  organizationId: string,
  csvText: string
): Promise<ProductActionResult<ProductImportResult>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "product.import");
  if (!auth.ok) {
    return auth.result;
  }

  const { rows } = csvToObjects(csvText);
  const service = new ProductService(supabase);
  const summary = await service.importProducts(
    rows,
    organizationId,
    auth.userId
  );

  revalidatePath("/products");

  await new AuditService(supabase).log({
    organizationId,
    actorUserId: auth.userId,
    action: "product.import",
    entityType: "product",
    summary: `Imported ${summary.created} product(s)`,
    metadata: {
      created: summary.created,
      skipped: summary.skipped,
      errorCount: summary.errors.length,
    },
  });

  return { success: true, data: summary };
}
