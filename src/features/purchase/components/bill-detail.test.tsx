import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@/tests/utils";
import { BillDetail } from "./bill-detail";
import type {
  BillStatus,
  BillWithItems,
} from "@/features/purchase/types/bill.types";

const { mockRefresh, postMock, cancelMock, applyCreditMock } = vi.hoisted(
  () => ({
    mockRefresh: vi.fn(),
    postMock: vi.fn(),
    cancelMock: vi.fn(),
    applyCreditMock: vi.fn(),
  })
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/features/purchase/actions/bill.actions", () => ({
  postBillAction: postMock,
  cancelBillAction: cancelMock,
}));

vi.mock("@/features/payment/actions/supplier-payment.actions", () => ({
  applySupplierCreditAction: applyCreditMock,
}));

// The payment dialog is exercised in its own suite; here we only assert that
// the detail mounts it with the right seed, so a light stand-in is enough.
vi.mock(
  "@/features/payment/components/record-supplier-payment-dialog",
  () => ({
    RecordSupplierPaymentDialog: (props: {
      supplierId: string;
      supplierName: string;
    }) => (
      <div role="dialog" aria-label="Record supplier payment">
        <span>Make Payment</span>
        <span data-testid="dialog-supplier-id">{props.supplierId}</span>
        <span data-testid="dialog-supplier-name">{props.supplierName}</span>
      </div>
    ),
  })
);

function makeInvoice(
  status: BillStatus = "draft",
  overrides: Partial<BillWithItems> = {}
): BillWithItems {
  return {
    id: "pinv-1",
    organizationId: "org-1",
    invoiceNumber: "PINV-00001",
    supplierInvoiceNumber: "SUP-9",
    purchaseOrderId: null,
    supplierId: "sup-1",
    status,
    invoiceDate: new Date("2026-06-01"),
    dueDate: new Date("2026-07-01"),
    subtotal: 1000,
    discountAmount: 0,
    taxAmount: 180,
    totalAmount: 1180,
    amountPaid: 0,
    notes: null,
    postedAt: null,
    postedBy: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    items: [
      {
        id: "item-1",
        organizationId: "org-1",
        billId: "pinv-1",
        productId: "p-1",
        description: "Widget",
        quantity: 10,
        unitPrice: 100,
        taxRate: 18,
        taxAmount: 180,
        lineTotal: 1180,
        createdAt: new Date("2026-06-01"),
        createdBy: "user-1",
      },
    ],
    ...overrides,
  };
}

