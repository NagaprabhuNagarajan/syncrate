/**
 * Unit (unit of measure) domain types.
 * Application-level types that mirror the DB schema but use camelCase.
 */

export type UnitStatus = "active" | "archived";

export interface Unit {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly symbol: string;
  readonly status: UnitStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateUnitInput {
  readonly name: string;
  readonly symbol: string;
  readonly status?: UnitStatus;
}

export type UpdateUnitInput = Partial<CreateUnitInput>;

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export interface UnitListParams {
  readonly search?: string;
  readonly status?: UnitStatus;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface UnitListResult {
  readonly items: readonly Unit[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type UnitErrorCode =
  | "not_found"
  | "forbidden"
  | "duplicate_name"
  | "validation"
  | "unknown";

export interface UnitError {
  readonly code: UnitErrorCode;
  readonly message: string;
}

export type UnitActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: UnitError };
