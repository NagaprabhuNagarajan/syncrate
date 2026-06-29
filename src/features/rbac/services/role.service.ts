import type { AppSupabaseClient } from "@/lib/supabase/types";
import { RoleRepository } from "@/features/rbac/repositories/role.repository";
import type {
  CreateRoleInput,
  Permission,
  Role,
  RoleActionResult,
  RoleError,
  RoleErrorCode,
  RoleWithPermissions,
  UpdateRoleInput,
} from "@/features/rbac/types/rbac.types";

function ok<T>(data: T): RoleActionResult<T> {
  return { success: true, data };
}

function fail(code: RoleErrorCode, message: string): RoleActionResult<never> {
  const error: RoleError = { code, message };
  return { success: false, error };
}

/** Normalizes an optional string: trims and converts "" → null. */
function nz(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export class RoleService {
  private readonly repo: RoleRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new RoleRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  /** System + custom roles for an org, each with its assigned permission ids. */
  async listRolesWithPermissions(
    organizationId: string
  ): Promise<RoleWithPermissions[]> {
    const roles = await this.repo.listRoles(organizationId);
    const permissionMap = await this.repo.listPermissionIdsByRoles(
      roles.map((role) => role.id)
    );
    return roles.map((role) => ({
      ...role,
      permissionIds: permissionMap[role.id] ?? [],
    }));
  }

  async listPermissions(): Promise<Permission[]> {
    return this.repo.listPermissions();
  }

  async getRole(id: string): Promise<RoleActionResult<Role>> {
    const role = await this.repo.findById(id);
    if (!role) {
      return fail("not_found", "Role not found");
    }
    return ok(role);
  }

  // ── Create ─────────────────────────────────────────────────

  async createRole(
    input: CreateRoleInput,
    organizationId: string,
    userId: string
  ): Promise<RoleActionResult<RoleWithPermissions>> {
    const name = input.name.trim();

    const existing = await this.repo.findByName(organizationId, name);
    if (existing) {
      return fail(
        "duplicate_name",
        `A role named "${name}" already exists`
      );
    }

    const role = await this.repo.create({
      organization_id: organizationId,
      name,
      description: nz(input.description),
      is_system: false,
      created_by: userId,
    });

    if (!role) {
      return fail("unknown", "Failed to create role. Please try again.");
    }

    const permissionIds = input.permissionIds ?? [];
    if (permissionIds.length > 0) {
      const assigned = await this.repo.replacePermissions(
        role.id,
        permissionIds,
        userId
      );
      if (!assigned) {
        return fail(
          "unknown",
          "Role created but assigning permissions failed. Please try again."
        );
      }
    }

    return ok({ ...role, permissionIds });
  }

  // ── Update (name / description) ─────────────────────────────

  async updateRole(
    roleId: string,
    input: UpdateRoleInput,
    organizationId: string,
    userId: string
  ): Promise<RoleActionResult<Role>> {
    const guard = await this.assertManageable(roleId, organizationId);
    if (!guard.ok) {
      return guard.result;
    }

    if (input.name !== undefined) {
      const name = input.name.trim();
      const clash = await this.repo.findByName(organizationId, name);
      if (clash && clash.id !== roleId) {
        return fail(
          "duplicate_name",
          `A role named "${name}" already exists`
        );
      }
    }

    const patch: Partial<{ name: string; description: string | null }> = {};
    if (input.name !== undefined) {
      patch.name = input.name.trim();
    }
    if (input.description !== undefined) {
      patch.description = nz(input.description);
    }

    const updated = await this.repo.update(
      roleId,
      patch,
      userId,
      input.version
    );

    if (!updated) {
      return fail(
        "conflict",
        "This role was changed by someone else. Reload and try again."
      );
    }

    return ok(updated);
  }

  // ── Delete (soft) ──────────────────────────────────────────

  async deleteRole(
    roleId: string,
    organizationId: string,
    userId: string
  ): Promise<RoleActionResult<void>> {
    const guard = await this.assertManageable(roleId, organizationId);
    if (!guard.ok) {
      return guard.result;
    }

    const deleted = await this.repo.softDelete(roleId, userId);
    if (!deleted) {
      return fail("unknown", "Failed to delete role. Please try again.");
    }
    return ok(undefined);
  }

  // ── Permission assignment ──────────────────────────────────

  async assignPermissions(
    roleId: string,
    permissionIds: readonly string[],
    organizationId: string,
    userId: string
  ): Promise<RoleActionResult<RoleWithPermissions>> {
    const guard = await this.assertManageable(roleId, organizationId);
    if (!guard.ok) {
      return guard.result;
    }

    const assigned = await this.repo.replacePermissions(
      roleId,
      permissionIds,
      userId
    );
    if (!assigned) {
      return fail(
        "unknown",
        "Failed to update permissions. Please try again."
      );
    }

    const touched = await this.repo.touch(roleId, userId);
    const role = touched ?? guard.role;
    return ok({ ...role, permissionIds: [...permissionIds] });
  }

  // ── Guards ─────────────────────────────────────────────────

  /**
   * Defense-in-depth check (on top of RLS): a role can only be managed when it
   * exists, is NOT a system role, and belongs to the active organization.
   */
  private async assertManageable(
    roleId: string,
    organizationId: string
  ): Promise<
    | { ok: true; role: Role }
    | { ok: false; result: RoleActionResult<never> }
  > {
    const role = await this.repo.findById(roleId);
    if (!role) {
      return { ok: false, result: fail("not_found", "Role not found") };
    }
    if (role.isSystem) {
      return {
        ok: false,
        result: fail("system_role", "System roles cannot be modified"),
      };
    }
    if (role.organizationId !== organizationId) {
      return {
        ok: false,
        result: fail(
          "forbidden",
          "This role belongs to another organization"
        ),
      };
    }
    return { ok: true, role };
  }
}
