/**
 * Supplier domain types (Procurement).
 * Application-level types that mirror the DB schema but use camelCase.
 */

export type SupplierStatus = "active" | "inactive" | "archived";

export interface Supplier {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly contactPerson: string | null;
  readonly gstNumber: string | null;
  readonly panNumber: string | null;
  readonly mobile: string | null;
  readonly email: string | null;
  readonly website: string | null;
  // Address
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly pincode: string | null;
  readonly country: string;
  // Bank details
  readonly bankAccountName: string | null;
  readonly bankAccountNumber: string | null;
  readonly bankIfsc: string | null;
  readonly bankName: string | null;
  readonly upiId: string | null;
  // Commercial terms
  readonly paymentTermsDays: number;
  readonly openingBalance: number;
  // Classification
  readonly rating: number | null;
  readonly status: SupplierStatus;
  readonly tags: readonly string[];
  readonly notes: string | null;
  /** Accepted CBN connection for this supplier's org, when they're on the network. */
  readonly cbnConnectionId: string | null;
  // Audit
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface SupplierLedgerEntry {
  readonly id: string;
  readonly supplierId: string;
  readonly entryDate: Date;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly description: string | null;
  readonly debit: number;
  readonly credit: number;
  readonly runningBalance: number;
  readonly createdAt: Date;
}

export interface SupplierLedger {
  readonly openingBalance: number;
  readonly entries: readonly SupplierLedgerEntry[];
  readonly outstanding: number;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateSupplierInput {
  readonly code?: string;
  readonly name: string;
  readonly contactPerson?: string;
  readonly gstNumber?: string;
  readonly panNumber?: string;
  readonly mobile?: string;
  readonly email?: string;
  readonly website?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly pincode?: string;
  readonly country?: string;
  readonly bankAccountName?: string;
  readonly bankAccountNumber?: string;
  readonly bankIfsc?: string;
  readonly bankName?: string;
  readonly upiId?: string;
  readonly paymentTermsDays?: number;
  readonly openingBalance?: number;
  readonly rating?: number;
  readonly tags?: readonly string[];
  readonly notes?: string;
}

export type UpdateSupplierInput = Partial<CreateSupplierInput> & {
  readonly status?: SupplierStatus;
};

// ─────────────────────────────────────────────────────────────
// CSV import
// ─────────────────────────────────────────────────────────────

export interface SupplierImportRowError {
  readonly row: number;
  readonly message: string;
}

export interface SupplierImportResult {
  readonly created: number;
  readonly skipped: number;
  readonly errors: ReadonlyArray<SupplierImportRowError>;
}

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export type SupplierSortField = "name" | "code" | "created_at";

export interface SupplierListParams {
  readonly search?: string;
  readonly status?: SupplierStatus;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: SupplierSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface SupplierListResult {
  readonly items: readonly Supplier[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Aggregate counts for the suppliers list header tiles. */
export interface SupplierStats {
  readonly total: number;
  readonly active: number;
  readonly newThisMonth: number;
  readonly inactive: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type SupplierErrorCode =
  | "not_found"
  | "forbidden"
  | "duplicate_code"
  | "duplicate_gst"
  | "validation"
  | "unknown";

export interface SupplierError {
  readonly code: SupplierErrorCode;
  readonly message: string;
}

export type SupplierActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: SupplierError };
