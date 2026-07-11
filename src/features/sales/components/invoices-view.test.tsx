import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
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
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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

// The payment dialog owns its own action/form; stub it so these tests stay
// focused on the list's selection + bulk-bar behaviour.
vi.mock("@/features/payment/components/record-customer-payment-dialog", () => ({
  RecordCustomerPaymentDialog: ({
    customerName,
  }: {
    customerName: string;
  }) => (
    <div role="dialog" aria-label="Record customer payment">
      Payment for {customerName}
    </div>
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
    branchId: null,
    salespersonId: null,
    referenceNumber: null,
    invoiceDate: new Date("2026-01-15"),
    dueDate: new Date("2026-02-15"),
    paymentTermsDays: 30,
    supplyState: "Maharashtra",
    isInterstate: false,
    status: "posted",
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

const zeroStats = {
  total: 0,
  draft: 0,
  posted: 0,
  cancelled: 0,
  totalInvoiced: 0,
  outstanding: 0,
  overdue: 0,
  paid: 0,
} as const;

function renderView(
  props: Partial<React.ComponentProps<typeof InvoicesView>> = {}
) {
  return render(
    <InvoicesView
      organizationId="org-1"
      result={makeResult([])}
      stats={zeroStats}
      filters={{}}
      canManage
      canReceivePayment={false}
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("InvoicesView", () => {
  it("renders the page header", () => {
    renderView();
    expect(screen.getByRole("heading", { name: /Invoices/ })).toBeDefined();
  });

  it("shows the New invoice button when canManage is true", () => {
    renderView();
    expect(screen.getByRole("link", { name: "New invoice" })).toBeDefined();
  });

  it("hides the New invoice button when canManage is false", () => {
    renderView({ canManage: false });
    expect(screen.queryByRole("link", { name: "New invoice" })).toBeNull();
  });

  it("shows empty state when there are no invoices", () => {
    renderView();
    expect(screen.getByText("No invoices yet")).toBeDefined();
  });

  it("renders invoice rows in the table", () => {
    renderView({ result: makeResult([makeInvoice()]) });
    expect(screen.getByText("INV-0001")).toBeDefined();
    expect(screen.getByText("Acme Corp")).toBeDefined();
  });

  it("renders Draft status badge correctly", () => {
    renderView({ result: makeResult([makeInvoice({ status: "draft" })]) });
    // Badge appears inside the table row — assert at least one instance
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("renders Posted status badge correctly", () => {
    renderView({ result: makeResult([makeInvoice({ status: "posted" })]) });
    expect(screen.getAllByText("Posted").length).toBeGreaterThan(0);
  });

  it("renders Cancelled status badge correctly", () => {
    renderView({ result: makeResult([makeInvoice({ status: "cancelled" })]) });
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
  });

  it("renders Unpaid payment status badge", () => {
    renderView({
      result: makeResult([makeInvoice({ paymentStatus: "unpaid" })]),
    });
    expect(screen.getAllByText("Unpaid").length).toBeGreaterThan(0);
  });

  it("renders Paid payment status badge", () => {
    renderView({ result: makeResult([makeInvoice({ paymentStatus: "paid" })]) });
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
  });

  it("renders Overdue payment status badge", () => {
    renderView({
      result: makeResult([makeInvoice({ paymentStatus: "overdue" })]),
    });
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
  });

  it("renders pagination controls when there are items", () => {
    renderView({ result: makeResult([makeInvoice()]) });
    // Pagination is shown when items.length > 0
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDefined();
  });

  it("shows search filter input", () => {
    renderView();
    expect(
      screen.getByRole("searchbox", { name: "Search invoices" })
    ).toBeDefined();
  });

  it("shows the status filter pills", () => {
    renderView();
    const statusTablist = screen.getByRole("tablist", {
      name: "Filter by status",
    });
    expect(statusTablist).toBeDefined();
    // "All" + the three invoice statuses render as tabs
    expect(
      screen.getAllByRole("tab", { name: "Draft" }).length
    ).toBeGreaterThan(0);
  });

  it("shows the payment filter pills", () => {
    renderView();
    expect(
      screen.getByRole("tablist", { name: "Filter by payment" })
    ).toBeDefined();
    expect(
      screen.getAllByRole("tab", { name: "Overdue" }).length
    ).toBeGreaterThan(0);
  });

  it("renders multiple invoices", () => {
    const invoices = [
      makeInvoice({ id: "inv-1", invoiceNumber: "INV-0001", customerName: "Alpha" }),
      makeInvoice({ id: "inv-2", invoiceNumber: "INV-0002", customerName: "Beta" }),
    ];
    renderView({ result: makeResult(invoices) });
    expect(screen.getByText("INV-0001")).toBeDefined();
    expect(screen.getByText("INV-0002")).toBeDefined();
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
  });

  it("shows correct invoice count in pagination", () => {
    renderView({ result: { ...makeResult([makeInvoice()]), total: 42 } });
    // Pagination shows a "Showing X–Y of N" summary with the total count.
    expect(screen.getByText(/Showing/)).toBeDefined();
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
  });

  // ── Bulk pay ───────────────────────────────────────────────

  it("does not render the selection column when canReceivePayment is false", () => {
    renderView({
      result: makeResult([makeInvoice()]),
      canReceivePayment: false,
    });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("renders a selection checkbox for payable rows when canReceivePayment", () => {
    renderView({
      result: makeResult([makeInvoice()]),
      canReceivePayment: true,
    });
    expect(
      screen.getByRole("checkbox", { name: "Select all payable invoices" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select INV-0001" })
    ).toBeInTheDocument();
  });

  it("omits a row checkbox for a fully-paid invoice", () => {
    renderView({
      result: makeResult([
        makeInvoice({ paymentStatus: "paid" }),
      ]),
      canReceivePayment: true,
    });
    expect(
      screen.queryByRole("checkbox", { name: "Select INV-0001" })
    ).toBeNull();
  });

  it("shows the bulk bar with the Record payment button once a row is selected", async () => {
    const user = userEvent.setup();
    renderView({
      result: makeResult([makeInvoice()]),
      canReceivePayment: true,
    });
    // Bar is hidden until something is selected.
    expect(
      screen.queryByRole("button", { name: /record payment/i })
    ).toBeNull();

    await user.click(screen.getByRole("checkbox", { name: "Select INV-0001" }));

    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    const payButton = screen.getByRole("button", { name: /record payment/i });
    expect(payButton).toBeInTheDocument();
    expect(payButton).toBeEnabled();
  });

  it("disables Record payment when the selection spans multiple customers", async () => {
    const user = userEvent.setup();
    renderView({
      result: makeResult([
        makeInvoice({ id: "inv-1", invoiceNumber: "INV-0001", customerId: "cust-1" }),
        makeInvoice({ id: "inv-2", invoiceNumber: "INV-0002", customerId: "cust-2" }),
      ]),
      canReceivePayment: true,
    });

    await user.click(screen.getByRole("checkbox", { name: "Select INV-0001" }));
    await user.click(screen.getByRole("checkbox", { name: "Select INV-0002" }));

    expect(
      screen.getByRole("button", { name: /record payment/i })
    ).toBeDisabled();
    expect(
      screen.getByText(/single customer to record one payment/i)
    ).toBeInTheDocument();
  });

  it("opens the payment dialog for a single-customer selection", async () => {
    const user = userEvent.setup();
    renderView({
      result: makeResult([
        makeInvoice({ id: "inv-1", invoiceNumber: "INV-0001", customerId: "cust-1" }),
        makeInvoice({ id: "inv-2", invoiceNumber: "INV-0002", customerId: "cust-1" }),
      ]),
      canReceivePayment: true,
    });

    await user.click(screen.getByRole("checkbox", { name: "Select INV-0001" }));
    await user.click(screen.getByRole("checkbox", { name: "Select INV-0002" }));

    const payButton = screen.getByRole("button", { name: /record payment/i });
    expect(payButton).toBeEnabled();
    await user.click(payButton);

    expect(
      screen.getByRole("dialog", { name: "Record customer payment" })
    ).toBeInTheDocument();
  });
});
