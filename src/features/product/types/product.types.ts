/**
 * Product domain types — the central catalog (docs/PRD/4.md Module 6).
 */

export type ProductType = "inventory" | "service";
export type ProductStatus = "draft" | "active" | "discontinued" | "archived";

export type GstRate = 0 | 5 | 12 | 18 | 28;

export interface Product {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: ProductType;
  readonly status: ProductStatus;
  // Classification
  readonly categoryId: string | null;
  readonly brandId: string | null;
  readonly unitId: string | null;
  readonly manufacturer: string | null;
  // Taxation
  readonly hsnCode: string | null;
  /** Primary/default GST slab — the first of `gstRates`; used to prefill transactions. */
  readonly gstRate: number;
  /** All applicable GST slabs for this product. */
  readonly gstRates: readonly number[];
  readonly taxInclusive: boolean;
  // Pricing
  readonly purchasePrice: number;
  readonly sellingPrice: number;
  readonly dealerPrice: number;
  readonly wholesalePrice: number;
  readonly retailPrice: number;
  readonly minSellingPrice: number;
  // Inventory attributes
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly qrCode: string | null;
  readonly trackInventory: boolean;
  readonly reorderLevel: number;
  readonly maxStock: number;
  readonly openingStock: number;
  readonly preferredSupplierId: string | null;
  // Flags
  readonly isSeasonal: boolean;
  readonly isFastMoving: boolean;
  readonly isSlowMoving: boolean;
  readonly aiTags: readonly string[];
  readonly tags: readonly string[];
  // Audit
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────

export interface CreateProductInput {
  readonly code?: string;
  readonly name: string;
  readonly description?: string;
  readonly type?: ProductType;
  readonly categoryId?: string | null;
  readonly brandId?: string | null;
  readonly unitId?: string | null;
  readonly manufacturer?: string;
  readonly hsnCode?: string;
  readonly gstRate?: number;
  readonly gstRates?: readonly number[];
  readonly taxInclusive?: boolean;
  readonly purchasePrice?: number;
  readonly sellingPrice?: number;
  readonly dealerPrice?: number;
  readonly wholesalePrice?: number;
  readonly retailPrice?: number;
  readonly minSellingPrice?: number;
  readonly sku?: string;
  readonly barcode?: string;
  readonly qrCode?: string;
  readonly trackInventory?: boolean;
  readonly reorderLevel?: number;
  readonly maxStock?: number;
  readonly openingStock?: number;
  readonly preferredSupplierId?: string | null;
  readonly tags?: readonly string[];
}

export type UpdateProductInput = Partial<CreateProductInput> & {
  readonly status?: ProductStatus;
};

// ─────────────────────────────────────────────────────────────
// Listing / search
// ─────────────────────────────────────────────────────────────

export type ProductSortField = "name" | "code" | "created_at";

export interface ProductListParams {
  readonly search?: string;
  readonly status?: ProductStatus;
  readonly type?: ProductType;
  readonly categoryId?: string;
  readonly brandId?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: ProductSortField;
  readonly sortDir?: "asc" | "desc";
}

export interface ProductListResult {
  readonly items: readonly Product[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Aggregate counts for the products list header tiles. */
export interface ProductStats {
  readonly total: number;
  readonly active: number;
  readonly draft: number;
  readonly discontinued: number;
}

export interface ProductImportRowError {
  readonly row: number;
  readonly message: string;
}

export interface ProductImportResult {
  readonly created: number;
  readonly skipped: number;
  readonly errors: readonly ProductImportRowError[];
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type ProductErrorCode =
  | "not_found"
  | "forbidden"
  | "duplicate_code"
  | "duplicate_sku"
  | "duplicate_barcode"
  | "validation"
  | "unknown";

export interface ProductError {
  readonly code: ProductErrorCode;
  readonly message: string;
}

export type ProductActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: ProductError };
