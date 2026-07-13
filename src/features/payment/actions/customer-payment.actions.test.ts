import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { CustomerPayment } from "@/features/payment/types/payment.types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  recordCustomerPaymentAction,
  listCustomerPaymentsAction,
  applyCustomerCreditAction,
} from "./customer-payment.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const {
  mockPaymentService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockPaymentService: {
    recordPayment: vi.fn(),
    listCustomerPayments: vi.fn(),
    applyCredit: vi.fn(),
  },
  mockOrgService: {
    getOrganizationContext: vi.fn(),
  },
  revalidateMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  auditLogMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidateMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createClientMock,
}));

vi.mock("@/features/payment/services/customer-payment.service", () => ({
  CustomerPaymentService: vi.fn(() => mockPaymentService),
}));

vi.mock("@/features/organization/services/organization.service", () => ({
  OrganizationService: vi.fn(() => mockOrgService),
}));

vi.mock("@/features/audit/services/audit.service", () => ({
  AuditService: vi.fn(() => ({ log: auditLogMock })),
}));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }
  return form;
}

const fakeSupabase = {
  auth: { getUser: getUserMock },
} as unknown as AppSupabaseClient;

function authedAs(userId: string): void {
  getUserMock.mockResolvedValue({ data: { user: { id: userId } } });
}

function unauthenticated(): void {
  getUserMock.mockResolvedValue({ data: { user: null } });
}

function contextWith(permissions: readonly string[]): OrganizationContext {
  return { permissions } as unknown as OrganizationContext;
}

function buildPayment(overrides: Partial<CustomerPayment> = {}): CustomerPayment {
  return {
    id: "pay-1",
    organizationId: "org-1",
    paymentNumber: "PAY-2026-000001",
    customerId: "550e8400-e29b-41d4-a716-446655440001",
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

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// recordCustomerPaymentAction
// ─────────────────────────────────────────────────────────────

describe("recordCustomerPaymentAction", () => {
  const validFormData = fd({
    customerId: "550e8400-e29b-41d4-a716-446655440001",
    amount: "1000",
    paymentMethod: "cash",
    allocations: "[]",
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await recordCustomerPaymentAction("org-1", validFormData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns forbidden when the user lacks the payment.receive permission", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.view"])
    );

    const result = await recordCustomerPaymentAction("org-1", validFormData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns forbidden when the user has no org context", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await recordCustomerPaymentAction("org-1", validFormData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns validation error for invalid form data", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["payment.receive"])
    );

    const result = await recordCustomerPaymentAction(
      "org-1",
      fd({ customerId: "not-a-uuid", amount: "1000", paymentMethod: "cash" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("returns validation error for malformed allocations JSON", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["payment.receive"])
    );

    const result = await recordCustomerPaymentAction(
      "org-1",
      fd({
        customerId: "550e8400-e29b-41d4-a716-446655440001",
        amount: "1000",
        paymentMethod: "cash",
        allocations: "not-json",
      })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("calls the service and revalidates paths on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["payment.receive"])
    );
    const payment = buildPayment();
    mockPaymentService.recordPayment.mockResolvedValue({
      success: true,
      data: payment,
    });

    const result = await recordCustomerPaymentAction("org-1", validFormData);
    expect(result.success).toBe(true);
    expect(revalidateMock).toHaveBeenCalledWith("/payments");
    expect(revalidateMock).toHaveBeenCalledWith("/customers");
    expect(revalidateMock).toHaveBeenCalledWith("/dashboard");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payment.receive",
        entityType: "customer_payment",
        entityId: "pay-1",
      })
    );
  });

  it("does not revalidate or audit when service returns an error", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["payment.receive"])
    );
    mockPaymentService.recordPayment.mockResolvedValue({
      success: false,
      error: { code: "not_found", message: "Customer not found" },
    });

    const result = await recordCustomerPaymentAction("org-1", validFormData);
    expect(result.success).toBe(false);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// applyCustomerCreditAction
// ─────────────────────────────────────────────────────────────

describe("applyCustomerCreditAction", () => {
  const creditForm = fd({
    customerId: "550e8400-e29b-41d4-a716-446655440001",
    invoiceId: "inv-1",
    amount: "250",
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await applyCustomerCreditAction("org-1", creditForm);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns validation for a non-positive amount", async () => {
    const result = await applyCustomerCreditAction(
      "org-1",
      fd({
        customerId: "550e8400-e29b-41d4-a716-446655440001",
        invoiceId: "inv-1",
        amount: "0",
      })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("calls the service, revalidates and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["payment.receive"])
    );
    mockPaymentService.applyCredit.mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await applyCustomerCreditAction("org-1", creditForm);
    expect(result.success).toBe(true);
    expect(mockPaymentService.applyCredit).toHaveBeenCalledWith(
      "org-1",
      "550e8400-e29b-41d4-a716-446655440001",
      "inv-1",
      250,
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/invoices/inv-1");
    expect(revalidateMock).toHaveBeenCalledWith("/customers");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer_credit.apply",
        entityType: "invoice",
        entityId: "inv-1",
      })
    );
  });

  it("does not revalidate or audit when the service returns an error", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["payment.receive"])
    );
    mockPaymentService.applyCredit.mockResolvedValue({
      success: false,
      error: { code: "validation", message: "amount exceeds credit" },
    });

    const result = await applyCustomerCreditAction("org-1", creditForm);
    expect(result.success).toBe(false);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// listCustomerPaymentsAction
// ─────────────────────────────────────────────────────────────

describe("listCustomerPaymentsAction", () => {
  it("delegates to the service and returns the result", async () => {
    const listResult = {
      payments: [buildPayment()],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockPaymentService.listCustomerPayments.mockResolvedValue(listResult);

    const result = await listCustomerPaymentsAction("org-1");
    expect(result).toBe(listResult);
    expect(mockPaymentService.listCustomerPayments).toHaveBeenCalledWith("org-1");
  });
});
