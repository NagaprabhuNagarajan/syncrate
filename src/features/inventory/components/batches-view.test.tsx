import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { BatchesView } from "./batches-view";
import type {
  Batch,
  BatchListResult,
} from "@/features/inventory/types/batch.types";

const { mockRefresh, createBatchMock } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  createBatchMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
}));

vi.mock("@/features/inventory/actions/inventory.actions", () => ({
  createBatchAction: createBatchMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
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

describe("BatchesView", () => {
  it("renders batch rows with the product name", () => {
    render(
      <BatchesView
        organizationId="org-1"
        result={makeResult()}
        products={products}
        canManage
      />
    );
    expect(screen.getByText("B-001")).toBeInTheDocument();
    expect(screen.getByText("Paracetamol (MED-01)")).toBeInTheDocument();
  });

  it("shows an empty state with no batches", () => {
    render(
      <BatchesView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        products={products}
        canManage
      />
    );
    expect(screen.getByText("No batches yet")).toBeInTheDocument();
  });

  it("creates a batch and refreshes on success", async () => {
    const user = userEvent.setup();
    createBatchMock.mockResolvedValue({
      success: true,
      data: { id: "batch-2", batchNumber: "B-002" },
    });

    render(
      <BatchesView
        organizationId="org-1"
        result={makeResult()}
        products={products}
        canManage
      />
    );

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
    render(
      <BatchesView
        organizationId="org-1"
        result={makeResult()}
        products={products}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /add batch/i })
    ).not.toBeInTheDocument();
  });
});
