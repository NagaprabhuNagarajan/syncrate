import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import type { Supplier } from "@/features/supplier/types/supplier.types";
import { SupplierForm } from "./supplier-form";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockCreateSupplier, mockUpdateSupplier } = vi.hoisted(() => ({
  mockCreateSupplier: vi.fn(),
  mockUpdateSupplier: vi.fn(),
}));

vi.mock("@/features/supplier/actions/supplier.actions", () => ({
  createSupplierAction: mockCreateSupplier,
  updateSupplierAction: mockUpdateSupplier,
}));

const ORG_ID = "org-1";

const EXISTING_SUPPLIER: Supplier = {
  id: "supplier-1",
  organizationId: ORG_ID,
  code: "SUPP-00001",
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
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "user-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Create mode
// ─────────────────────────────────────────────────────────────

describe("SupplierForm — create mode", () => {
  it("renders the create heading and key fields", () => {
    render(<SupplierForm organizationId={ORG_ID} />);

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
    // Status select is edit-only.
    expect(screen.queryByLabelText(/^status$/i)).not.toBeInTheDocument();
  });

  it("shows a validation error and does not submit when name is too short", async () => {
    const user = userEvent.setup();
    render(<SupplierForm organizationId={ORG_ID} />);

    await user.type(screen.getByLabelText(/supplier name/i), "A");
    await user.click(screen.getByRole("button", { name: /create supplier/i }));

    expect(
      await screen.findByText(/name must be at least 2 characters/i)
    ).toBeInTheDocument();
    expect(mockCreateSupplier).not.toHaveBeenCalled();
  });

  it("submits create with normalized form data", async () => {
    mockCreateSupplier.mockResolvedValue({
      success: true,
      data: { id: "supplier-2" },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<SupplierForm organizationId={ORG_ID} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/supplier name/i), "Acme Industries");
    await user.type(screen.getByLabelText(/contact person/i), "Ramesh");
    await user.type(screen.getByLabelText(/^rating$/i), "4.5");
    await user.type(screen.getByLabelText(/^tags$/i), "preferred");
    await user.click(screen.getByRole("button", { name: /create supplier/i }));

    await waitFor(() => expect(mockCreateSupplier).toHaveBeenCalledTimes(1));
    const [orgArg, formData] = mockCreateSupplier.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(orgArg).toBe(ORG_ID);
    expect(formData.get("name")).toBe("Acme Industries");
    expect(formData.get("contactPerson")).toBe("Ramesh");
    expect(formData.get("rating")).toBe("4.5");
    expect(formData.get("tags")).toBe("preferred");
    // Status not sent in create mode.
    expect(formData.get("status")).toBeNull();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("displays a server error returned by the create action", async () => {
    mockCreateSupplier.mockResolvedValue({
      success: false,
      error: { code: "duplicate_gst", message: "GST already in use" },
    });
    const user = userEvent.setup();
    render(<SupplierForm organizationId={ORG_ID} />);

    await user.type(screen.getByLabelText(/supplier name/i), "Acme Industries");
    await user.click(screen.getByRole("button", { name: /create supplier/i }));

    expect(
      await screen.findByText(/gst already in use/i)
    ).toBeInTheDocument();
  });

  it("calls onCancel when cancel is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<SupplierForm organizationId={ORG_ID} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────
// Edit mode
// ─────────────────────────────────────────────────────────────

describe("SupplierForm — edit mode", () => {
  it("pre-fills the form and shows the status select", () => {
    render(
      <SupplierForm organizationId={ORG_ID} supplier={EXISTING_SUPPLIER} />
    );

    expect(
      screen.getByRole("heading", { name: /edit supplier/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/supplier name/i)).toHaveValue(
      "Acme Industries"
    );
    expect(screen.getByLabelText(/ifsc code/i)).toHaveValue("HDFC0001234");
    expect(screen.getByLabelText(/^tags$/i)).toHaveValue("preferred");
    expect(screen.getByLabelText(/^status$/i)).toHaveValue("active");
    expect(
      screen.getByRole("button", { name: /save changes/i })
    ).toBeInTheDocument();
  });

  it("submits update with the supplier id and status", async () => {
    mockUpdateSupplier.mockResolvedValue({
      success: true,
      data: { id: EXISTING_SUPPLIER.id },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <SupplierForm
        organizationId={ORG_ID}
        supplier={EXISTING_SUPPLIER}
        onSuccess={onSuccess}
      />
    );

    await user.clear(screen.getByLabelText(/supplier name/i));
    await user.type(screen.getByLabelText(/supplier name/i), "Acme Corp");
    await user.selectOptions(screen.getByLabelText(/^status$/i), "inactive");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdateSupplier).toHaveBeenCalledTimes(1));
    const [orgArg, supplierArg, formData] = mockUpdateSupplier.mock
      .calls[0] as [string, string, FormData];
    expect(orgArg).toBe(ORG_ID);
    expect(supplierArg).toBe(EXISTING_SUPPLIER.id);
    expect(formData.get("name")).toBe("Acme Corp");
    expect(formData.get("status")).toBe("inactive");
    expect(mockCreateSupplier).not.toHaveBeenCalled();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
