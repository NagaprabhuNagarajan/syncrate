import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { PurchaseReturnsView } from "./purchase-returns-view";
import type {
  PurchaseReturnListItem,
  PurchaseReturnListResult,
} from "@/features/purchase/types/purchase-return.types";

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

function makeReturn(
  overrides: Partial<PurchaseReturnListItem> = {}
): PurchaseReturnListItem {
  return {
    id: "pret-1",
    organizationId: "org-1",
    returnNumber: "PRET-00001",
    purchaseOrderId: null,
    supplierId: "sup-1",
    supplierName: "Acme Supply",
    branchId: "wh-1",
    status: "draft",
    returnDate: new Date("2026-06-01"),
    reason: "damaged",
    subtotal: 1000,
    taxAmount: 180,
    totalAmount: 1180,
    notes: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeResult(
  items: PurchaseReturnListItem[],
  overrides: Partial<PurchaseReturnListResult> = {}
): PurchaseReturnListResult {
  return { items, total: items.length, page: 1, pageSize: 20, ...overrides };
}

describe("PurchaseReturnsView", () => {
  it("renders an empty state when there are no returns", () => {
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("No purchase returns found")).toBeInTheDocument();
  });

  it("renders returns with supplier name, status and total", () => {
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("PRET-00001")).toBeInTheDocument();
    expect(screen.getByText("Acme Supply")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getByText("₹1,180.00")).toBeInTheDocument();
  });

  it("shows the new return button only when canManage is true", () => {
    const { rerender } = render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /new purchase return/i })
    ).toBeInTheDocument();

    rerender(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /new purchase return/i })
    ).not.toBeInTheDocument();
  });

  it("pushes a search query on submit", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        filters={{}}
        canManage
      />
    );
    await user.type(screen.getByLabelText("Search purchase returns"), "PRET-001");
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/purchases/returns?search=PRET-001");
  });

  it("pushes a status filter change", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        filters={{}}
        canManage
      />
    );
    await user.selectOptions(
      screen.getByLabelText("Filter by status"),
      "completed"
    );
    expect(mockPush).toHaveBeenCalledWith("/purchases/returns?status=completed");
  });
});
