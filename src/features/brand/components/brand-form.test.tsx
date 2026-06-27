import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { BrandForm } from "./brand-form";
import type { Brand } from "@/features/brand/types/brand.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/features/brand/actions/brand.actions", () => ({
  createBrandAction: mockCreate,
  updateBrandAction: mockUpdate,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: "brand-1",
    organizationId: "org-1",
    name: "Samsung",
    description: "Consumer electronics",
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

describe("BrandForm (create)", () => {
  it("renders the create heading and required name field", () => {
    render(<BrandForm organizationId="org-1" />);
    expect(
      screen.getByRole("heading", { name: /add brand/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/brand name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create brand/i })
    ).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when the name is empty", async () => {
    const user = userEvent.setup();
    render(<BrandForm organizationId="org-1" />);

    await user.click(screen.getByRole("button", { name: /create brand/i }));

    expect(
      await screen.findByText(/name must be at least 2 characters/i)
    ).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("submits FormData with name and description and calls onSuccess", async () => {
    const onSuccess = vi.fn();
    mockCreate.mockResolvedValue({ success: true, data: makeBrand() });
    const user = userEvent.setup();
    render(<BrandForm organizationId="org-1" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/brand name/i), "Samsung");
    await user.type(screen.getByLabelText(/description/i), "Electronics");
    await user.click(screen.getByRole("button", { name: /create brand/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const [orgId, formData] = mockCreate.mock.calls[0] as [string, FormData];
    expect(orgId).toBe("org-1");
    expect(formData.get("name")).toBe("Samsung");
    expect(formData.get("description")).toBe("Electronics");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("displays a server error returned by the action", async () => {
    mockCreate.mockResolvedValue({
      success: false,
      error: { code: "duplicate_name", message: "A brand named exists" },
    });
    const user = userEvent.setup();
    render(<BrandForm organizationId="org-1" />);

    await user.type(screen.getByLabelText(/brand name/i), "Samsung");
    await user.click(screen.getByRole("button", { name: /create brand/i }));

    expect(
      await screen.findByText(/a brand named exists/i)
    ).toBeInTheDocument();
  });

  it("calls onCancel when cancel is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<BrandForm organizationId="org-1" onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("BrandForm (edit)", () => {
  it("pre-fills fields from the brand and shows the status select", () => {
    render(<BrandForm organizationId="org-1" brand={makeBrand()} />);

    expect(
      screen.getByRole("heading", { name: /edit brand/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/brand name/i)).toHaveValue("Samsung");
    expect(screen.getByLabelText(/^status$/i)).toBeInTheDocument();
  });

  it("submits an update via updateBrandAction with the brand id", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: makeBrand() });
    const user = userEvent.setup();
    render(<BrandForm organizationId="org-1" brand={makeBrand()} />);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [orgId, brandId, formData] = mockUpdate.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(brandId).toBe("brand-1");
    expect(formData.get("name")).toBe("Samsung");
    expect(formData.get("status")).toBe("active");
  });
});
