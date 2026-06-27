import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/tests/utils";
import { InvoicesView } from "./invoices-view";
import type {
  InvoiceListItem,
  InvoiceListResult,
} from "@/features/sales/types/invoice.types";

// ─────────────────────────────────────────────────────────────
// Mock Next.js navigation hooks
// ─────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: (_key: string) => null, toString: () => "" }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeInvoice(
  overrides: Partial<InvoiceListItem> = {}
): InvoiceListItem {
  return {
    id: "inv-1",
    organizationId: "org-1",
    invoiceNumber: "INV-0001",
    invoiceType: "tax_invoice",
    customerId: "cust-1",
    customerName: "Acme Corp",
    salesOrderId: null,
    quotationId: null,
    branchId: null,
    warehouseId: null,
    salespersonId: null,
    referenceNumber: null,
    invoiceDate: new Date("2026-01-15"),
    dueDate: new Date("2026-02-15"),
    paymentTermsDays: 30,
    supplyState: "Maharashtra",
    isInterstate: false,
    status: "draft",
    paymentStatus: "unpaid",
    subtotal: 10000,
    discountAmount: 0,
    cgstAmount: 900,
    sgstAmount: 900,
    igstAmount: 0,
    taxAmount: 1800,
    roundOff: 0,
    totalAmount: 11800,
    amountPaid: 0,
    notes: null,
    terms: null,
    postedAt: null,
    postedBy: null,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    createdBy: "user-1",
    version: 1,
    ...overrides,
  };
}

function makeResult(
  items: InvoiceListItem[],
  total = items.length
): InvoiceListResult {
  return { items, total, page: 1, pageSize: 20 };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("InvoicesView", () => {
  it("renders the page header", () => {
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("heading", { name: "Invoices" })).toBeDefined();
  });

  it("shows the New invoice button when canManage is true", () => {
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("link", { name: "New invoice" })).toBeDefined();
  });

  it("hides the New invoice button when canManage is false", () => {
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([])}
        filters={{}}
        canManage={false}
      />
    );
    expect(screen.queryByRole("link", { name: "New invoice" })).toBeNull();
  });

  it("shows empty state when there are no invoices", () => {
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("No invoices found")).toBeDefined();
  });

  it("renders invoice rows in the table", () => {
    const invoice = makeInvoice();
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([invoice])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("INV-0001")).toBeDefined();
    expect(screen.getByText("Acme Corp")).toBeDefined();
  });

  it("renders Draft status badge correctly", () => {
    const invoice = makeInvoice({ status: "draft" });
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([invoice])}
        filters={{}}
        canManage
      />
    );
    // Badge appears inside the table row — assert at least one instance
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("renders Posted status badge correctly", () => {
    const invoice = makeInvoice({ status: "posted" });
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([invoice])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getAllByText("Posted").length).toBeGreaterThan(0);
  });

  it("renders Cancelled status badge correctly", () => {
    const invoice = makeInvoice({ status: "cancelled" });
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([invoice])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
  });

  it("renders Unpaid payment status badge", () => {
    const invoice = makeInvoice({ paymentStatus: "unpaid" });
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([invoice])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getAllByText("Unpaid").length).toBeGreaterThan(0);
  });

  it("renders Paid payment status badge", () => {
    const invoice = makeInvoice({ paymentStatus: "paid" });
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([invoice])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
  });

  it("renders Overdue payment status badge", () => {
    const invoice = makeInvoice({ paymentStatus: "overdue" });
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([invoice])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
  });

  it("renders pagination controls when there are items", () => {
    const invoice = makeInvoice();
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([invoice])}
        filters={{}}
        canManage
      />
    );
    // Pagination is shown when items.length > 0
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDefined();
  });

  it("shows search filter input", () => {
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("searchbox", { name: "Search invoices" })).toBeDefined();
  });

  it("shows status filter select", () => {
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("combobox", { name: "Filter by status" })).toBeDefined();
  });

  it("shows payment status filter select", () => {
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult([])}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("combobox", { name: "Filter by payment status" })
    ).toBeDefined();
  });

  it("renders multiple invoices", () => {
    const invoices = [
      makeInvoice({ id: "inv-1", invoiceNumber: "INV-0001", customerName: "Alpha" }),
      makeInvoice({ id: "inv-2", invoiceNumber: "INV-0002", customerName: "Beta" }),
    ];
    render(
      <InvoicesView
        organizationId="org-1"
        result={makeResult(invoices)}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("INV-0001")).toBeDefined();
    expect(screen.getByText("INV-0002")).toBeDefined();
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
  });

  it("shows correct invoice count in pagination", () => {
    const invoice = makeInvoice();
    render(
      <InvoicesView
        organizationId="org-1"
        result={{ ...makeResult([invoice]), total: 42 }}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/42 invoices/)).toBeDefined();
  });
});
