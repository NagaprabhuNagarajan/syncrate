"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SerialService } from "@/features/serial/services/serial.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createSerialSchema,
  updateSerialSchema,
  bulkSerialSchema,
  splitSerials,
} from "@/features/serial/schemas/serial.schemas";
import type {
  SerialNumber,
  SerialActionResult,
  BulkSerialResult,
} from "@/features/serial/types/serial.types";

const LIST_PATH = "/inventory/serials";

// Permissions: manage uses inventory.adjust, read uses inventory.view.
const MANAGE_PERMISSION = "inventory.adjust";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): SerialActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): SerialActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

function str(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : undefined;
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
  | { ok: false; result: SerialActionResult<never> }
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
// Create (single)
// ─────────────────────────────────────────────────────────────

export async function createSerialAction(
  organizationId: string,
  formData: FormData
): Promise<SerialActionResult<SerialNumber>> {
  const parsed = createSerialSchema.safeParse({
    productId: str(formData.get("productId")),
    serialNumber: str(formData.get("serialNumber")),
    warehouseId: str(formData.get("warehouseId")),
    batchId: str(formData.get("batchId")),
    notes: str(formData.get("notes")),
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, MANAGE_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SerialService(supabase);
  const result = await service.createSerial(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(LIST_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "serial.create",
      entityType: "serial",
      entityId: result.data.id,
      summary: `Registered serial "${result.data.serialNumber}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Bulk create
// ─────────────────────────────────────────────────────────────

export async function bulkCreateSerialsAction(
  organizationId: string,
  formData: FormData
): Promise<SerialActionResult<BulkSerialResult>> {
  const rawSerials = formData.get("serialNumbers");
  const serials = typeof rawSerials === "string" ? splitSerials(rawSerials) : [];

  const parsed = bulkSerialSchema.safeParse({
    productId: str(formData.get("productId")),
    serials,
    warehouseId: str(formData.get("warehouseId")),
    batchId: str(formData.get("batchId")),
    notes: str(formData.get("notes")),
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, MANAGE_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SerialService(supabase);
  const summary = await service.bulkCreateSerials(
    parsed.data.serials,
    parsed.data.productId,
    organizationId,
    auth.userId,
    {
      warehouseId: parsed.data.warehouseId ?? null,
      batchId: parsed.data.batchId ?? null,
      notes: parsed.data.notes,
    }
  );

  revalidatePath(LIST_PATH);
  await new AuditService(supabase).log({
    organizationId,
    actorUserId: auth.userId,
    action: "serial.create",
    entityType: "serial",
    summary: `Registered ${summary.created} serial(s)`,
    metadata: {
      created: summary.created,
      skipped: summary.skipped,
      errorCount: summary.errors.length,
    },
  });

  return { success: true, data: summary };
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateSerialAction(
  organizationId: string,
  serialId: string,
  formData: FormData
): Promise<SerialActionResult<SerialNumber>> {
  const parsed = updateSerialSchema.safeParse({
    serialNumber: str(formData.get("serialNumber")),
    warehouseId: formData.has("warehouseId")
      ? (formData.get("warehouseId") ?? "")
      : undefined,
    batchId: formData.has("batchId")
      ? (formData.get("batchId") ?? "")
      : undefined,
    status: str(formData.get("status")),
    notes: formData.has("notes") ? (formData.get("notes") ?? "") : undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, MANAGE_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SerialService(supabase);
  const result = await service.updateSerial(
    serialId,
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(LIST_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "serial.update",
      entityType: "serial",
      entityId: serialId,
      summary: `Updated serial "${result.data.serialNumber}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Archive
// ─────────────────────────────────────────────────────────────

export async function archiveSerialAction(
  organizationId: string,
  serialId: string
): Promise<SerialActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, MANAGE_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SerialService(supabase);
  const result = await service.archiveSerial(serialId, auth.userId);

  if (result.success) {
    revalidatePath(LIST_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "serial.archive",
      entityType: "serial",
      entityId: serialId,
      summary: "Archived serial",
    });
  }
  return result;
}
