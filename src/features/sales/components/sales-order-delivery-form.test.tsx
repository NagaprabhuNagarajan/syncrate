import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { SalesOrderDeliveryForm } from "./sales-order-delivery-form";
import type { SalesOrderWithItems } from "@/features/sales/types/sales-order.types";

const { mockPush, deliverMock } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  deliverMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/features/sales/actions/sales-order.actions", () => ({
  recordSalesOrderDeliveryAction: deliverMock,
}));

function makeOrder(
  overrides: Partial<SalesOrderWithItems> = {}
): SalesOrderWithItems {
  return {
    id: "so-1",
    organizationId: "org-1",
    soNumber: "SO-00001",
    customerId: "cust-1",
    branchId: "br-1",
    salespersonId: null,
    referenceNumber: null,
    status: "processing",
    orderDate: new Date("2026-06-01"),
    deliveryDate: null,
    paymentTermsDays: 30,
    supplyState: "Karnataka",
    isInterstate: false,
    subtotal: 1000,
    discountAmount: 0,
    cgstAmount: 90,
    sgstAmount: 90,
    igstAmount: 0,
    taxAmount: 180,
    roundOff: 0,
    totalAmount: 1180,
    notes: null,
    terms: null,
    approvedBy: null,
    approvedAt: null,
    convertedInvId: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version: 2,
    items: [
      {
        id: "item-1",
        organizationId: "org-1",
        salesOrderId: "so-1",
        productId: "p-1",
        description: "Widget",
        hsnCode: null,
        quantity: 10,
        deliveredQty: 4,
        unitPrice: 100,
        discountPercent: 0,
        discountAmount: 0,
        taxableAmount: 1000,
        gstRate: 18,
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 0,
        cgstAmount: 90,
        sgstAmount: 90,
        igstAmount: 0,
        taxAmount: 180,
        lineTotal: 1180,
        sortOrder: 0,
        createdAt: new Date("2026-06-01"),
        createdBy: "user-1",
      },
    ],
    ...overrides,
  };
}

function renderForm(order: SalesOrderWithItems = makeOrder()) {
  return render(
    <SalesOrderDeliveryForm
      organizationId="org-1"
      salesOrder={order}
      productNames={{ "p-1": "Widget" }}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SalesOrderDeliveryForm", () => {
  it("renders each line with ordered, delivered and remaining", () => {
    renderForm();
    expect(
      screen.getByRole("heading", { name: /record delivery/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
    // Remaining = 10 - 4 = 6, prefilled into the input.
    expect(
      screen.getByLabelText("Deliver quantity for Widget")
    ).toHaveValue(6);
  });

  it("submits the delivery lines and navigates back on success", async () => {
    const user = userEvent.setup();
    deliverMock.mockResolvedValue({ success: true, data: makeOrder() });
    renderForm();

    await user.click(
      screen.getByRole("button", { name: /record delivery/i })
    );

    await waitFor(() => expect(deliverMock).toHaveBeenCalled());
    const [orgArg, idArg, fd] = deliverMock.mock.calls[0];
    expect(orgArg).toBe("org-1");
    expect(idArg).toBe("so-1");
    expect(fd.get("version")).toBe("2");
    expect(JSON.parse(fd.get("lines") as string)).toEqual([
      { itemId: "item-1", deliverQty: 6 },
    ]);
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/sales-orders/so-1")
    );
  });

  it("surfaces a server error and does not navigate", async () => {
    const user = userEvent.setup();
    deliverMock.mockResolvedValue({
      success: false,
      error: { code: "validation", message: "Cannot deliver more" },
    });
    renderForm();

    await user.click(
      screen.getByRole("button", { name: /record delivery/i })
    );

    expect(await screen.findByText("Cannot deliver more")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("blocks submitting when no quantity is entered", async () => {
    const user = userEvent.setup();
    const base = makeOrder();
    const [firstItem] = base.items;
    if (!firstItem) {
      throw new Error("fixture must have at least one item");
    }
    renderForm(
      makeOrder({
        items: [{ ...firstItem, quantity: 10, deliveredQty: 10 }],
      })
    );

    await user.click(
      screen.getByRole("button", { name: /record delivery/i })
    );

    expect(
      await screen.findByText(/enter a delivery quantity/i)
    ).toBeInTheDocument();
    expect(deliverMock).not.toHaveBeenCalled();
  });
});
