import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { PurchaseOrderDetail } from "./purchase-order-detail";
import type {
  PurchaseOrderStatus,
  PurchaseOrderWithItems,
} from "@/features/purchase/types/purchase-order.types";
import type { BillListItem } from "@/features/purchase/types/bill.types";
import type { PurchaseReturnListItem } from "@/features/purchase/types/purchase-return.types";
import type { GoodsReceiptListItem } from "@/features/purchase/types/goods-receipt.types";

const { mockRefresh, submitMock, approveMock, orderMock, cancelMock } =
  vi.hoisted(() => ({
    mockRefresh: vi.fn(),
    submitMock: vi.fn(),
    approveMock: vi.fn(),
    orderMock: vi.fn(),
    cancelMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/features/purchase/actions/purchase-order.actions", () => ({
  submitPurchaseOrderAction: submitMock,
  approvePurchaseOrderAction: approveMock,
  orderPurchaseOrderAction: orderMock,
  cancelPurchaseOrderAction: cancelMock,
}));

function makeOrder(
  status: PurchaseOrderStatus = "draft"
): PurchaseOrderWithItems {
  return {
    id: "po-1",
    organizationId: "org-1",
    poNumber: "PO-00001",
    supplierId: "sup-1",
    branchId: "wh-1",
    status,
    orderDate: new Date("2026-06-01"),
    expectedDeliveryDate: null,
    currency: "INR",
    notes: null,
    terms: null,
    subtotal: 1000,
    discountAmount: 100,
    taxAmount: 162,
    totalAmount: 1062,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version: 1,
    items: [
      {
        id: "item-1",
        organizationId: "org-1",
        purchaseOrderId: "po-1",
        productId: "p-1",
        description: "Widget",
        quantity: 10,
        receivedQuantity: 0,
        unitPrice: 100,
        discountPercent: 10,
        taxRate: 18,
        taxAmount: 162,
        lineTotal: 1062,
        createdAt: new Date("2026-06-01"),
        createdBy: "user-1",
      },
    ],
  };
}

