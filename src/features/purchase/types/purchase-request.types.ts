/**
 * Purchase Request (requisition) domain types.
 *
 * A purchase request is an internal requisition: a HEADER plus many simple
 * LINE ITEMS (product, quantity, estimated price — no tax math). It is
 * supplier-agnostic; a supplier is only chosen when the request is converted
 * into a Purchase Order.
 *
 * Workflow: draft → submitted → approved / rejected → converted / cancelled.
 */

export type PurchaseRequestStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "converted"
  | "cancelled";

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

export interface PurchaseRequest {
  readonly id: string;
  readonly organizationId: string;
  readonly requestNumber: string;
  readonly status: PurchaseRequestStatus;
  readonly warehouseId: string | null;
  readonly requiredDate: Date | null;
  readonly notes: string | null;
  readonly approvedBy: string | null;
  readonly approvedAt: Date | null;
  readonly rejectedReason: string | null;
  readonly convertedPoId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export interface PurchaseRequestItem {
  readonly id: string;
  readonly organizationId: string;
  readonly purchaseRequestId: string;
  readonly productId: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly estimatedPrice: number;
  readonly createdAt: Date;
  readonly createdBy: string | null;
}

/** Header + its line items — the canonical "full" purchase request shape. */
export interface PurchaseRequestWithItems extends PurchaseRequest {
  readonly items: readonly PurchaseRequestItem[];
}

/** A list row enriched with the joined warehouse name. */
export interface PurchaseRequestListItem extends PurchaseRequest {
  readonly warehouseName: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreatePurchaseRequestItemInput {
  readonly productId: string;
  readonly description?: string;
  readonly quantity: number;
  readonly estimatedPrice?: number;
}

export interface CreatePurchaseRequestInput {
  readonly requestNumber?: string;
  readonly warehouseId?: string;
  readonly requiredDate?: string;
  readonly notes?: string;
  readonly items: readonly CreatePurchaseRequestItemInput[];
}

/** Update replaces the whole document (header + items); same shape as create. */
export type UpdatePurchaseRequestInput = CreatePurchaseRequestInput;

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export type PurchaseRequestSortField =
  | "request_number"
  | "required_date"
  | "created_at";

export interface PurchaseRequestListParams {
  readonly search?: string;
  readonly status?: PurchaseRequestStatus;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: PurchaseRequestSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface PurchaseRequestListResult {
  readonly items: readonly PurchaseRequestListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type PurchaseRequestErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "invalid_status"
  | "conflict"
  | "unknown";

export interface PurchaseRequestError {
  readonly code: PurchaseRequestErrorCode;
  readonly message: string;
}

export type PurchaseRequestActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: PurchaseRequestError };
