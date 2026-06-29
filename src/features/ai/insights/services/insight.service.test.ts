import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { AiContext } from "@/features/ai/types/ai.types";
import type { Product } from "@/features/product/types/product.types";
import type { Supplier } from "@/features/supplier/types/supplier.types";
import type { InvoiceListItem } from "@/features/sales/types/invoice.types";
import { InsightService } from "./insight.service";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const {
  mockGenerateStructured,
  mockListProducts,
  mockListLevels,
  mockGetStockValue,
  mockListSuppliers,
  mockListCustomers,
  mockListInvoices,
} = vi.hoisted(() => ({
  mockGenerateStructured: vi.fn(),
  mockListProducts: vi.fn(),
  mockListLevels: vi.fn(),
  mockGetStockValue: vi.fn(),
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
  InventoryService: vi.fn(() => ({
    listLevels: mockListLevels,
    getStockValue: mockGetStockValue,
  })),
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
const NOW = new Date("2026-06-29T00:00:00Z");

function product(overrides: Partial<Product> = {}): Product {
  return {
    code: "SKU-1",
    name: "Widget",
    sellingPrice: 100,
    purchasePrice: 60,
    isSlowMoving: false,
    ...overrides,
  } as unknown as Product;
}

function supplier(rating: number | null): Supplier {
  return { name: "Acme", rating } as unknown as Supplier;
}

function invoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    customerId: "c-1",
    customerName: "Kumar",
    totalAmount: 1000,
    amountPaid: 1000,
    paymentStatus: "paid",
    invoiceDate: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  } as unknown as InvoiceListItem;
}

function setupHappyData() {
  mockListProducts.mockResolvedValue({
    items: [
      product(),
      product({
        code: "SKU-2",
        sellingPrice: 200,
        purchasePrice: 150,
        isSlowMoving: true,
      }),
    ],
    total: 2,
    page: 1,
    pageSize: 100,
  });
  mockListLevels.mockResolvedValue({
    items: [{ quantity: 1 }, { quantity: 0 }],
    total: 2,
    page: 1,
    pageSize: 100,
  });
  mockGetStockValue.mockResolvedValue(12345.678);
  mockListSuppliers.mockResolvedValue({
    items: [supplier(4), supplier(2), supplier(null)],
    total: 3,
    page: 1,
    pageSize: 100,
  });
  mockListCustomers.mockResolvedValue({
    items: [],
    total: 9,
    page: 1,
    pageSize: 100,
  });
  mockListInvoices.mockResolvedValue({
    items: [
      invoice({ invoiceDate: new Date("2026-05-12T00:00:00Z") }),
      invoice({ invoiceDate: new Date("2026-06-01T00:00:00Z") }),
      invoice({
        customerId: "c-2",
        totalAmount: 500,
        invoiceDate: new Date("2026-01-05T00:00:00Z"),
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
  mockGetStockValue.mockResolvedValue(0);
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

describe("InsightService.gatherSnapshot", () => {
  it("derives revenue, margin, churn and supplier aggregates", async () => {
    setupHappyData();
    const service = new InsightService(supabase);
    const snapshot = await service.gatherSnapshot("org-1", "INR", NOW);

    expect(snapshot.totalRevenue).toBe(2500);
    expect(snapshot.inventoryValue).toBe(12345.68);
    expect(snapshot.lowStockCount).toBe(2);
    expect(snapshot.slowMovingCount).toBe(1);
    expect(snapshot.slowMovingProducts[0]?.code).toBe("SKU-2");
    // margins: (100-60)/100=40%, (200-150)/200=25% → avg 32.5
    expect(snapshot.avgGrossMarginPercent).toBe(32.5);
    // ratings 4 and 2 (null ignored) → avg 3
    expect(snapshot.avgSupplierRating).toBe(3);
    expect(snapshot.customerCount).toBe(9);
    // c-2's last invoice (Jan) is older than the 90-day window → churn risk
    expect(snapshot.inactiveCustomerCount).toBe(1);
  });

  it("buckets revenue by month, oldest first", async () => {
    setupHappyData();
    const service = new InsightService(supabase);
    const snapshot = await service.gatherSnapshot("org-1", "INR", NOW);

    expect(snapshot.monthlyRevenue.map((m) => m.month)).toEqual([
      "2026-01",
      "2026-05",
      "2026-06",
    ]);
    expect(snapshot.monthlyRevenue[0]?.revenue).toBe(500);
  });

  it("returns null averages and zeros when there is no data", async () => {
    setupEmptyData();
    const service = new InsightService(supabase);
    const snapshot = await service.gatherSnapshot("org-1", "INR", NOW);

    expect(snapshot.avgGrossMarginPercent).toBeNull();
    expect(snapshot.avgSupplierRating).toBeNull();
    expect(snapshot.monthlyRevenue).toEqual([]);
    expect(snapshot.totalRevenue).toBe(0);
  });
});

describe("InsightService.generate", () => {
  it("returns parsed insights on gateway success", async () => {
    setupHappyData();
    const payload = { confidence: 0.7, summary: "Healthy.", insights: [] };
    mockGenerateStructured.mockResolvedValue({
      success: true,
      data: { data: payload, usage: {}, model: "test" },
    });

    const service = new InsightService(supabase);
    const result = await service.generate(CONTEXT);

    expect(result).toEqual({ success: true, data: payload });
    const call = mockGenerateStructured.mock.calls[0]?.[0];
    expect(call.capability).toBe("insight");
    expect(call.context).toBe(CONTEXT);
  });

  it("propagates a gateway failure", async () => {
    setupHappyData();
    mockGenerateStructured.mockResolvedValue({
      success: false,
      error: { code: "provider_error", message: "down" },
    });

    const service = new InsightService(supabase);
    const result = await service.generate(CONTEXT);

    expect(result).toEqual({
      success: false,
      error: { code: "provider_error", message: "down" },
    });
  });
});
