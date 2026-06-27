/**
 * Brand domain types (product catalog).
 * Application-level types that mirror the DB schema but use camelCase.
 */

export type BrandStatus = "active" | "archived";

export interface Brand {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: BrandStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateBrandInput {
  readonly name: string;
  readonly description?: string;
  readonly status?: BrandStatus;
}

export type UpdateBrandInput = Partial<CreateBrandInput>;

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export interface BrandListParams {
  readonly search?: string;
  readonly status?: BrandStatus;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface BrandListResult {
  readonly items: readonly Brand[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type BrandErrorCode =
  | "not_found"
  | "forbidden"
  | "duplicate_name"
  | "validation"
  | "unknown";

export interface BrandError {
  readonly code: BrandErrorCode;
  readonly message: string;
}

export type BrandActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: BrandError };
