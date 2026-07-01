import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { SuppliersView } from "./suppliers-view";
import type {
  Supplier,
  SupplierListResult,
  SupplierStats,
} from "@/features/supplier/types/supplier.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockPush, mockRefresh, searchParamsRef, exportActionMock, importActionMock } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockRefresh: vi.fn(),
    searchParamsRef: { current: "" },
    exportActionMock: vi.fn(),
    importActionMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("@/features/supplier/actions/supplier.actions", () => ({
  exportSuppliersAction: exportActionMock,
  importSuppliersAction: importActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
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
    panNumber: null,
    mobile: "+91 98765 43210",
    email: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    pincode: null,
    country: "IN",
    bankAccountName: null,
    bankAccountNumber: null,
    bankIfsc: null,
    bankName: null,
    upiId: null,
    paymentTermsDays: 30,
    openingBalance: 0,
    rating: null,
    status: "active",
    tags: [],
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<SupplierListResult> = {}
): SupplierListResult {
  return {
    items: [makeSupplier()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

function makeStats(overrides: Partial<SupplierStats> = {}): SupplierStats {
  return {
    total: 1,
    active: 1,
    newThisMonth: 1,
    inactive: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SuppliersView", () => {
  it("renders the heading, table rows and add-supplier link when canManage", () => {
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );

    expect(
      screen.getByRole("heading", { name: /suppliers/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Acme Industries")).toBeInTheDocument();
    expect(screen.getByText("SUPP-001")).toBeInTheDocument();
    expect(screen.getByText("Active", { selector: "div" })).toBeInTheDocument();
    const addLink = screen.getByRole("link", { name: /add supplier/i });
    expect(addLink).toHaveAttribute("href", "/suppliers/new");
  });

  it("hides the add-supplier link when the user cannot manage", () => {
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /add supplier/i })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no suppliers", () => {
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/no suppliers yet/i)).toBeInTheDocument();
  });

  it("navigates via the empty-state action when canManage", async () => {
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /add supplier/i }));
    expect(mockPush).toHaveBeenCalledWith("/suppliers/new");
  });

  it("updates the URL when a search is submitted", async () => {
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.type(screen.getByLabelText(/search suppliers/i), "acme{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/suppliers?search=acme");
  });

  it("clears the search filter when the field is emptied", async () => {
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{ search: "acme" }}
        canManage
      />
    );
    await user.clear(screen.getByLabelText(/search suppliers/i));
    expect(mockPush).toHaveBeenCalledWith("/suppliers");
  });

  it("updates the URL when the status filter changes", async () => {
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("tab", { name: "Inactive" }));
    expect(mockPush).toHaveBeenCalledWith("/suppliers?status=inactive");
  });

  it("paginates to the next page", async () => {
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult({
          items: [makeSupplier(), makeSupplier({ id: "supplier-2" })],
          total: 45,
          page: 1,
          pageSize: 20,
        })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/suppliers?page=2");
  });

  it("navigates to the supplier detail when a row is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByText("SUPP-001"));
    expect(mockPush).toHaveBeenCalledWith("/suppliers/supplier-1");
  });

  it("renders an em dash for missing contact person and contact details", () => {
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult({
          items: [
            makeSupplier({ contactPerson: null, mobile: null, email: null }),
          ],
        })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    // Two "—" cells (contact person and the combined contact column) for the row.
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("renders the payment terms in days", () => {
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult({ items: [makeSupplier({ paymentTermsDays: 45 })] })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("45 days")).toBeInTheDocument();
  });

  it("hides the export and import buttons when the user cannot manage", () => {
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /export/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /import/i })
    ).not.toBeInTheDocument();
  });

  it("exports suppliers and triggers a CSV download", async () => {
    const user = userEvent.setup();
    exportActionMock.mockResolvedValue({ success: true, data: "code,name\r\nS1,Acme" });

    const createUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake");
    const revokeUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /export/i }));

    expect(exportActionMock).toHaveBeenCalledWith("org-1");
    expect(createUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith("blob:fake");

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });

  it("surfaces an export error without downloading", async () => {
    const user = userEvent.setup();
    exportActionMock.mockResolvedValue({
      success: false,
      error: { code: "forbidden", message: "Not allowed" },
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /export/i }));

    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("opens the import dialog when import is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );

    expect(
      screen.queryByRole("dialog", { name: /import suppliers/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(
      screen.getByRole("dialog", { name: /import suppliers/i })
    ).toBeInTheDocument();
  });

  it("preserves the active org param in links and navigation", async () => {
    searchParamsRef.current = "org=org-9";
    const user = userEvent.setup();
    render(
      <SuppliersView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("link", { name: /add supplier/i })).toHaveAttribute(
      "href",
      "/suppliers/new?org=org-9"
    );
    await user.click(screen.getByText("SUPP-001"));
    expect(mockPush).toHaveBeenCalledWith("/suppliers/supplier-1?org=org-9");
  });
});
