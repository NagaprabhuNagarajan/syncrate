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
