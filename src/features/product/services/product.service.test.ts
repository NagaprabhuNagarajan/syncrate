import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Product } from "@/features/product/types/product.types";
import { ProductService } from "./product.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    getStats: vi.fn(),
    findById: vi.fn(),
    findByField: vi.fn(),
    findAllForExport: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/features/product/repositories/product.repository", () => ({
  ProductRepository: vi.fn(() => mockRepo),
}));

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    organizationId: "org-1",
    code: "PROD-00001",
    name: "Premium Widget",
    description: null,
    type: "inventory",
    status: "active",
    categoryId: null,
    brandId: null,
    unitId: null,
    manufacturer: null,
    hsnCode: null,
    gstRate: 18,
    gstRates: [18],
    taxInclusive: false,
    purchasePrice: 100,
    sellingPrice: 199.5,
    dealerPrice: 0,
    wholesalePrice: 0,
    retailPrice: 250,
    minSellingPrice: 0,
    sku: null,
    barcode: null,
    qrCode: null,
    trackInventory: true,
    reorderLevel: 0,
    maxStock: 0,
    openingStock: 0,
    preferredSupplierId: null,
    isSeasonal: false,
    isFastMoving: false,
    isSlowMoving: false,
    aiTags: [],
    tags: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

let service: ProductService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new ProductService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("ProductService.listProducts", () => {
  it("delegates to the repository", async () => {
    const listResult = {
      items: [buildProduct()],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockRepo.list.mockResolvedValue(listResult);

    const result = await service.listProducts("org-1", { search: "widget" });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { search: "widget" });
  });
});

describe("ProductService.getProductStats", () => {
  it("delegates to the repository", async () => {
    const stats = { total: 5, active: 4, draft: 1, discontinued: 0 };
    mockRepo.getStats.mockResolvedValue(stats);

    const result = await service.getProductStats("org-1");
    expect(result).toBe(stats);
    expect(mockRepo.getStats).toHaveBeenCalledWith("org-1");
  });
});

