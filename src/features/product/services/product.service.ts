import type { AppSupabaseClient } from "@/lib/supabase/types";
import { ProductRepository } from "@/features/product/repositories/product.repository";
import { createProductSchema } from "@/features/product/schemas/product.schemas";
import { objectsToCsv } from "@/utils/csv";
import type {
  Product,
  ProductActionResult,
  ProductError,
  ProductErrorCode,
  ProductImportResult,
  ProductImportRowError,
  ProductListParams,
  ProductListResult,
  ProductStats,
  CreateProductInput,
  UpdateProductInput,
} from "@/features/product/types/product.types";

function ok<T>(data: T): ProductActionResult<T> {
  return { success: true, data };
}

function fail(
  code: ProductErrorCode,
  message: string
): ProductActionResult<never> {
  const error: ProductError = { code, message };
  return { success: false, error };
}

function nz(value: string | undefined | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function nuuid(value: string | undefined | null): string | null {
  const v = nz(value);
  return v;
}

const VALID_GST_SLABS = [0, 5, 12, 18, 28];

/**
 * Normalizes the applicable GST slabs: keeps only valid slabs, de-duplicates
 * and sorts ascending. Falls back to a single scalar rate when no array is
 * given (e.g. CSV import), so `gst_rates` is always populated.
 */
function normalizeGstRates(
  rates: readonly number[] | undefined,
  fallback?: number
): number[] {
  const source =
    rates && rates.length > 0
      ? rates
      : fallback !== undefined
        ? [fallback]
        : [];
  const valid = source.filter((r) => VALID_GST_SLABS.includes(r));
  return Array.from(new Set(valid)).sort((a, b) => a - b);
}

export class ProductService {
  private readonly repo: ProductRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new ProductRepository(supabase);
  }

  async listProducts(
    organizationId: string,
    params?: ProductListParams
  ): Promise<ProductListResult> {
    return this.repo.list(organizationId, params);
  }

  async getProductStats(organizationId: string): Promise<ProductStats> {
    return this.repo.getStats(organizationId);
  }

  async getProduct(id: string): Promise<ProductActionResult<Product>> {
    const product = await this.repo.findById(id);
    if (!product) {
      return fail("not_found", "Product not found");
    }
    return ok(product);
  }

  async createProduct(
    input: CreateProductInput,
    organizationId: string,
    userId: string
  ): Promise<ProductActionResult<Product>> {
    const code = await this.resolveCode(organizationId, input.code);

    const dupCode = await this.repo.findByField(organizationId, "code", code);
    if (dupCode) {
      return fail("duplicate_code", `A product with code "${code}" already exists`);
    }

    const sku = nz(input.sku);
    if (sku) {
      const dupSku = await this.repo.findByField(organizationId, "sku", sku);
      if (dupSku) {
        return fail("duplicate_sku", `SKU "${sku}" is already in use`);
      }
    }

    const barcode = nz(input.barcode);
    if (barcode) {
      const dupBarcode = await this.repo.findByField(
        organizationId,
        "barcode",
        barcode
      );
      if (dupBarcode) {
        return fail("duplicate_barcode", `Barcode "${barcode}" is already in use`);
      }
    }

    const product = await this.repo.create({
      organization_id: organizationId,
      code,
      name: input.name.trim(),
      description: nz(input.description),
      type: input.type ?? "inventory",
      category_id: nuuid(input.categoryId),
      brand_id: nuuid(input.brandId),
      unit_id: nuuid(input.unitId),
      manufacturer: nz(input.manufacturer),
      hsn_code: nz(input.hsnCode),
      gst_rate: normalizeGstRates(input.gstRates, input.gstRate)[0] ?? 0,
      gst_rates: normalizeGstRates(input.gstRates, input.gstRate),
      tax_inclusive: input.taxInclusive ?? false,
      purchase_price: input.purchasePrice ?? 0,
      selling_price: input.sellingPrice ?? 0,
      dealer_price: input.dealerPrice ?? 0,
      wholesale_price: input.wholesalePrice ?? 0,
      retail_price: input.retailPrice ?? 0,
      min_selling_price: input.minSellingPrice ?? 0,
      sku,
      barcode,
      qr_code: nz(input.qrCode),
      track_inventory: input.trackInventory ?? true,
      reorder_level: input.reorderLevel ?? 0,
      max_stock: input.maxStock ?? 0,
      opening_stock: input.openingStock ?? 0,
      preferred_supplier_id: nuuid(input.preferredSupplierId),
      tags: input.tags ? [...input.tags] : [],
      created_by: userId,
    });

    if (!product) {
      return fail("unknown", "Failed to create product. Please try again.");
    }
    return ok(product);
  }

  async updateProduct(
    productId: string,
    input: UpdateProductInput,
    organizationId: string,
    userId: string
  ): Promise<ProductActionResult<Product>> {
    if (input.code !== undefined && input.code.trim() !== "") {
      const code = input.code.toUpperCase().trim();
      const dup = await this.repo.findByField(organizationId, "code", code);
      if (dup && dup.id !== productId) {
        return fail("duplicate_code", `A product with code "${code}" already exists`);
      }
    }
    const sku = input.sku ? nz(input.sku) : undefined;
    if (sku) {
      const dup = await this.repo.findByField(organizationId, "sku", sku);
      if (dup && dup.id !== productId) {
        return fail("duplicate_sku", `SKU "${sku}" is already in use`);
      }
    }
    const barcode = input.barcode ? nz(input.barcode) : undefined;
    if (barcode) {
      const dup = await this.repo.findByField(organizationId, "barcode", barcode);
      if (dup && dup.id !== productId) {
        return fail("duplicate_barcode", `Barcode "${barcode}" is already in use`);
      }
    }

    const patch = buildUpdatePatch(input);

    // Keep the soft-delete flag consistent with an explicit status change:
    // archiving stamps deleted_at, and moving to any other status restores
    // the record (editing is how an archived product is brought back).
    if (input.status !== undefined) {
      if (input.status === "archived") {
        patch.deleted_at = new Date().toISOString();
        patch.deleted_by = userId;
      } else {
        patch.deleted_at = null;
        patch.deleted_by = null;
      }
    }

    const product = await this.repo.update(productId, patch, userId);
    if (!product) {
      return fail("not_found", "Product not found or update failed");
    }
    return ok(product);
  }

  async archiveProduct(
    productId: string,
    userId: string
  ): Promise<ProductActionResult<void>> {
    const existing = await this.repo.findById(productId);
    if (!existing) {
      return fail("not_found", "Product not found");
    }
    const archived = await this.repo.softDelete(productId, userId);
    if (!archived) {
      return fail("unknown", "Failed to archive product. Please try again.");
    }
    return ok(undefined);
  }

  async restoreProduct(
    productId: string,
    userId: string
  ): Promise<ProductActionResult<void>> {
    const existing = await this.repo.findById(productId);
    if (!existing) {
      return fail("not_found", "Product not found");
    }
    const restored = await this.repo.restore(productId, userId);
    if (!restored) {
      return fail("unknown", "Failed to restore product. Please try again.");
    }
    return ok(undefined);
  }

  // ── CSV export ─────────────────────────────────────────────

  /** Serializes every non-deleted product for the org into CSV text. */
  async exportProductsCsv(organizationId: string): Promise<string> {
    const products = await this.repo.findAllForExport(organizationId);
    return objectsToCsv(CSV_COLUMNS, products.map(toCsvRecord));
  }

  // ── CSV import ─────────────────────────────────────────────

  /**
   * Bulk-creates products from parsed CSV rows. Validation and per-row
   * failures (duplicate code/sku/barcode, invalid data) are collected; the
   * batch always runs to completion. Row numbers are 1-based with the header
   * as row 1, so the first data row is row 2.
   */
  async importProducts(
    rows: Array<Record<string, string>>,
    organizationId: string,
    userId: string
  ): Promise<ProductImportResult> {
    let created = 0;
    let skipped = 0;
    const errors: ProductImportRowError[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2;
      const parsed = createProductSchema.safeParse(mapCsvRowToInput(rows[i]));

      if (!parsed.success) {
        skipped += 1;
        errors.push({
          row: rowNumber,
          message: parsed.error.errors[0]?.message ?? "Invalid row",
        });
        continue;
      }

      const result = await this.createProduct(
        parsed.data,
        organizationId,
        userId
      );

      if (result.success) {
        created += 1;
      } else {
        skipped += 1;
        errors.push({ row: rowNumber, message: result.error.message });
      }
    }

    return { created, skipped, errors };
  }

  private async resolveCode(
    organizationId: string,
    provided?: string
  ): Promise<string> {
    const trimmed = provided?.trim();
    if (trimmed) {
      return trimmed.toUpperCase();
    }
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `PROD-${String(total + 1).padStart(5, "0")}`;
  }
}

