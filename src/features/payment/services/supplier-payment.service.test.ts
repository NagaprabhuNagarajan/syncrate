import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  SupplierPayment,
  SupplierPaymentListResult,
} from "@/features/payment/types/payment.types";
import { SupplierPaymentService } from "./supplier-payment.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findBySupplier: vi.fn(),
    findAllocations: vi.fn(),
    countByOrg: vi.fn(),
  },
}));

vi.mock(
  "@/features/payment/repositories/supplier-payment.repository",
  () => ({
    SupplierPaymentRepository: vi.fn(() => mockRepo),
  })
);

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildPayment(overrides: Partial<SupplierPayment> = {}): SupplierPayment {
  return {
    id: "spay-1",
    organizationId: "org-1",
    paymentNumber: "PAY-2026-000001",
    supplierId: "supp-1",
    supplierName: "Best Supplies Ltd",
    paymentDate: "2026-06-27",
    amount: 5000,
    paymentMethod: "bank_transfer",
    referenceNumber: null,
    notes: null,
    status: "completed",
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    createdAt: "2026-06-27T00:00:00Z",
    updatedAt: "2026-06-27T00:00:00Z",
    createdBy: "user-1",
    ...overrides,
  };
}

const mockRpc = vi.fn();
const mockSupabase = {
  rpc: mockRpc,
} as unknown as AppSupabaseClient;

let service: SupplierPaymentService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new SupplierPaymentService(mockSupabase);
});

// ─────────────────────────────────────────────────────────────
// listSupplierPayments
// ─────────────────────────────────────────────────────────────

describe("SupplierPaymentService.listSupplierPayments", () => {
  it("delegates to the repository", async () => {
    const listResult: SupplierPaymentListResult = {
      payments: [buildPayment()],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockRepo.findAll.mockResolvedValue(listResult);

    const result = await service.listSupplierPayments("org-1");
    expect(result).toBe(listResult);
    expect(mockRepo.findAll).toHaveBeenCalledWith("org-1", undefined);
  });
});

// ─────────────────────────────────────────────────────────────
// getSupplierPayment
// ─────────────────────────────────────────────────────────────

describe("SupplierPaymentService.getSupplierPayment", () => {
  it("returns payment when found", async () => {
    const payment = buildPayment();
    mockRepo.findById.mockResolvedValue(payment);

    const result = await service.getSupplierPayment("spay-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("spay-1");
    }
  });

  it("returns not_found when payment does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.getSupplierPayment("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// recordPayment
// ─────────────────────────────────────────────────────────────

describe("SupplierPaymentService.recordPayment", () => {
  const validInput = {
    supplierId: "supp-1",
    amount: 5000,
    paymentMethod: "bank_transfer" as const,
    allocations: [],
  };

  it("fails with validation when amount is zero", async () => {
    const result = await service.recordPayment(
      { ...validInput, amount: 0 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("fails with validation when allocations exceed payment amount", async () => {
    const result = await service.recordPayment(
      {
        ...validInput,
        amount: 1000,
        allocations: [
          { purchaseInvoiceId: "pinv-1", amount: 600 },
          { purchaseInvoiceId: "pinv-2", amount: 600 },
        ],
      },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("calls the RPC with the correct arguments including allocations", async () => {
    mockRepo.countByOrg.mockResolvedValue(2);
    mockRpc.mockResolvedValue({ data: "spay-1", error: null });
    mockRepo.findById.mockResolvedValue(buildPayment());

    await service.recordPayment(
      {
        supplierId: "supp-1",
        amount: 3000,
        paymentMethod: "cheque",
        referenceNumber: "CHQ-100",
        paymentDate: "2026-06-27",
        allocations: [{ purchaseInvoiceId: "pinv-1", amount: 3000 }],
      },
      "org-1",
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "record_supplier_payment",
      expect.objectContaining({
        p_org_id: "org-1",
        p_supplier_id: "supp-1",
        p_amount: 3000,
        p_method: "cheque",
        p_reference: "CHQ-100",
        p_allocations: JSON.stringify([
          { purchase_invoice_id: "pinv-1", amount: 3000 },
        ]),
      })
    );
  });

  it("returns the payment on success", async () => {
    mockRepo.countByOrg.mockResolvedValue(0);
    const created = buildPayment();
    mockRpc.mockResolvedValue({ data: "spay-1", error: null });
    mockRepo.findById.mockResolvedValue(created);

    const result = await service.recordPayment(validInput, "org-1", "user-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(created);
    }
  });

  it("maps not_found RPC errors correctly", async () => {
    mockRepo.countByOrg.mockResolvedValue(0);
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "not_found: supplier" },
    });

    const result = await service.recordPayment(validInput, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("generates the correct payment number sequence", async () => {
    mockRepo.countByOrg.mockResolvedValue(9);
    mockRpc.mockResolvedValue({ data: "spay-1", error: null });
    mockRepo.findById.mockResolvedValue(buildPayment());

    await service.recordPayment(validInput, "org-1", "user-1");

    expect(mockRpc).toHaveBeenCalledWith(
      "record_supplier_payment",
      expect.objectContaining({
        p_payment_number: `PAY-${new Date().getFullYear()}-000010`,
      })
    );
  });
});
