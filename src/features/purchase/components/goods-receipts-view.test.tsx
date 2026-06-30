import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { GoodsReceiptsView } from "./goods-receipts-view";
import type {
  GoodsReceiptListItem,
  GoodsReceiptListResult,
} from "@/features/purchase/types/goods-receipt.types";

const { mockPush, searchParamsRef } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

function makeReceipt(
  overrides: Partial<GoodsReceiptListItem> = {}
): GoodsReceiptListItem {
  return {
    id: "grn-1",
    organizationId: "org-1",
    grnNumber: "GRN-00001",
    purchaseOrderId: "po-1",
    poNumber: "PO-00001",
    supplierName: "Acme Supply",
    branchId: "wh-1",
    receivedDate: new Date("2026-06-26"),
    status: "completed",
    notes: null,
    createdAt: new Date("2026-06-26"),
    updatedAt: new Date("2026-06-26"),
    createdBy: "user-1",
    ...overrides,
  };
}

function makeResult(
  items: GoodsReceiptListItem[],
  overrides: Partial<GoodsReceiptListResult> = {}
): GoodsReceiptListResult {
  return { items, total: items.length, page: 1, pageSize: 20, ...overrides };
}

describe("GoodsReceiptsView", () => {
  it("renders an empty state when there are no goods receipts", () => {
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([])}
        filters={{}}
      />
    );
    expect(screen.getByText("No goods receipts found")).toBeInTheDocument();
  });

  it("renders a row with GRN number, PO link, supplier and status", () => {
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([makeReceipt()])}
        filters={{}}
      />
    );
    expect(screen.getByText("GRN-00001")).toBeInTheDocument();
    expect(screen.getByText("Acme Supply")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    const poLink = screen.getByRole("link", { name: "PO-00001" });
    expect(poLink).toHaveAttribute("href", "/purchases/po-1");
  });

  it("falls back to em dash when the PO number is missing", () => {
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([makeReceipt({ poNumber: null, supplierName: null })])}
        filters={{}}
      />
    );
    expect(screen.queryByRole("link", { name: "PO-00001" })).not.toBeInTheDocument();
  });

  it("pushes a search query on submit", async () => {
    const user = userEvent.setup();
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([makeReceipt()])}
        filters={{}}
      />
    );
    await user.type(
      screen.getByLabelText("Search goods receipts"),
      "GRN-00001"
    );
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith(
      "/purchases/goods-receipts?search=GRN-00001"
    );
  });

  it("paginates to the next page", async () => {
    const user = userEvent.setup();
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([makeReceipt()], { total: 40, page: 1, pageSize: 20 })}
        filters={{}}
      />
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/purchases/goods-receipts?page=2");
  });
});
