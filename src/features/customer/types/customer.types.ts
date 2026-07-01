/**
 * Customer domain types (CRM).
 * Application-level types that mirror the DB schema but use camelCase.
 */

export type CustomerStatus =
  | "active"
  | "inactive"
  | "blacklisted"
  | "archived";

export interface Customer {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly company: string | null;
  readonly gstNumber: string | null;
  readonly panNumber: string | null;
  readonly mobile: string | null;
  readonly email: string | null;
  readonly website: string | null;
  // Billing address
  readonly billingAddressLine1: string | null;
  readonly billingAddressLine2: string | null;
  readonly billingCity: string | null;
  readonly billingState: string | null;
  readonly billingPincode: string | null;
  readonly billingCountry: string;
  // Shipping address
  readonly shippingAddressLine1: string | null;
  readonly shippingAddressLine2: string | null;
  readonly shippingCity: string | null;
  readonly shippingState: string | null;
  readonly shippingPincode: string | null;
  readonly shippingCountry: string | null;
  // Commercial terms
  readonly creditLimit: number;
  readonly paymentTermsDays: number;
  readonly preferredPaymentMethod: string | null;
  readonly openingBalance: number;
  // Classification
  readonly status: CustomerStatus;
  readonly tags: readonly string[];
  readonly notes: string | null;
  // Audit
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface CustomerLedgerEntry {
  readonly id: string;
  readonly customerId: string;
  readonly entryDate: Date;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly description: string | null;
  readonly debit: number;
  readonly credit: number;
  readonly runningBalance: number;
  readonly createdAt: Date;
}

export interface CustomerLedger {
  readonly openingBalance: number;
  readonly entries: readonly CustomerLedgerEntry[];
  readonly outstanding: number;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateCustomerInput {
  readonly code?: string;
  readonly name: string;
  readonly company?: string;
  readonly gstNumber?: string;
  readonly panNumber?: string;
  readonly mobile?: string;
  readonly email?: string;
  readonly website?: string;
  readonly billingAddressLine1?: string;
  readonly billingAddressLine2?: string;
  readonly billingCity?: string;
  readonly billingState?: string;
  readonly billingPincode?: string;
  readonly billingCountry?: string;
  readonly shippingAddressLine1?: string;
  readonly shippingAddressLine2?: string;
  readonly shippingCity?: string;
  readonly shippingState?: string;
  readonly shippingPincode?: string;
  readonly shippingCountry?: string;
  readonly creditLimit?: number;
  readonly paymentTermsDays?: number;
  readonly preferredPaymentMethod?: string;
  readonly openingBalance?: number;
  readonly tags?: readonly string[];
  readonly notes?: string;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput> & {
  readonly status?: CustomerStatus;
};

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export type CustomerSortField = "name" | "code" | "created_at";

export interface CustomerListParams {
  readonly search?: string;
  readonly status?: CustomerStatus;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: CustomerSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface CustomerListResult {
  readonly items: readonly Customer[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Aggregate counts for the customers list header tiles. */
export interface CustomerStats {
  readonly total: number;
  readonly active: number;
  readonly blacklisted: number;
  readonly newThisMonth: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type CustomerErrorCode =
  | "not_found"
  | "forbidden"
  | "duplicate_code"
  | "duplicate_gst"
  | "validation"
  | "unknown";

export interface CustomerError {
  readonly code: CustomerErrorCode;
  readonly message: string;
}

export type CustomerActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: CustomerError };

// ─────────────────────────────────────────────────────────────
// CSV import
// ─────────────────────────────────────────────────────────────

export interface CustomerImportError {
  readonly row: number;
  readonly message: string;
}

export interface CustomerImportResult {
  readonly created: number;
  readonly skipped: number;
  readonly errors: readonly CustomerImportError[];
}
