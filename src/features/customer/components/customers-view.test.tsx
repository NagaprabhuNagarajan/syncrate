import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { CustomersView } from "./customers-view";
import type {
  Customer,
  CustomerListResult,
} from "@/features/customer/types/customer.types";

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

vi.mock("@/features/customer/actions/customer.actions", () => ({
  exportCustomersAction: exportActionMock,
  importCustomersAction: importActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    organizationId: "org-1",
    code: "CUST-001",
    name: "Kumar Traders",
    company: "Kumar Traders Pvt. Ltd.",
    gstNumber: "22AAAAA0000A1Z5",
    panNumber: null,
    mobile: "+91 98765 43210",
    email: null,
    website: null,
    billingAddressLine1: null,
    billingAddressLine2: null,
    billingCity: null,
    billingState: null,
    billingPincode: null,
    billingCountry: "IN",
    shippingAddressLine1: null,
    shippingAddressLine2: null,
    shippingCity: null,
    shippingState: null,
    shippingPincode: null,
    shippingCountry: null,
    creditLimit: 50000,
    paymentTermsDays: 30,
    preferredPaymentMethod: null,
    openingBalance: 0,
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
  overrides: Partial<CustomerListResult> = {}
): CustomerListResult {
  return {
    items: [makeCustomer()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("CustomersView", () => {
  it("renders the heading, table rows and add-customer link when canManage", () => {
    render(
      <CustomersView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );

    expect(
      screen.getByRole("heading", { name: /customers/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Kumar Traders")).toBeInTheDocument();
    expect(screen.getByText("CUST-001")).toBeInTheDocument();
    expect(screen.getByText("Active", { selector: "div" })).toBeInTheDocument();
    const addLink = screen.getByRole("link", { name: /add customer/i });
    expect(addLink).toHaveAttribute("href", "/customers/new");
  });

  it("hides the add-customer link when the user cannot manage", () => {
    render(
      <CustomersView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /add customer/i })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no customers", () => {
    render(
      <CustomersView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/no customers found/i)).toBeInTheDocument();
  });

  it("navigates via the empty-state action when canManage", async () => {
    const user = userEvent.setup();
    render(
      <CustomersView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /add customer/i }));
    expect(mockPush).toHaveBeenCalledWith("/customers/new");
  });

  it("updates the URL when a search is submitted", async () => {
    const user = userEvent.setup();
    render(
      <CustomersView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.type(screen.getByLabelText(/search customers/i), "kumar{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/customers?search=kumar");
  });

  it("updates the URL when the status filter changes", async () => {
    const user = userEvent.setup();
    render(
      <CustomersView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      "blacklisted"
    );
    expect(mockPush).toHaveBeenCalledWith("/customers?status=blacklisted");
  });

  it("paginates to the next page", async () => {
    const user = userEvent.setup();
    render(
      <CustomersView
        organizationId="org-1"
        result={makeResult({
          items: [makeCustomer(), makeCustomer({ id: "cust-2" })],
          total: 45,
          page: 1,
          pageSize: 20,
        })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/customers?page=2");
  });

  it("navigates to the customer detail when a row is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CustomersView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByText("CUST-001"));
    expect(mockPush).toHaveBeenCalledWith("/customers/cust-1");
  });

  it("renders an em dash for missing company, mobile and GST", () => {
    render(
      <CustomersView
        organizationId="org-1"
        result={makeResult({
          items: [
            makeCustomer({ company: null, mobile: null, gstNumber: null }),
          ],
        })}
        filters={{}}
        canManage
      />
    );
    // Three "—" cells (company, mobile, GST) for the single row.
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("hides the export and import buttons when the user cannot manage", () => {
    render(
      <CustomersView
        organizationId="org-1"
        result={makeResult()}
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

  it("exports customers and triggers a CSV download", async () => {
    const user = userEvent.setup();
    exportActionMock.mockResolvedValue({ success: true, data: "code,name\r\nC1,Acme" });

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
      <CustomersView
        organizationId="org-1"
        result={makeResult()}
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
      <CustomersView
        organizationId="org-1"
        result={makeResult()}
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
      <CustomersView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );

    expect(
      screen.queryByRole("dialog", { name: /import customers/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(
      screen.getByRole("dialog", { name: /import customers/i })
    ).toBeInTheDocument();
  });

  it("preserves the active org param in links and navigation", async () => {
    searchParamsRef.current = "org=org-9";
    const user = userEvent.setup();
    render(
      <CustomersView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("link", { name: /add customer/i })).toHaveAttribute(
      "href",
      "/customers/new?org=org-9"
    );
    await user.click(screen.getByText("CUST-001"));
    expect(mockPush).toHaveBeenCalledWith("/customers/cust-1?org=org-9");
  });
});
