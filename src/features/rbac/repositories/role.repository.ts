import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type { Permission, Role } from "@/features/rbac/types/rbac.types";

type DbRole = Database["public"]["Tables"]["roles"]["Row"];
type DbRoleInsert = Database["public"]["Tables"]["roles"]["Insert"];
type DbPermission = Database["public"]["Tables"]["permissions"]["Row"];

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapRole(row: DbRole): Role {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    isSystem: row.is_system,
    version: row.version,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function mapPermission(row: DbPermission): Permission {
  return {
    id: row.id,
    module: row.module,
    action: row.action,
    name: row.name,
    description: row.description,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class RoleRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  /**
   * Lists every role visible to an organization: the built-in system roles
   * (organization_id IS NULL) plus the organization's own custom roles.
   * System roles are returned first, then custom roles alphabetically.
   */
  async listRoles(organizationId: string): Promise<Role[]> {
    const { data, error } = await this.supabase
      .from("roles")
      .select("*")
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .is("deleted_at", null)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapRole);
  }

  async findById(id: string): Promise<Role | null> {
    const { data, error } = await this.supabase
      .from("roles")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapRole(data);
  }

  /** Finds a custom role by name within an organization (for dedupe checks). */
  async findByName(
    organizationId: string,
    name: string
  ): Promise<Role | null> {
    const { data, error } = await this.supabase
      .from("roles")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("name", name.trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapRole(data);
  }

  async create(input: DbRoleInsert): Promise<Role | null> {
    const { data, error } = await this.supabase
      .from("roles")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapRole(data);
  }

  /**
   * Applies a patch guarded by an optimistic lock and the system-role
   * invariant: the update only matches a non-system row whose stored `version`
   * equals `expectedVersion`. A concurrent write bumps the version (via the
   * `handle_updated_at` trigger), so a stale caller matches no row and gets
   * `null` — the service maps this to a conflict.
   */
  async update(
    id: string,
    patch: Partial<DbRole>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<Role | null> {
    const { data, error } = await this.supabase
      .from("roles")
      .update({
        ...patch,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("version", expectedVersion)
      .eq("is_system", false)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapRole(data);
  }

  /** Stamps a role as updated (used when only its permissions changed). */
  async touch(id: string, updatedBy: string): Promise<Role | null> {
    const { data, error } = await this.supabase
      .from("roles")
      .update({
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("is_system", false)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapRole(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("roles")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("is_system", false)
      .is("deleted_at", null);

    return !error;
  }

  // ── Permissions catalog ────────────────────────────────────

  async listPermissions(): Promise<Permission[]> {
    const { data, error } = await this.supabase
      .from("permissions")
      .select("*")
      .is("deleted_at", null)
      .order("module", { ascending: true })
      .order("action", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapPermission);
  }

  /** Maps each role id to the set of permission ids currently assigned to it. */
  async listPermissionIdsByRoles(
    roleIds: readonly string[]
  ): Promise<Record<string, string[]>> {
    if (roleIds.length === 0) {
      return {};
    }
    const { data, error } = await this.supabase
      .from("role_permissions")
      .select("role_id,permission_id")
      .in("role_id", [...roleIds]);

    if (error || !data) {
      return {};
    }

    const map: Record<string, string[]> = {};
    for (const row of data) {
      (map[row.role_id] ??= []).push(row.permission_id);
    }
    return map;
  }

  /**
   * Replaces the full permission set of a role: removes the existing junction
   * rows and inserts the new selection. Junction rows are not soft-deletable
   * business records, so they are replaced outright.
   */
  async replacePermissions(
    roleId: string,
    permissionIds: readonly string[],
    createdBy: string
  ): Promise<boolean> {
    const { error: deleteError } = await this.supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    if (deleteError) {
      return false;
    }

    if (permissionIds.length === 0) {
      return true;
    }

    const rows = permissionIds.map((permissionId) => ({
      role_id: roleId,
      permission_id: permissionId,
      created_by: createdBy,
    }));

    const { error: insertError } = await this.supabase
      .from("role_permissions")
      .insert(rows);

    return !insertError;
  }
}
