import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { AiContext } from "@/features/ai/types/ai.types";
import type { InvoiceListItem } from "@/features/sales/types/invoice.types";
import type { InventoryLevel } from "@/features/inventory/types/inventory.types";
import type { Supplier } from "@/features/supplier/types/supplier.types";
import { RecommendationService } from "./recommendation.service";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks for the gateway + every domain service
// ─────────────────────────────────────────────────────────────

const {
  mockGenerateStructured,
  mockListProducts,
  mockListLevels,
  mockListSuppliers,
  mockListCustomers,
  mockListInvoices,
} = vi.hoisted(() => ({
  mockGenerateStructured: vi.fn(),
  mockListProducts: vi.fn(),
  mockListLevels: vi.fn(),
  mockListSuppliers: vi.fn(),
  mockListCustomers: vi.fn(),
  mockListInvoices: vi.fn(),
}));

vi.mock("@/features/ai/services/ai-gateway.service", () => ({
  AiGatewayService: vi.fn(() => ({
    generateStructured: mockGenerateStructured,
  })),
}));
vi.mock("@/features/product/services/product.service", () => ({
  ProductService: vi.fn(() => ({ listProducts: mockListProducts })),
}));
vi.mock("@/features/inventory/services/inventory.service", () => ({
  InventoryService: vi.fn(() => ({ listLevels: mockListLevels })),
}));
vi.mock("@/features/supplier/services/supplier.service", () => ({
  SupplierService: vi.fn(() => ({ listSuppliers: mockListSuppliers })),
}));
vi.mock("@/features/customer/services/customer.service", () => ({
  CustomerService: vi.fn(() => ({ listCustomers: mockListCustomers })),
}));
vi.mock("@/features/sales/services/invoice.service", () => ({
  InvoiceService: vi.fn(() => ({ listInvoices: mockListInvoices })),
}));

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const CONTEXT: AiContext = { organizationId: "org-1", userId: "user-1" };
const supabase = {} as AppSupabaseClient;

function level(overrides: Partial<InventoryLevel> = {}): InventoryLevel {
  return {
    productCode: "SKU-1",
    productName: "Widget",
    quantity: 3,
    reorderLevel: 20,
    purchasePrice: 50,
    id: "lvl-1",
    organizationId: "org-1",
    productId: "p-1",
    warehouseId: "w-1",
    reservedQuantity: 0,
    warehouseName: "Main",
    warehouseCode: "WH-1",
    ...overrides,
  };
}

function supplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    name: "Acme Supply",
    rating: 4,
    paymentTermsDays: 30,
    ...overrides,
  } as unknown as Supplier;
}

function invoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    customerId: "c-1",
    customerName: "Kumar Traders",
    totalAmount: 1000,
    amountPaid: 400,
    paymentStatus: "partial",
    invoiceDate: new Date("2026-05-10T00:00:00Z"),
    ...overrides,
  } as unknown as InvoiceListItem;
}

function setupHappyData() {
  mockListProducts.mockResolvedValue({
    items: [],
    total: 12,
    page: 1,
    pageSize: 100,
  });
  mockListLevels.mockResolvedValue({
    items: [level(), level({ productCode: "SKU-2", quantity: 1 })],
    total: 2,
    page: 1,
    pageSize: 100,
  });
  mockListSuppliers.mockResolvedValue({
    items: [supplier()],
    total: 5,
    page: 1,
    pageSize: 100,
  });
  mockListCustomers.mockResolvedValue({
    items: [],
    total: 8,
    page: 1,
    pageSize: 100,
  });
  mockListInvoices.mockResolvedValue({
    items: [
      invoice(),
      invoice({
        customerId: "c-1",
        totalAmount: 2000,
        amountPaid: 0,
        paymentStatus: "overdue",
        invoiceDate: new Date("2026-06-01T00:00:00Z"),
      }),
      invoice({
        customerId: "c-2",
        customerName: "Rao & Co",
        totalAmount: 500,
        amountPaid: 500,
        paymentStatus: "paid",
      }),
    ],
    total: 3,
    page: 1,
    pageSize: 100,
  });
}

