"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MarketplaceService } from "@/features/marketplace/services/marketplace.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createListingSchema,
  listingStatusSchema,
  updateListingSchema,
} from "@/features/marketplace/schemas/marketplace.schemas";
import type {
  MarketplaceActionResult,
  MarketplaceListing,
} from "@/features/marketplace/types/marketplace.types";

const MY_LISTINGS_PATH = "/marketplace/my-listings";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): MarketplaceActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): MarketplaceActionResult<never> {
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
  | { ok: true; userId: string }
  | { ok: false; result: MarketplaceActionResult<never> }
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
// Create
// ─────────────────────────────────────────────────────────────

export async function createListingAction(
  organizationId: string,
  formData: FormData
): Promise<MarketplaceActionResult<MarketplaceListing>> {
  const parsed = createListingSchema.safeParse({
    listingType: formData.get("listingType"),
    productId: nonEmpty(formData.get("productId")),
    title: formData.get("title"),
    description: nonEmpty(formData.get("description")),
    category: nonEmpty(formData.get("category")),
    price: nonEmpty(formData.get("price")),
    currency: nonEmpty(formData.get("currency")),
    unit: nonEmpty(formData.get("unit")),
    minOrderQty: nonEmpty(formData.get("minOrderQty")),
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new MarketplaceService(supabase);
  const result = await service.createListing(
    {
      listingType: parsed.data.listingType,
      productId: parsed.data.productId || undefined,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      category: parsed.data.category || undefined,
      price: parsed.data.price,
      currency: parsed.data.currency || undefined,
      unit: parsed.data.unit || undefined,
      minOrderQty: parsed.data.minOrderQty,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(MY_LISTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "marketplace.create",
      entityType: "marketplace_listing",
      entityId: result.data.id,
      summary: `Created marketplace listing "${result.data.title}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateListingAction(
  organizationId: string,
  listingId: string,
  formData: FormData
): Promise<MarketplaceActionResult<MarketplaceListing>> {
  const parsed = updateListingSchema.safeParse({
    listingType: formData.get("listingType"),
    productId: nonEmpty(formData.get("productId")),
    title: formData.get("title"),
    description: nonEmpty(formData.get("description")),
    category: nonEmpty(formData.get("category")),
    price: nonEmpty(formData.get("price")),
    currency: nonEmpty(formData.get("currency")),
    unit: nonEmpty(formData.get("unit")),
    minOrderQty: nonEmpty(formData.get("minOrderQty")),
    version: formData.get("version"),
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new MarketplaceService(supabase);
  const result = await service.updateListing(
    listingId,
    {
      listingType: parsed.data.listingType,
      productId: parsed.data.productId || undefined,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      category: parsed.data.category || undefined,
      price: parsed.data.price,
      currency: parsed.data.currency || undefined,
      unit: parsed.data.unit || undefined,
      minOrderQty: parsed.data.minOrderQty,
      version: parsed.data.version,
    },
    auth.userId
  );

  if (result.success) {
    revalidatePath(MY_LISTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "marketplace.update",
      entityType: "marketplace_listing",
      entityId: listingId,
      summary: `Updated marketplace listing "${result.data.title}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Publish / unpublish
// ─────────────────────────────────────────────────────────────

export async function setListingPublishedAction(
  organizationId: string,
  listingId: string,
  isPublished: boolean
): Promise<MarketplaceActionResult<MarketplaceListing>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new MarketplaceService(supabase);
  const result = await service.setPublished(
    listingId,
    isPublished,
    auth.userId
  );

  if (result.success) {
    revalidatePath(MY_LISTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: isPublished ? "marketplace.publish" : "marketplace.unpublish",
      entityType: "marketplace_listing",
      entityId: listingId,
      summary: isPublished
        ? `Published listing "${result.data.title}"`
        : `Unpublished listing "${result.data.title}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Status change (active / paused)
// ─────────────────────────────────────────────────────────────

export async function setListingStatusAction(
  organizationId: string,
  listingId: string,
  status: string
): Promise<MarketplaceActionResult<MarketplaceListing>> {
  const parsed = listingStatusSchema.safeParse({ status });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid status");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new MarketplaceService(supabase);
  const result = await service.changeStatus(
    listingId,
    parsed.data.status,
    auth.userId
  );

  if (result.success) {
    revalidatePath(MY_LISTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "marketplace.status_change",
      entityType: "marketplace_listing",
      entityId: listingId,
      summary: `Set listing "${result.data.title}" to ${parsed.data.status}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Archive (soft delete)
// ─────────────────────────────────────────────────────────────

export async function archiveListingAction(
  organizationId: string,
  listingId: string
): Promise<MarketplaceActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new MarketplaceService(supabase);
  const result = await service.archiveListing(listingId, auth.userId);

  if (result.success) {
    revalidatePath(MY_LISTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "marketplace.archive",
      entityType: "marketplace_listing",
      entityId: listingId,
      summary: "Archived marketplace listing",
    });
  }
  return result;
}
