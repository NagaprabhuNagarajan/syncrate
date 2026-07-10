import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { BatchesView } from "./batches-view";
import type {
  Batch,
  BatchListResult,
  BatchStats,
} from "@/features/inventory/types/batch.types";

const { mockPush, mockRefresh, createBatchMock, searchParamsRef } = vi.hoisted(
  () => ({
    mockPush: vi.fn(),
    mockRefresh: vi.fn(),
    createBatchMock: vi.fn(),
    searchParamsRef: { current: "" },
  })
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("@/features/inventory/actions/inventory.actions", () => ({
  createBatchAction: createBatchMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

const products = [{ id: "prod-1", name: "Paracetamol", code: "MED-01" }];

function makeBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: "batch-1",
    organizationId: "org-1",
    productId: "prod-1",
    batchNumber: "B-001",
    manufacturingDate: "2026-01-01",
    expiryDate: "2027-01-01",
    supplierBatch: null,
    receivedQuantity: 100,
    remainingQuantity: 80,
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeResult(overrides: Partial<BatchListResult> = {}): BatchListResult {
  return {
    items: [makeBatch()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

function makeStats(overrides: Partial<BatchStats> = {}): BatchStats {
  return {
    total: 1,
    active: 1,
    expired: 0,
    depleted: 0,
    ...overrides,
  };
}

function renderView(props: Partial<Parameters<typeof BatchesView>[0]> = {}) {
  return render(
    <BatchesView
      organizationId="org-1"
      result={makeResult()}
      stats={makeStats()}
      products={products}
      filters={{}}
      canManage
      {...props}
    />
  );
}

describe("BatchesView", () => {
  it("renders batch rows with the product name", () => {
    renderView();
    expect(screen.getByText("B-001")).toBeInTheDocument();
    expect(screen.getAllByText("Paracetamol (MED-01)").length).toBeGreaterThan(
      0
    );
  });

  it("shows an empty state with no batches", () => {
    renderView({ result: makeResult({ items: [], total: 0 }) });
    expect(screen.getByText("No batches yet")).toBeInTheDocument();
  });

  it("creates a batch and refreshes on success", async () => {
    const user = userEvent.setup();
    createBatchMock.mockResolvedValue({
      success: true,
      data: { id: "batch-2", batchNumber: "B-002" },
    });

    renderView();

    await user.click(screen.getByRole("button", { name: /add batch/i }));
    await user.selectOptions(screen.getByLabelText("Product"), "prod-1");
    await user.type(screen.getByLabelText("Batch number"), "B-002");
    await user.type(screen.getByLabelText("Received quantity"), "20");
    await user.click(screen.getByRole("button", { name: /create batch/i }));

    await waitFor(() => {
      expect(createBatchMock).toHaveBeenCalled();
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("hides the add button when the user cannot manage", () => {
    renderView({ canManage: false });
    expect(
      screen.queryByRole("button", { name: /add batch/i })
    ).not.toBeInTheDocument();
  });

  it("renders the stat tiles", () => {
    renderView({
      stats: makeStats({ total: 8, active: 5, expired: 2, depleted: 1 }),
      result: makeResult({ items: [] }),
    });
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText("Depleted")).toBeInTheDocument();
  });

  it("filters by product via the URL", async () => {
    const user = userEvent.setup();
    renderView();
    await user.selectOptions(
      screen.getByLabelText("Filter by product"),
      "prod-1"
    );
    expect(mockPush).toHaveBeenCalledWith(
      "/inventory/batches?product=prod-1"
    );
  });

  it("shows pagination and navigates to the next page", async () => {
    const user = userEvent.setup();
    renderView({ result: makeResult({ total: 45, page: 1, pageSize: 20 }) });
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/inventory/batches?page=2");
  });
});
