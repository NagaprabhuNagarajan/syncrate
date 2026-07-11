import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import {
  SalesOrderForm,
  type CustomerOption,
  type ProductOption,
} from "./sales-order-form";

const { mockPush, createActionMock, updateActionMock } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  createActionMock: vi.fn(),
  updateActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/sales/actions/sales-order.actions", () => ({
  createSalesOrderAction: createActionMock,
  updateSalesOrderAction: updateActionMock,
}));

const customers: CustomerOption[] = [
  {
    id: "cust-1",
    name: "Acme Retail",
    billingState: "Maharashtra",
    shippingState: "Karnataka",
  },
];
const products: ProductOption[] = [
  { id: "p-1", name: "Widget", sellingPrice: 100, gstRate: 18 },
  { id: "p-2", name: "Gadget", sellingPrice: 50, gstRate: 5 },
];

function renderForm(orgState?: string) {
  return render(
    <SalesOrderForm
      organizationId="org-1"
      orgState={orgState}
      customers={customers}
      branches={[]}
      products={products}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SalesOrderForm", () => {
  it("starts with a single line item row", () => {
    renderForm();
    expect(screen.getByLabelText("Product for line 1")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Product for line 2")
    ).not.toBeInTheDocument();
  });

  it("adds and removes line item rows", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /add item/i }));
    expect(screen.getByLabelText("Product for line 2")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Remove line 2"));
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Product for line 2")
      ).not.toBeInTheDocument()
    );
  });

  it("disables removing the only remaining row", () => {
    renderForm();
    expect(screen.getByLabelText("Remove line 1")).toBeDisabled();
  });

  it("pre-fills price/GST and updates the grand total when a product is chosen (inter-state, IGST)", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(
      screen.getByLabelText("Product for line 1"),
      "p-1"
    );

    // No org/supply state → treated as inter-state: qty 1 × 100, IGST 18% →
    // line/grand total ₹118.00
    expect(
      (screen.getByLabelText("Unit price for line 1") as HTMLInputElement)
        .value
    ).toBe("100");
    expect((await screen.findAllByText("₹118.00")).length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText("Quantity for line 1"));
    await user.type(screen.getByLabelText("Quantity for line 1"), "2");
    // 2 × 100 = 200 net, IGST 36 → ₹236.00
    expect((await screen.findAllByText("₹236.00")).length).toBeGreaterThan(0);
  });

  it("splits GST into CGST + SGST for an intra-state supply", async () => {
    const user = userEvent.setup();
    renderForm("Karnataka");

    await user.selectOptions(
      screen.getByLabelText("Product for line 1"),
      "p-1"
    );
    await user.clear(screen.getByLabelText(/supply state/i));
    await user.type(screen.getByLabelText(/supply state/i), "Karnataka");

    expect(
      await screen.findByText(/intra-state supply to/i)
    ).toBeInTheDocument();
    // taxable 100, 18% split evenly → CGST 9 + SGST 9, same ₹118.00 total
    expect((await screen.findAllByText("₹118.00")).length).toBeGreaterThan(0);
    // "CGST"/"SGST" appear both as table headers and totals dl terms.
    expect(screen.getAllByText("CGST").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SGST").length).toBeGreaterThan(0);
  });

  it("auto-fills supply state from the selected customer's shipping state", async () => {
    const user = userEvent.setup();
    renderForm();

    const supplyStateInput = screen.getByLabelText(
      /supply state/i
    ) as HTMLInputElement;
    expect(supplyStateInput.value).toBe("");

    await user.selectOptions(screen.getByLabelText(/customer/i), "cust-1");

    await waitFor(() => expect(supplyStateInput.value).toBe("Karnataka"));
  });

  it("serializes line items to a JSON field and calls the create action", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({ success: true, data: { id: "so-9" } });
    renderForm();

    await user.selectOptions(screen.getByLabelText(/customer/i), "cust-1");
    await user.selectOptions(
      screen.getByLabelText("Product for line 1"),
      "p-1"
    );
    await user.click(
      screen.getByRole("button", { name: /create sales order/i })
    );

    await waitFor(() => expect(createActionMock).toHaveBeenCalled());

    const [orgId, formData] = createActionMock.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(formData.get("customerId")).toBe("cust-1");
    const items = JSON.parse(String(formData.get("items"))) as Array<{
      productId: string;
      quantity: number;
      gstRate: number;
    }>;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      productId: "p-1",
      quantity: 1,
      gstRate: 18,
    });

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/sales-orders/so-9")
    );
  });

  it("surfaces a server error and does not navigate", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Could not save" },
    });
    renderForm();

    await user.selectOptions(screen.getByLabelText(/customer/i), "cust-1");
    await user.selectOptions(
      screen.getByLabelText("Product for line 1"),
      "p-1"
    );
    await user.click(
      screen.getByRole("button", { name: /create sales order/i })
    );

    expect(await screen.findByText("Could not save")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("blocks submission when no customer is selected", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(
      screen.getByLabelText("Product for line 1"),
      "p-1"
    );
    await user.click(
      screen.getByRole("button", { name: /create sales order/i })
    );

    await waitFor(() =>
      expect(screen.getByText("Customer is required")).toBeInTheDocument()
    );
    expect(createActionMock).not.toHaveBeenCalled();
  });

  it("falls back to a zero GST rate for products outside the allowed slabs", async () => {
    const user = userEvent.setup();
    render(
      <SalesOrderForm
        organizationId="org-1"
        customers={customers}
        branches={[]}
        products={[
          { id: "p-3", name: "Oddment", sellingPrice: 200, gstRate: 9 },
        ]}
      />
    );

    await user.selectOptions(
      screen.getByLabelText("Product for line 1"),
      "p-3"
    );
    // gstRate 9 is not an allowed slab → GST rate resets to 0%, total = 200
    expect(
      (screen.getByLabelText(/gst rate for line 1/i) as HTMLSelectElement)
        .value
    ).toBe("0");
    expect((await screen.findAllByText("₹200.00")).length).toBeGreaterThan(0);
  });

  it("pre-populates fields and calls the update action in edit mode", async () => {
    const user = userEvent.setup();
    updateActionMock.mockResolvedValue({ success: true, data: { id: "so-1" } });

    const order = {
      id: "so-1",
      organizationId: "org-1",
      soNumber: "SO-00001",
      customerId: "cust-1",
      branchId: null,
      salespersonId: null,
      referenceNumber: null,
      status: "draft" as const,
      orderDate: new Date("2026-06-01"),
      deliveryDate: null,
      paymentTermsDays: 30,
      supplyState: null,
      isInterstate: true,
      notes: "existing note",
      terms: null,
      subtotal: 100,
      discountAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 18,
      taxAmount: 18,
      roundOff: 0,
      totalAmount: 118,
      approvedBy: null,
      approvedAt: null,
      convertedInvId: null,
      createdAt: new Date("2026-06-01"),
      updatedAt: new Date("2026-06-01"),
      createdBy: "user-1",
      version: 4,
      items: [
        {
          id: "item-1",
          organizationId: "org-1",
          salesOrderId: "so-1",
          productId: "p-1",
          description: "Widget",
          hsnCode: null,
          quantity: 1,
          deliveredQty: 0,
          unitPrice: 100,
          discountPercent: 0,
          discountAmount: 0,
          taxableAmount: 100,
          gstRate: 18,
          cgstRate: 0,
          sgstRate: 0,
          igstRate: 18,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 18,
          taxAmount: 18,
          lineTotal: 118,
          sortOrder: 0,
          createdAt: new Date("2026-06-01"),
          createdBy: "user-1",
        },
      ],
    };

    render(
      <SalesOrderForm
        organizationId="org-1"
        customers={customers}
        branches={[]}
        products={products}
        salesOrder={order}
      />
    );

    expect(screen.getByText("Edit sales order")).toBeInTheDocument();
    expect(
      (screen.getByLabelText("Quantity for line 1") as HTMLInputElement).value
    ).toBe("1");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateActionMock).toHaveBeenCalledWith(
        "org-1",
        "so-1",
        expect.any(FormData)
      )
    );

    // The loaded optimistic-lock version is forwarded to the update action.
    const [, , formData] = updateActionMock.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(formData.get("version")).toBe("4");
  });
});
