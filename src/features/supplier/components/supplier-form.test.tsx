import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { SupplierForm } from "./supplier-form";
import type { Supplier } from "@/features/supplier/types/supplier.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockCreate, mockUpdate, mockPush } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/features/supplier/actions/supplier.actions", () => ({
  createSupplierAction: mockCreate,
  updateSupplierAction: mockUpdate,
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

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: "supplier-1",
    organizationId: "org-1",
    code: "SUPP-001",
    name: "Acme Industries",
    contactPerson: "Ramesh Kumar",
    gstNumber: "22AAAAA0000A1Z5",
    panNumber: "AAAAA0000A",
    mobile: "+91 98765 43210",
    email: "acme@example.com",
    website: "https://acme.test",
    addressLine1: "12 MG Road",
    addressLine2: null,
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "IN",
    bankAccountName: "Acme Industries",
    bankAccountNumber: "123456789012",
    bankIfsc: "HDFC0001234",
    bankName: "HDFC Bank",
    upiId: "acme@okhdfcbank",
    paymentTermsDays: 30,
    openingBalance: 1000,
    rating: 4.5,
    status: "active",
    tags: ["preferred"],
    notes: "Reliable supplier",
    cbnConnectionId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Create mode
// ─────────────────────────────────────────────────────────────

describe("SupplierForm (create)", () => {
  it("renders the create heading and key fields", () => {
    render(<SupplierForm organizationId="org-1" />);

    expect(
      screen.getByRole("heading", { name: /add supplier/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/supplier name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact person/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ifsc code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^rating$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create supplier/i })
    ).toBeInTheDocument();
    // Status control is edit-only.
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("shows a validation error and does not submit when the name is too short", async () => {
    const user = userEvent.setup();
    render(<SupplierForm organizationId="org-1" />);

    await user.type(screen.getByLabelText(/supplier name/i), "A");
    await user.click(screen.getByRole("button", { name: /create supplier/i }));

    expect(
      await screen.findByText(/name must be at least 2 characters/i)
    ).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("submits FormData with an uppercased code, numbers and CSV tags", async () => {
    mockCreate.mockResolvedValue({ success: true, data: makeSupplier() });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<SupplierForm organizationId="org-1" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/supplier name/i), "Acme Industries");
    await user.type(screen.getByLabelText(/supplier code/i), "supp-1");
    await user.type(screen.getByLabelText(/contact person/i), "Ramesh");
    await user.type(screen.getByLabelText(/ifsc code/i), "hdfc0001234");
    await user.type(screen.getByLabelText(/^rating$/i), "4.5");
    await user.type(screen.getByLabelText(/^tags$/i), "preferred, raw");
    await user.click(screen.getByRole("button", { name: /create supplier/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const [orgId, formData] = mockCreate.mock.calls[0] as [string, FormData];
    expect(orgId).toBe("org-1");
    expect(formData.get("name")).toBe("Acme Industries");
    expect(formData.get("code")).toBe("SUPP-1");
    expect(formData.get("contactPerson")).toBe("Ramesh");
    expect(formData.get("bankIfsc")).toBe("HDFC0001234");
    expect(formData.get("rating")).toBe("4.5");
    expect(formData.get("tags")).toBe("preferred, raw");
    // Status not sent in create mode.
    expect(formData.get("status")).toBeNull();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("displays a server error returned by the action", async () => {
    mockCreate.mockResolvedValue({
      success: false,
      error: { code: "duplicate_gst", message: "GST already in use" },
    });
    const user = userEvent.setup();
    render(<SupplierForm organizationId="org-1" />);

    await user.type(screen.getByLabelText(/supplier name/i), "Acme Industries");
    await user.click(screen.getByRole("button", { name: /create supplier/i }));

    expect(
      await screen.findByText(/gst already in use/i)
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls onCancel when cancel is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<SupplierForm organizationId="org-1" onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────
// Edit mode
// ─────────────────────────────────────────────────────────────

describe("SupplierForm (edit)", () => {
  it("pre-fills the form and shows the segmented status control", () => {
    render(<SupplierForm organizationId="org-1" supplier={makeSupplier()} />);

    expect(
      screen.getByRole("heading", { name: /edit supplier/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/supplier name/i)).toHaveValue(
      "Acme Industries"
    );
    expect(screen.getByLabelText(/ifsc code/i)).toHaveValue("HDFC0001234");
    expect(screen.getByLabelText(/^tags$/i)).toHaveValue("preferred");
    expect(screen.getByRole("radio", { name: "Active" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(
      screen.getByRole("button", { name: /save changes/i })
    ).toBeInTheDocument();
  });

  it("submits update with the supplier id and status", async () => {
    mockUpdate.mockResolvedValue({
      success: true,
      data: makeSupplier(),
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <SupplierForm
        organizationId="org-1"
        supplier={makeSupplier()}
        onSuccess={onSuccess}
      />
    );

    await user.clear(screen.getByLabelText(/supplier name/i));
    await user.type(screen.getByLabelText(/supplier name/i), "Acme Corp");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [orgId, supplierId, formData] = mockUpdate.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(supplierId).toBe("supplier-1");
    expect(formData.get("name")).toBe("Acme Corp");
    expect(formData.get("status")).toBe("active");
    expect(mockCreate).not.toHaveBeenCalled();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("submits the status chosen from the segmented control", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: makeSupplier() });
    const user = userEvent.setup();
    render(<SupplierForm organizationId="org-1" supplier={makeSupplier()} />);

    await user.click(screen.getByRole("radio", { name: "Inactive" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [, , formData] = mockUpdate.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(formData.get("status")).toBe("inactive");
  });
});
