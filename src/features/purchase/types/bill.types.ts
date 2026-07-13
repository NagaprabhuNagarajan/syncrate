/**
 * Bill domain types.
 *
 * A bill is a supplier bill: a HEADER (commercial/document
 * metadata) plus many LINE ITEMS. Application-level types mirror the DB schema
 * but use camelCase. Posting a bill writes the supplier ledger.
 */

export type BillStatus = "draft" | "posted" | "cancelled";

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

export interface Bill {
  readonly id: string;
  readonly organizationId: string;
  readonly invoiceNumber: string;
  readonly supplierInvoiceNumber: string | null;
  readonly purchaseOrderId: string | null;
  readonly supplierId: string;
  readonly status: BillStatus;
  readonly invoiceDate: Date;
  readonly dueDate: Date | null;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxAmount: number;
  readonly totalAmount: number;
  readonly amountPaid: number;
  readonly notes: string | null;
  readonly postedAt: Date | null;
  readonly postedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  /** Optimistic-lock counter, auto-incremented by the `handle_updated_at` trigger. */
  readonly version?: number;
}

// ─────────────────────────────────────────────────────────────
// Line item (bill items carry NO per-line discount)
// ─────────────────────────────────────────────────────────────

export interface BillItem {
  readonly id: string;
  readonly organizationId: string;
  readonly billId: string;
  readonly productId: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly lineTotal: number;
  readonly createdAt: Date;
  readonly createdBy: string | null;
}

/** Header + its line items — the canonical "full" bill shape. */
export interface BillWithItems extends Bill {
  readonly items: readonly BillItem[];
}

/** A list row enriched with the joined supplier name. */
export interface BillListItem extends Bill {
  readonly supplierName: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateBillItemInput {
  readonly productId: string;
  readonly description?: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly taxRate?: number;
}

export interface CreateBillInput {
  readonly supplierId: string;
  readonly invoiceNumber?: string;
  readonly supplierInvoiceNumber?: string;
  readonly purchaseOrderId?: string;
  readonly invoiceDate?: string;
  readonly dueDate?: string;
  readonly notes?: string;
  readonly items: readonly CreateBillItemInput[];
}

/** Update replaces the whole document (header + items); same shape as create. */
export type UpdateBillInput = CreateBillInput;

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export type BillSortField =
  | "invoice_number"
  | "invoice_date"
  | "created_at"
  | "total_amount";

/**
 * Payment-status filter values for the bill list. Kept as an inline union here
 * (rather than importing `BillPaymentStatus` from `utils/bill-display`) to avoid
 * a circular import, since `bill-display` imports `BillStatus` from this module.
 * Must stay in sync with `BillPaymentStatus` in `utils/bill-display`.
 */
export type BillPaymentStatusFilter =
  | "unpaid"
  | "partial"
  | "paid"
  | "overdue";

export interface BillListParams {
  readonly search?: string;
  readonly status?: BillStatus;
  readonly paymentStatus?: BillPaymentStatusFilter;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: BillSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface BillListResult {
  readonly items: readonly BillListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Aggregate counts/sums for the list header stat tiles. */
export interface BillStats {
  /** Sum of total_amount across non-cancelled bills. */
  readonly totalBilled: number;
  /** Sum of (total_amount − amount_paid), i.e. balance due, non-cancelled. */
  readonly outstanding: number;
  /** Sum of balance due for posted bills past their due date. */
  readonly overdue: number;
  /** Sum of amount_paid across non-cancelled bills. */
  readonly paid: number;
  readonly draft: number;
  readonly posted: number;
}

/**
 * A lightweight summary of a bill that still has a balance due, used to build
 * the "settle outstanding" checkbox list in the make-payment dialog.
 * `outstandingAmount` = `totalAmount` − `amountPaid` and is always > 0.
 * `invoiceNumber` is the bill's own number; `invoiceDate` is the bill date.
 */
export interface OutstandingBillSummary {
  readonly id: string;
  readonly invoiceNumber: string;
  /** ISO date string (YYYY-MM-DD). */
  readonly invoiceDate: string;
  readonly totalAmount: number;
  readonly amountPaid: number;
  readonly outstandingAmount: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type BillErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "invalid_status"
  | "conflict"
  | "unknown";

export interface BillError {
  readonly code: BillErrorCode;
  readonly message: string;
}

export type BillActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: BillError };
