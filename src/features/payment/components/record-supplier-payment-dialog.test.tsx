import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { RecordSupplierPaymentDialog } from "./record-supplier-payment-dialog";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { recordActionMock, outstandingActionMock } = vi.hoisted(() => ({
  recordActionMock: vi.fn(),
  outstandingActionMock: vi.fn(),
}));

vi.mock("@/features/payment/actions/supplier-payment.actions", () => ({
  recordSupplierPaymentAction: recordActionMock,
  getOutstandingSupplierBillsAction: outstandingActionMock,
}));

const SUPPLIER_ID = "550e8400-e29b-41d4-a716-446655440001";
const BILL_ONE = "550e8400-e29b-41d4-a716-446655440099";
const BILL_TWO = "550e8400-e29b-41d4-a716-4466554400aa";

const outstandingInvoices = [
  {
    id: BILL_ONE,
    invoiceNumber: "PINV-001",
    invoiceDate: "2026-06-01",
    totalAmount: 1000,
    amountPaid: 0,
    outstandingAmount: 1000,
  },
  {
    id: BILL_TWO,
    invoiceNumber: "PINV-002",
    invoiceDate: "2026-06-05",
    totalAmount: 2000,
    amountPaid: 200,
    outstandingAmount: 1800,
  },
];

const suppliers = [{ id: SUPPLIER_ID, name: "Globex Supplies" }];

function renderDialog(
  props: Partial<React.ComponentProps<typeof RecordSupplierPaymentDialog>> = {}
) {
  const onClose = vi.fn();
  const onDone = vi.fn();
  render(
    <RecordSupplierPaymentDialog
      organizationId="org-1"
      supplierId={SUPPLIER_ID}
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
  outstandingActionMock.mockResolvedValue({
    success: true,
    data: outstandingInvoices,
  });
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("RecordSupplierPaymentDialog", () => {
  it("renders the dialog with the supplier name and core fields", async () => {
    renderDialog();

    expect(
      screen.getByRole("dialog", { name: /record supplier payment/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Globex Supplies")).toBeInTheDocument();
    expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(outstandingActionMock).toHaveBeenCalledWith("org-1", SUPPLIER_ID)
    );
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.click(screen.getByRole("button", { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a party picker and loads outstanding bills on selection", async () => {
    const user = userEvent.setup();
    renderDialog({ supplierId: "", supplierName: "Select Supplier", suppliers });

    expect(outstandingActionMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(/select a supplier to see their outstanding/i)
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/^supplier/i),
      SUPPLIER_ID
    );

    await waitFor(() =>
      expect(outstandingActionMock).toHaveBeenCalledWith("org-1", SUPPLIER_ID)
    );
    expect(await screen.findByText("PINV-001")).toBeInTheDocument();
    expect(screen.getByText("PINV-002")).toBeInTheDocument();
  });

  it("shows an empty message when there are no outstanding bills", async () => {
    outstandingActionMock.mockResolvedValue({ success: true, data: [] });
    renderDialog();

    expect(
      await screen.findByText(/no outstanding bills for this supplier/i)
    ).toBeInTheDocument();
  });

  it("sums the checked bills and submits one allocation per checked row", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({ success: true, data: { id: "pay-1" } });
    const { onDone } = renderDialog();

    const rowOne = await screen.findByRole("checkbox", {
      name: /select bill PINV-001/i,
    });
    const rowTwo = screen.getByRole("checkbox", {
      name: /select bill PINV-002/i,
    });

    expect(
      screen.getByRole("button", { name: /make payment/i })
    ).toBeDisabled();

    await user.click(rowOne);
    await user.click(rowTwo);

    await user.click(screen.getByRole("button", { name: /make payment/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(recordActionMock).toHaveBeenCalledTimes(1);
    const [orgId, formData] = recordActionMock.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(formData.get("supplierId")).toBe(SUPPLIER_ID);
    // amount = 1000 + 1800
    expect(formData.get("amount")).toBe("2800");
    expect(formData.get("paymentMethod")).toBe("bank_transfer");
    expect(JSON.parse(formData.get("allocations") as string)).toEqual([
      { purchaseInvoiceId: BILL_ONE, amount: 1000 },
      { purchaseInvoiceId: BILL_TWO, amount: 1800 },
    ]);
  });

  it("uses the override list and pre-checks the given bill ids", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({ success: true, data: { id: "pay-1" } });
    const { onDone } = renderDialog({
      outstandingInvoices,
      preselectedInvoiceIds: [BILL_TWO],
    });

    expect(outstandingActionMock).not.toHaveBeenCalled();

    const rowTwo = await screen.findByRole("checkbox", {
      name: /select bill PINV-002/i,
    });
    expect(rowTwo).toBeChecked();

    await user.click(screen.getByRole("button", { name: /make payment/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [, formData] = recordActionMock.mock.calls[0] as [string, FormData];
    expect(formData.get("amount")).toBe("1800");
    expect(JSON.parse(formData.get("allocations") as string)).toEqual([
      { purchaseInvoiceId: BILL_TWO, amount: 1800 },
    ]);
  });

  it("displays the server error message when the action fails", async () => {
    const user = userEvent.setup();
    recordActionMock.mockResolvedValue({
      success: false,
      error: { code: "not_found", message: "Supplier not found" },
    });
    const { onDone } = renderDialog();

    const rowOne = await screen.findByRole("checkbox", {
      name: /select bill PINV-001/i,
    });
    await user.click(rowOne);
    await user.click(screen.getByRole("button", { name: /make payment/i }));

    expect(await screen.findByText("Supplier not found")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
