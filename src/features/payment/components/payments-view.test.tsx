import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/tests/utils";
import { PaymentsView } from "./payments-view";
import type {
  CustomerPayment,
  CustomerPaymentListResult,
  PaymentStats,
  SupplierPayment,
  SupplierPaymentListResult,
} from "@/features/payment/types/payment.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
}));

vi.mock("@/features/payment/actions/customer-payment.actions", () => ({
  recordCustomerPaymentAction: vi.fn(),
  getOutstandingCustomerInvoicesAction: vi
    .fn()
    .mockResolvedValue({ success: true, data: [] }),
}));

vi.mock("@/features/payment/actions/supplier-payment.actions", () => ({
  recordSupplierPaymentAction: vi.fn(),
  getOutstandingSupplierBillsAction: vi
    .fn()
    .mockResolvedValue({ success: true, data: [] }),
}));

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeCustomerPayment(
  overrides: Partial<CustomerPayment> = {}
): CustomerPayment {
  return {
    id: "cpay-1",
    organizationId: "org-1",
    paymentNumber: "PAY-2026-000001",
    customerId: "cust-1",
    customerName: "Acme Traders",
    paymentDate: "2026-06-01",
    amount: 1500,
    paymentMethod: "upi",
    referenceNumber: "UTR-1",
    notes: null,
    status: "completed",
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
    createdBy: "user-1",
    ...overrides,
  };
}

function makeSupplierPayment(
  overrides: Partial<SupplierPayment> = {}
): SupplierPayment {
  return {
    id: "spay-1",
    organizationId: "org-1",
    paymentNumber: "SPAY-2026-000001",
    supplierId: "sup-1",
    supplierName: "Globex Supplies",
    paymentDate: "2026-06-02",
    amount: 2500,
    paymentMethod: "bank_transfer",
    referenceNumber: null,
    notes: null,
    status: "voided",
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    createdAt: "2026-06-02T00:00:00Z",
    updatedAt: "2026-06-02T00:00:00Z",
    createdBy: "user-1",
    ...overrides,
  };
}

function customerResult(
  overrides: Partial<CustomerPaymentListResult> = {}
): CustomerPaymentListResult {
  return {
    payments: [makeCustomerPayment()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

function supplierResult(
  overrides: Partial<SupplierPaymentListResult> = {}
): SupplierPaymentListResult {
  return {
    payments: [makeSupplierPayment()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

function makeStats(overrides: Partial<PaymentStats> = {}): PaymentStats {
  return {
    total: 1,
    completed: 1,
    voided: 0,
    totalAmount: 1500,
    thisMonth: 1500,
    ...overrides,
  };
}

function renderView(
  customer: CustomerPaymentListResult = customerResult(),
  supplier: SupplierPaymentListResult = supplierResult()
) {
  render(
    <PaymentsView
      organizationId="org-1"
      customerPayments={customer}
      supplierPayments={supplier}
      customerStats={makeStats()}
      supplierStats={makeStats({ completed: 0, voided: 1 })}
      customers={[{ id: "cust-1", name: "Acme Traders" }]}
      suppliers={[{ id: "sup-1", name: "Globex Supplies" }]}
      customerFilters={{}}
      supplierFilters={{}}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("PaymentsView", () => {
  it("renders the header, tabs and the customer payments table by default", () => {
    renderView();

    expect(
      screen.getByRole("heading", { name: /payments/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /customer payments/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /supplier payments/i })
    ).toBeInTheDocument();
    expect(screen.getByText("PAY-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    // "Completed" also appears as a status filter pill, so scope to the table.
    expect(
      within(screen.getByRole("table")).getByText("Completed")
    ).toBeInTheDocument();
  });

  it("renders the customer empty state when there are no customer payments", () => {
    renderView(customerResult({ payments: [], total: 0 }));
    expect(
      screen.getByText(/no customer payments yet/i)
    ).toBeInTheDocument();
  });

  it("switches to the supplier tab and shows supplier payments", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("tab", { name: /supplier payments/i }));

    expect(screen.getByText("SPAY-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Globex Supplies")).toBeInTheDocument();
    // "Voided" also appears as a status filter pill, so scope to the table.
    expect(
      within(screen.getByRole("table")).getByText("Voided")
    ).toBeInTheDocument();
  });

  it("renders the supplier empty state when there are no supplier payments", async () => {
    const user = userEvent.setup();
    renderView(customerResult(), supplierResult({ payments: [], total: 0 }));

    await user.click(screen.getByRole("tab", { name: /supplier payments/i }));
    expect(
      screen.getByText(/no supplier payments yet/i)
    ).toBeInTheDocument();
  });

  it("pushes a search query for customer payments", async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(
      screen.getByLabelText(/search customer payments/i),
      "PAY-1{Enter}"
    );

    expect(mockPush).toHaveBeenCalledWith("?cSearch=PAY-1");
  });

  it("pushes a search query for supplier payments", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("tab", { name: /supplier payments/i }));
    await user.type(
      screen.getByLabelText(/search supplier payments/i),
      "SPAY-1{Enter}"
    );

    expect(mockPush).toHaveBeenCalledWith("?sSearch=SPAY-1");
  });

  it("paginates the customer payments to the next page", async () => {
    const user = userEvent.setup();
    renderView(
      customerResult({
        payments: [
          makeCustomerPayment({ id: "cpay-1" }),
          makeCustomerPayment({ id: "cpay-2" }),
        ],
        total: 45,
      })
    );

    expect(
      screen.getByRole("button", { name: /previous page/i })
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(mockPush).toHaveBeenCalledWith("?cPage=2");
  });

  it("opens the record customer payment dialog", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: /record payment/i }));
    expect(
      screen.getByRole("dialog", { name: /record customer payment/i })
    ).toBeInTheDocument();
  });

  it("opens the make supplier payment dialog", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("tab", { name: /supplier payments/i }));
    await user.click(screen.getByRole("button", { name: /make payment/i }));
    expect(
      screen.getByRole("dialog", { name: /record supplier payment/i })
    ).toBeInTheDocument();
  });

  it("falls back to the customer id when no customer name is present", () => {
    renderView(
      customerResult({
        payments: [
          makeCustomerPayment({ customerName: undefined, customerId: "cust-x" }),
        ],
      })
    );
    expect(screen.getByText("cust-x")).toBeInTheDocument();
  });
});
