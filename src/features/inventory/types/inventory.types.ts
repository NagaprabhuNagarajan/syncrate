/**
 * Inventory domain types.
 *
 * Stock is event-driven: every change writes an immutable row to
 * `inventory_transactions` AND updates the `inventory` snapshot. Manual
 * editing of the snapshot quantity is prohibited — only events mutate stock.
 */

export type InventoryTransactionType =
  | "opening"
  | "purchase"
  | "sale"
  | "sales_return"
  | "purchase_return"
  | "transfer_in"
  | "transfer_out"
  | "adjustment"
  | "damage"
  | "expiry"
  | "production"
  | "consumption";

/** Lightweight product option used by the inventory pickers. */
export interface ProductOption {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

/** Raw stock snapshot for a (product, branch) pair. */
export interface StockLevel {
  readonly id: string;
  readonly organizationId: string;
  readonly productId: string;
  readonly branchId: string;
  readonly quantity: number;
  readonly reservedQuantity: number;
}

/** Stock snapshot enriched with product + branch details for listing. */
export interface InventoryLevel extends StockLevel {
  readonly productName: string;
  readonly productCode: string;
  readonly reorderLevel: number;
  readonly purchasePrice: number;
  readonly branchName: string;
  readonly branchCode: string;
}

export interface InventoryTransaction {
  readonly id: string;
  readonly organizationId: string;
  readonly productId: string;
  readonly branchId: string;
  readonly batchId: string | null;
  readonly type: InventoryTransactionType;
  readonly quantity: number;
  readonly runningBalance: number;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly createdBy: string | null;
  readonly productName: string | null;
  readonly productCode: string | null;
  readonly branchName: string | null;
}

// ─────────────────────────────────────────────────────────────
// Event inputs / commands
// ─────────────────────────────────────────────────────────────

export interface AdjustStockInput {
  readonly productId: string;
  readonly branchId: string;
  /** Signed delta — positive increases stock, negative decreases it. */
  readonly quantity: number;
  readonly reason?: string;
}

export interface TransferStockInput {
  readonly productId: string;
  readonly fromBranchId: string;
  readonly toBranchId: string;
  /** Always positive. */
  readonly quantity: number;
  readonly note?: string;
}

export interface OpeningStockInput {
  readonly productId: string;
  readonly branchId: string;
  readonly quantity: number;
  readonly note?: string;
}

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export interface InventoryLevelListParams {
  readonly branchId?: string;
  readonly search?: string;
  readonly lowStockOnly?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface InventoryLevelListResult {
  readonly items: readonly InventoryLevel[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface InventoryTransactionListParams {
  readonly productId?: string;
  readonly branchId?: string;
  readonly limit?: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type InventoryErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "negative_stock"
  | "insufficient_stock"
  | "same_warehouse"
  | "unknown";

export interface InventoryError {
  readonly code: InventoryErrorCode;
  readonly message: string;
}

export type InventoryActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: InventoryError };
