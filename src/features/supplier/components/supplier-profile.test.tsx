import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { SupplierProfile } from "./supplier-profile";
import type {
  Supplier,
  SupplierLedger,
} from "@/features/supplier/types/supplier.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockArchive, mockPush, searchParamsRef } = vi.hoisted(() => ({
  mockArchive: vi.fn(),
  mockPush: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("@/features/supplier/actions/supplier.actions", () => ({
  archiveSupplierAction: mockArchive,
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

function makeLedger(overrides: Partial<SupplierLedger> = {}): SupplierLedger {
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

describe("SupplierProfile", () => {
  it("renders supplier details and an empty ledger state", () => {
    render(
      <SupplierProfile
        supplier={makeSupplier()}
        ledger={makeLedger()}
        organizationId="org-1"
        canManage
      />
    );

    expect(
      screen.getByRole("heading", { name: /acme industries/i })
    ).toBeInTheDocument();
    expect(screen.getByText("acme@example.com")).toBeInTheDocument();
    expect(screen.getByText("preferred")).toBeInTheDocument();
    expect(screen.getByText(/no ledger entries yet/i)).toBeInTheDocument();
  });

  it("renders ledger entries when present", () => {
    render(
      <SupplierProfile
        supplier={makeSupplier()}
        ledger={makeLedger({
          entries: [
            {
              id: "led-1",
              supplierId: "supplier-1",
              entryDate: new Date("2026-02-01"),
              referenceType: "purchase_invoice",
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
      <SupplierProfile
        supplier={makeSupplier()}
        ledger={makeLedger()}
        organizationId="org-1"
        canManage
      />
    );
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/suppliers/supplier-1/edit?org=org-9"
    );
  });

  it("hides management actions when the user cannot manage", () => {
    render(
      <SupplierProfile
        supplier={makeSupplier()}
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

  it("archives the supplier through the confirmation dialog", async () => {
    mockArchive.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(
      <SupplierProfile
        supplier={makeSupplier()}
        ledger={makeLedger()}
        organizationId="org-1"
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Archive supplier" })
    );

    await waitFor(() =>
      expect(mockArchive).toHaveBeenCalledWith("org-1", "supplier-1")
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/suppliers"));
  });

  it("shows an error when archiving fails", async () => {
    mockArchive.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Failed to archive supplier" },
    });
    const user = userEvent.setup();
    render(
      <SupplierProfile
        supplier={makeSupplier()}
        ledger={makeLedger()}
        organizationId="org-1"
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    await user.click(
      screen.getByRole("button", { name: "Archive supplier" })
    );

    expect(
      await screen.findByText(/failed to archive supplier/i)
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("hides the archive action for an already-archived supplier", () => {
    render(
      <SupplierProfile
        supplier={makeSupplier({ status: "archived" })}
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
