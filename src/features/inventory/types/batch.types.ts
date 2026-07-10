/**
 * Batch domain types — track products by manufacturing batch (Module 11).
 */

export type BatchStatus = "active" | "expired" | "depleted";

export interface Batch {
  readonly id: string;
  readonly organizationId: string;
  readonly productId: string;
  readonly batchNumber: string;
  readonly manufacturingDate: string | null;
  readonly expiryDate: string | null;
  readonly supplierBatch: string | null;
  readonly receivedQuantity: number;
  readonly remainingQuantity: number;
  readonly status: BatchStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface CreateBatchInput {
  readonly productId: string;
  readonly batchNumber: string;
  readonly manufacturingDate?: string;
  readonly expiryDate?: string;
  readonly supplierBatch?: string;
  readonly receivedQuantity: number;
  readonly remainingQuantity?: number;
}

export interface BatchListParams {
  readonly productId?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface BatchListResult {
  readonly items: readonly Batch[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export type BatchErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "duplicate_number"
  | "unknown";

export interface BatchError {
  readonly code: BatchErrorCode;
  readonly message: string;
}

export type BatchActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: BatchError };

/** Aggregate counts for the batches list header tiles. */
export interface BatchStats {
  readonly total: number;
  readonly active: number;
  readonly expired: number;
  readonly depleted: number;
}
