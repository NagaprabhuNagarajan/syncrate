import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { SmartReportService } from "./smart-report.service";

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

const sampleReport = {
  confidence: 0.8,
  reportType: "business_health",
  title: "Business Health",
  summary: "All good.",
  sections: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  repos.invoiceList.mockResolvedValue({
    items: [
      { totalAmount: 1000, amountPaid: 400, paymentStatus: "partial" },
      { totalAmount: 500, amountPaid: 0, paymentStatus: "unpaid" },
      { totalAmount: 300, amountPaid: 0, paymentStatus: "overdue" },
      { totalAmount: 200, amountPaid: 200, paymentStatus: "paid" },
    ],
    total: 12,
    page: 1,
    pageSize: 100,
  });
  repos.inventoryListLevels.mockResolvedValue({
    items: [
      { quantity: 2, reorderLevel: 10, purchasePrice: 50 },
      { quantity: 20, reorderLevel: 5, purchasePrice: 10 },
    ],
    total: 7,
    page: 1,
    pageSize: 100,
  });
  repos.customerList.mockResolvedValue({ items: [], total: 9, page: 1, pageSize: 1 });
  repos.supplierList.mockResolvedValue({ items: [], total: 4, page: 1, pageSize: 1 });
  repos.productList.mockResolvedValue({ items: [], total: 30, page: 1, pageSize: 1 });
  repos.customerPaymentFindAll.mockResolvedValue({
    payments: [{ amount: 600 }, { amount: 400 }],
    total: 2,
    page: 1,
    pageSize: 100,
  });
  repos.supplierPaymentFindAll.mockResolvedValue({
    payments: [{ amount: 250 }],
    total: 1,
    page: 1,
    pageSize: 100,
  });
});

describe("SmartReportService.gatherSnapshot", () => {
  it("aggregates compact figures from every repository", async () => {
    const service = new SmartReportService(fakeSupabase);
    const snapshot = await service.gatherSnapshot("org-1");

    expect(snapshot.invoices.total).toBe(12);
    expect(snapshot.invoices.sumTotal).toBe(2000);
    expect(snapshot.invoices.sumPaid).toBe(600);
    expect(snapshot.invoices.outstanding).toBe(1400);
    expect(snapshot.invoices.unpaidCount).toBe(2); // partial + unpaid
    expect(snapshot.invoices.overdueCount).toBe(1);

    expect(snapshot.inventory.totalItems).toBe(7);
    expect(snapshot.inventory.lowStockCount).toBe(1);
    expect(snapshot.inventory.stockValue).toBe(2 * 50 + 20 * 10);

    expect(snapshot.customers.total).toBe(9);
    expect(snapshot.suppliers.total).toBe(4);
    expect(snapshot.products.total).toBe(30);
    expect(snapshot.customerPayments.sumAmount).toBe(1000);
    expect(snapshot.supplierPayments.sumAmount).toBe(250);
  });

  it("scopes every repository call to the organization", async () => {
    const service = new SmartReportService(fakeSupabase);
    await service.gatherSnapshot("org-xyz");

    expect(repos.invoiceList).toHaveBeenCalledWith("org-xyz", expect.anything());
    expect(repos.inventoryListLevels).toHaveBeenCalledWith(
      "org-xyz",
      expect.anything()
    );
    expect(repos.customerPaymentFindAll).toHaveBeenCalledWith(
      "org-xyz",
      expect.anything()
    );
  });
});

describe("SmartReportService.generate", () => {
  it("requests a structured report and unwraps the data on success", async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      data: { data: sampleReport, usage: {}, model: "m" },
    });
    const service = new SmartReportService(fakeSupabase);

    const res = await service.generate("business_health", "org-1", "user-1");

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "report",
        cacheSystem: true,
        context: { organizationId: "org-1", userId: "user-1" },
      })
    );
    // The serialized snapshot is included in the prompt.
    const call = mockGenerate.mock.calls[0]?.[0];
    expect(call.prompt).toContain("business_health");
    expect(call.prompt).toContain("\"outstanding\":1400");

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.title).toBe("Business Health");
    }
  });

  it("propagates a gateway failure", async () => {
    mockGenerate.mockResolvedValue({
      success: false,
      error: { code: "rate_limited", message: "busy" },
    });
    const service = new SmartReportService(fakeSupabase);

    const res = await service.generate("cash_flow", "org-1", "user-1");

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("rate_limited");
    }
  });
});