describe("ProductService.getProduct", () => {
  it("returns the product when found", async () => {
    mockRepo.findById.mockResolvedValue(buildProduct());
    const result = await service.getProduct("prod-1");
    expect(result.success).toBe(true);
  });

  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.getProduct("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// createProduct
// ─────────────────────────────────────────────────────────────

describe("ProductService.createProduct", () => {
  it("auto-generates the next code from the list total when none is provided", async () => {
    mockRepo.list.mockResolvedValue({
      items: [],
      total: 4,
      page: 1,
      pageSize: 1,
    });
    mockRepo.findByField.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildProduct());

    const result = await service.createProduct(
      { name: "Widget" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const createArg = mockRepo.create.mock.calls[0]?.[0];
    expect(createArg.code).toBe("PROD-00005");
    expect(mockRepo.findByField).toHaveBeenCalledWith(
      "org-1",
      "code",
      "PROD-00005"
    );
  });

  it("uppercases a provided code", async () => {
    mockRepo.findByField.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildProduct());

    await service.createProduct(
      { name: "Widget", code: "  abc-1  " },
      "org-1",
      "user-1"
    );
    const createArg = mockRepo.create.mock.calls[0]?.[0];
    expect(createArg.code).toBe("ABC-1");
    expect(mockRepo.list).not.toHaveBeenCalled();
  });

  it("stores multiple GST rates (deduped, sorted) with the first as the primary", async () => {
    mockRepo.findByField.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildProduct());

    await service.createProduct(
      { name: "Widget", gstRates: [18, 5, 18] },
      "org-1",
      "user-1"
    );
    const createArg = mockRepo.create.mock.calls[0]?.[0];
    expect(createArg.gst_rates).toEqual([5, 18]);
    expect(createArg.gst_rate).toBe(5);
  });

  it("fails with duplicate_code when the code already exists", async () => {
    mockRepo.findByField.mockResolvedValue(buildProduct());

    const result = await service.createProduct(
      { name: "Widget", code: "PROD-1" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_code");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("fails with duplicate_sku when the SKU already exists", async () => {
    // code check passes (null), sku check returns existing.
    mockRepo.findByField
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildProduct());

    const result = await service.createProduct(
      { name: "Widget", code: "PROD-1", sku: "SKU-1" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_sku");
    }
    expect(mockRepo.findByField).toHaveBeenNthCalledWith(
      2,
      "org-1",
      "sku",
      "SKU-1"
    );
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("fails with duplicate_barcode when the barcode already exists", async () => {
    // code + sku pass, barcode returns existing.
    mockRepo.findByField
      .mockResolvedValueOnce(null) // code
      .mockResolvedValueOnce(null) // sku
      .mockResolvedValueOnce(buildProduct()); // barcode

    const result = await service.createProduct(
      { name: "Widget", code: "PROD-1", sku: "SKU-1", barcode: "BC-1" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_barcode");
    }
    expect(mockRepo.findByField).toHaveBeenNthCalledWith(
      3,
      "org-1",
      "barcode",
      "BC-1"
    );
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("maps fields, converting empty strings to null and applying defaults", async () => {
    mockRepo.findByField.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildProduct());

    await service.createProduct(
      {
        name: "  Widget  ",
        code: "PROD-1",
        description: "",
        type: "service",
        gstRate: 12,
        taxInclusive: true,
        sellingPrice: 199.5,
        retailPrice: 250,
        tags: ["featured"],
      },
      "org-1",
      "user-1"
    );

    const arg = mockRepo.create.mock.calls[0]?.[0];
    expect(arg.name).toBe("Widget");
    expect(arg.description).toBeNull();
    expect(arg.type).toBe("service");
    expect(arg.gst_rate).toBe(12);
    expect(arg.tax_inclusive).toBe(true);
    expect(arg.selling_price).toBe(199.5);
    expect(arg.retail_price).toBe(250);
    expect(arg.tags).toEqual(["featured"]);
    expect(arg.created_by).toBe("user-1");
    // defaults
    expect(arg.purchase_price).toBe(0);
    expect(arg.track_inventory).toBe(true);
    expect(arg.type).toBe("service");
  });

  it("defaults type to inventory and gst_rate to 0 when not provided", async () => {
    mockRepo.findByField.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildProduct());

    await service.createProduct(
      { name: "Widget", code: "PROD-1" },
      "org-1",
      "user-1"
    );
    const arg = mockRepo.create.mock.calls[0]?.[0];
    expect(arg.type).toBe("inventory");
    expect(arg.gst_rate).toBe(0);
  });

  it("fails with unknown when the repository create returns null", async () => {
    mockRepo.findByField.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(null);

    const result = await service.createProduct(
      { name: "Widget", code: "PROD-1" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("succeeds and returns the created product", async () => {
    mockRepo.findByField.mockResolvedValue(null);
    const created = buildProduct();
    mockRepo.create.mockResolvedValue(created);

    const result = await service.createProduct(
      { name: "Widget", code: "PROD-1" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(created);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// updateProduct
// ─────────────────────────────────────────────────────────────

describe("ProductService.updateProduct", () => {
  it("fails with duplicate_code when the code belongs to a different product", async () => {
    mockRepo.findByField.mockResolvedValue(buildProduct({ id: "other" }));

    const result = await service.updateProduct(
      "prod-1",
      { code: "DUP" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_code");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("allows updating to a code owned by the same product", async () => {
    mockRepo.findByField.mockResolvedValue(buildProduct({ id: "prod-1" }));
    mockRepo.update.mockResolvedValue(buildProduct({ id: "prod-1" }));

    const result = await service.updateProduct(
      "prod-1",
      { code: "prod-00001", name: "New Name" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.code).toBe("PROD-00001");
    expect(patch.name).toBe("New Name");
    expect(mockRepo.update.mock.calls[0]?.[2]).toBe("user-1");
  });

  it("fails with duplicate_sku when the SKU belongs to a different product", async () => {
    mockRepo.findByField.mockResolvedValue(buildProduct({ id: "other" }));

    const result = await service.updateProduct(
      "prod-1",
      { sku: "SKU-1" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_sku");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("fails with duplicate_barcode when the barcode belongs to a different product", async () => {
    mockRepo.findByField.mockResolvedValue(buildProduct({ id: "other" }));

    const result = await service.updateProduct(
      "prod-1",
      { barcode: "BC-1" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_barcode");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("returns not_found when the repository update returns null", async () => {
    mockRepo.update.mockResolvedValue(null);

    const result = await service.updateProduct(
      "prod-1",
      { name: "Renamed" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("succeeds with the built patch", async () => {
    mockRepo.update.mockResolvedValue(buildProduct());

    const result = await service.updateProduct(
      "prod-1",
      {
        description: "",
        type: "service",
        status: "discontinued",
        gstRate: 5,
        taxInclusive: true,
        sellingPrice: 300,
        retailPrice: 350,
        trackInventory: false,
        reorderLevel: 5,
        tags: ["seasonal"],
      },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.description).toBeNull();
    expect(patch.type).toBe("service");
    expect(patch.status).toBe("discontinued");
    expect(patch.gst_rate).toBe(5);
    expect(patch.tax_inclusive).toBe(true);
    expect(patch.selling_price).toBe(300);
    expect(patch.retail_price).toBe(350);
    expect(patch.track_inventory).toBe(false);
    expect(patch.reorder_level).toBe(5);
    expect(patch.tags).toEqual(["seasonal"]);
  });

  it("stamps deleted_at/deleted_by when the status changes to archived", async () => {
    mockRepo.update.mockResolvedValue(buildProduct({ status: "archived" }));

    await service.updateProduct(
      "prod-1",
      { status: "archived" },
      "org-1",
      "user-9"
    );

    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(typeof patch.deleted_at).toBe("string");
    expect(patch.deleted_by).toBe("user-9");
  });

  it("clears deleted_at/deleted_by when the status changes away from archived", async () => {
    mockRepo.update.mockResolvedValue(buildProduct({ status: "active" }));

    await service.updateProduct(
      "prod-1",
      { status: "active" },
      "org-1",
      "user-9"
    );

    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.deleted_at).toBeNull();
    expect(patch.deleted_by).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// archiveProduct
// ─────────────────────────────────────────────────────────────

describe("ProductService.archiveProduct", () => {
  it("returns not_found when the product does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.archiveProduct("prod-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it("fails with unknown when the soft delete fails", async () => {
    mockRepo.findById.mockResolvedValue(buildProduct());
    mockRepo.softDelete.mockResolvedValue(false);

    const result = await service.archiveProduct("prod-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("succeeds when the product is soft deleted", async () => {
    mockRepo.findById.mockResolvedValue(buildProduct());
    mockRepo.softDelete.mockResolvedValue(true);

    const result = await service.archiveProduct("prod-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("prod-1", "user-1");
  });
});

// ─────────────────────────────────────────────────────────────
// exportProductsCsv
// ─────────────────────────────────────────────────────────────

describe("ProductService.exportProductsCsv", () => {
  it("serializes products with the stable column set and maps mrp to retailPrice", async () => {
    mockRepo.findAllForExport.mockResolvedValue([
      buildProduct({
        code: "P1",
        name: "Widget",
        type: "inventory",
        status: "active",
        gstRate: 18,
        taxInclusive: false,
        purchasePrice: 100,
        sellingPrice: 199.5,
        retailPrice: 250,
        sku: "SKU-1",
        tags: ["featured", "seasonal"],
        description: null,
      }),
    ]);

    const csv = await service.exportProductsCsv("org-1");
    const [header, firstRow] = csv.split("\r\n");

    expect(header).toBe(
      "code,name,type,status,categoryId,brandId,unitId,hsnCode,gstRate," +
        "taxInclusive,purchasePrice,sellingPrice,mrp,sku,barcode," +
        "reorderLevel,maxStock,openingStock,tags,description"
    );
    expect(firstRow.startsWith("P1,Widget,inventory,active,")).toBe(true);
    // mrp column carries the retail price.
    expect(firstRow).toContain("250");
    expect(firstRow).toContain("featured;seasonal");
    expect(mockRepo.findAllForExport).toHaveBeenCalledWith("org-1");
  });

  it("quotes a value containing a comma", async () => {
    mockRepo.findAllForExport.mockResolvedValue([
      buildProduct({ code: "P1", name: "Widget, Deluxe", tags: [] }),
    ]);

    const csv = await service.exportProductsCsv("org-1");
    expect(csv).toContain('"Widget, Deluxe"');
  });

  it("returns just the header when there are no products", async () => {
    mockRepo.findAllForExport.mockResolvedValue([]);
    const csv = await service.exportProductsCsv("org-1");
    expect(csv.split("\r\n")).toHaveLength(1);
    expect(csv.startsWith("code,name")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// importProducts
// ─────────────────────────────────────────────────────────────

describe("ProductService.importProducts", () => {
  it("creates valid rows, splits tags by ';' and maps mrp/taxInclusive", async () => {
    mockRepo.findByField.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildProduct());

    const result = await service.importProducts(
      [
        {
          code: "P1",
          name: "Widget",
          mrp: "250",
          taxInclusive: "true",
          tags: "featured;seasonal",
        },
        { code: "P2", name: "Gadget" },
      ],
      "org-1",
      "user-1"
    );

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    const firstArg = mockRepo.create.mock.calls[0]?.[0];
    expect(firstArg.tags).toEqual(["featured", "seasonal"]);
    expect(firstArg.retail_price).toBe(250);
    expect(firstArg.tax_inclusive).toBe(true);
  });

  it("skips invalid rows with a 1-based row number (header is row 1)", async () => {
    mockRepo.findByField.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildProduct());

    const result = await service.importProducts(
      [
        { code: "P1", name: "Widget" }, // row 2 — valid
        { code: "P2", name: "" }, // row 3 — name required
      ],
      "org-1",
      "user-1"
    );

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
  });

  it("records duplicate_code failures as skipped without aborting the batch", async () => {
    // First row duplicates an existing code; second row is fresh.
    mockRepo.findByField
      .mockResolvedValueOnce(buildProduct({ id: "existing" })) // row 2 code dup
      .mockResolvedValueOnce(null); // row 3 code ok
    mockRepo.create.mockResolvedValue(buildProduct());

    const result = await service.importProducts(
      [
        { code: "DUP", name: "Widget" }, // row 2 — duplicate code
        { code: "P2", name: "Gadget" }, // row 3 — created
      ],
      "org-1",
      "user-1"
    );

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[0].message).toContain("DUP");
  });

  it("returns zeroed counts for an empty batch", async () => {
    const result = await service.importProducts([], "org-1", "user-1");
    expect(result).toEqual({ created: 0, skipped: 0, errors: [] });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});
