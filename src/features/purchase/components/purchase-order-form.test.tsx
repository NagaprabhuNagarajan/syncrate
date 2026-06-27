import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import {
  PurchaseOrderForm,
  type ProductOption,
  type SupplierOption,
} from "./purchase-order-form";

const { mockPush, createActionMock, updateActionMock } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  createActionMock: vi.fn(),
  updateActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/purchase/actions/purchase-order.actions", () => ({
  createPurchaseOrderAction: createActionMock,
  updatePurchaseOrderAction: updateActionMock,
}));

const suppliers: SupplierOption[] = [{ id: "sup-1", name: "Acme Supply" }];
const products: ProductOption[] = [
  { id: "p-1", name: "Widget", purchasePrice: 100, gstRate: 18 },
  { id: "p-2", name: "Gadget", purchasePrice: 50, gstRate: 5 },
];

function renderForm() {
  return render(
    <PurchaseOrderForm
      organizationId="org-1"
      suppliers={suppliers}
      warehouses={[]}
      products={products}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PurchaseOrderForm", () => {
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

  it("pre-fills price/tax and updates the grand total when a product is chosen", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");

    // qty 1 × 100, tax 18% → line/grand total ₹118.00
    expect(
      (screen.getByLabelText("Unit price for line 1") as HTMLInputElement).value
    ).toBe("100");
    expect((await screen.findAllByText("₹118.00")).length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText("Quantity for line 1"));
    await user.type(screen.getByLabelText("Quantity for line 1"), "2");
    // 2 × 100 = 200 net, tax 36 → ₹236.00
    expect((await screen.findAllByText("₹236.00")).length).toBeGreaterThan(0);
  });

  it("serializes line items to a JSON field and calls the create action", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({ success: true, data: { id: "po-9" } });
    renderForm();

    await user.selectOptions(screen.getByLabelText(/supplier/i), "sup-1");
    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");
    await user.click(
      screen.getByRole("button", { name: /create purchase order/i })
    );

    await waitFor(() => expect(createActionMock).toHaveBeenCalled());

    const [orgId, formData] = createActionMock.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(formData.get("supplierId")).toBe("sup-1");
    const items = JSON.parse(String(formData.get("items"))) as Array<{
      productId: string;
      quantity: number;
      taxRate: number;
    }>;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: "p-1", quantity: 1, taxRate: 18 });

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/purchases/po-9"));
  });

  it("surfaces a server error and does not navigate", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Could not save" },
    });
    renderForm();

    await user.selectOptions(screen.getByLabelText(/supplier/i), "sup-1");
    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");
    await user.click(
      screen.getByRole("button", { name: /create purchase order/i })
    );

    expect(await screen.findByText("Could not save")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("blocks submission when no supplier is selected", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");
    await user.click(
      screen.getByRole("button", { name: /create purchase order/i })
    );

    await waitFor(() =>
      expect(screen.getByText("Supplier is required")).toBeInTheDocument()
    );
    expect(createActionMock).not.toHaveBeenCalled();
  });

  it("falls back to a zero tax rate for products outside the allowed slabs", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseOrderForm
        organizationId="org-1"
        suppliers={suppliers}
        warehouses={[]}
        products={[
          { id: "p-3", name: "Oddment", purchasePrice: 200, gstRate: 9 },
        ]}
      />
    );

    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-3");
    // gstRate 9 is not an allowed slab → tax rate resets to 0%, total = 200
    expect(
      (screen.getByLabelText(/tax rate for line 1/i) as HTMLSelectElement).value
    ).toBe("0");
    expect((await screen.findAllByText("₹200.00")).length).toBeGreaterThan(0);
  });

  it("pre-populates fields and calls the update action in edit mode", async () => {
    const user = userEvent.setup();
    updateActionMock.mockResolvedValue({ success: true, data: { id: "po-1" } });

    const order = {
      id: "po-1",
      organizationId: "org-1",
      poNumber: "PO-00001",
      supplierId: "sup-1",
      warehouseId: null,
      status: "draft" as const,
      orderDate: new Date("2026-06-01"),
      expectedDeliveryDate: null,
      currency: "INR",
      notes: "existing note",
      terms: null,
      subtotal: 100,
      discountAmount: 0,
      taxAmount: 18,
      totalAmount: 118,
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date("2026-06-01"),
      updatedAt: new Date("2026-06-01"),
      createdBy: "user-1",
      version: 4,
      items: [
        {
          id: "item-1",
          organizationId: "org-1",
          purchaseOrderId: "po-1",
          productId: "p-1",
          description: "Widget",
          quantity: 1,
          receivedQuantity: 0,
          unitPrice: 100,
          discountPercent: 0,
          taxRate: 18,
          taxAmount: 18,
          lineTotal: 118,
          createdAt: new Date("2026-06-01"),
          createdBy: "user-1",
        },
      ],
    };

    render(
      <PurchaseOrderForm
        organizationId="org-1"
        suppliers={suppliers}
        warehouses={[]}
        products={products}
        purchaseOrder={order}
      />
    );

    expect(screen.getByText("Edit purchase order")).toBeInTheDocument();
    expect(
      (screen.getByLabelText("Quantity for line 1") as HTMLInputElement).value
    ).toBe("1");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateActionMock).toHaveBeenCalledWith(
        "org-1",
        "po-1",
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
