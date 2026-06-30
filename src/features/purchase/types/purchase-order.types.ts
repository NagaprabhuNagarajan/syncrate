/**
 * Purchase Order domain types.
 *
 * A purchase order is a HEADER (commercial/document metadata) plus many LINE
 * ITEMS. Application-level types mirror the DB schema but use camelCase.
 *
 * Dependent modules (GRN, purchase invoice, purchase return) build on these
 * types — import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderWithItems }
 * from "@/features/purchase/types/purchase-order.types".
 */

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "ordered"
  | "partially_received"
  | "completed"
  | "cancelled";

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

export interface PurchaseOrder {
  readonly id: string;
  readonly organizationId: string;
  readonly poNumber: string;
  readonly supplierId: string;
  readonly branchId: string | null;
  readonly status: PurchaseOrderStatus;
  readonly orderDate: Date;
  readonly expectedDeliveryDate: Date | null;
  readonly currency: string;
  readonly notes: string | null;
  readonly terms: string | null;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxAmount: number;
  readonly totalAmount: number;
  readonly approvedBy: string | null;
  readonly approvedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  /** Optimistic-lock counter; bumped by the `handle_updated_at` trigger. */
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export interface PurchaseOrderItem {
  readonly id: string;
  readonly organizationId: string;
  readonly purchaseOrderId: string;
  readonly productId: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly receivedQuantity: number;
  readonly unitPrice: number;
  readonly discountPercent: number;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly lineTotal: number;
  readonly createdAt: Date;
  readonly createdBy: string | null;
}

/** Header + its line items — the canonical "full" purchase order shape. */
export interface PurchaseOrderWithItems extends PurchaseOrder {
  readonly items: readonly PurchaseOrderItem[];
}

/** A list row enriched with the joined supplier name. */
export interface PurchaseOrderListItem extends PurchaseOrder {
  readonly supplierName: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreatePurchaseOrderItemInput {
  readonly productId: string;
  readonly description?: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountPercent?: number;
  readonly taxRate?: number;
}

export interface CreatePurchaseOrderInput {
  readonly supplierId: string;
  readonly branchId?: string;
  readonly orderDate?: string;
  readonly expectedDeliveryDate?: string;
  readonly currency?: string;
  readonly notes?: string;
  readonly terms?: string;
  readonly items: readonly CreatePurchaseOrderItemInput[];
}

/**
 * Update replaces the whole document (header + items). It additionally carries
 * the `version` the client loaded so the write can be optimistically locked —
 * the update is rejected (`conflict`) if the row changed in the meantime.
 */
export interface UpdatePurchaseOrderInput extends CreatePurchaseOrderInput {
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export type PurchaseOrderSortField =
  | "po_number"
  | "order_date"
  | "created_at"
  | "total_amount";

export interface PurchaseOrderListParams {
  readonly search?: string;
  readonly status?: PurchaseOrderStatus;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: PurchaseOrderSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface PurchaseOrderListResult {
  readonly items: readonly PurchaseOrderListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type PurchaseOrderErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "invalid_status"
  | "conflict"
  | "unknown";

export interface PurchaseOrderError {
  readonly code: PurchaseOrderErrorCode;
  readonly message: string;
}

export type PurchaseOrderActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: PurchaseOrderError };
