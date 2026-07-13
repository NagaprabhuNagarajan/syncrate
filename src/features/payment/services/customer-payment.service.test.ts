import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CustomerPayment,
  CustomerPaymentListResult,
  CustomerPaymentAllocation,
} from "@/features/payment/types/payment.types";
import { CustomerPaymentService } from "./customer-payment.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByCustomer: vi.fn(),
    findAllocations: vi.fn(),
    countByOrg: vi.fn(),
    getAvailableCredit: vi.fn(),
  },
}));

vi.mock(
  "@/features/payment/repositories/customer-payment.repository",
  () => ({
    CustomerPaymentRepository: vi.fn(() => mockRepo),
  })
);

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildPayment(overrides: Partial<CustomerPayment> = {}): CustomerPayment {
  return {
    id: "pay-1",
    organizationId: "org-1",
    paymentNumber: "PAY-2026-000001",
    customerId: "cust-1",
    customerName: "Acme Traders",
    paymentDate: "2026-06-27",
    amount: 1000,
    paymentMethod: "cash",
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

function buildAllocation(
  overrides: Partial<CustomerPaymentAllocation> = {}
): CustomerPaymentAllocation {
  return {
    id: "alloc-1",
    organizationId: "org-1",
    customerPaymentId: "pay-1",
    invoiceId: "inv-1",
    allocatedAmount: 1000,
    createdAt: "2026-06-27T00:00:00Z",
    createdBy: "user-1",
    ...overrides,
  };
}

// Mock supabase rpc
const mockRpc = vi.fn();
const mockSupabase = {
  rpc: mockRpc,
} as unknown as AppSupabaseClient;

let service: CustomerPaymentService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new CustomerPaymentService(mockSupabase);
});

// ─────────────────────────────────────────────────────────────
// listCustomerPayments
// ─────────────────────────────────────────────────────────────

