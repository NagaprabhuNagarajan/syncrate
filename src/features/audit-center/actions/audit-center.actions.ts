"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditCenterService } from "@/features/audit-center/services/audit-center.service";
import { auditCenterFiltersSchema } from "@/features/audit-center/schemas/audit-center.schemas";
import type {
  AuditCenterActionResult,
  AuditCenterFilters,
  AuditCenterPage,
} from "@/features/audit-center/types/audit-center.types";

const AUDIT_VIEW_PERMISSION = "audit.view";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): AuditCenterActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): AuditCenterActionResult<never> {
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
  | { ok: false; result: AuditCenterActionResult<never> }
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
// Fetch (filtered + paginated)
// ─────────────────────────────────────────────────────────────

export async function fetchAuditCenterAction(
  organizationId: string,
  rawFilters: AuditCenterFilters
): Promise<AuditCenterActionResult<AuditCenterPage>> {
  const parsed = auditCenterFiltersSchema.safeParse(rawFilters);
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid filters");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, AUDIT_VIEW_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new AuditCenterService(supabase);
  const data = await service.list(organizationId, parsed.data);
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────
// Export (CSV)
// ─────────────────────────────────────────────────────────────

export async function exportAuditCenterAction(
  organizationId: string,
  rawFilters: AuditCenterFilters
): Promise<AuditCenterActionResult<string>> {
  const parsed = auditCenterFiltersSchema.safeParse(rawFilters);
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid filters");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, AUDIT_VIEW_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new AuditCenterService(supabase);
  const csv = await service.exportCsv(organizationId, parsed.data);
  return { success: true, data: csv };
}