function setupEmptyData() {
  const empty = { items: [], total: 0, page: 1, pageSize: 100 };
  mockListProducts.mockResolvedValue(empty);
  mockListLevels.mockResolvedValue(empty);
  mockListSuppliers.mockResolvedValue(empty);
  mockListCustomers.mockResolvedValue(empty);
  mockListInvoices.mockResolvedValue(empty);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("RecommendationService.gatherSnapshot", () => {
  it("derives compact aggregates from the domain services", async () => {
    setupHappyData();
    const service = new RecommendationService(supabase);
    const snapshot = await service.gatherSnapshot("org-1");

    expect(snapshot.activeProductCount).toBe(12);
    expect(snapshot.lowStockCount).toBe(2);
    expect(snapshot.lowStockItems[0]?.code).toBe("SKU-1");
    expect(snapshot.supplierCount).toBe(5);
    expect(snapshot.customerCount).toBe(8);
    // revenue = 1000 + 2000 + 500
    expect(snapshot.totalRevenue).toBe(3500);
    // outstanding = (1000-400) + (2000-0) + (500-500)
    expect(snapshot.outstandingAmount).toBe(2600);
    expect(snapshot.overdueInvoiceCount).toBe(1);
  });

  it("aggregates invoices per customer, sorted by total billed", async () => {
    setupHappyData();
    const service = new RecommendationService(supabase);
    const snapshot = await service.gatherSnapshot("org-1");

    expect(snapshot.topCustomers[0]?.name).toBe("Kumar Traders");
    expect(snapshot.topCustomers[0]?.totalBilled).toBe(3000);
    expect(snapshot.topCustomers[0]?.invoiceCount).toBe(2);
    expect(snapshot.topCustomers[0]?.overdueCount).toBe(1);
    expect(snapshot.topCustomers[0]?.lastInvoiceDate).toBe("2026-06-01");
  });

  it("returns zeroed aggregates when there is no data", async () => {
    setupEmptyData();
    const service = new RecommendationService(supabase);
    const snapshot = await service.gatherSnapshot("org-1");

    expect(snapshot.totalRevenue).toBe(0);
    expect(snapshot.lowStockItems).toEqual([]);
    expect(snapshot.topCustomers).toEqual([]);
  });
});

describe("RecommendationService.generate", () => {
  it("returns the parsed recommendations on gateway success", async () => {
    setupHappyData();
    const payload = {
      confidence: 0.8,
      summary: "Reorder two SKUs.",
      recommendations: [],
    };
    mockGenerateStructured.mockResolvedValue({
      success: true,
      data: { data: payload, usage: {}, model: "test" },
    });

    const service = new RecommendationService(supabase);
    const result = await service.generate(CONTEXT);

    expect(result).toEqual({ success: true, data: payload });
    expect(mockGenerateStructured).toHaveBeenCalledTimes(1);
    const call = mockGenerateStructured.mock.calls[0]?.[0];
    expect(call.capability).toBe("recommendation");
    expect(call.context).toBe(CONTEXT);
    expect(call.cacheSystem).toBe(true);
  });

  it("propagates a gateway failure unchanged", async () => {
    setupHappyData();
    mockGenerateStructured.mockResolvedValue({
      success: false,
      error: { code: "rate_limited", message: "busy" },
    });

    const service = new RecommendationService(supabase);
    const result = await service.generate(CONTEXT);

    expect(result).toEqual({
      success: false,
      error: { code: "rate_limited", message: "busy" },
    });
  });

  it("still calls the gateway when the business has no data", async () => {
    setupEmptyData();
    mockGenerateStructured.mockResolvedValue({
      success: true,
      data: {
        data: { confidence: 0.1, summary: "No data.", recommendations: [] },
        usage: {},
        model: "test",
      },
    });

    const service = new RecommendationService(supabase);
    const result = await service.generate(CONTEXT);

    expect(result.success).toBe(true);
    expect(mockGenerateStructured).toHaveBeenCalledTimes(1);
  });
});
