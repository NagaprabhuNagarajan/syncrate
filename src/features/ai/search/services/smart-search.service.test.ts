import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { SearchIntent } from "@/features/ai/search/schemas/searchIntentSchema";
import { SmartSearchService } from "./smart-search.service";

// ── Mocks ────────────────────────────────────────────────────────
const { mockGenerate, repos } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  repos: {
    invoiceList: vi.fn(),
    customerList: vi.fn(),
    productList: vi.fn(),
    inventoryListLevels: vi.fn(),
    supplierList: vi.fn(),
    customerPaymentFindAll: vi.fn(),
    supplierPaymentFindAll: vi.fn(),
  },
}));

vi.mock("@/features/ai/client/anthropic-client", () => ({
  AI_MODELS: { default: "claude-opus-4-8", fast: "claude-haiku-4-5" },
}));

vi.mock("@/features/ai/services/ai-gateway.service", () => ({
  AiGatewayService: vi.fn(() => ({ generateStructured: mockGenerate })),
}));

vi.mock("@/features/sales/repositories/invoice.repository", () => ({
  InvoiceRepository: vi.fn(() => ({ list: repos.invoiceList })),
}));
vi.mock("@/features/customer/repositories/customer.repository", () => ({
  CustomerRepository: vi.fn(() => ({ list: repos.customerList })),
}));
vi.mock("@/features/product/repositories/product.repository", () => ({
  ProductRepository: vi.fn(() => ({ list: repos.productList })),
}));
vi.mock("@/features/inventory/repositories/inventory.repository", () => ({
  InventoryRepository: vi.fn(() => ({ listLevels: repos.inventoryListLevels })),
}));
vi.mock("@/features/supplier/repositories/supplier.repository", () => ({
  SupplierRepository: vi.fn(() => ({ list: repos.supplierList })),
}));
vi.mock("@/features/payment/repositories/customer-payment.repository", () => ({
  CustomerPaymentRepository: vi.fn(() => ({
    findAll: repos.customerPaymentFindAll,
  })),
}));
vi.mock("@/features/payment/repositories/supplier-payment.repository", () => ({
  SupplierPaymentRepository: vi.fn(() => ({
    findAll: repos.supplierPaymentFindAll,
  })),
}));

const fakeSupabase = {} as unknown as AppSupabaseClient;

function intent(overrides: Partial<SearchIntent> = {}): SearchIntent {
  return {
    confidence: 0.9,
    entity: "invoice",
    explanation: "Unpaid invoices",
    filters: {
      keyword: null,
      status: null,
      paymentStatus: null,
      lowStock: null,
      overdue: null,
    },
    timeRange: null,
    sort: null,
    limit: null,
    ...overrides,
  };
}

