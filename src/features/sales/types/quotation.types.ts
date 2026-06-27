/**
 * Quotation domain types.
 *
 * A quotation is a HEADER (commercial/document metadata) plus many LINE ITEMS.
 * Application-level types mirror the DB schema but use camelCase.
 *
 * Dependent modules (Sales Order, Invoice) build on these types.
 */

export type QuotationStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted";

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

export interface Quotation {
  readonly id: string;
  readonly organizationId: string;
  readonly quotationNumber: string;
  readonly customerId: string;
  readonly branchId: string | null;
  readonly salespersonId: string | null;
  readonly referenceNumber: string | null;
  readonly quotationDate: Date;
  readonly expiryDate: Date | null;
  readonly supplyState: string | null;
  readonly isInterstate: boolean;
  readonly status: QuotationStatus;
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
  readonly convertedSoId: string | null;
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

export interface QuotationItem {
  readonly id: string;
  readonly organizationId: string;
  readonly quotationId: string;
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

/** Header + its line items — the canonical "full" quotation shape. */
export interface QuotationWithItems extends Quotation {
  readonly items: readonly QuotationItem[];
}

/** A list row enriched with the joined customer name. */
export interface QuotationListItem extends Quotation {
  readonly customerName: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateQuotationItemInput {
  readonly productId: string;
  readonly description?: string;
  readonly hsnCode?: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountPercent?: number;
  readonly gstRate?: number;
  readonly sortOrder?: number;
}

export interface CreateQuotationInput {
  readonly customerId: string;
  readonly branchId?: string;
  readonly salespersonId?: string;
  readonly referenceNumber?: string;
  readonly quotationDate?: string;
  readonly expiryDate?: string;
  readonly supplyState?: string;
  readonly notes?: string;
  readonly terms?: string;
  readonly items: readonly CreateQuotationItemInput[];
}

/**
 * Update replaces the whole document (header + items). It additionally carries
 * the `version` the client loaded so the write can be optimistically locked —
 * the update is rejected (`conflict`) if the row changed in the meantime.
 */
export interface UpdateQuotationInput extends CreateQuotationInput {
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export type QuotationSortField =
  | "quotation_number"
  | "quotation_date"
  | "created_at"
  | "total_amount";

export interface QuotationListParams {
  readonly search?: string;
  readonly status?: QuotationStatus;
  readonly customerId?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: QuotationSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface QuotationListResult {
  readonly items: readonly QuotationListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type QuotationErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "invalid_status"
  | "conflict"
  | "unknown";

export interface QuotationError {
  readonly code: QuotationErrorCode;
  readonly message: string;
}

export type QuotationActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: QuotationError };
