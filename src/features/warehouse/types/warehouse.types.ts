/**
 * Warehouse domain types.
 * Application-level types that mirror the DB schema but use camelCase.
 */

export type WarehouseStatus = "active" | "inactive" | "archived";

export interface Warehouse {
  readonly id: string;
  readonly organizationId: string;
  readonly branchId: string | null;
  readonly code: string;
  readonly name: string;
  readonly addressLine1: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly pincode: string | null;
  readonly capacity: number | null;
  readonly isDefault: boolean;
  readonly status: WarehouseStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

/** Lightweight option used by pickers (transfer dialog, etc.). */
export interface WarehouseOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateWarehouseInput {
  readonly code: string;
  readonly name: string;
  readonly branchId?: string;
  readonly addressLine1?: string;
  readonly city?: string;
  readonly state?: string;
  readonly pincode?: string;
  readonly capacity?: number;
  readonly isDefault?: boolean;
}

export type UpdateWarehouseInput = Partial<CreateWarehouseInput> & {
  readonly status?: WarehouseStatus;
};

// ─────────────────────────────────────────────────────────────
// Listing
// ─────────────────────────────────────────────────────────────

export type WarehouseSortField = "name" | "code" | "created_at";

export interface WarehouseListParams {
  readonly search?: string;
  readonly status?: WarehouseStatus;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: WarehouseSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface WarehouseListResult {
  readonly items: readonly Warehouse[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type WarehouseErrorCode =
  | "not_found"
  | "forbidden"
  | "duplicate_code"
  | "validation"
  | "unknown";

export interface WarehouseError {
  readonly code: WarehouseErrorCode;
  readonly message: string;
}

export type WarehouseActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: WarehouseError };
