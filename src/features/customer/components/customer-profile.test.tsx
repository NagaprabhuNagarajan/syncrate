import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { CustomerProfile } from "./customer-profile";
import type {
  Customer,
  CustomerLedger,
} from "@/features/customer/types/customer.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockArchive, mockPush, searchParamsRef } = vi.hoisted(() => ({
  mockArchive: vi.fn(),
  mockPush: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("@/features/customer/actions/customer.actions", () => ({
  archiveCustomerAction: mockArchive,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
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
    email: "kumar@example.com",
    website: null,
    billingAddressLine1: "12 Market Road",
    billingAddressLine2: null,
    billingCity: "Mumbai",
    billingState: "Maharashtra",
    billingPincode: "400001",
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
    openingBalance: 1000,
    status: "active",
    tags: ["vip"],
    notes: "Prefers morning deliveries",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeLedger(overrides: Partial<CustomerLedger> = {}): CustomerLedger {
  return {
    openingBalance: 1000,
    outstanding: 1000,
    entries: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("CustomerProfile", () => {
  it("renders customer details and an empty ledger state", () => {
    render(
      <CustomerProfile
        customer={makeCustomer()}
        ledger={makeLedger()}
        organizationId="org-1"
        canManage
      />
    );

    expect(
      screen.getByRole("heading", { name: /kumar traders/i })
    ).toBeInTheDocument();
    expect(screen.getByText("kumar@example.com")).toBeInTheDocument();
    expect(screen.getByText("vip")).toBeInTheDocument();
    expect(screen.getByText(/no ledger entries yet/i)).toBeInTheDocument();
  });

  it("renders ledger entries when present", () => {
    render(
      <CustomerProfile
        customer={makeCustomer()}
        ledger={makeLedger({
          entries: [
            {
              id: "led-1",
              customerId: "cust-1",
              entryDate: new Date("2026-02-01"),
              referenceType: "invoice",
              referenceId: "inv-1",
              description: "Invoice INV-001",
              debit: 5000,
              credit: 0,
              runningBalance: 6000,
              createdAt: new Date("2026-02-01"),
            },
          ],
        })}
        organizationId="org-1"
        canManage
      />
    );
    expect(screen.getByText("Invoice INV-001")).toBeInTheDocument();
    expect(
      screen.queryByText(/no ledger entries yet/i)
    ).not.toBeInTheDocument();
  });

  it("renders an edit link that preserves the org param", () => {
    searchParamsRef.current = "org=org-9";
    render(
      <CustomerProfile
        customer={makeCustomer()}
        ledger={makeLedger()}
        organizationId="org-1"
        canManage
      />
    );
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/customers/cust-1/edit?org=org-9"
    );
  });

  it("hides management actions when the user cannot manage", () => {
    render(
      <CustomerProfile
        customer={makeCustomer()}
        ledger={makeLedger()}
        organizationId="org-1"
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /edit/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archive" })
    ).not.toBeInTheDocument();
  });

  it("archives the customer through the confirmation dialog", async () => {
    mockArchive.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(
      <CustomerProfile
        customer={makeCustomer()}
        ledger={makeLedger()}
        organizationId="org-1"
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Archive customer" })
    );

    await waitFor(() =>
      expect(mockArchive).toHaveBeenCalledWith("org-1", "cust-1")
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/customers"));
  });

  it("shows an error when archiving fails", async () => {
    mockArchive.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Failed to archive customer" },
    });
    const user = userEvent.setup();
    render(
      <CustomerProfile
        customer={makeCustomer()}
        ledger={makeLedger()}
        organizationId="org-1"
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    await user.click(
      screen.getByRole("button", { name: "Archive customer" })
    );

    expect(
      await screen.findByText(/failed to archive customer/i)
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("hides the archive action for an already-archived customer", () => {
    render(
      <CustomerProfile
        customer={makeCustomer({ status: "archived" })}
        ledger={makeLedger()}
        organizationId="org-1"
        canManage
      />
    );
    expect(
      screen.queryByRole("button", { name: "Archive" })
    ).not.toBeInTheDocument();
    // Edit remains available.
    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
  });
});