function renderDetail(
  invoice: BillWithItems,
  perms: {
    canManage?: boolean;
    canCancel?: boolean;
    canMakePayment?: boolean;
    availableCredit?: number;
  } = {}
) {
  return render(
    <BillDetail
      bill={invoice}
      supplierName="Acme Supply"
      productNames={{ "p-1": "Widget" }}
      availableCredit={perms.availableCredit ?? 0}
      organizationId="org-1"
      canManage={perms.canManage ?? false}
      canCancel={perms.canCancel ?? false}
      canMakePayment={perms.canMakePayment ?? false}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BillDetail", () => {
  it("links to the purchase order when the bill was raised from one", () => {
    const invoice = { ...makeInvoice("posted"), purchaseOrderId: "po-1" };
    render(
      <BillDetail
        bill={invoice}
        supplierName="Acme Supply"
        productNames={{ "p-1": "Widget" }}
        purchaseOrderNumber="PO-0001"
        organizationId="org-1"
        canManage
        canCancel={false}
      />
    );
    expect(screen.getByRole("link", { name: "PO-0001" })).toHaveAttribute(
      "href",
      "/purchases/po-1"
    );
  });

  it("renders header info, items, totals and status", () => {
    renderDetail(makeInvoice("draft"), { canManage: true });
    expect(screen.getByText("PINV-00001")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Supply").length).toBeGreaterThan(0);
    expect(screen.getByText("SUP-9")).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,180.00").length).toBeGreaterThan(0);
  });

  it("shows Post for a draft when canManage", () => {
    renderDetail(makeInvoice("draft"), { canManage: true });
    expect(screen.getByRole("button", { name: /post/i })).toBeInTheDocument();
  });

  it("hides Post when canManage is false", () => {
    renderDetail(makeInvoice("draft"), { canManage: false });
    expect(
      screen.queryByRole("button", { name: /post/i })
    ).not.toBeInTheDocument();
  });

  it("hides actions for a posted (immutable) invoice", () => {
    renderDetail(makeInvoice("posted"), { canManage: true, canCancel: true });
    expect(
      screen.queryByRole("button", { name: /post/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^cancel$/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Posted")).toBeInTheDocument();
  });

  it("posts the invoice and refreshes on success", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({ success: true });
    renderDetail(makeInvoice("draft"), { canManage: true });
    await user.click(screen.getByRole("button", { name: /post/i }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("org-1", "pinv-1")
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("surfaces an error message when posting fails", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({
      success: false,
      error: { message: "Cannot post" },
    });
    renderDetail(makeInvoice("draft"), { canManage: true });
    await user.click(screen.getByRole("button", { name: /post/i }));
    expect(await screen.findByText("Cannot post")).toBeInTheDocument();
  });

  it("opens the cancel dialog and cancels the invoice", async () => {
    const user = userEvent.setup();
    cancelMock.mockResolvedValue({ success: true });
    renderDetail(makeInvoice("draft"), { canCancel: true });
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel bill/i }));
    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith("org-1", "pinv-1")
    );
  });

  // ── Apply credit ───────────────────────────────────────────

  it("shows Apply credit for a posted bill with balance, credit and permission", () => {
    renderDetail(makeInvoice("posted"), {
      canMakePayment: true,
      availableCredit: 400,
    });
    expect(
      screen.getByRole("button", { name: /apply credit/i })
    ).toBeInTheDocument();
  });

  it("surfaces available credit in the details section", () => {
    renderDetail(makeInvoice("posted"), {
      canMakePayment: true,
      availableCredit: 400,
    });
    expect(screen.getByText("Available credit")).toBeInTheDocument();
    expect(screen.getAllByText("₹400.00").length).toBeGreaterThan(0);
  });

  it("hides Apply credit when there is no available credit", () => {
    renderDetail(makeInvoice("posted"), {
      canMakePayment: true,
      availableCredit: 0,
    });
    expect(
      screen.queryByRole("button", { name: /apply credit/i })
    ).not.toBeInTheDocument();
  });

  it("hides Apply credit when canMakePayment is false", () => {
    renderDetail(makeInvoice("posted"), {
      canMakePayment: false,
      availableCredit: 400,
    });
    expect(
      screen.queryByRole("button", { name: /apply credit/i })
    ).not.toBeInTheDocument();
  });

  it("hides Apply credit for a draft bill", () => {
    renderDetail(makeInvoice("draft"), {
      canMakePayment: true,
      availableCredit: 400,
    });
    expect(
      screen.queryByRole("button", { name: /apply credit/i })
    ).not.toBeInTheDocument();
  });

  it("hides Apply credit for a fully-paid bill", () => {
    renderDetail(makeInvoice("posted", { amountPaid: 1180 }), {
      canMakePayment: true,
      availableCredit: 400,
    });
    expect(
      screen.queryByRole("button", { name: /apply credit/i })
    ).not.toBeInTheDocument();
  });

  it("applies credit and refreshes on success", async () => {
    const user = userEvent.setup();
    applyCreditMock.mockResolvedValue({ success: true, data: undefined });
    renderDetail(makeInvoice("posted"), {
      canMakePayment: true,
      availableCredit: 400,
    });

    await user.click(screen.getByRole("button", { name: /apply credit/i }));
    const dialog = screen.getByRole("dialog", { name: /apply credit/i });
    await user.click(
      within(dialog).getByRole("button", { name: /apply credit/i })
    );

    await waitFor(() => expect(applyCreditMock).toHaveBeenCalled());
    const [orgArg, formArg] = applyCreditMock.mock.calls[0];
    expect(orgArg).toBe("org-1");
    expect((formArg as FormData).get("billId")).toBe("pinv-1");
    expect((formArg as FormData).get("supplierId")).toBe("sup-1");
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  // ── Record payment ─────────────────────────────────────────

  it("shows Record payment for a posted bill with balance and permission", () => {
    renderDetail(makeInvoice("posted"), { canMakePayment: true });
    expect(
      screen.getByRole("button", { name: /record payment/i })
    ).toBeInTheDocument();
  });

  it("hides Record payment when canMakePayment is false", () => {
    renderDetail(makeInvoice("posted"), { canMakePayment: false });
    expect(
      screen.queryByRole("button", { name: /record payment/i })
    ).not.toBeInTheDocument();
  });

  it("hides Record payment for a draft bill", () => {
    renderDetail(makeInvoice("draft"), { canMakePayment: true });
    expect(
      screen.queryByRole("button", { name: /record payment/i })
    ).not.toBeInTheDocument();
  });

  it("hides Record payment for a fully-paid bill", () => {
    renderDetail(makeInvoice("posted", { amountPaid: 1180 }), {
      canMakePayment: true,
    });
    expect(
      screen.queryByRole("button", { name: /record payment/i })
    ).not.toBeInTheDocument();
  });

  it("opens the payment dialog seeded with the bill's supplier", async () => {
    const user = userEvent.setup();
    renderDetail(makeInvoice("posted"), { canMakePayment: true });
    await user.click(screen.getByRole("button", { name: /record payment/i }));
    const dialog = screen.getByRole("dialog", {
      name: /record supplier payment/i,
    });
    expect(
      within(dialog).getByTestId("dialog-supplier-id")
    ).toHaveTextContent("sup-1");
    expect(
      within(dialog).getByTestId("dialog-supplier-name")
    ).toHaveTextContent("Acme Supply");
  });

  it("renders the derived payment-status badge in the header", () => {
    renderDetail(makeInvoice("posted", { dueDate: null }), {
      canMakePayment: true,
    });
    expect(screen.getByText("Unpaid")).toBeInTheDocument();
  });
});
