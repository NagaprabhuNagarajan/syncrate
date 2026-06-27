import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { PurchaseInvoicesView } from "./purchase-invoices-view";
import type {
  PurchaseInvoiceListItem,
  PurchaseInvoiceListResult,
} from "@/features/purchase/types/purchase-invoice.types";

const { mockPush, searchParamsRef } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

function makeInvoice(
  overrides: Partial<PurchaseInvoiceListItem> = {}
): PurchaseInvoiceListItem {
  return {
    id: "pinv-1",
    organizationId: "org-1",
    invoiceNumber: "PINV-00001",
    supplierInvoiceNumber: null,
    purchaseOrderId: null,
    supplierId: "sup-1",
    supplierName: "Acme Supply",
    status: "draft",
    invoiceDate: new Date("2026-06-01"),
    dueDate: null,
    subtotal: 1000,
    discountAmount: 0,
    taxAmount: 180,
    totalAmount: 1180,
    amountPaid: 0,
    notes: null,
    postedAt: null,
    postedBy: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeResult(
  items: PurchaseInvoiceListItem[],
  overrides: Partial<PurchaseInvoiceListResult> = {}
): PurchaseInvoiceListResult {
  return { items, total: items.length, page: 1, pageSize: 20, ...overrides };
}

describe("PurchaseInvoicesView", () => {
  it("renders an empty state when there are no invoices", () => {
    render(
      <PurchaseInvoicesView
        organizationId="org-1"
        result={makeResult([])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("No purchase invoices found")).toBeInTheDocument();
  });

  it("renders invoices with supplier name, status and total", () => {
    render(
      <PurchaseInvoicesView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("PINV-00001")).toBeInTheDocument();
    expect(screen.getByText("Acme Supply")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getByText("₹1,180.00")).toBeInTheDocument();
  });

  it("shows the new invoice button only when canManage is true", () => {
    const { rerender } = render(
      <PurchaseInvoicesView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /new purchase invoice/i })
    ).toBeInTheDocument();

    rerender(
      <PurchaseInvoicesView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /new purchase invoice/i })
    ).not.toBeInTheDocument();
  });

  it("pushes a search query on submit", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseInvoicesView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        filters={{}}
        canManage
      />
    );
    await user.type(
      screen.getByLabelText("Search purchase invoices"),
      "PINV-001"
    );
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/purchases/invoices?search=PINV-001");
  });

  it("pushes a status filter change", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseInvoicesView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        filters={{}}
        canManage
      />
    );
    await user.selectOptions(
      screen.getByLabelText("Filter by status"),
      "posted"
    );
    expect(mockPush).toHaveBeenCalledWith("/purchases/invoices?status=posted");
  });
});
