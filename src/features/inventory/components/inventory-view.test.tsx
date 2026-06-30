import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { InventoryView } from "./inventory-view";
import type {
  InventoryLevel,
  InventoryLevelListResult,
  InventoryTransaction,
} from "@/features/inventory/types/inventory.types";

const { mockPush, mockRefresh, searchParamsRef } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("@/features/inventory/actions/inventory.actions", () => ({
  adjustStockAction: vi.fn(),
  transferStockAction: vi.fn(),
  createBatchAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

function makeLevel(overrides: Partial<InventoryLevel> = {}): InventoryLevel {
  return {
    id: "lvl-1",
    organizationId: "org-1",
    productId: "prod-1",
    branchId: "wh-1",
    quantity: 4,
    reservedQuantity: 0,
    productName: "Cement Bag",
    productCode: "CEM-01",
    reorderLevel: 10,
    purchasePrice: 50,
    branchName: "Main Depot",
    branchCode: "WH-01",
    ...overrides,
  };
}

function makeTx(overrides: Partial<InventoryTransaction> = {}): InventoryTransaction {
  return {
    id: "tx-1",
    organizationId: "org-1",
    productId: "prod-1",
    branchId: "wh-1",
    batchId: null,
    type: "adjustment",
    quantity: 5,
    runningBalance: 9,
    referenceType: "manual",
    referenceId: null,
    note: null,
    createdAt: new Date("2026-06-01T10:00:00Z"),
    createdBy: "user-1",
    productName: "Cement Bag",
    productCode: "CEM-01",
    branchName: "Main Depot",
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<InventoryLevelListResult> = {}
): InventoryLevelListResult {
  return {
    items: [makeLevel()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

const branches = [
  { id: "wh-1", code: "WH-01", name: "Main Depot" },
  { id: "wh-2", code: "WH-02", name: "Second Depot" },
];
const products = [{ id: "prod-1", name: "Cement Bag", code: "CEM-01" }];

function renderView(props: Partial<Parameters<typeof InventoryView>[0]> = {}) {
  return render(
    <InventoryView
      organizationId="org-1"
      result={makeResult()}
      transactions={[makeTx()]}
      products={products}
      branches={branches}
      filters={{}}
      stockValue={200}
      canAdjust
      canTransfer
      {...props}
    />
  );
}

describe("InventoryView", () => {
  it("renders stock levels and a reorder badge for low stock", () => {
    renderView();
    // product code is unique to the stock-levels table
    expect(screen.getByText("CEM-01")).toBeInTheDocument();
    // quantity 4 <= reorder 10 → reorder badge
    expect(screen.getByText("Reorder")).toBeInTheDocument();
  });

  it("renders the ledger of recent movements", () => {
    renderView();
    expect(screen.getByText("Recent stock movements")).toBeInTheDocument();
    expect(screen.getByText("Adjustment")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
  });

  it("shows the total stock value", () => {
    renderView({ stockValue: 1500 });
    expect(screen.getByText(/₹/)).toBeInTheDocument();
  });

  it("opens the adjust dialog", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: /adjust stock/i }));
    expect(
      screen.getByRole("heading", { name: "Adjust stock" })
    ).toBeInTheDocument();
  });

  it("opens the transfer dialog", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: /transfer/i }));
    expect(
      screen.getByRole("heading", { name: "Transfer stock" })
    ).toBeInTheDocument();
  });

  it("hides actions when the user cannot adjust or transfer", () => {
    renderView({ canAdjust: false, canTransfer: false });
    expect(
      screen.queryByRole("button", { name: /adjust stock/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /transfer/i })
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when there is no stock", () => {
    renderView({ result: makeResult({ items: [], total: 0 }) });
    expect(screen.getByText("No stock to show")).toBeInTheDocument();
  });

  it("toggles the low-stock filter via the URL", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByLabelText("Low stock only"));
    expect(mockPush).toHaveBeenCalledWith("/inventory?low=1");
  });
});
