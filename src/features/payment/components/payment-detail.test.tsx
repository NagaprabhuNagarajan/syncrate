import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/tests/utils";
import { PaymentDetail } from "./payment-detail";
import type { PaymentWithAllocations } from "@/features/payment/types/payment.types";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

function makePayment(
  overrides: Partial<PaymentWithAllocations> = {}
): PaymentWithAllocations {
  return {
    id: "pay-1",
    organizationId: "org-1",
    paymentNumber: "PAY-2026-000001",
    customerId: "cust-1",
    customerName: "Acme Retail",
    paymentDate: "2026-06-01",
    amount: 1000,
    paymentMethod: "bank_transfer",
    referenceNumber: "TXN-9988",
    notes: "Advance settlement",
    status: "completed",
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    createdBy: "user-1",
    allocations: [
      {
        id: "alloc-1",
        organizationId: "org-1",
        customerPaymentId: "pay-1",
        invoiceId: "inv-1",
        allocatedAmount: 600,
        createdAt: "2026-06-01T10:00:00.000Z",
        createdBy: "user-1",
      },
      {
        id: "alloc-2",
        organizationId: "org-1",
        customerPaymentId: "pay-1",
        invoiceId: "inv-2",
        allocatedAmount: 400,
        createdAt: "2026-06-01T10:00:00.000Z",
        createdBy: "user-1",
      },
    ],
    ...overrides,
  };
}

describe("PaymentDetail", () => {
  it("renders the payment number, party name and amount", () => {
    render(<PaymentDetail payment={makePayment()} />);
    expect(screen.getByText("PAY-2026-000001")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Retail").length).toBeGreaterThan(0);
    // Amount appears in the KPI strip.
    expect(screen.getAllByText("₹1,000.00").length).toBeGreaterThan(0);
  });

  it("falls back to the customer id when no name is present", () => {
    render(
      <PaymentDetail payment={makePayment({ customerName: undefined })} />
    );
    expect(screen.getAllByText("cust-1").length).toBeGreaterThan(0);
  });

  it("shows the status badge and payment method", () => {
    render(<PaymentDetail payment={makePayment()} />);
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bank Transfer").length).toBeGreaterThan(0);
  });

  it("renders the KPI strip labels", () => {
    render(<PaymentDetail payment={makePayment()} />);
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Method")).toBeInTheDocument();
    expect(screen.getAllByText("Unallocated").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Payment date").length).toBeGreaterThan(0);
  });

  it("lists invoice allocations linking to each invoice", () => {
    render(<PaymentDetail payment={makePayment()} />);
    const first = screen.getByRole("link", { name: "inv-1" });
    expect(first).toHaveAttribute("href", "/invoices/inv-1");
    expect(screen.getByRole("link", { name: "inv-2" })).toBeInTheDocument();
    // Total allocated (600 + 400).
    expect(screen.getAllByText("₹1,000.00").length).toBeGreaterThan(0);
  });

  it("shows an empty message when there are no allocations", () => {
    render(<PaymentDetail payment={makePayment({ allocations: [] })} />);
    expect(
      screen.getByText(/not been allocated to any invoices/i)
    ).toBeInTheDocument();
  });

  it("renders void metadata for a voided payment", () => {
    render(
      <PaymentDetail
        payment={makePayment({
          status: "voided",
          voidedAt: "2026-06-05T09:00:00.000Z",
          voidReason: "Duplicate entry",
        })}
      />
    );
    expect(screen.getAllByText("Voided").length).toBeGreaterThan(0);
    const timeline = screen
      .getByText("Timeline")
      .closest("div") as HTMLElement;
    expect(within(timeline).getByText("Duplicate entry")).toBeInTheDocument();
  });

  it("hides void metadata for a completed payment", () => {
    render(<PaymentDetail payment={makePayment()} />);
    expect(screen.queryByText("Void reason")).not.toBeInTheDocument();
  });
});