describe("CustomerPaymentService.listCustomerPayments", () => {
  it("delegates to the repository", async () => {
    const listResult: CustomerPaymentListResult = {
      payments: [buildPayment()],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockRepo.findAll.mockResolvedValue(listResult);

    const result = await service.listCustomerPayments("org-1", { page: 1 });
    expect(result).toBe(listResult);
    expect(mockRepo.findAll).toHaveBeenCalledWith("org-1", { page: 1 });
  });
});

// ─────────────────────────────────────────────────────────────
// getCustomerPayment
// ─────────────────────────────────────────────────────────────

describe("CustomerPaymentService.getCustomerPayment", () => {
  it("returns payment with allocations when found", async () => {
    const payment = buildPayment();
    const allocations = [buildAllocation()];
    mockRepo.findById.mockResolvedValue(payment);
    mockRepo.findAllocations.mockResolvedValue(allocations);

    const result = await service.getCustomerPayment("pay-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("pay-1");
      expect(result.data.allocations).toBe(allocations);
    }
  });

  it("returns not_found when payment does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.getCustomerPayment("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// getAvailableCredit
// ─────────────────────────────────────────────────────────────

describe("CustomerPaymentService.getAvailableCredit", () => {
  it("delegates to the repository", async () => {
    mockRepo.getAvailableCredit.mockResolvedValue(750);

    const result = await service.getAvailableCredit("org-1", "cust-1");
    expect(result).toBe(750);
    expect(mockRepo.getAvailableCredit).toHaveBeenCalledWith("org-1", "cust-1");
  });
});

// ─────────────────────────────────────────────────────────────
// applyCredit
// ─────────────────────────────────────────────────────────────

describe("CustomerPaymentService.applyCredit", () => {
  it("fails with validation when amount is not positive", async () => {
    const result = await service.applyCredit(
      "org-1",
      "cust-1",
      "inv-1",
      0,
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls the RPC with the correct arguments and returns ok on success", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await service.applyCredit(
      "org-1",
      "cust-1",
      "inv-1",
      250,
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("apply_customer_credit", {
      p_org_id: "org-1",
      p_customer_id: "cust-1",
      p_invoice_id: "inv-1",
      p_amount: 250,
    });
  });

  it("maps not_found RPC errors to a friendly message", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "not_found: invoice" },
    });

    const result = await service.applyCredit(
      "org-1",
      "cust-1",
      "inv-1",
      250,
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
      expect(result.error.message).toBe("Invoice not found");
    }
  });

  it("maps validation RPC errors with the raw message", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "validation: amount exceeds the available credit" },
    });

    const result = await service.applyCredit(
      "org-1",
      "cust-1",
      "inv-1",
      9999,
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
      expect(result.error.message).toContain("available credit");
    }
  });

  it("maps invalid_status RPC errors with the raw message", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "invalid_status: only posted invoices can be settled with credit",
      },
    });

    const result = await service.applyCredit(
      "org-1",
      "cust-1",
      "inv-1",
      250,
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
      expect(result.error.message).toContain("posted");
    }
  });

  it("returns an unknown error for unrecognized RPC errors", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "internal server error" },
    });

    const result = await service.applyCredit(
      "org-1",
      "cust-1",
      "inv-1",
      250,
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
      expect(result.error.message).toBe(
        "Failed to apply credit. Please try again."
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────
// recordPayment
// ─────────────────────────────────────────────────────────────

describe("CustomerPaymentService.recordPayment", () => {
  const validInput = {
    customerId: "cust-1",
    amount: 1000,
    paymentMethod: "cash" as const,
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
        amount: 500,
        allocations: [
          { invoiceId: "inv-1", amount: 300 },
          { invoiceId: "inv-2", amount: 300 },
        ],
      },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
      expect(result.error.message).toContain("600");
    }
  });

  it("generates a payment number based on existing count and year", async () => {
    mockRepo.countByOrg.mockResolvedValue(5);
    mockRpc.mockResolvedValue({ data: "pay-new", error: null });
    mockRepo.findById.mockResolvedValue(buildPayment({ id: "pay-new" }));

    await service.recordPayment(validInput, "org-1", "user-1");

    expect(mockRpc).toHaveBeenCalledWith(
      "record_customer_payment",
      expect.objectContaining({
        p_payment_number: `PAY-${new Date().getFullYear()}-000006`,
      })
    );
  });

  it("calls the RPC with the correct arguments", async () => {
    mockRepo.countByOrg.mockResolvedValue(0);
    mockRpc.mockResolvedValue({ data: "pay-1", error: null });
    mockRepo.findById.mockResolvedValue(buildPayment());

    await service.recordPayment(
      {
        customerId: "cust-1",
        amount: 1500,
        paymentMethod: "upi",
        referenceNumber: "REF-001",
        paymentDate: "2026-06-27",
        notes: "First payment",
        allocations: [{ invoiceId: "inv-1", amount: 1500 }],
      },
      "org-1",
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "record_customer_payment",
      expect.objectContaining({
        p_org_id: "org-1",
        p_customer_id: "cust-1",
        p_amount: 1500,
        p_method: "upi",
        p_reference: "REF-001",
        p_payment_date: "2026-06-27",
        p_notes: "First payment",
        p_allocations: [{ invoice_id: "inv-1", amount: 1500 }],
      })
    );
  });

  it("returns the payment on success", async () => {
    mockRepo.countByOrg.mockResolvedValue(0);
    const created = buildPayment();
    mockRpc.mockResolvedValue({ data: "pay-1", error: null });
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
      error: { message: "not_found: customer" },
    });

    const result = await service.recordPayment(validInput, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("maps duplicate RPC errors correctly", async () => {
    mockRepo.countByOrg.mockResolvedValue(0);
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "duplicate key value" },
    });

    const result = await service.recordPayment(validInput, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate");
    }
  });

  it("returns unknown error for unrecognized RPC errors", async () => {
    mockRepo.countByOrg.mockResolvedValue(0);
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "internal server error" },
    });

    const result = await service.recordPayment(validInput, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("returns unknown when payment cannot be retrieved after recording", async () => {
    mockRepo.countByOrg.mockResolvedValue(0);
    mockRpc.mockResolvedValue({ data: "pay-1", error: null });
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.recordPayment(validInput, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});