function buildUpdatePatch(input: UpdateProductInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const setText = (key: string, value: string | undefined) => {
    if (value !== undefined) {
      patch[key] = nz(value);
    }
  };
  const setNum = (key: string, value: number | undefined) => {
    if (value !== undefined) {
      patch[key] = value;
    }
  };
  const setBool = (key: string, value: boolean | undefined) => {
    if (value !== undefined) {
      patch[key] = value;
    }
  };
  const setUuid = (key: string, value: string | null | undefined) => {
    if (value !== undefined) {
      patch[key] = nuuid(value);
    }
  };

  if (input.code !== undefined && input.code.trim() !== "") {
    patch.code = input.code.toUpperCase().trim();
  }
  if (input.name !== undefined) {
    patch.name = input.name.trim();
  }
  setText("description", input.description);
  if (input.type !== undefined) {
    patch.type = input.type;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  setUuid("category_id", input.categoryId);
  setUuid("brand_id", input.brandId);
  setUuid("unit_id", input.unitId);
  setText("manufacturer", input.manufacturer);
  setText("hsn_code", input.hsnCode);
  if (input.gstRates !== undefined || input.gstRate !== undefined) {
    const gstRates = normalizeGstRates(input.gstRates, input.gstRate);
    patch.gst_rates = gstRates;
    patch.gst_rate = gstRates[0] ?? 0;
  }
  setBool("tax_inclusive", input.taxInclusive);
  setNum("purchase_price", input.purchasePrice);
  setNum("selling_price", input.sellingPrice);
  setNum("dealer_price", input.dealerPrice);
  setNum("wholesale_price", input.wholesalePrice);
  setNum("retail_price", input.retailPrice);
  setNum("min_selling_price", input.minSellingPrice);
  if (input.sku !== undefined) {
    patch.sku = nz(input.sku);
  }
  if (input.barcode !== undefined) {
    patch.barcode = nz(input.barcode);
  }
  setText("qr_code", input.qrCode);
  setBool("track_inventory", input.trackInventory);
  setNum("reorder_level", input.reorderLevel);
  setNum("max_stock", input.maxStock);
  setNum("opening_stock", input.openingStock);
  setUuid("preferred_supplier_id", input.preferredSupplierId);
  if (input.tags !== undefined) {
    patch.tags = [...input.tags];
  }
  return patch;
}

// ─────────────────────────────────────────────────────────────
// CSV column mapping (stable, shared by export & import)
// ─────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  "code",
  "name",
  "type",
  "status",
  "categoryId",
  "brandId",
  "unitId",
  "hsnCode",
  "gstRate",
  "taxInclusive",
  "purchasePrice",
  "sellingPrice",
  "mrp",
  "sku",
  "barcode",
  "reorderLevel",
  "maxStock",
  "openingStock",
  "tags",
  "description",
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];
type CsvRecord = Record<CsvColumn, string>;

