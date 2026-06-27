import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { WarehouseForm } from "./warehouse-form";
import type { Warehouse } from "@/features/warehouse/types/warehouse.types";

const { mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/features/warehouse/actions/warehouse.actions", () => ({
  createWarehouseAction: mockCreate,
  updateWarehouseAction: mockUpdate,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
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
    isDefault: false,
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

describe("WarehouseForm", () => {
  it("renders create mode by default", () => {
    render(<WarehouseForm organizationId="org-1" onSuccess={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Add warehouse" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create warehouse" })
    ).toBeInTheDocument();
  });

  it("shows validation errors for an empty submit", async () => {
    const user = userEvent.setup();
    render(<WarehouseForm organizationId="org-1" onSuccess={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create warehouse" }));
    expect(await screen.findByText(/code must be/i)).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("submits a valid create and calls onSuccess", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockCreate.mockResolvedValue({ success: true, data: makeWarehouse() });

    render(<WarehouseForm organizationId="org-1" onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/warehouse name/i), "Main Depot");
    await user.type(screen.getByLabelText(/warehouse code/i), "WH-99");
    await user.click(screen.getByRole("button", { name: "Create warehouse" }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("renders edit mode with a status field", () => {
    render(
      <WarehouseForm
        organizationId="org-1"
        warehouse={makeWarehouse()}
        onSuccess={vi.fn()}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Edit warehouse" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("surfaces a server error", async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue({
      success: false,
      error: { code: "duplicate_code", message: "Code taken" },
    });
    render(<WarehouseForm organizationId="org-1" onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/warehouse name/i), "Main Depot");
    await user.type(screen.getByLabelText(/warehouse code/i), "WH-99");
    await user.click(screen.getByRole("button", { name: "Create warehouse" }));
    expect(await screen.findByText("Code taken")).toBeInTheDocument();
  });
});