function gatewaySuccess(parsed: SearchIntent) {
  return {
    success: true,
    data: { data: parsed, usage: {}, model: "m" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repos.invoiceList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  repos.customerList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  repos.productList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  repos.inventoryListLevels.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  repos.supplierList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  repos.customerPaymentFindAll.mockResolvedValue({ payments: [], total: 0, page: 1, pageSize: 20 });
  repos.supplierPaymentFindAll.mockResolvedValue({ payments: [], total: 0, page: 1, pageSize: 20 });
});

describe("SmartSearchService.search", () => {
  it("propagates a gateway failure", async () => {
    mockGenerate.mockResolvedValue({
      success: false,
      error: { code: "provider_error", message: "boom" },
    });
    const service = new SmartSearchService(fakeSupabase);

    const res = await service.search("anything", "org-1", "user-1");

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("provider_error");
    }
    expect(repos.invoiceList).not.toHaveBeenCalled();
  });

  it("maps an invoice intent to the invoice repository with filters", async () => {
    mockGenerate.mockResolvedValue(
      gatewaySuccess(
        intent({
          filters: {
            keyword: "INV",
            status: "posted",
            paymentStatus: "unpaid",
            lowStock: null,
            overdue: null,
          },
          timeRange: { from: "2026-06-01", to: "2026-06-30" },
        })
      )
    );
    repos.invoiceList.mockResolvedValue({
      items: [
        {
          id: "i1",
          invoiceNumber: "INV-1",
          customerName: "Acme",
          paymentStatus: "unpaid",
          totalAmount: 1000,
        },
        {
          id: "i2",
          invoiceNumber: "INV-2",
          customerName: "Beta",
          paymentStatus: "paid",
          totalAmount: 500,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });
    const service = new SmartSearchService(fakeSupabase);

    const res = await service.search("show unpaid invoices", "org-1", "user-1");

    expect(repos.invoiceList).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({
        search: "INV",
        status: "posted",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
      })
    );
    expect(res.success).toBe(true);
    if (res.success) {
      const group = res.data.groups[0];
      expect(group.entity).toBe("invoice");
      // payment-status filter applied in-service: only the unpaid one remains
      expect(group.items).toHaveLength(1);
      expect(group.items[0]?.id).toBe("i1");
      expect(res.data.intent.explanation).toBe("Unpaid invoices");
    }
  });

  it("filters invoices by overdue flag in-service", async () => {
    mockGenerate.mockResolvedValue(
      gatewaySuccess(
        intent({
          filters: {
            keyword: null,
            status: null,
            paymentStatus: null,
            lowStock: null,
            overdue: true,
          },
        })
      )
    );
    repos.invoiceList.mockResolvedValue({
      items: [
        { id: "a", invoiceNumber: "A", customerName: null, paymentStatus: "overdue", totalAmount: 1 },
        { id: "b", invoiceNumber: "B", customerName: null, paymentStatus: "paid", totalAmount: 2 },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });
    const service = new SmartSearchService(fakeSupabase);

    const res = await service.search("overdue invoices", "org-1", "user-1");

    expect(res.success && res.data.groups[0]?.items).toHaveLength(1);
    expect(res.success && res.data.groups[0]?.items[0]?.id).toBe("a");
  });

  it("maps an inventory low-stock intent to listLevels", async () => {
    mockGenerate.mockResolvedValue(
      gatewaySuccess(
        intent({
          entity: "inventory",
          explanation: "Products below reorder level",
          filters: {
            keyword: null,
            status: null,
            paymentStatus: null,
            lowStock: true,
            overdue: null,
          },
        })
      )
    );
    repos.inventoryListLevels.mockResolvedValue({
      items: [
        {
          id: "l1",
          productName: "Widget",
          branchName: "Main",
          quantity: 2,
          reorderLevel: 10,
          purchasePrice: 50,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const service = new SmartSearchService(fakeSupabase);

    const res = await service.search("products below reorder level", "org-1", null);

    expect(repos.inventoryListLevels).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ lowStockOnly: true })
    );
    expect(res.success && res.data.groups[0]?.entity).toBe("inventory");
    expect(res.success && res.data.groups[0]?.items[0]?.title).toBe("Widget");
  });

  it("maps a customer intent to the customer repository", async () => {
    mockGenerate.mockResolvedValue(
      gatewaySuccess(intent({ entity: "customer", explanation: "Active customers" }))
    );
    repos.customerList.mockResolvedValue({
      items: [
        {
          id: "c1",
          name: "Acme",
          company: "Acme Ltd",
          code: "C1",
          status: "active",
          creditLimit: 5000,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const service = new SmartSearchService(fakeSupabase);

    const res = await service.search("customers", "org-1", "user-1");

    expect(repos.customerList).toHaveBeenCalledTimes(1);
    expect(res.success && res.data.groups[0]?.items[0]?.amount).toBe(5000);
  });

  it("maps a customer_payment intent to findAll", async () => {
    mockGenerate.mockResolvedValue(
      gatewaySuccess(intent({ entity: "customer_payment", explanation: "Payments" }))
    );
    repos.customerPaymentFindAll.mockResolvedValue({
      payments: [
        {
          id: "p1",
          paymentNumber: "PAY-1",
          customerName: "Acme",
          paymentMethod: "upi",
          amount: 250,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const service = new SmartSearchService(fakeSupabase);

    const res = await service.search("payments received", "org-1", "user-1");

    expect(repos.customerPaymentFindAll).toHaveBeenCalledTimes(1);
    expect(res.success && res.data.groups[0]?.items[0]?.title).toBe("PAY-1");
  });

  it("returns an empty group when the repository has no matches", async () => {
    mockGenerate.mockResolvedValue(gatewaySuccess(intent({ entity: "supplier" })));
    const service = new SmartSearchService(fakeSupabase);

    const res = await service.search("suppliers", "org-1", "user-1");

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.groups[0]?.entity).toBe("supplier");
      expect(res.data.groups[0]?.items).toHaveLength(0);
      expect(res.data.groups[0]?.total).toBe(0);
    }
  });

  it("ignores an invalid status that the entity does not support", async () => {
    mockGenerate.mockResolvedValue(
      gatewaySuccess(
        intent({
          entity: "customer",
          filters: {
            keyword: null,
            status: "posted", // not a valid customer status
            paymentStatus: null,
            lowStock: null,
            overdue: null,
          },
        })
      )
    );
    const service = new SmartSearchService(fakeSupabase);

    await service.search("customers", "org-1", "user-1");

    expect(repos.customerList).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ status: undefined })
    );
  });
});
