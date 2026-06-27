import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { RecordCustomerPaymentDialog } from "./record-customer-payment-dialog";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { recordActionMock } = vi.hoisted(() => ({
  recordActionMock: vi.fn(),
}));

vi.mock("@/features/payment/actions/customer-payment.actions", () => ({
  recordCustomerPaymentAction: recordActionMock,
}));

const outstandingInvoices = [
  {
    id: "inv-1",
    invoiceNumber: "INV-001",
    totalAmount: 1000,
    amountPaid: 0,
    outstandingAmount: 1000,
  },
];

function renderDialog(
  props: Partial<React.ComponentProps<typeof RecordCustomerPaymentDialog>> = {}
) {
  const onClose = vi.fn();
  const onDone = vi.fn();
  render(
    <RecordCustomerPaymentDialog
      organizationId="org-1"
      customerId="550e8400-e29b-41d4-a716-446655440001"
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
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("RecordCustomerPaymentDialog", () => {
  it("renders the dialog with the customer name and core fields", () => {
    renderDialog();

    expect(
      screen.getByRole("dialog", { name: /record customer payment/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.getByLabelText(/payment amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.click(screen.getByRole("button", { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a validation error when amount is missing or zero", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /record payment/i }));

    expect(
      await screen.findByText(/payment amount must be greater than 0/i)
    ).toBeInTheDocument();
    expect(recordActionMock).not.toHaveBeenCalled();
  });

  it("blocks submission and shows an error when allocations exceed the amount", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/payment amount/i), "100");
    await user.click(screen.getByRole("button", { name: /add invoice/i }));
    await user.type(
      screen.getByLabelText(/amount for allocation 1/i),
      "200"
    );

    await user.click(screen.getByRole("button", { name: /record payment/i }));

    expect(
      await screen.findByText(/exceeds payment amount/i)
    ).toBeInTheDocument();
    expect(recordActionMock).not.toHaveBeenCalled();
  });

  it("adds and removes allocation rows", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /add invoice/i }));
    expect(
      screen.getByLabelText(/invoice id for allocation 1/i)
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /remove allocation 1/i })
    );
    expect(
      screen.queryByLabelText(/invoice id for allocation 1/i)
    ).not.toBeInTheDocument();
  });

  it("renders a select when outstanding invoices are provided", async () => {
    const user = userEvent.setup();
    renderDialog({ outstandingInvoices });

    await user.click(screen.getByRole("button", { name: /add invoice/i }));
    expect(
      screen.getByLabelText(/invoice for allocation 1/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/INV-001/)).toBeInTheDocument();
  });

  it("submits the action with the correct payload and calls onDone on success", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({ success: true, data: { id: "pay-1" } });
    const { onDone } = renderDialog();

    await user.type(screen.getByLabelText(/payment amount/i), "1500");
    await user.type(screen.getByLabelText(/reference number/i), " UTR-1 ");
    await user.click(screen.getByRole("button", { name: /add invoice/i }));
    await user.type(
      screen.getByLabelText(/invoice id for allocation 1/i),
      "550e8400-e29b-41d4-a716-446655440099"
    );
    await user.type(screen.getByLabelText(/amount for allocation 1/i), "400");

    await user.click(screen.getByRole("button", { name: /record payment/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(recordActionMock).toHaveBeenCalledTimes(1);
    const [orgId, formData] = recordActionMock.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(formData.get("customerId")).toBe(
      "550e8400-e29b-41d4-a716-446655440001"
    );
    expect(formData.get("amount")).toBe("1500");
    expect(formData.get("paymentMethod")).toBe("bank_transfer");
    expect(formData.get("referenceNumber")).toBe("UTR-1");
    expect(
      JSON.parse(formData.get("allocations") as string)
    ).toEqual([
      { invoiceId: "550e8400-e29b-41d4-a716-446655440099", amount: 400 },
    ]);
  });

  it("displays the server error message when the action fails", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({
      success: false,
      error: { code: "not_found", message: "Customer not found" },
    });
    const { onDone } = renderDialog();

    await user.type(screen.getByLabelText(/payment amount/i), "500");
    await user.click(screen.getByRole("button", { name: /record payment/i }));

    expect(await screen.findByText("Customer not found")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
