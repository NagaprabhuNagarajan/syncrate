/**
 * Purchase Invoice domain types.
 *
 * A purchase invoice is a supplier bill: a HEADER (commercial/document
 * metadata) plus many LINE ITEMS. Application-level types mirror the DB schema
 * but use camelCase. Posting a purchase invoice writes the supplier ledger.
 */

export type PurchaseInvoiceStatus = "draft" | "posted" | "cancelled";

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

export interface PurchaseInvoice {
  readonly id: string;
  readonly organizationId: string;
  readonly invoiceNumber: string;
  readonly supplierInvoiceNumber: string | null;
  readonly purchaseOrderId: string | null;
  readonly supplierId: string;
  readonly status: PurchaseInvoiceStatus;
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
}

// ─────────────────────────────────────────────────────────────
// Line item (purchase invoice items carry NO per-line discount)
// ─────────────────────────────────────────────────────────────

export interface PurchaseInvoiceItem {
  readonly id: string;
  readonly organizationId: string;
  readonly purchaseInvoiceId: string;
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

/** Header + its line items — the canonical "full" purchase invoice shape. */
export interface PurchaseInvoiceWithItems extends PurchaseInvoice {
  readonly items: readonly PurchaseInvoiceItem[];
}

/** A list row enriched with the joined supplier name. */
export interface PurchaseInvoiceListItem extends PurchaseInvoice {
  readonly supplierName: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreatePurchaseInvoiceItemInput {
  readonly productId: string;
  readonly description?: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly taxRate?: number;
}

export interface CreatePurchaseInvoiceInput {
  readonly supplierId: string;
  readonly invoiceNumber?: string;
  readonly supplierInvoiceNumber?: string;
  readonly purchaseOrderId?: string;
  readonly invoiceDate?: string;
  readonly dueDate?: string;
  readonly notes?: string;
  readonly items: readonly CreatePurchaseInvoiceItemInput[];
}

/** Update replaces the whole document (header + items); same shape as create. */
export type UpdatePurchaseInvoiceInput = CreatePurchaseInvoiceInput;

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export type PurchaseInvoiceSortField =
  | "invoice_number"
  | "invoice_date"
  | "created_at"
  | "total_amount";

export interface PurchaseInvoiceListParams {
  readonly search?: string;
  readonly status?: PurchaseInvoiceStatus;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: PurchaseInvoiceSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface PurchaseInvoiceListResult {
  readonly items: readonly PurchaseInvoiceListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type PurchaseInvoiceErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "invalid_status"
  | "unknown";

export interface PurchaseInvoiceError {
  readonly code: PurchaseInvoiceErrorCode;
  readonly message: string;
}

export type PurchaseInvoiceActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: PurchaseInvoiceError };
