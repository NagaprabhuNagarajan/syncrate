"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { RoleService } from "@/features/rbac/services/role.service";
import {
  assignPermissionsSchema,
  createRoleSchema,
  updateRoleSchema,
} from "@/features/rbac/schemas/role.schemas";
import type {
  Role,
  RoleActionResult,
  RoleWithPermissions,
} from "@/features/rbac/types/rbac.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): RoleActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): RoleActionResult<never> {
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
  { ok: true; userId: string } | { ok: false; result: RoleActionResult<never> }
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

export async function createRoleAction(
  organizationId: string,
  input: {
    name: string;
    description?: string;
    permissionIds?: readonly string[];
  }
): Promise<RoleActionResult<RoleWithPermissions>> {
  const parsed = createRoleSchema.safeParse({
    name: input.name,
    description: input.description ?? "",
    permissionIds: input.permissionIds ? [...input.permissionIds] : undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "role.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new RoleService(supabase);
  const result = await service.createRole(
    {
      name: parsed.data.name,
      description: parsed.data.description,
      permissionIds: parsed.data.permissionIds,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/settings/roles");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "role.create",
      entityType: "role",
      entityId: result.data.id,
      summary: `Created custom role "${result.data.name}"`,
      metadata: { permissionCount: result.data.permissionIds.length },
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update (name / description)
// ─────────────────────────────────────────────────────────────

export async function updateRoleAction(
  organizationId: string,
  roleId: string,
  input: { name?: string; description?: string; version: number }
): Promise<RoleActionResult<Role>> {
  const parsed = updateRoleSchema.safeParse({
    name: input.name,
    description: input.description ?? "",
    version: input.version,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "role.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new RoleService(supabase);
  const result = await service.updateRole(
    roleId,
    {
      name: parsed.data.name,
      description: parsed.data.description,
      version: parsed.data.version,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/settings/roles");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "role.update",
      entityType: "role",
      entityId: roleId,
      summary: `Updated role "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Delete (soft)
// ─────────────────────────────────────────────────────────────

export async function deleteRoleAction(
  organizationId: string,
  roleId: string
): Promise<RoleActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "role.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new RoleService(supabase);
  const result = await service.deleteRole(roleId, organizationId, auth.userId);

  if (result.success) {
    revalidatePath("/settings/roles");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "role.delete",
      entityType: "role",
      entityId: roleId,
      summary: "Deleted custom role",
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Assign permissions
// ─────────────────────────────────────────────────────────────

export async function assignPermissionsAction(
  organizationId: string,
  roleId: string,
  permissionIds: readonly string[]
): Promise<RoleActionResult<RoleWithPermissions>> {
  const parsed = assignPermissionsSchema.safeParse({
    permissionIds: [...permissionIds],
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "role.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new RoleService(supabase);
  const result = await service.assignPermissions(
    roleId,
    parsed.data.permissionIds,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/settings/roles");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "role.permissions.update",
      entityType: "role",
      entityId: roleId,
      summary: `Updated permissions for role "${result.data.name}"`,
      metadata: { permissionCount: result.data.permissionIds.length },
    });
  }
  return result;
}
