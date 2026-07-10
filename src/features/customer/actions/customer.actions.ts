"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CustomerService } from "@/features/customer/services/customer.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@/features/customer/schemas/customer.schemas";
import { csvToObjects } from "@/utils/csv";
import type {
  Customer,
  CustomerActionResult,
  CustomerImportResult,
} from "@/features/customer/types/customer.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): CustomerActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): CustomerActionResult<never> {
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
  { ok: true; userId: string } | { ok: false; result: CustomerActionResult<never> }
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

export async function createCustomerAction(
  organizationId: string,
  formData: FormData
): Promise<CustomerActionResult<Customer>> {
  const parsed = createCustomerSchema.safeParse({
    code: formData.get("code") || undefined,
    name: formData.get("name"),
    company: formData.get("company") || undefined,
    gstNumber: formData.get("gstNumber") || undefined,
    panNumber: formData.get("panNumber") || undefined,
    mobile: formData.get("mobile") || undefined,
    email: formData.get("email") || undefined,
    website: formData.get("website") || undefined,
    billingAddressLine1: formData.get("billingAddressLine1") || undefined,
    billingAddressLine2: formData.get("billingAddressLine2") || undefined,
    billingCity: formData.get("billingCity") || undefined,
    billingState: formData.get("billingState") || undefined,
    billingPincode: formData.get("billingPincode") || undefined,
    billingCountry: formData.get("billingCountry") || undefined,
    shippingAddressLine1: formData.get("shippingAddressLine1") || undefined,
    shippingAddressLine2: formData.get("shippingAddressLine2") || undefined,
    shippingCity: formData.get("shippingCity") || undefined,
    shippingState: formData.get("shippingState") || undefined,
    shippingPincode: formData.get("shippingPincode") || undefined,
    shippingCountry: formData.get("shippingCountry") || undefined,
    creditLimit: formData.get("creditLimit") || undefined,
    paymentTermsDays: formData.get("paymentTermsDays") || undefined,
    preferredPaymentMethod: formData.get("preferredPaymentMethod") || undefined,
    openingBalance: formData.get("openingBalance") || undefined,
    tags: parseTags(formData.get("tags")),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "customer.create");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new CustomerService(supabase);
  const result = await service.createCustomer(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/customers");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "customer.create",
      entityType: "customer",
      entityId: result.data.id,
      summary: `Created customer "${result.data.name}" (${result.data.code})`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateCustomerAction(
  organizationId: string,
  customerId: string,
  formData: FormData
): Promise<CustomerActionResult<Customer>> {
  const parsed = updateCustomerSchema.safeParse({
    code: formData.get("code") || undefined,
    name: formData.get("name") || undefined,
    company: formData.get("company") || undefined,
    gstNumber: formData.get("gstNumber") || undefined,
    panNumber: formData.get("panNumber") || undefined,
    mobile: formData.get("mobile") || undefined,
    email: formData.get("email") || undefined,
    website: formData.get("website") || undefined,
    billingAddressLine1: formData.get("billingAddressLine1") || undefined,
    billingAddressLine2: formData.get("billingAddressLine2") || undefined,
    billingCity: formData.get("billingCity") || undefined,
    billingState: formData.get("billingState") || undefined,
    billingPincode: formData.get("billingPincode") || undefined,
    billingCountry: formData.get("billingCountry") || undefined,
    shippingAddressLine1: formData.get("shippingAddressLine1") || undefined,
    shippingAddressLine2: formData.get("shippingAddressLine2") || undefined,
    shippingCity: formData.get("shippingCity") || undefined,
    shippingState: formData.get("shippingState") || undefined,
    shippingPincode: formData.get("shippingPincode") || undefined,
    shippingCountry: formData.get("shippingCountry") || undefined,
    creditLimit: formData.get("creditLimit") || undefined,
    paymentTermsDays: formData.get("paymentTermsDays") || undefined,
    preferredPaymentMethod: formData.get("preferredPaymentMethod") || undefined,
    openingBalance: formData.get("openingBalance") || undefined,
    tags: formData.has("tags") ? parseTags(formData.get("tags")) : undefined,
    notes: formData.get("notes") || undefined,
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "customer.update");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new CustomerService(supabase);
  const result = await service.updateCustomer(
    customerId,
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "customer.update",
      entityType: "customer",
      entityId: customerId,
      summary: `Updated customer "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Archive
// ─────────────────────────────────────────────────────────────

export async function archiveCustomerAction(
  organizationId: string,
  customerId: string
): Promise<CustomerActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "customer.archive");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new CustomerService(supabase);
  const result = await service.archiveCustomer(customerId, auth.userId);

  if (result.success) {
    revalidatePath("/customers");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "customer.archive",
      entityType: "customer",
      entityId: customerId,
      summary: "Archived customer",
    });
  }
  return result;
}

export async function restoreCustomerAction(
  organizationId: string,
  customerId: string
): Promise<CustomerActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "customer.update");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new CustomerService(supabase);
  const result = await service.restoreCustomer(customerId, auth.userId);

  if (result.success) {
    revalidatePath("/customers");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "customer.restore",
      entityType: "customer",
      entityId: customerId,
      summary: "Restored customer",
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Export (CSV)
// ─────────────────────────────────────────────────────────────

export async function exportCustomersAction(
  organizationId: string
): Promise<CustomerActionResult<string>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "customer.export");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new CustomerService(supabase);
  const csv = await service.exportCustomersCsv(organizationId);

  await new AuditService(supabase).log({
    organizationId,
    actorUserId: auth.userId,
    action: "customer.export",
    entityType: "customer",
    summary: "Exported customers to CSV",
  });

  return { success: true, data: csv };
}

// ─────────────────────────────────────────────────────────────
// Import (CSV)
// ─────────────────────────────────────────────────────────────

export async function importCustomersAction(
  organizationId: string,
  csvText: string
): Promise<CustomerActionResult<CustomerImportResult>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "customer.create");
  if (!auth.ok) {
    return auth.result;
  }

  const { rows } = csvToObjects(csvText);
  const service = new CustomerService(supabase);
  const summary = await service.importCustomers(
    rows,
    organizationId,
    auth.userId
  );

  revalidatePath("/customers");

  await new AuditService(supabase).log({
    organizationId,
    actorUserId: auth.userId,
    action: "customer.import",
    entityType: "customer",
    summary: `Imported ${summary.created} customer(s)`,
    metadata: {
      created: summary.created,
      skipped: summary.skipped,
      errorCount: summary.errors.length,
    },
  });

  return { success: true, data: summary };
}
