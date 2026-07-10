import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { GoodsReceiptsView } from "./goods-receipts-view";
import type {
  GoodsReceiptListItem,
  GoodsReceiptListResult,
  GoodsReceiptStats,
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
    totalReceivedQuantity: 10,
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

function makeStats(overrides: Partial<GoodsReceiptStats> = {}): GoodsReceiptStats {
  return { total: 0, thisMonth: 0, completed: 0, draft: 0, ...overrides };
}

describe("GoodsReceiptsView", () => {
  it("renders an empty state when there are no goods receipts", () => {
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([])}
        stats={makeStats()}
        filters={{}}
      />
    );
    expect(screen.getByText("No goods receipts yet")).toBeInTheDocument();
  });

  it("renders a distinct empty state when filters produce no matches", () => {
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([])}
        stats={makeStats()}
        filters={{ search: "zzz" }}
      />
    );
    expect(screen.getByText("No matching goods receipts")).toBeInTheDocument();
  });

  it("renders the stat tiles", () => {
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([makeReceipt()])}
        stats={makeStats({ total: 12, thisMonth: 3, completed: 9, draft: 3 })}
        filters={{}}
      />
    );
    expect(screen.getByText("Total receipts")).toBeInTheDocument();
    expect(screen.getByText("This month")).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("renders a row with GRN number, PO link, supplier and status", () => {
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([makeReceipt()])}
        stats={makeStats()}
        filters={{}}
      />
    );
    expect(screen.getByText("GRN-00001")).toBeInTheDocument();
    expect(screen.getByText("Acme Supply")).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    const poLink = screen.getByRole("link", { name: "PO-00001" });
    expect(poLink).toHaveAttribute("href", "/purchases/po-1");
  });

  it("falls back to em dash when the PO number is missing", () => {
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([makeReceipt({ poNumber: null, supplierName: null })])}
        stats={makeStats()}
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
        stats={makeStats()}
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

  it("resets the list immediately when the search field is cleared", async () => {
    const user = userEvent.setup();
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([makeReceipt()])}
        stats={makeStats()}
        filters={{ search: "GRN-00001" }}
      />
    );
    const input = screen.getByLabelText("Search goods receipts");
    await user.clear(input);
    expect(mockPush).toHaveBeenCalledWith("/purchases/goods-receipts");
  });

  it("shows the pagination summary and paginates to the next page", async () => {
    const user = userEvent.setup();
    render(
      <GoodsReceiptsView
        organizationId="org-1"
        result={makeResult([makeReceipt()], { total: 40, page: 1, pageSize: 20 })}
        stats={makeStats()}
        filters={{}}
      />
    );
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/purchases/goods-receipts?page=2");
  });
});
