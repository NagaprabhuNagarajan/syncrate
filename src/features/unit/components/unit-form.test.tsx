import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { UnitForm } from "./unit-form";
import type { Unit } from "@/features/unit/types/unit.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockCreate, mockUpdate, mockPush } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/features/unit/actions/unit.actions", () => ({
  createUnitAction: mockCreate,
  updateUnitAction: mockUpdate,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "unit-1",
    organizationId: "org-1",
    name: "Kilogram",
    symbol: "kg",
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("UnitForm (create)", () => {
  it("renders the create heading and required fields", () => {
    render(<UnitForm organizationId="org-1" />);
    expect(
      screen.getByRole("heading", { name: /add unit/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/unit name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/symbol/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create unit/i })
    ).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when fields are empty", async () => {
    const user = userEvent.setup();
    render(<UnitForm organizationId="org-1" />);

    await user.click(screen.getByRole("button", { name: /create unit/i }));

    expect(
      await screen.findByText(/unit name is required/i)
    ).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("submits FormData with the name and symbol", async () => {
    mockCreate.mockResolvedValue({ success: true, data: makeUnit() });
    const user = userEvent.setup();
    render(<UnitForm organizationId="org-1" />);

    await user.type(screen.getByLabelText(/unit name/i), "Kilogram");
    await user.type(screen.getByLabelText(/symbol/i), "kg");
    await user.click(screen.getByRole("button", { name: /create unit/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const [orgId, formData] = mockCreate.mock.calls[0] as [string, FormData];
    expect(orgId).toBe("org-1");
    expect(formData.get("name")).toBe("Kilogram");
    expect(formData.get("symbol")).toBe("kg");
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/products/units")
    );
  });

  it("displays a server error returned by the action", async () => {
    mockCreate.mockResolvedValue({
      success: false,
      error: { code: "duplicate_name", message: "A unit named already exists" },
    });
    const user = userEvent.setup();
    render(<UnitForm organizationId="org-1" />);

    await user.type(screen.getByLabelText(/unit name/i), "Kilogram");
    await user.type(screen.getByLabelText(/symbol/i), "kg");
    await user.click(screen.getByRole("button", { name: /create unit/i }));

    expect(
      await screen.findByText(/a unit named already exists/i)
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls onSuccess instead of navigating when provided", async () => {
    const onSuccess = vi.fn();
    mockCreate.mockResolvedValue({ success: true, data: makeUnit() });
    const user = userEvent.setup();
    render(<UnitForm organizationId="org-1" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/unit name/i), "Kilogram");
    await user.type(screen.getByLabelText(/symbol/i), "kg");
    await user.click(screen.getByRole("button", { name: /create unit/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls onCancel when cancel is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<UnitForm organizationId="org-1" onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("UnitForm (edit)", () => {
  it("pre-fills fields and shows the status select", () => {
    render(<UnitForm organizationId="org-1" unit={makeUnit()} />);

    expect(
      screen.getByRole("heading", { name: /edit unit/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/unit name/i)).toHaveValue("Kilogram");
    expect(screen.getByLabelText(/symbol/i)).toHaveValue("kg");
    expect(screen.getByLabelText(/^status$/i)).toBeInTheDocument();
  });

  it("submits an update via updateUnitAction with the unit id", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: makeUnit() });
    const user = userEvent.setup();
    render(<UnitForm organizationId="org-1" unit={makeUnit()} />);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [orgId, unitId, formData] = mockUpdate.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(unitId).toBe("unit-1");
    expect(formData.get("name")).toBe("Kilogram");
    expect(formData.get("status")).toBe("active");
  });
});
