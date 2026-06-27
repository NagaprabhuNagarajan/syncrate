import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { SupplierPayment } from "@/features/payment/types/payment.types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  recordSupplierPaymentAction,
  listSupplierPaymentsAction,
} from "./supplier-payment.actions";

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
    listSupplierPayments: vi.fn(),
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

vi.mock("@/features/payment/services/supplier-payment.service", () => ({
  SupplierPaymentService: vi.fn(() => mockPaymentService),
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

function buildPayment(overrides: Partial<SupplierPayment> = {}): SupplierPayment {
  return {
    id: "pay-1",
    organizationId: "org-1",
    paymentNumber: "SPAY-2026-000001",
    supplierId: "550e8400-e29b-41d4-a716-446655440001",
    paymentDate: "2026-06-27",
    amount: 2500,
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

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// recordSupplierPaymentAction
// ─────────────────────────────────────────────────────────────

describe("recordSupplierPaymentAction", () => {
  const validFormData = fd({
    supplierId: "550e8400-e29b-41d4-a716-446655440001",
    amount: "2500",
    paymentMethod: "bank_transfer",
    allocations: "[]",
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await recordSupplierPaymentAction("org-1", validFormData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns forbidden when the user lacks the payment.make permission", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["supplier.view"])
    );

    const result = await recordSupplierPaymentAction("org-1", validFormData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns forbidden when the user has no org context", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await recordSupplierPaymentAction("org-1", validFormData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns validation error for invalid form data", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["payment.make"])
    );

    const result = await recordSupplierPaymentAction(
      "org-1",
      fd({ supplierId: "not-a-uuid", amount: "2500", paymentMethod: "cash" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("returns validation error for malformed allocations JSON", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["payment.make"])
    );

    const result = await recordSupplierPaymentAction(
      "org-1",
      fd({
        supplierId: "550e8400-e29b-41d4-a716-446655440001",
        amount: "2500",
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
      contextWith(["payment.make"])
    );
    const payment = buildPayment();
    mockPaymentService.recordPayment.mockResolvedValue({
      success: true,
      data: payment,
    });

    const result = await recordSupplierPaymentAction("org-1", validFormData);
    expect(result.success).toBe(true);
    expect(revalidateMock).toHaveBeenCalledWith("/payments");
    expect(revalidateMock).toHaveBeenCalledWith("/suppliers");
    expect(revalidateMock).toHaveBeenCalledWith("/dashboard");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payment.make",
        entityType: "supplier_payment",
        entityId: "pay-1",
      })
    );
  });

  it("does not revalidate or audit when service returns an error", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["payment.make"])
    );
    mockPaymentService.recordPayment.mockResolvedValue({
      success: false,
      error: { code: "not_found", message: "Supplier not found" },
    });

    const result = await recordSupplierPaymentAction("org-1", validFormData);
    expect(result.success).toBe(false);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// listSupplierPaymentsAction
// ─────────────────────────────────────────────────────────────

describe("listSupplierPaymentsAction", () => {
  it("delegates to the service and returns the result", async () => {
    const listResult = {
      payments: [buildPayment()],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockPaymentService.listSupplierPayments.mockResolvedValue(listResult);

    const result = await listSupplierPaymentsAction("org-1");
    expect(result).toBe(listResult);
    expect(mockPaymentService.listSupplierPayments).toHaveBeenCalledWith(
      "org-1"
    );
  });
});
