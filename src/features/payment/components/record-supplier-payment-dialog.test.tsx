import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { RecordSupplierPaymentDialog } from "./record-supplier-payment-dialog";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { recordActionMock } = vi.hoisted(() => ({
  recordActionMock: vi.fn(),
}));

vi.mock("@/features/payment/actions/supplier-payment.actions", () => ({
  recordSupplierPaymentAction: recordActionMock,
}));

const outstandingInvoices = [
  {
    id: "pinv-1",
    invoiceNumber: "PINV-001",
    totalAmount: 1000,
    amountPaid: 0,
    outstandingAmount: 1000,
  },
];

function renderDialog(
  props: Partial<React.ComponentProps<typeof RecordSupplierPaymentDialog>> = {}
) {
  const onClose = vi.fn();
  const onDone = vi.fn();
  render(
    <RecordSupplierPaymentDialog
      organizationId="org-1"
      supplierId="550e8400-e29b-41d4-a716-446655440001"
      supplierName="Globex Supplies"
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

describe("RecordSupplierPaymentDialog", () => {
  it("renders the dialog with the supplier name and core fields", () => {
    renderDialog();

    expect(
      screen.getByRole("dialog", { name: /record supplier payment/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Globex Supplies")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /make payment/i }));

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

    await user.click(screen.getByRole("button", { name: /make payment/i }));

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
      screen.getByLabelText(/purchase invoice id for allocation 1/i)
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /remove allocation 1/i })
    );
    expect(
      screen.queryByLabelText(/purchase invoice id for allocation 1/i)
    ).not.toBeInTheDocument();
  });

  it("renders a select when outstanding purchase invoices are provided", async () => {
    const user = userEvent.setup();
    renderDialog({ outstandingInvoices });

    await user.click(screen.getByRole("button", { name: /add invoice/i }));
    expect(
      screen.getByLabelText(/purchase invoice for allocation 1/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/PINV-001/)).toBeInTheDocument();
  });

  it("submits the action with the correct payload and calls onDone on success", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({ success: true, data: { id: "pay-1" } });
    const { onDone } = renderDialog();

    await user.type(screen.getByLabelText(/payment amount/i), "2500");
    await user.click(screen.getByRole("button", { name: /add invoice/i }));
    await user.type(
      screen.getByLabelText(/purchase invoice id for allocation 1/i),
      "550e8400-e29b-41d4-a716-446655440099"
    );
    await user.type(screen.getByLabelText(/amount for allocation 1/i), "800");

    await user.click(screen.getByRole("button", { name: /make payment/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(recordActionMock).toHaveBeenCalledTimes(1);
    const [orgId, formData] = recordActionMock.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(formData.get("supplierId")).toBe(
      "550e8400-e29b-41d4-a716-446655440001"
    );
    expect(formData.get("amount")).toBe("2500");
    expect(formData.get("paymentMethod")).toBe("bank_transfer");
    expect(
      JSON.parse(formData.get("allocations") as string)
    ).toEqual([
      {
        purchaseInvoiceId: "550e8400-e29b-41d4-a716-446655440099",
        amount: 800,
      },
    ]);
  });

  it("displays the server error message when the action fails", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({
      success: false,
      error: { code: "not_found", message: "Supplier not found" },
    });
    const { onDone } = renderDialog();

    await user.type(screen.getByLabelText(/payment amount/i), "500");
    await user.click(screen.getByRole("button", { name: /make payment/i }));

    expect(await screen.findByText("Supplier not found")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
