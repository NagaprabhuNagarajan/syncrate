import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { PurchaseInvoiceDetail } from "./purchase-invoice-detail";
import type {
  PurchaseInvoiceStatus,
  PurchaseInvoiceWithItems,
} from "@/features/purchase/types/purchase-invoice.types";

const { mockRefresh, postMock, cancelMock } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  postMock: vi.fn(),
  cancelMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
}));

vi.mock("@/features/purchase/actions/purchase-invoice.actions", () => ({
  postPurchaseInvoiceAction: postMock,
  cancelPurchaseInvoiceAction: cancelMock,
}));

function makeInvoice(
  status: PurchaseInvoiceStatus = "draft"
): PurchaseInvoiceWithItems {
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
        purchaseInvoiceId: "pinv-1",
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
  };
}

function renderDetail(
  invoice: PurchaseInvoiceWithItems,
  perms: { canManage?: boolean; canCancel?: boolean } = {}
) {
  return render(
    <PurchaseInvoiceDetail
      purchaseInvoice={invoice}
      supplierName="Acme Supply"
      productNames={{ "p-1": "Widget" }}
      organizationId="org-1"
      canManage={perms.canManage ?? false}
      canCancel={perms.canCancel ?? false}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PurchaseInvoiceDetail", () => {
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
    await user.click(screen.getByRole("button", { name: /cancel invoice/i }));
    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith("org-1", "pinv-1")
    );
  });
});
