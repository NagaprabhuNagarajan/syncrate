/**
 * Sales Invoice domain types.
 *
 * A sales invoice is a HEADER (commercial/document metadata) plus many LINE
 * ITEMS. Application-level types mirror the DB schema but use camelCase.
 * Each line item carries a full Indian GST breakdown (CGST/SGST for
 * intra-state, IGST for inter-state). Posting a sales invoice writes the
 * customer ledger.
 */

export type InvoiceStatus = "draft" | "posted" | "cancelled";

export type InvoiceType =
  | "tax_invoice"
  | "retail_invoice"
  | "proforma_invoice"
  | "commercial_invoice"
  | "export_invoice";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overdue";

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

export interface Invoice {
  readonly id: string;
  readonly organizationId: string;
  readonly invoiceNumber: string;
  readonly invoiceType: InvoiceType;
  readonly customerId: string;
  readonly salesOrderId: string | null;
  readonly quotationId: string | null;
  readonly branchId: string | null;
  readonly warehouseId: string | null;
  readonly salespersonId: string | null;
  readonly referenceNumber: string | null;
  readonly invoiceDate: Date;
  readonly dueDate: Date | null;
  readonly paymentTermsDays: number;
  readonly supplyState: string | null;
  readonly isInterstate: boolean;
  readonly status: InvoiceStatus;
  readonly paymentStatus: PaymentStatus;
  // Totals
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly cgstAmount: number;
  readonly sgstAmount: number;
  readonly igstAmount: number;
  readonly taxAmount: number;
  readonly roundOff: number;
  readonly totalAmount: number;
  readonly amountPaid: number;
  // Metadata
  readonly notes: string | null;
  readonly terms: string | null;
  readonly postedAt: Date | null;
  readonly postedBy: string | null;
  // Audit
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  /** Optimistic-lock counter, auto-incremented by the `handle_updated_at` trigger. */
  readonly version?: number;
}

// ─────────────────────────────────────────────────────────────
// Line item (carries per-line GST breakdown)
// ─────────────────────────────────────────────────────────────

export interface InvoiceItem {
  readonly id: string;
  readonly organizationId: string;
  readonly invoiceId: string;
  readonly productId: string;
  readonly description: string | null;
  readonly hsnCode: string | null;
  readonly quantity: number;
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

/** Header + its line items — the canonical "full" sales invoice shape. */
export interface InvoiceWithItems extends Invoice {
  readonly items: readonly InvoiceItem[];
}

/** A list row enriched with the joined customer name. */
export interface InvoiceListItem extends Invoice {
  readonly customerName: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateInvoiceItemInput {
  readonly productId: string;
  readonly description?: string;
  readonly hsnCode?: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountPercent?: number;
  readonly gstRate?: number;
}

export interface CreateInvoiceInput {
  readonly customerId: string;
  readonly salesOrderId?: string;
  readonly quotationId?: string;
  readonly branchId?: string;
  readonly warehouseId?: string;
  readonly invoiceDate?: string;
  readonly dueDate?: string;
  readonly paymentTermsDays?: number;
  readonly supplyState?: string;
  readonly isInterstate?: boolean;
  readonly invoiceType?: InvoiceType;
  readonly referenceNumber?: string;
  readonly notes?: string;
  readonly terms?: string;
  readonly items: readonly CreateInvoiceItemInput[];
}

/** Update replaces the whole document (header + items). */
export interface UpdateInvoiceInput extends CreateInvoiceInput {
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export type InvoiceSortField =
  | "invoice_number"
  | "invoice_date"
  | "created_at"
  | "total_amount";

export interface InvoiceListParams {
  readonly search?: string;
  readonly status?: InvoiceStatus;
  readonly customerId?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: InvoiceSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface InvoiceListResult {
  readonly items: readonly InvoiceListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type InvoiceErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "invalid_status"
  | "conflict"
  | "unknown";

export interface InvoiceError {
  readonly code: InvoiceErrorCode;
  readonly message: string;
}

export type InvoiceActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: InvoiceError };
