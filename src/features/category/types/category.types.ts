/**
 * Category domain types (product catalog).
 * Categories are nested via a self-referential parent_id.
 * Application-level types mirror the DB schema but use camelCase.
 */

export type CategoryStatus = "active" | "archived";

export interface Category {
  readonly id: string;
  readonly organizationId: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly status: CategoryStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateCategoryInput {
  readonly name: string;
  readonly parentId?: string | null;
  readonly description?: string;
  readonly status?: CategoryStatus;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export interface CategoryListParams {
  readonly search?: string;
  readonly status?: CategoryStatus;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface CategoryListResult {
  readonly items: readonly Category[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type CategoryErrorCode =
  | "not_found"
  | "forbidden"
  | "duplicate_name"
  | "validation"
  | "unknown";

export interface CategoryError {
  readonly code: CategoryErrorCode;
  readonly message: string;
}

export type CategoryActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: CategoryError };
