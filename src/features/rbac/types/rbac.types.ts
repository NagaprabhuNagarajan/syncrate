/**
 * RBAC domain types (custom role management).
 * Application-level types that mirror the DB schema but use camelCase.
 */

export interface Role {
  readonly id: string;
  /** NULL for built-in system roles; set for organization-scoped custom roles. */
  readonly organizationId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface RoleWithPermissions extends Role {
  readonly permissionIds: readonly string[];
}

export interface Permission {
  readonly id: string;
  readonly module: string;
  readonly action: string;
  readonly name: string;
  readonly description: string | null;
}

/** Permissions grouped by their owning module, for the assignment UI. */
export interface PermissionGroup {
  readonly module: string;
  readonly permissions: readonly Permission[];
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateRoleInput {
  readonly name: string;
  readonly description?: string;
  readonly permissionIds?: readonly string[];
}

export interface UpdateRoleInput {
  readonly name?: string;
  readonly description?: string;
  /** Expected version for optimistic locking. */
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type RoleErrorCode =
  | "not_found"
  | "forbidden"
  | "system_role"
  | "duplicate_name"
  | "validation"
  | "conflict"
  | "unknown";

export interface RoleError {
  readonly code: RoleErrorCode;
  readonly message: string;
}

export type RoleActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: RoleError };