function renderDetail(
  order: PurchaseOrderWithItems,
  perms: {
    canManage?: boolean;
    canApprove?: boolean;
    canCancel?: boolean;
    canReceive?: boolean;
    linkedBills?: readonly BillListItem[];
    linkedReturns?: readonly PurchaseReturnListItem[];
    linkedReceipts?: readonly GoodsReceiptListItem[];
    approvedByName?: string | null;
  } = {}
) {
  return render(
    <PurchaseOrderDetail
      purchaseOrder={order}
      supplierName="Acme Supply"
      branchName="Main WH"
      productNames={{ "p-1": "Widget" }}
      linkedBills={perms.linkedBills ?? []}
      linkedReturns={perms.linkedReturns ?? []}
      linkedReceipts={perms.linkedReceipts ?? []}
      approvedByName={perms.approvedByName ?? null}
      organizationId="org-1"
      canManage={perms.canManage ?? false}
      canApprove={perms.canApprove ?? false}
      canCancel={perms.canCancel ?? false}
      canReceive={perms.canReceive ?? false}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PurchaseOrderDetail", () => {
  it("renders header info, items, totals and status", () => {
    renderDetail(makeOrder("draft"), { canManage: true });
    expect(screen.getByText("PO-00001")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Supply").length).toBeGreaterThan(0);
    expect(screen.getByText("Main WH")).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,062.00").length).toBeGreaterThan(0);
  });

  it("shows Submit and Edit for a draft when canManage", () => {
    renderDetail(makeOrder("draft"), { canManage: true });
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /approve/i })
    ).not.toBeInTheDocument();
  });

  it("hides management actions when permissions are absent", () => {
    renderDetail(makeOrder("draft"), { canManage: false });
    expect(
      screen.queryByRole("button", { name: /submit/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("shows Approve only for a submitted order with canApprove", () => {
    renderDetail(makeOrder("submitted"), { canApprove: true });
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit/i })
    ).not.toBeInTheDocument();
  });

  it("shows Mark as ordered for an approved order when canManage", () => {
    renderDetail(makeOrder("approved"), { canManage: true });
    expect(
      screen.getByRole("button", { name: /mark as ordered/i })
    ).toBeInTheDocument();
  });

  it("calls the order action and refreshes", async () => {
    const user = userEvent.setup();
    orderMock.mockResolvedValue({ success: true, data: makeOrder("ordered") });
    renderDetail(makeOrder("approved"), { canManage: true });
    await user.click(screen.getByRole("button", { name: /mark as ordered/i }));
    await waitFor(() =>
      expect(orderMock).toHaveBeenCalledWith("org-1", "po-1")
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("calls the submit action and refreshes", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ success: true, data: makeOrder("submitted") });
    renderDetail(makeOrder("draft"), { canManage: true });

    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith("org-1", "po-1")
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("confirms before cancelling, then calls the cancel action", async () => {
    const user = userEvent.setup();
    cancelMock.mockResolvedValue({ success: true, data: makeOrder("cancelled") });
    renderDetail(makeOrder("submitted"), { canCancel: true });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel order/i }));
    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith("org-1", "po-1")
    );
  });

  it("hides the cancel action for terminal statuses", () => {
    renderDetail(makeOrder("completed"), { canCancel: true });
    expect(
      screen.queryByRole("button", { name: /^cancel$/i })
    ).not.toBeInTheDocument();
  });

  it("shows the Receive goods link for an approved PO when canReceive", () => {
    renderDetail(makeOrder("approved"), { canReceive: true });
    const link = screen.getByRole("link", { name: /receive goods/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/purchases/po-1/receive");
  });

  it("hides the Receive goods link without the receive permission", () => {
    renderDetail(makeOrder("approved"), { canManage: true });
    expect(
      screen.queryByRole("link", { name: /receive goods/i })
    ).not.toBeInTheDocument();
  });

  it("hides the Receive goods link for a draft PO even with canReceive", () => {
    renderDetail(makeOrder("draft"), { canReceive: true });
    expect(
      screen.queryByRole("link", { name: /receive goods/i })
    ).not.toBeInTheDocument();
  });

  it("shows Create bill and Create return links for a non-draft PO when canManage", () => {
    renderDetail(makeOrder("ordered"), { canManage: true });
    expect(
      screen.getByRole("link", { name: /create bill/i })
    ).toHaveAttribute("href", "/purchases/bills/new?fromPurchaseOrder=po-1");
    expect(
      screen.getByRole("link", { name: /create return/i })
    ).toHaveAttribute(
      "href",
      "/purchases/returns/new?fromPurchaseOrder=po-1"
    );
  });

  it("hides Create bill and Create return links for a draft PO", () => {
    renderDetail(makeOrder("draft"), { canManage: true });
    expect(
      screen.queryByRole("link", { name: /create bill/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /create return/i })
    ).not.toBeInTheDocument();
  });

  it("lists linked bills and returns with links to each", () => {
    const bill = {
      id: "bill-1",
      invoiceNumber: "BILL-001",
      invoiceDate: new Date("2026-02-01"),
      status: "posted",
      totalAmount: 1180,
    } as unknown as BillListItem;
    const ret = {
      id: "ret-1",
      returnNumber: "PRET-001",
      returnDate: new Date("2026-02-03"),
      status: "completed",
      totalAmount: 250,
    } as unknown as PurchaseReturnListItem;

    renderDetail(makeOrder("ordered"), {
      linkedBills: [bill],
      linkedReturns: [ret],
    });

    expect(screen.getByRole("link", { name: "BILL-001" })).toHaveAttribute(
      "href",
      "/purchases/bills/bill-1"
    );
    expect(screen.getByRole("link", { name: "PRET-001" })).toHaveAttribute(
      "href",
      "/purchases/returns/ret-1"
    );
  });

  it("shows an empty message when no documents are linked", () => {
    renderDetail(makeOrder("ordered"));
    expect(
      screen.getByText(/are linked to this purchase\s+order yet/i)
    ).toBeInTheDocument();
  });

  it("lists linked goods receipts with a link to the filtered GRN list", () => {
    const grn = {
      id: "grn-1",
      grnNumber: "GRN-0001",
      receivedDate: new Date("2026-02-02"),
      status: "completed",
      totalReceivedQuantity: 7,
    } as unknown as GoodsReceiptListItem;

    renderDetail(makeOrder("partially_received"), { linkedReceipts: [grn] });
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GRN-0001" })).toHaveAttribute(
      "href",
      "/purchases/goods-receipts?search=GRN-0001"
    );
  });

  it("shows the resolved approver name instead of the raw id", () => {
    renderDetail(makeOrder("approved"), { approvedByName: "Jane Approver" });
    expect(screen.getByText("Jane Approver")).toBeInTheDocument();
  });

  it("surfaces an action error", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({
      success: false,
      error: { code: "invalid_status", message: "Cannot submit" },
    });
    renderDetail(makeOrder("draft"), { canManage: true });

    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText("Cannot submit")).toBeInTheDocument();
  });
});
