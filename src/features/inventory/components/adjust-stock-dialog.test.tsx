import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { AdjustStockDialog } from "./adjust-stock-dialog";

const { adjustActionMock } = vi.hoisted(() => ({
  adjustActionMock: vi.fn(),
}));

vi.mock("@/features/inventory/actions/inventory.actions", () => ({
  adjustStockAction: adjustActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const products = [{ id: "prod-1", name: "Cement Bag", code: "CEM-01" }];
const warehouses = [{ id: "wh-1", code: "WH-01", name: "Main Depot" }];

describe("AdjustStockDialog", () => {
  it("submits the adjustment and calls onDone", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    adjustActionMock.mockResolvedValue({ success: true, data: { id: "tx-1" } });

    render(
      <AdjustStockDialog
        organizationId="org-1"
        products={products}
        warehouses={warehouses}
        onClose={vi.fn()}
        onDone={onDone}
      />
    );

    await user.selectOptions(screen.getByLabelText("Product"), "prod-1");
    await user.selectOptions(screen.getByLabelText("Warehouse"), "wh-1");
    await user.type(screen.getByLabelText("Quantity change"), "-3");
    await user.click(screen.getByRole("button", { name: /apply adjustment/i }));

    await waitFor(() => {
      expect(adjustActionMock).toHaveBeenCalledWith("org-1", expect.any(FormData));
    });
    const form = adjustActionMock.mock.calls[0][1] as FormData;
    expect(form.get("productId")).toBe("prod-1");
    expect(form.get("warehouseId")).toBe("wh-1");
    expect(form.get("quantity")).toBe("-3");
    expect(onDone).toHaveBeenCalled();
  });

  it("surfaces a server error and keeps the dialog open", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    adjustActionMock.mockResolvedValue({
      success: false,
      error: { code: "negative_stock", message: "Would go negative" },
    });

    render(
      <AdjustStockDialog
        organizationId="org-1"
        products={products}
        warehouses={warehouses}
        onClose={vi.fn()}
        onDone={onDone}
      />
    );

    await user.selectOptions(screen.getByLabelText("Product"), "prod-1");
    await user.selectOptions(screen.getByLabelText("Warehouse"), "wh-1");
    await user.type(screen.getByLabelText("Quantity change"), "-99");
    await user.click(screen.getByRole("button", { name: /apply adjustment/i }));

    expect(await screen.findByText("Would go negative")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("calls onClose from the cancel button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AdjustStockDialog
        organizationId="org-1"
        products={products}
        warehouses={warehouses}
        onClose={onClose}
        onDone={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
