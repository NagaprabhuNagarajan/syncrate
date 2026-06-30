import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { PurchaseRequestDetail } from "./purchase-request-detail";
import type {
  PurchaseRequestStatus,
  PurchaseRequestWithItems,
} from "@/features/purchase/types/purchase-request.types";

const {
  mockRefresh,
  mockPush,
  submitMock,
  approveMock,
  rejectMock,
  cancelMock,
  convertMock,
} = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockPush: vi.fn(),
  submitMock: vi.fn(),
  approveMock: vi.fn(),
  rejectMock: vi.fn(),
  cancelMock: vi.fn(),
  convertMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/features/purchase/actions/purchase-request.actions", () => ({
  submitPurchaseRequestAction: submitMock,
  approvePurchaseRequestAction: approveMock,
  rejectPurchaseRequestAction: rejectMock,
  cancelPurchaseRequestAction: cancelMock,
  convertPurchaseRequestAction: convertMock,
}));

function makeRequest(
  status: PurchaseRequestStatus = "draft",
  overrides: Partial<PurchaseRequestWithItems> = {}
): PurchaseRequestWithItems {
  return {
    id: "pr-1",
    organizationId: "org-1",
    requestNumber: "PR-00001",
    status,
    branchId: "wh-1",
    requiredDate: new Date("2026-06-10"),
    notes: null,
    approvedBy: null,
    approvedAt: null,
    rejectedReason: null,
    convertedPoId: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version: 1,
    items: [
      {
        id: "item-1",
        organizationId: "org-1",
        purchaseRequestId: "pr-1",
        productId: "p-1",
        description: "Widget",
        quantity: 10,
        estimatedPrice: 100,
        createdAt: new Date("2026-06-01"),
        createdBy: "user-1",
      },
    ],
    ...overrides,
  };
}

function renderDetail(
  request: PurchaseRequestWithItems,
  perms: {
    canManage?: boolean;
    canApprove?: boolean;
    canCancel?: boolean;
  } = {}
) {
  return render(
    <PurchaseRequestDetail
      purchaseRequest={request}
      branchName="Main WH"
      productNames={{ "p-1": "Widget" }}
      suppliers={[{ id: "sup-1", name: "Acme Supply" }]}
      organizationId="org-1"
      canManage={perms.canManage ?? false}
      canApprove={perms.canApprove ?? false}
      canCancel={perms.canCancel ?? false}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PurchaseRequestDetail", () => {
  it("renders header info, items and status", () => {
    renderDetail(makeRequest("draft"), { canManage: true });
    expect(screen.getByText("PR-00001")).toBeInTheDocument();
    expect(screen.getAllByText("Main WH").length).toBeGreaterThan(0);
    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows Submit and Edit for a draft when canManage", () => {
    renderDetail(makeRequest("draft"), { canManage: true });
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
  });

  it("hides management actions without canManage", () => {
    renderDetail(makeRequest("draft"), { canManage: false });
    expect(
      screen.queryByRole("button", { name: /submit/i })
    ).not.toBeInTheDocument();
  });

  it("shows Approve and Reject for a submitted request with canApprove", () => {
    renderDetail(makeRequest("submitted"), { canApprove: true });
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("calls submit and refreshes", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ success: true, data: makeRequest("submitted") });
    renderDetail(makeRequest("draft"), { canManage: true });
    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(submitMock).toHaveBeenCalledWith("org-1", "pr-1"));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("requires a reason before rejecting, then calls the reject action", async () => {
    const user = userEvent.setup();
    rejectMock.mockResolvedValue({ success: true, data: makeRequest("rejected") });
    renderDetail(makeRequest("submitted"), { canApprove: true });

    await user.click(screen.getByRole("button", { name: /reject/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Reason"), "No budget");
    await user.click(screen.getByRole("button", { name: /reject request/i }));
    await waitFor(() =>
      expect(rejectMock).toHaveBeenCalledWith("org-1", "pr-1", "No budget")
    );
  });

  it("shows Convert to PO for an approved request and converts with a supplier", async () => {
    const user = userEvent.setup();
    convertMock.mockResolvedValue({
      success: true,
      data: { id: "po-9", poNumber: "PO-00001" },
    });
    renderDetail(makeRequest("approved"), { canManage: true });

    await user.click(screen.getByRole("button", { name: /convert to po/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Supplier"), "sup-1");
    await user.click(
      screen.getByRole("button", { name: /create purchase order/i })
    );
    await waitFor(() =>
      expect(convertMock).toHaveBeenCalledWith("org-1", "pr-1", "sup-1")
    );
  });

  it("hides Convert to PO unless the request is approved", () => {
    renderDetail(makeRequest("submitted"), { canManage: true });
    expect(
      screen.queryByRole("button", { name: /convert to po/i })
    ).not.toBeInTheDocument();
  });

  it("shows a link to the converted purchase order", () => {
    renderDetail(
      makeRequest("converted", { convertedPoId: "po-9" }),
      { canManage: true }
    );
    expect(
      screen.getByRole("link", { name: /view purchase order/i })
    ).toHaveAttribute("href", "/purchases/po-9");
  });

  it("displays the rejection reason for a rejected request", () => {
    renderDetail(
      makeRequest("rejected", { rejectedReason: "Out of budget" }),
      {}
    );
    expect(screen.getByText("Out of budget")).toBeInTheDocument();
  });

  it("hides the cancel action for a converted request", () => {
    renderDetail(makeRequest("converted"), { canCancel: true });
    expect(
      screen.queryByRole("button", { name: /^cancel$/i })
    ).not.toBeInTheDocument();
  });

  it("confirms before cancelling, then calls the cancel action", async () => {
    const user = userEvent.setup();
    cancelMock.mockResolvedValue({ success: true, data: makeRequest("cancelled") });
    renderDetail(makeRequest("draft"), { canManage: true, canCancel: true });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel request/i }));
    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith("org-1", "pr-1")
    );
  });

  it("dismisses the reject dialog without rejecting", async () => {
    const user = userEvent.setup();
    renderDetail(makeRequest("submitted"), { canApprove: true });
    await user.click(screen.getByRole("button", { name: /reject/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /keep request/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(rejectMock).not.toHaveBeenCalled();
  });

  it("pushes to the purchase orders list after converting", async () => {
    const user = userEvent.setup();
    convertMock.mockResolvedValue({
      success: true,
      data: { id: "po-9", poNumber: "PO-00001" },
    });
    renderDetail(makeRequest("approved"), { canManage: true });
    await user.click(screen.getByRole("button", { name: /convert to po/i }));
    await user.selectOptions(screen.getByLabelText("Supplier"), "sup-1");
    await user.click(
      screen.getByRole("button", { name: /create purchase order/i })
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/purchases")
    );
  });

  it("surfaces an action error", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({
      success: false,
      error: { code: "invalid_status", message: "Cannot submit" },
    });
    renderDetail(makeRequest("draft"), { canManage: true });
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText("Cannot submit")).toBeInTheDocument();
  });
});
