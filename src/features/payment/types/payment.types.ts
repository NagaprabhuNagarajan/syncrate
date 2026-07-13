/**
 * Payment domain types.
 * Mirrors the DB schema but uses camelCase throughout.
 */

// ─────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────

export type PaymentMethod =
  | "cash"
  | "upi"
  | "bank_transfer"
  | "cheque"
  | "credit_card"
  | "debit_card"
  | "wallet"
  | "other";

export type PaymentStatus = "completed" | "voided";

// ─────────────────────────────────────────────────────────────
// Domain entities
// ─────────────────────────────────────────────────────────────

export interface CustomerPayment {
  readonly id: string;
  readonly organizationId: string;
  readonly paymentNumber: string;
  readonly customerId: string;
  readonly customerName?: string;
  readonly paymentDate: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly referenceNumber: string | null;
  readonly notes: string | null;
  readonly status: PaymentStatus;
  readonly voidedAt: string | null;
  readonly voidedBy: string | null;
  readonly voidReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string | null;
}

export interface SupplierPayment {
  readonly id: string;
  readonly organizationId: string;
  readonly paymentNumber: string;
  readonly supplierId: string;
  readonly supplierName?: string;
  readonly paymentDate: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly referenceNumber: string | null;
  readonly notes: string | null;
  readonly status: PaymentStatus;
  readonly voidedAt: string | null;
  readonly voidedBy: string | null;
  readonly voidReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string | null;
}

export interface CustomerPaymentAllocation {
  readonly id: string;
  readonly organizationId: string;
  readonly customerPaymentId: string;
  readonly invoiceId: string;
  readonly allocatedAmount: number;
  readonly createdAt: string;
  readonly createdBy: string | null;
}

export interface SupplierPaymentAllocation {
  readonly id: string;
  readonly organizationId: string;
  readonly supplierPaymentId: string;
  readonly purchaseInvoiceId: string;
  readonly allocatedAmount: number;
  readonly createdAt: string;
  readonly createdBy: string | null;
}

/** A payment (with its amount allocated to a specific invoice) — for the
 * invoice detail "payments received" panel. */
export interface InvoicePaymentSummary {
  readonly id: string;
  readonly paymentNumber: string;
  readonly paymentDate: string;
  readonly paymentMethod: PaymentMethod;
  readonly allocatedAmount: number;
  readonly status: PaymentStatus;
}

export interface PaymentWithAllocations extends CustomerPayment {
  readonly allocations: readonly CustomerPaymentAllocation[];
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface InvoiceAllocationInput {
  readonly invoiceId: string;
  readonly amount: number;
}

export interface PurchaseInvoiceAllocationInput {
  readonly purchaseInvoiceId: string;
  readonly amount: number;
}

export interface RecordCustomerPaymentInput {
  readonly customerId: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly referenceNumber?: string;
  readonly paymentDate?: string;
  readonly notes?: string;
  readonly allocations: readonly InvoiceAllocationInput[];
}

export interface RecordSupplierPaymentInput {
  readonly supplierId: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly referenceNumber?: string;
  readonly paymentDate?: string;
  readonly notes?: string;
  readonly allocations: readonly PurchaseInvoiceAllocationInput[];
}

// ─────────────────────────────────────────────────────────────
// Outstanding transactions (record-payment picker)
// ─────────────────────────────────────────────────────────────

/**
 * A transaction with a balance still due — an unpaid/partial customer invoice
 * or supplier bill — surfaced by the record-payment dialog so the user can
 * check the ones to settle. `outstandingAmount` (= `totalAmount` − `amountPaid`)
 * is always > 0. For supplier bills, `invoiceNumber`/`invoiceDate` carry the
 * bill's own number and date.
 */
export interface OutstandingTransaction {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly invoiceDate: string;
  readonly totalAmount: number;
  readonly amountPaid: number;
  readonly outstandingAmount: number;
}

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export interface CustomerPaymentListParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly status?: PaymentStatus;
}

export interface CustomerPaymentListResult {
  readonly payments: readonly CustomerPayment[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface SupplierPaymentListParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly status?: PaymentStatus;
}

export interface SupplierPaymentListResult {
  readonly payments: readonly SupplierPayment[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Stats (list header tiles)
// ─────────────────────────────────────────────────────────────

/**
 * Aggregate figures for the payments list header tiles. Reused by both the
 * customer (received) and supplier (paid) tabs. `totalAmount` and `thisMonth`
 * sum only completed payments; voided payments are excluded from the money.
 */
export interface PaymentStats {
  readonly total: number;
  readonly completed: number;
  readonly voided: number;
  readonly totalAmount: number;
  readonly thisMonth: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type PaymentErrorCode =
  | "validation"
  | "not_found"
  | "forbidden"
  | "duplicate"
  | "unknown";

export interface PaymentError {
  readonly code: PaymentErrorCode;
  readonly message: string;
}

export type PaymentActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: PaymentError };
