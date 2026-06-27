/**
 * Purchase Return domain types.
 *
 * A purchase return is a HEADER (commercial/document metadata) plus many LINE
 * ITEMS. Application-level types mirror the DB schema but use camelCase.
 *
 * Completing a return DECREASES stock (goods leave our warehouse back to the
 * supplier) and REDUCES the payable owed to that supplier (a debit on the
 * supplier ledger).
 */

export type PurchaseReturnStatus = "draft" | "completed" | "cancelled";

export type PurchaseReturnReason =
  | "damaged"
  | "wrong_item"
  | "expired"
  | "quality_issue"
  | "supplier_recall"
  | "other";

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

export interface PurchaseReturn {
  readonly id: string;
  readonly organizationId: string;
  readonly returnNumber: string;
  readonly purchaseOrderId: string | null;
  readonly supplierId: string;
  readonly warehouseId: string | null;
  readonly status: PurchaseReturnStatus;
  readonly returnDate: Date;
  readonly reason: PurchaseReturnReason;
  readonly subtotal: number;
  readonly taxAmount: number;
  readonly totalAmount: number;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  /** Optimistic-lock counter, auto-incremented by the `handle_updated_at` trigger. */
  readonly version?: number;
}

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export interface PurchaseReturnItem {
  readonly id: string;
  readonly organizationId: string;
  readonly purchaseReturnId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly lineTotal: number;
  readonly batchId: string | null;
  readonly createdAt: Date;
  readonly createdBy: string | null;
}

/** Header + its line items — the canonical "full" purchase return shape. */
export interface PurchaseReturnWithItems extends PurchaseReturn {
  readonly items: readonly PurchaseReturnItem[];
}

/** A list row enriched with the joined supplier name. */
export interface PurchaseReturnListItem extends PurchaseReturn {
  readonly supplierName: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreatePurchaseReturnItemInput {
  readonly productId: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly taxRate?: number;
  readonly batchId?: string;
}

export interface CreatePurchaseReturnInput {
  readonly returnNumber?: string;
  readonly purchaseOrderId?: string;
  readonly supplierId: string;
  readonly warehouseId: string;
  readonly returnDate?: string;
  readonly reason: PurchaseReturnReason;
  readonly notes?: string;
  readonly items: readonly CreatePurchaseReturnItemInput[];
}

/** Update replaces the whole document (header + items); same shape as create. */
export type UpdatePurchaseReturnInput = CreatePurchaseReturnInput;

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export type PurchaseReturnSortField =
  | "return_number"
  | "return_date"
  | "created_at"
  | "total_amount";

export interface PurchaseReturnListParams {
  readonly search?: string;
  readonly status?: PurchaseReturnStatus;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: PurchaseReturnSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface PurchaseReturnListResult {
  readonly items: readonly PurchaseReturnListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type PurchaseReturnErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "invalid_status"
  | "insufficient_stock"
  | "conflict"
  | "unknown";

export interface PurchaseReturnError {
  readonly code: PurchaseReturnErrorCode;
  readonly message: string;
}

export type PurchaseReturnActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: PurchaseReturnError };
