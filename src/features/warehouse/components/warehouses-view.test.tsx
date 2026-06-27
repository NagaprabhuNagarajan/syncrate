import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { WarehousesView } from "./warehouses-view";
import type {
  Warehouse,
  WarehouseListResult,
} from "@/features/warehouse/types/warehouse.types";

const { mockPush, mockRefresh, searchParamsRef, archiveActionMock } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockRefresh: vi.fn(),
    searchParamsRef: { current: "" },
    archiveActionMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("@/features/warehouse/actions/warehouse.actions", () => ({
  archiveWarehouseAction: archiveActionMock,
  createWarehouseAction: vi.fn(),
  updateWarehouseAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

function makeWarehouse(overrides: Partial<Warehouse> = {}): Warehouse {
  return {
    id: "wh-1",
    organizationId: "org-1",
    branchId: null,
    code: "WH-01",
    name: "Chennai Central",
    addressLine1: null,
    city: "Chennai",
    state: "TN",
    pincode: null,
    capacity: 1000,
    isDefault: true,
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<WarehouseListResult> = {}
): WarehouseListResult {
  return {
    items: [makeWarehouse()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

describe("WarehousesView", () => {
  it("renders the warehouse rows", () => {
    render(
      <WarehousesView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("Chennai Central")).toBeInTheDocument();
    expect(screen.getByText("WH-01")).toBeInTheDocument();
  });

  it("shows an empty state when there are no warehouses", () => {
    render(
      <WarehousesView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("No warehouses found")).toBeInTheDocument();
  });

  it("hides management actions when canManage is false", () => {
    render(
      <WarehousesView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /add warehouse/i })
    ).not.toBeInTheDocument();
  });

  it("opens the create dialog", async () => {
    const user = userEvent.setup();
    render(
      <WarehousesView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /add warehouse/i }));
    expect(
      screen.getByRole("heading", { name: "Add warehouse" })
    ).toBeInTheDocument();
  });

  it("archives a warehouse and refreshes on success", async () => {
    const user = userEvent.setup();
    archiveActionMock.mockResolvedValue({ success: true, data: undefined });
    render(
      <WarehousesView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /archive/i }));
    await waitFor(() => {
      expect(archiveActionMock).toHaveBeenCalledWith("org-1", "wh-1");
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("surfaces an archive error", async () => {
    const user = userEvent.setup();
    archiveActionMock.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Cannot archive" },
    });
    render(
      <WarehousesView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /archive/i }));
    expect(await screen.findByText("Cannot archive")).toBeInTheDocument();
  });

  it("navigates with a search query on submit", async () => {
    const user = userEvent.setup();
    render(
      <WarehousesView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.type(screen.getByLabelText("Search warehouses"), "chennai");
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith(
      "/inventory/warehouses?search=chennai"
    );
  });
});
