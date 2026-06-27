import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@/tests/utils";
import type {
  Supplier,
  SupplierLedger,
} from "@/features/supplier/types/supplier.types";
import { SupplierProfile } from "./supplier-profile";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockArchiveSupplier } = vi.hoisted(() => ({
  mockArchiveSupplier: vi.fn(),
}));

vi.mock("@/features/supplier/actions/supplier.actions", () => ({
  archiveSupplierAction: mockArchiveSupplier,
}));

const ORG_ID = "org-1";

function buildSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
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
    ...overrides,
  };
}

const LEDGER: SupplierLedger = {
  openingBalance: 1000,
  outstanding: 1500,
  entries: [
    {
      id: "entry-1",
      supplierId: "supplier-1",
      entryDate: new Date("2026-01-05T00:00:00Z"),
      referenceType: "purchase",
      referenceId: "po-1",
      description: "Purchase order PO-1",
      debit: 0,
      credit: 500,
      runningBalance: 1500,
      createdAt: new Date("2026-01-05T00:00:00Z"),
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SupplierProfile", () => {
  it("renders the supplier name, code, status, rating and tags", () => {
    render(
      <SupplierProfile
        organizationId={ORG_ID}
        supplier={buildSupplier()}
        ledger={LEDGER}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Acme Industries" })
    ).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText(/4\.5 \/ 5/)).toBeInTheDocument();
    expect(screen.getByText("preferred")).toBeInTheDocument();
  });

  it("renders contact, bank and notes details", () => {
    render(
      <SupplierProfile
        organizationId={ORG_ID}
        supplier={buildSupplier()}
        ledger={LEDGER}
      />
    );

    expect(screen.getByText("Ramesh Kumar")).toBeInTheDocument();
    expect(screen.getByText("acme@example.com")).toBeInTheDocument();
    expect(screen.getByText("HDFC0001234")).toBeInTheDocument();
    expect(screen.getByText("acme@okhdfcbank")).toBeInTheDocument();
    expect(screen.getByText("Reliable supplier")).toBeInTheDocument();
  });

  it("renders payables outstanding and ledger entries", () => {
    render(
      <SupplierProfile
        organizationId={ORG_ID}
        supplier={buildSupplier()}
        ledger={LEDGER}
      />
    );

    expect(screen.getByText(/outstanding/i)).toBeInTheDocument();
    expect(screen.getByText("Purchase order PO-1")).toBeInTheDocument();
  });

  it("shows an empty ledger message when there are no entries", () => {
    render(
      <SupplierProfile
        organizationId={ORG_ID}
        supplier={buildSupplier()}
        ledger={{ openingBalance: 0, outstanding: 0, entries: [] }}
      />
    );

    expect(screen.getByText(/no ledger entries yet/i)).toBeInTheDocument();
  });

  it("links to the edit page with the org param", () => {
    render(
      <SupplierProfile
        organizationId={ORG_ID}
        supplier={buildSupplier()}
        ledger={LEDGER}
      />
    );

    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      `/suppliers/supplier-1/edit?org=${ORG_ID}`
    );
  });

  it("archives the supplier through the confirmation dialog", async () => {
    mockArchiveSupplier.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(
      <SupplierProfile
        organizationId={ORG_ID}
        supplier={buildSupplier()}
        ledger={LEDGER}
      />
    );

    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /archive supplier/i })
    );

    await waitFor(() =>
      expect(mockArchiveSupplier).toHaveBeenCalledWith(ORG_ID, "supplier-1")
    );
  });

  it("does not render an archive control for archived suppliers", () => {
    render(
      <SupplierProfile
        organizationId={ORG_ID}
        supplier={buildSupplier({ status: "archived" })}
        ledger={LEDGER}
      />
    );

    expect(
      screen.queryByRole("button", { name: /^archive$/i })
    ).not.toBeInTheDocument();
  });
});
