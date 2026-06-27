/**
 * Serial number domain types (Inventory · Serial Number Tracking).
 * Application-level types that mirror the DB schema but use camelCase.
 */

export type SerialStatus =
  | "in_stock"
  | "reserved"
  | "sold"
  | "returned"
  | "damaged";

export interface SerialNumber {
  readonly id: string;
  readonly organizationId: string;
  readonly productId: string;
  /** Joined from the product for display; null if the product is missing. */
  readonly productName: string | null;
  readonly productCode: string | null;
  readonly warehouseId: string | null;
  readonly batchId: string | null;
  readonly serialNumber: string;
  readonly status: SerialStatus;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateSerialInput {
  readonly productId: string;
  readonly serialNumber: string;
  readonly warehouseId?: string | null;
  readonly batchId?: string | null;
  readonly notes?: string;
}

export interface BulkCreateSerialInput {
  readonly productId: string;
  readonly serialNumbers: readonly string[];
  readonly warehouseId?: string | null;
  readonly batchId?: string | null;
  readonly notes?: string;
}

export interface UpdateSerialInput {
  readonly serialNumber?: string;
  readonly warehouseId?: string | null;
  readonly batchId?: string | null;
  readonly status?: SerialStatus;
  readonly notes?: string;
}

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export interface SerialListParams {
  readonly search?: string;
  readonly status?: SerialStatus;
  readonly productId?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface SerialListResult {
  readonly items: readonly SerialNumber[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type SerialErrorCode =
  | "not_found"
  | "forbidden"
  | "duplicate_serial"
  | "validation"
  | "unknown";

export interface SerialError {
  readonly code: SerialErrorCode;
  readonly message: string;
}

export type SerialActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: SerialError };

// ─────────────────────────────────────────────────────────────
// Bulk registration
// ─────────────────────────────────────────────────────────────

export interface BulkSerialError {
  readonly serial: string;
  readonly message: string;
}

export interface BulkSerialResult {
  readonly created: number;
  readonly skipped: number;
  readonly errors: readonly BulkSerialError[];
}
