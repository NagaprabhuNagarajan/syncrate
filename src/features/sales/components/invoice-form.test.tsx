import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@/tests/utils";
import {
  InvoiceForm,
  type CustomerOption,
  type ProductOption,
  type BranchOption,
} from "./invoice-form";

const { mockPush, createActionMock, updateActionMock } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  createActionMock: vi.fn(),
  updateActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/sales/actions/invoice.actions", () => ({
  createInvoiceAction: createActionMock,
  updateInvoiceAction: updateActionMock,
}));

const customers: CustomerOption[] = [
  {
    id: "cust-1",
    name: "Acme Retail",
    billingState: "Karnataka",
    shippingState: "Karnataka",
  },
];
const products: ProductOption[] = [
  { id: "p-1", name: "Widget", salePrice: 100, gstRate: 18 },
  { id: "p-2", name: "Gadget", salePrice: 50, gstRate: 5 },
];
const branches: BranchOption[] = [
  { id: "br-1", name: "Main WH", state: "Karnataka" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InvoiceForm", () => {
  it("prefills customer, branch and line items from a sales order", () => {
    const { container } = render(
      <InvoiceForm
        organizationId="org-1"
        orgState="Karnataka"
        customers={customers}
        products={products}
        branches={branches}
        prefill={{
          customerId: "cust-1",
          salesOrderId: "so-1",
          salesOrderNumber: "SO-00001",
          branchId: "br-1",
          supplyState: "Karnataka",
          isInterstate: false,
          items: [
            {
              productId: "p-1",
              description: "",
              quantity: 3,
              unitPrice: 120,
              discountPercent: 0,
              gstRate: 18,
            },
          ],
        }}
      />
    );

    expect(
      (container.querySelector("#customerId") as HTMLSelectElement).value
    ).toBe("cust-1");
    expect(
      (container.querySelector("#branchId") as HTMLSelectElement).value
    ).toBe("br-1");
    expect(screen.getByLabelText("Product for line 1")).toHaveValue("p-1");
    expect(screen.getByLabelText("Quantity for line 1")).toHaveValue(3);
    expect(screen.getByLabelText("Unit price for line 1")).toHaveValue(120);
  });

  it("shows the SO number as a link, not the raw sales-order id", () => {
    const { container } = render(
      <InvoiceForm
        organizationId="org-1"
        orgState="Karnataka"
        customers={customers}
        products={products}
        branches={branches}
        prefill={{
          customerId: "cust-1",
          salesOrderId: "so-uuid-123",
          salesOrderNumber: "SO-00001",
          branchId: "br-1",
          supplyState: "Karnataka",
          isInterstate: false,
          items: [],
        }}
      />
    );

    const link = screen.getByRole("link", { name: "SO-00001" });
    expect(link).toHaveAttribute(
      "href",
      "/sales-orders/so-uuid-123?org=org-1"
    );
    // The raw UUID is carried only as a hidden field, never an editable input.
    const carrier = container.querySelector('input[value="so-uuid-123"]');
    expect(carrier).toHaveAttribute("type", "hidden");
  });

  it("starts with a single empty line item when no prefill", () => {
    render(
      <InvoiceForm
        organizationId="org-1"
        orgState="Karnataka"
        customers={customers}
        products={products}
        branches={branches}
      />
    );
    expect(screen.getByLabelText("Product for line 1")).toHaveValue("");
    expect(
      screen.queryByLabelText("Product for line 2")
    ).not.toBeInTheDocument();
  });
});