/** Maps a domain Product to a flat CSV record. Tags are joined by ";". */
function toCsvRecord(product: Product): CsvRecord {
  return {
    code: product.code,
    name: product.name,
    type: product.type,
    status: product.status,
    categoryId: product.categoryId ?? "",
    brandId: product.brandId ?? "",
    unitId: product.unitId ?? "",
    hsnCode: product.hsnCode ?? "",
    gstRate: String(product.gstRate),
    taxInclusive: String(product.taxInclusive),
    purchasePrice: String(product.purchasePrice),
    sellingPrice: String(product.sellingPrice),
    mrp: String(product.retailPrice),
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    reorderLevel: String(product.reorderLevel),
    maxStock: String(product.maxStock),
    openingStock: String(product.openingStock),
    tags: product.tags.join(";"),
    description: product.description ?? "",
  };
}

/** Maps a raw CSV row into a CreateProductInput-shaped object for validation. */
function mapCsvRowToInput(row: Record<string, string>): Record<string, unknown> {
  const get = (key: string): string | undefined => {
    const value = row[key];
    if (value === undefined) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  const rawTags = row.tags;
  const tags = rawTags
    ? rawTags
        .split(";")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    : undefined;

  const taxInclusiveRaw = get("taxInclusive");
  const taxInclusive =
    taxInclusiveRaw === undefined
      ? undefined
      : /^(true|1|yes)$/i.test(taxInclusiveRaw);

  return {
    code: get("code"),
    name: get("name"),
    type: get("type"),
    categoryId: get("categoryId"),
    brandId: get("brandId"),
    unitId: get("unitId"),
    hsnCode: get("hsnCode"),
    gstRate: get("gstRate"),
    taxInclusive,
    purchasePrice: get("purchasePrice"),
    sellingPrice: get("sellingPrice"),
    retailPrice: get("mrp"),
    sku: get("sku"),
    barcode: get("barcode"),
    reorderLevel: get("reorderLevel"),
    maxStock: get("maxStock"),
    openingStock: get("openingStock"),
    tags: tags && tags.length > 0 ? tags : undefined,
    description: get("description"),
  };
}
