/**
 * Goods Receipt Note (GRN) domain types.
 *
 * A goods receipt records the physical delivery of goods against a purchase
 * order. It is a HEADER (which PO, which branch, when) plus many LINE ITEMS
 * (how much of each product was received vs rejected). Completing a GRN drives
 * three side effects: an inventory `purchase` event per received line, a bump of
 * the matching `purchase_order_items.received_quantity`, and an advance of the
 * parent purchase order's status.
 *
 * Application-level types mirror the DB schema but use camelCase.
 */

export type GoodsReceiptStatus = "draft" | "completed";

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

export interface GoodsReceipt {
  readonly id: string;
  readonly organizationId: string;
  readonly grnNumber: string;
  readonly purchaseOrderId: string;
  readonly branchId: string;
  readonly receivedDate: Date;
  readonly status: GoodsReceiptStatus;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export interface GoodsReceiptItem {
  readonly id: string;
  readonly organizationId: string;
  readonly goodsReceiptId: string;
  readonly purchaseOrderItemId: string | null;
  readonly productId: string;
  readonly orderedQuantity: number;
  readonly receivedQuantity: number;
  readonly rejectedQuantity: number;
  readonly batchId: string | null;
  readonly createdAt: Date;
  readonly createdBy: string | null;
}

/** Header + its line items — the canonical "full" goods receipt shape. */
export interface GoodsReceiptWithItems extends GoodsReceipt {
  readonly items: readonly GoodsReceiptItem[];
}

/** A list row enriched with the joined PO number, supplier name and item total. */
export interface GoodsReceiptListItem extends GoodsReceipt {
  readonly poNumber: string | null;
  readonly supplierName: string | null;
  /** Sum of received quantity across this receipt's line items. */
  readonly totalReceivedQuantity: number;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateGoodsReceiptItemInput {
  readonly purchaseOrderItemId: string;
  readonly productId: string;
  readonly receivedQuantity: number;
  readonly rejectedQuantity?: number;
  readonly batchId?: string;
}

export interface CreateGoodsReceiptInput {
  readonly purchaseOrderId: string;
  readonly branchId: string;
  readonly receivedDate?: string;
  readonly notes?: string;
  readonly items: readonly CreateGoodsReceiptItemInput[];
}

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export interface GoodsReceiptListParams {
  readonly search?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface GoodsReceiptListResult {
  readonly items: readonly GoodsReceiptListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────

/** Aggregate counts for the goods-receipts list header tiles. */
export interface GoodsReceiptStats {
  /** All goods receipts, including drafts. */
  readonly total: number;
  /** Goods receipts recorded in the current calendar month. */
  readonly thisMonth: number;
  readonly completed: number;
  readonly draft: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type GoodsReceiptErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "invalid_status"
  | "insufficient_stock"
  | "unknown";

export interface GoodsReceiptError {
  readonly code: GoodsReceiptErrorCode;
  readonly message: string;
}

export type GoodsReceiptActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: GoodsReceiptError };
