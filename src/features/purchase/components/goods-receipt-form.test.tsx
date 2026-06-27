import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { GoodsReceiptForm } from "./goods-receipt-form";
import type { PurchaseOrderWithItems } from "@/features/purchase/types/purchase-order.types";
import type { WarehouseOption } from "./purchase-order-form";

const { mockPush, createActionMock } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  createActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/purchase/actions/goods-receipt.actions", () => ({
  createGoodsReceiptAction: createActionMock,
}));

function buildPo(): PurchaseOrderWithItems {
  return {
    id: "po-1",
    organizationId: "org-1",
    poNumber: "PO-00001",
    supplierId: "sup-1",
    warehouseId: "wh-1",
    status: "approved",
    orderDate: new Date("2026-06-01"),
    expectedDeliveryDate: null,
    currency: "INR",
    notes: null,
    terms: null,
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    approvedBy: "user-1",
    approvedAt: new Date("2026-06-01"),
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version: 1,
    items: [
      {
        id: "poi-a",
        organizationId: "org-1",
        purchaseOrderId: "po-1",
        productId: "prod-a",
        description: null,
        quantity: 10,
        receivedQuantity: 4,
        unitPrice: 100,
        discountPercent: 0,
        taxRate: 18,
        taxAmount: 180,
        lineTotal: 1180,
        createdAt: new Date("2026-06-01"),
        createdBy: "user-1",
      },
    ],
  };
}

const warehouses: WarehouseOption[] = [
  { id: "wh-1", name: "Main warehouse" },
  { id: "wh-2", name: "Backup warehouse" },
];

function renderForm() {
  return render(
    <GoodsReceiptForm
      organizationId="org-1"
      purchaseOrder={buildPo()}
      productNames={{ "prod-a": "Widget" }}
      warehouses={warehouses}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GoodsReceiptForm", () => {
  it("renders a row per PO line with ordered/received/outstanding values", () => {
    renderForm();
    expect(screen.getByText("Widget")).toBeInTheDocument();
    // Outstanding = ordered 10 − already received 4 = 6, prefilled into the input.
    const receiveInput = screen.getByLabelText(
      "Receive quantity for Widget"
    ) as HTMLInputElement;
    expect(receiveInput.value).toBe("6");
  });

  it("defaults the warehouse select to the PO warehouse", () => {
    renderForm();
    const select = screen.getByLabelText(/warehouse/i) as HTMLSelectElement;
    expect(select.value).toBe("wh-1");
  });

  it("serializes received lines to a JSON field and calls the create action", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({ success: true, data: { id: "grn-1" } });
    renderForm();

    await user.click(screen.getByRole("button", { name: /record receipt/i }));

    await waitFor(() => expect(createActionMock).toHaveBeenCalled());

    const [orgId, formData] = createActionMock.mock.calls[0] as [string, FormData];
    expect(orgId).toBe("org-1");
    expect(formData.get("purchaseOrderId")).toBe("po-1");
    expect(formData.get("warehouseId")).toBe("wh-1");
    const items = JSON.parse(formData.get("items") as string) as Array<{
      purchaseOrderItemId: string;
      receivedQuantity: number;
    }>;
    expect(items).toEqual([
      expect.objectContaining({
        purchaseOrderItemId: "poi-a",
        productId: "prod-a",
        receivedQuantity: 6,
        rejectedQuantity: 0,
      }),
    ]);
    expect(mockPush).toHaveBeenCalledWith("/purchases/po-1");
  });

  it("shows a client-side error when no quantity is recorded", async () => {
    const user = userEvent.setup();
    renderForm();

    const receiveInput = screen.getByLabelText("Receive quantity for Widget");
    await user.clear(receiveInput);
    await user.type(receiveInput, "0");

    await user.click(screen.getByRole("button", { name: /record receipt/i }));

    expect(
      await screen.findByText(/record a received or rejected quantity/i)
    ).toBeInTheDocument();
    expect(createActionMock).not.toHaveBeenCalled();
  });

  it("surfaces a server error returned by the action", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({
      success: false,
      error: { code: "invalid_status", message: "PO not receivable" },
    });
    renderForm();

    await user.click(screen.getByRole("button", { name: /record receipt/i }));

    expect(await screen.findByText("PO not receivable")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
