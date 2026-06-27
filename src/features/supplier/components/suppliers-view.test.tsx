import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@/tests/utils";
import type { Supplier } from "@/features/supplier/types/supplier.types";
import { SuppliersView } from "./suppliers-view";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockArchiveSupplier, mockExportSuppliers, mockImportSuppliers } =
  vi.hoisted(() => ({
    mockArchiveSupplier: vi.fn(),
    mockExportSuppliers: vi.fn(),
    mockImportSuppliers: vi.fn(),
  }));

vi.mock("@/features/supplier/actions/supplier.actions", () => ({
  archiveSupplierAction: mockArchiveSupplier,
  exportSuppliersAction: mockExportSuppliers,
  importSuppliersAction: mockImportSuppliers,
}));

const ORG_ID = "org-1";

function buildSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: "supplier-1",
    organizationId: ORG_ID,
    code: "SUPP-00001",
    name: "Acme Industries",
    contactPerson: "Ramesh Kumar",
    gstNumber: null,
    panNumber: null,
    mobile: "+91 98765 43210",
    email: "acme@example.com",
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: "Mumbai",
    state: "Maharashtra",
    pincode: null,
    country: "IN",
    bankAccountName: null,
    bankAccountNumber: null,
    bankIfsc: null,
    bankName: null,
    upiId: null,
    paymentTermsDays: 30,
    openingBalance: 0,
    rating: 4.5,
    status: "active",
    tags: [],
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SuppliersView", () => {
  it("renders the empty state when there are no suppliers", () => {
    render(<SuppliersView organizationId={ORG_ID} suppliers={[]} />);

    expect(screen.getByText(/no suppliers yet/i)).toBeInTheDocument();
    // The "Add supplier" header link is always present.
    expect(
      screen.getByRole("link", { name: /add supplier/i })
    ).toHaveAttribute("href", `/suppliers/new?org=${ORG_ID}`);
  });

  it("renders supplier cards with key details and links", () => {
    render(
      <SuppliersView
        organizationId={ORG_ID}
        suppliers={[buildSupplier()]}
      />
    );

    expect(
      screen.getByRole("link", { name: "Acme Industries" })
    ).toHaveAttribute("href", `/suppliers/supplier-1?org=${ORG_ID}`);
    expect(screen.getByText("SUPP-00001")).toBeInTheDocument();
    expect(screen.getByText(/4\.5/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /edit acme industries/i })
    ).toHaveAttribute("href", `/suppliers/supplier-1/edit?org=${ORG_ID}`);
  });

  it("filters suppliers by search term", async () => {
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId={ORG_ID}
        suppliers={[
          buildSupplier(),
          buildSupplier({ id: "s-2", name: "Beta Traders", code: "SUPP-2" }),
        ]}
      />
    );

    await user.type(screen.getByLabelText(/search suppliers/i), "beta");

    expect(
      screen.getByRole("link", { name: "Beta Traders" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Acme Industries" })
    ).not.toBeInTheDocument();
  });

  it("filters suppliers by status", async () => {
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId={ORG_ID}
        suppliers={[
          buildSupplier(),
          buildSupplier({
            id: "s-2",
            name: "Inactive Co",
            status: "inactive",
          }),
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: /^inactive$/i }));

    expect(
      screen.getByRole("link", { name: "Inactive Co" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Acme Industries" })
    ).not.toBeInTheDocument();
  });

  it("shows a no-match empty state when filters exclude all suppliers", async () => {
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId={ORG_ID}
        suppliers={[buildSupplier()]}
      />
    );

    await user.type(screen.getByLabelText(/search suppliers/i), "zzzzz");

    expect(screen.getByText(/no matching suppliers/i)).toBeInTheDocument();
  });

  it("opens the archive dialog and calls the action on confirm", async () => {
    mockArchiveSupplier.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId={ORG_ID}
        suppliers={[buildSupplier()]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /archive acme industries/i })
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: /archive supplier/i })
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: /archive supplier/i })
    );

    await waitFor(() =>
      expect(mockArchiveSupplier).toHaveBeenCalledWith(ORG_ID, "supplier-1")
    );
  });

  it("surfaces an archive error in the dialog", async () => {
    mockArchiveSupplier.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Could not archive" },
    });
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId={ORG_ID}
        suppliers={[buildSupplier()]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /archive acme industries/i })
    );
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /archive supplier/i })
    );

    expect(await screen.findByText(/could not archive/i)).toBeInTheDocument();
  });

  it("does not show an archive button for archived suppliers", () => {
    render(
      <SuppliersView
        organizationId={ORG_ID}
        suppliers={[buildSupplier({ status: "archived" })]}
      />
    );

    expect(
      screen.queryByRole("button", { name: /archive acme industries/i })
    ).not.toBeInTheDocument();
  });

  it("hides Export and Import controls when canManage is false", () => {
    render(<SuppliersView organizationId={ORG_ID} suppliers={[buildSupplier()]} />);

    expect(
      screen.queryByRole("button", { name: /^export$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^import$/i })
    ).not.toBeInTheDocument();
  });

  it("downloads a CSV when Export is clicked", async () => {
    const createUrl = vi.fn(() => "blob:url");
    const revokeUrl = vi.fn();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    Object.defineProperty(URL, "createObjectURL", {
      value: createUrl,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeUrl,
      configurable: true,
    });
    mockExportSuppliers.mockResolvedValue({
      success: true,
      data: "code,name\r\nSUPP-1,Acme",
    });

    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId={ORG_ID}
        suppliers={[buildSupplier()]}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /^export$/i }));

    await waitFor(() =>
      expect(mockExportSuppliers).toHaveBeenCalledWith(ORG_ID)
    );
    expect(createUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("surfaces an export error", async () => {
    mockExportSuppliers.mockResolvedValue({
      success: false,
      error: { code: "forbidden", message: "Export denied" },
    });

    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId={ORG_ID}
        suppliers={[buildSupplier()]}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /^export$/i }));

    expect(await screen.findByText(/export denied/i)).toBeInTheDocument();
  });

  it("opens the import dialog from the Import button", async () => {
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId={ORG_ID}
        suppliers={[buildSupplier()]}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(
      screen.getByRole("dialog", { name: /import suppliers/i })
    ).toBeInTheDocument();
  });
});
