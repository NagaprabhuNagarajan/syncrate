import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { PurchaseReturnDetail } from "./purchase-return-detail";
import type {
  PurchaseReturnStatus,
  PurchaseReturnWithItems,
} from "@/features/purchase/types/purchase-return.types";

const { mockRefresh, completeMock, cancelMock } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  completeMock: vi.fn(),
  cancelMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
}));

vi.mock("@/features/purchase/actions/purchase-return.actions", () => ({
  completePurchaseReturnAction: completeMock,
  cancelPurchaseReturnAction: cancelMock,
}));

function makeReturn(
  status: PurchaseReturnStatus = "draft"
): PurchaseReturnWithItems {
  return {
    id: "pret-1",
    organizationId: "org-1",
    returnNumber: "PRET-00001",
    purchaseOrderId: null,
    supplierId: "sup-1",
    branchId: "wh-1",
    status,
    returnDate: new Date("2026-06-01"),
    reason: "damaged",
    subtotal: 1000,
    taxAmount: 180,
    totalAmount: 1180,
    notes: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    items: [
      {
        id: "item-1",
        organizationId: "org-1",
        purchaseReturnId: "pret-1",
        productId: "p-1",
        quantity: 10,
        unitPrice: 100,
        taxRate: 18,
        taxAmount: 180,
        lineTotal: 1180,
        batchId: null,
        createdAt: new Date("2026-06-01"),
        createdBy: "user-1",
      },
    ],
  };
}

function renderDetail(
  entry: PurchaseReturnWithItems,
  perms: { canComplete?: boolean; canCancel?: boolean; canManage?: boolean } = {}
) {
  return render(
    <PurchaseReturnDetail
      purchaseReturn={entry}
      supplierName="Acme Supply"
      branchName="Main WH"
      productNames={{ "p-1": "Widget" }}
      organizationId="org-1"
      canComplete={perms.canComplete ?? false}
      canCancel={perms.canCancel ?? false}
      canManage={perms.canManage ?? false}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PurchaseReturnDetail", () => {
  it("renders header info, items, totals, reason and status", () => {
    renderDetail(makeReturn("draft"), { canComplete: true });
    expect(screen.getByText("PRET-00001")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Supply").length).toBeGreaterThan(0);
    expect(screen.getByText("Main WH")).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("Damaged")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,180.00").length).toBeGreaterThan(0);
  });

  it("shows Complete for a draft when canComplete", () => {
    renderDetail(makeReturn("draft"), { canComplete: true });
    expect(
      screen.getByRole("button", { name: /complete/i })
    ).toBeInTheDocument();
  });

  it("hides management actions when permissions are absent", () => {
    renderDetail(makeReturn("draft"), {});
    expect(
      screen.queryByRole("button", { name: /complete/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^cancel$/i })
    ).not.toBeInTheDocument();
  });

  it("hides actions for a completed return", () => {
    renderDetail(makeReturn("completed"), {
      canComplete: true,
      canCancel: true,
    });
    expect(
      screen.queryByRole("button", { name: /complete/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^cancel$/i })
    ).not.toBeInTheDocument();
  });

  it("calls the complete action and refreshes", async () => {
    const user = userEvent.setup();
    completeMock.mockResolvedValue({
      success: true,
      data: makeReturn("completed"),
    });
    renderDetail(makeReturn("draft"), { canComplete: true });

    await user.click(screen.getByRole("button", { name: /complete/i }));
    await waitFor(() =>
      expect(completeMock).toHaveBeenCalledWith("org-1", "pret-1")
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("confirms before cancelling, then calls the cancel action", async () => {
    const user = userEvent.setup();
    cancelMock.mockResolvedValue({
      success: true,
      data: makeReturn("cancelled"),
    });
    renderDetail(makeReturn("draft"), { canCancel: true });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel return/i }));
    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith("org-1", "pret-1")
    );
  });

  it("surfaces an action error", async () => {
    const user = userEvent.setup();
    completeMock.mockResolvedValue({
      success: false,
      error: { code: "insufficient_stock", message: "Not enough stock" },
    });
    renderDetail(makeReturn("draft"), { canComplete: true });

    await user.click(screen.getByRole("button", { name: /complete/i }));
    expect(await screen.findByText("Not enough stock")).toBeInTheDocument();
  });
});
