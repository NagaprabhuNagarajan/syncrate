import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { RecordCustomerPaymentDialog } from "./record-customer-payment-dialog";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { recordActionMock, outstandingActionMock } = vi.hoisted(() => ({
  recordActionMock: vi.fn(),
  outstandingActionMock: vi.fn(),
}));

vi.mock("@/features/payment/actions/customer-payment.actions", () => ({
  recordCustomerPaymentAction: recordActionMock,
  getOutstandingCustomerInvoicesAction: outstandingActionMock,
}));

const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440001";
const INVOICE_ONE = "550e8400-e29b-41d4-a716-446655440099";
const INVOICE_TWO = "550e8400-e29b-41d4-a716-4466554400aa";

const outstandingInvoices = [
  {
    id: INVOICE_ONE,
    invoiceNumber: "INV-001",
    invoiceDate: "2026-06-01",
    totalAmount: 1000,
    amountPaid: 0,
    outstandingAmount: 1000,
  },
  {
    id: INVOICE_TWO,
    invoiceNumber: "INV-002",
    invoiceDate: "2026-06-05",
    totalAmount: 700,
    amountPaid: 200,
    outstandingAmount: 500,
  },
];

const customers = [{ id: CUSTOMER_ID, name: "Acme Traders" }];

function renderDialog(
  props: Partial<React.ComponentProps<typeof RecordCustomerPaymentDialog>> = {}
) {
  const onClose = vi.fn();
  const onDone = vi.fn();
  render(
    <RecordCustomerPaymentDialog
      organizationId="org-1"
      customerId={CUSTOMER_ID}
      customerName="Acme Traders"
      onClose={onClose}
      onDone={onDone}
      {...props}
    />
  );
  return { onClose, onDone };
}

beforeEach(() => {
  vi.clearAllMocks();
  outstandingActionMock.mockResolvedValue({
    success: true,
    data: outstandingInvoices,
  });
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("RecordCustomerPaymentDialog", () => {
  it("renders the dialog with the customer name and core fields", async () => {
    renderDialog();

    expect(
      screen.getByRole("dialog", { name: /record customer payment/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument();
    // Pre-seeded party fetches its outstanding invoices on mount.
    await waitFor(() =>
      expect(outstandingActionMock).toHaveBeenCalledWith("org-1", CUSTOMER_ID)
    );
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.click(screen.getByRole("button", { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a party picker and loads outstanding invoices on selection", async () => {
    const user = userEvent.setup();
    renderDialog({ customerId: "", customerName: "Select Customer", customers });

    // No fetch until a customer is chosen.
    expect(outstandingActionMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(/select a customer to see their outstanding/i)
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/^customer/i),
      CUSTOMER_ID
    );

    await waitFor(() =>
      expect(outstandingActionMock).toHaveBeenCalledWith("org-1", CUSTOMER_ID)
    );
    expect(await screen.findByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("INV-002")).toBeInTheDocument();
  });

  it("shows an empty message when there are no outstanding invoices", async () => {
    outstandingActionMock.mockResolvedValue({ success: true, data: [] });
    renderDialog();

    expect(
      await screen.findByText(/no outstanding invoices for this customer/i)
    ).toBeInTheDocument();
  });

  it("sums the checked invoices and submits one allocation per checked row", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({ success: true, data: { id: "pay-1" } });
    const { onDone } = renderDialog();

    // Wait for the outstanding list.
    const rowOne = await screen.findByRole("checkbox", {
      name: /select invoice INV-001/i,
    });
    const rowTwo = screen.getByRole("checkbox", {
      name: /select invoice INV-002/i,
    });

    // Submit is disabled until at least one row is checked.
    expect(
      screen.getByRole("button", { name: /record payment/i })
    ).toBeDisabled();

    await user.click(rowOne);
    await user.click(rowTwo);
    await user.type(screen.getByLabelText(/reference number/i), " UTR-1 ");

    await user.click(screen.getByRole("button", { name: /record payment/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(recordActionMock).toHaveBeenCalledTimes(1);
    const [orgId, formData] = recordActionMock.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(formData.get("customerId")).toBe(CUSTOMER_ID);
    // amount = 1000 + 500
    expect(formData.get("amount")).toBe("1500");
    expect(formData.get("paymentMethod")).toBe("bank_transfer");
    expect(formData.get("referenceNumber")).toBe("UTR-1");
    expect(JSON.parse(formData.get("allocations") as string)).toEqual([
      { invoiceId: INVOICE_ONE, amount: 1000 },
      { invoiceId: INVOICE_TWO, amount: 500 },
    ]);
  });

  it("allows overpayment — the excess beyond outstanding stays unallocated", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({ success: true, data: { id: "pay-1" } });
    const { onDone } = renderDialog();

    const rowOne = await screen.findByRole("checkbox", {
      name: /select invoice INV-001/i,
    });
    const rowTwo = screen.getByRole("checkbox", {
      name: /select invoice INV-002/i,
    });
    await user.click(rowOne);
    await user.click(rowTwo);

    // Bump the amount above the 1500 selected total.
    const amount = screen.getByLabelText(/amount received/i);
    await user.clear(amount);
    await user.type(amount, "2000");

    await user.click(screen.getByRole("button", { name: /record payment/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());

    const [, formData] = recordActionMock.mock.calls[0] as [string, FormData];
    expect(formData.get("amount")).toBe("2000");
    // Each invoice is capped at its outstanding; the extra 500 is unallocated.
    expect(JSON.parse(formData.get("allocations") as string)).toEqual([
      { invoiceId: INVOICE_ONE, amount: 1000 },
      { invoiceId: INVOICE_TWO, amount: 500 },
    ]);
  });

  it("records a pure advance with no invoices selected", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({ success: true, data: { id: "pay-1" } });
    const { onDone } = renderDialog();

    // Party is pre-seeded and the list has loaded — the amount box is shown.
    const amount = await screen.findByLabelText(/amount received/i);
    await user.clear(amount);
    await user.type(amount, "300");

    await user.click(screen.getByRole("button", { name: /record payment/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());

    const [, formData] = recordActionMock.mock.calls[0] as [string, FormData];
    expect(formData.get("amount")).toBe("300");
    expect(JSON.parse(formData.get("allocations") as string)).toEqual([]);
  });

  it("uses the override list and pre-checks the given invoice ids", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({ success: true, data: { id: "pay-1" } });
    const { onDone } = renderDialog({
      outstandingInvoices,
      preselectedInvoiceIds: [INVOICE_ONE],
    });

    // Override means no fetch.
    expect(outstandingActionMock).not.toHaveBeenCalled();

    const rowOne = await screen.findByRole("checkbox", {
      name: /select invoice INV-001/i,
    });
    expect(rowOne).toBeChecked();

    await user.click(screen.getByRole("button", { name: /record payment/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [, formData] = recordActionMock.mock.calls[0] as [string, FormData];
    expect(formData.get("amount")).toBe("1000");
    expect(JSON.parse(formData.get("allocations") as string)).toEqual([
      { invoiceId: INVOICE_ONE, amount: 1000 },
    ]);
  });

  it("displays the server error message when the action fails", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({
      success: false,
      error: { code: "not_found", message: "Customer not found" },
    });
    const { onDone } = renderDialog();

    const rowOne = await screen.findByRole("checkbox", {
      name: /select invoice INV-001/i,
    });
    await user.click(rowOne);
    await user.click(screen.getByRole("button", { name: /record payment/i }));

    expect(await screen.findByText("Customer not found")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
