import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import {
  PurchaseReturnForm,
  type ProductOption,
  type SupplierOption,
  type WarehouseOption,
} from "./purchase-return-form";

const { mockPush, createActionMock, updateActionMock } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  createActionMock: vi.fn(),
  updateActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/purchase/actions/purchase-return.actions", () => ({
  createPurchaseReturnAction: createActionMock,
  updatePurchaseReturnAction: updateActionMock,
}));

const suppliers: SupplierOption[] = [{ id: "sup-1", name: "Acme Supply" }];
const warehouses: WarehouseOption[] = [{ id: "wh-1", name: "Main WH" }];
const products: ProductOption[] = [
  { id: "p-1", name: "Widget", purchasePrice: 100, gstRate: 18 },
  { id: "p-2", name: "Gadget", purchasePrice: 50, gstRate: 5 },
];

function renderForm() {
  return render(
    <PurchaseReturnForm
      organizationId="org-1"
      suppliers={suppliers}
      warehouses={warehouses}
      products={products}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PurchaseReturnForm", () => {
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

  it("submits valid data and navigates to the new return", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({
      success: true,
      data: { id: "pret-9" },
    });
    renderForm();

    await user.selectOptions(screen.getByLabelText(/supplier/i), "sup-1");
    await user.selectOptions(screen.getByLabelText(/warehouse/i), "wh-1");
    await user.selectOptions(screen.getByLabelText(/reason/i), "damaged");
    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");

    await user.click(
      screen.getByRole("button", { name: /create purchase return/i })
    );

    await waitFor(() => expect(createActionMock).toHaveBeenCalled());
    const fd = createActionMock.mock.calls[0][1] as FormData;
    expect(fd.get("supplierId")).toBe("sup-1");
    expect(fd.get("warehouseId")).toBe("wh-1");
    expect(fd.get("reason")).toBe("damaged");
    const items = JSON.parse(fd.get("items") as string) as Array<
      Record<string, number | string>
    >;
    expect(items[0]).toMatchObject({ productId: "p-1", quantity: 1 });
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/purchases/returns/pret-9")
    );
  });

  it("surfaces a server error", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Something went wrong" },
    });
    renderForm();

    await user.selectOptions(screen.getByLabelText(/supplier/i), "sup-1");
    await user.selectOptions(screen.getByLabelText(/warehouse/i), "wh-1");
    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");

    await user.click(
      screen.getByRole("button", { name: /create purchase return/i })
    );

    expect(
      await screen.findByText("Something went wrong")
    ).toBeInTheDocument();
  });
});
