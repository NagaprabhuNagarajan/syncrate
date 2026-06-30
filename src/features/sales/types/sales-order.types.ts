/**
 * Sales Order domain types.
 *
 * A sales order is a HEADER (commercial/document metadata) plus many LINE ITEMS.
 * Application-level types mirror the DB schema but use camelCase.
 *
 * Dependent modules (Invoice, Delivery) build on these types.
 */

export type SalesOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "processing"
  | "partially_delivered"
  | "completed"
  | "cancelled";

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

export interface SalesOrder {
  readonly id: string;
  readonly organizationId: string;
  readonly soNumber: string;
  readonly customerId: string;
  readonly quotationId: string | null;
  readonly branchId: string | null;
  readonly salespersonId: string | null;
  readonly referenceNumber: string | null;
  readonly orderDate: Date;
  readonly deliveryDate: Date | null;
  readonly paymentTermsDays: number;
  readonly supplyState: string | null;
  readonly isInterstate: boolean;
  readonly status: SalesOrderStatus;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly cgstAmount: number;
  readonly sgstAmount: number;
  readonly igstAmount: number;
  readonly taxAmount: number;
  readonly roundOff: number;
  readonly totalAmount: number;
  readonly notes: string | null;
  readonly terms: string | null;
  readonly approvedBy: string | null;
  readonly approvedAt: Date | null;
  readonly convertedInvId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  /** Optimistic-lock counter; bumped by the `handle_updated_at` trigger. */
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export interface SalesOrderItem {
  readonly id: string;
  readonly organizationId: string;
  readonly salesOrderId: string;
  readonly productId: string;
  readonly description: string | null;
  readonly hsnCode: string | null;
  readonly quantity: number;
  readonly deliveredQty: number;
  readonly unitPrice: number;
  readonly discountPercent: number;
  readonly discountAmount: number;
  readonly taxableAmount: number;
  readonly gstRate: number;
  readonly cgstRate: number;
  readonly sgstRate: number;
  readonly igstRate: number;
  readonly cgstAmount: number;
  readonly sgstAmount: number;
  readonly igstAmount: number;
  readonly taxAmount: number;
  readonly lineTotal: number;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly createdBy: string | null;
}

/** Header + its line items — the canonical "full" sales order shape. */
export interface SalesOrderWithItems extends SalesOrder {
  readonly items: readonly SalesOrderItem[];
}

/** A list row enriched with the joined customer name. */
export interface SalesOrderListItem extends SalesOrder {
  readonly customerName: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateSalesOrderItemInput {
  readonly productId: string;
  readonly description?: string;
  readonly hsnCode?: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountPercent?: number;
  readonly gstRate?: number;
  readonly sortOrder?: number;
}

export interface CreateSalesOrderInput {
  readonly customerId: string;
  readonly quotationId?: string;
  readonly branchId?: string;
  readonly salespersonId?: string;
  readonly referenceNumber?: string;
  readonly orderDate?: string;
  readonly deliveryDate?: string;
  readonly paymentTermsDays?: number;
  readonly supplyState?: string;
  readonly notes?: string;
  readonly terms?: string;
  readonly items: readonly CreateSalesOrderItemInput[];
}

/**
 * Update replaces the whole document (header + items). It additionally carries
 * the `version` the client loaded so the write can be optimistically locked —
 * the update is rejected (`conflict`) if the row changed in the meantime.
 */
export interface UpdateSalesOrderInput extends CreateSalesOrderInput {
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export type SalesOrderSortField =
  | "so_number"
  | "order_date"
  | "created_at"
  | "total_amount";

export interface SalesOrderListParams {
  readonly search?: string;
  readonly status?: SalesOrderStatus;
  readonly customerId?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: SalesOrderSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface SalesOrderListResult {
  readonly items: readonly SalesOrderListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type SalesOrderErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "invalid_status"
  | "conflict"
  | "unknown";

export interface SalesOrderError {
  readonly code: SalesOrderErrorCode;
  readonly message: string;
}

export type SalesOrderActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: SalesOrderError };
