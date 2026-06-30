import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { TransferStockDialog } from "./transfer-stock-dialog";

const { transferActionMock } = vi.hoisted(() => ({
  transferActionMock: vi.fn(),
}));

vi.mock("@/features/inventory/actions/inventory.actions", () => ({
  transferStockAction: transferActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const products = [{ id: "prod-1", name: "Cement Bag", code: "CEM-01" }];
const branches = [
  { id: "wh-1", code: "WH-01", name: "Main Depot" },
  { id: "wh-2", code: "WH-02", name: "Second Depot" },
];

describe("TransferStockDialog", () => {
  it("submits a transfer between two branches", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    transferActionMock.mockResolvedValue({
      success: true,
      data: { out: { id: "tx-out" }, in: { id: "tx-in" } },
    });

    render(
      <TransferStockDialog
        organizationId="org-1"
        products={products}
        branches={branches}
        onClose={vi.fn()}
        onDone={onDone}
      />
    );

    await user.selectOptions(screen.getByLabelText("Product"), "prod-1");
    await user.selectOptions(screen.getByLabelText("From branch"), "wh-1");
    await user.selectOptions(screen.getByLabelText("To branch"), "wh-2");
    await user.type(screen.getByLabelText("Quantity"), "8");
    await user.click(screen.getByRole("button", { name: /transfer stock/i }));

    await waitFor(() => {
      expect(transferActionMock).toHaveBeenCalled();
    });
    const form = transferActionMock.mock.calls[0][1] as FormData;
    expect(form.get("fromBranchId")).toBe("wh-1");
    expect(form.get("toBranchId")).toBe("wh-2");
    expect(form.get("quantity")).toBe("8");
    expect(onDone).toHaveBeenCalled();
  });

  it("blocks a transfer to the same branch before calling the action", async () => {
    const user = userEvent.setup();
    render(
      <TransferStockDialog
        organizationId="org-1"
        products={products}
        branches={branches}
        onClose={vi.fn()}
        onDone={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText("Product"), "prod-1");
    await user.selectOptions(screen.getByLabelText("From branch"), "wh-1");
    await user.selectOptions(screen.getByLabelText("To branch"), "wh-1");
    await user.type(screen.getByLabelText("Quantity"), "8");
    await user.click(screen.getByRole("button", { name: /transfer stock/i }));

    expect(
      await screen.findByText(/must be different/i)
    ).toBeInTheDocument();
    expect(transferActionMock).not.toHaveBeenCalled();
  });

  it("surfaces a server error", async () => {
    const user = userEvent.setup();
    transferActionMock.mockResolvedValue({
      success: false,
      error: { code: "insufficient_stock", message: "Not enough stock" },
    });

    render(
      <TransferStockDialog
        organizationId="org-1"
        products={products}
        branches={branches}
        onClose={vi.fn()}
        onDone={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText("Product"), "prod-1");
    await user.selectOptions(screen.getByLabelText("From branch"), "wh-1");
    await user.selectOptions(screen.getByLabelText("To branch"), "wh-2");
    await user.type(screen.getByLabelText("Quantity"), "8");
    await user.click(screen.getByRole("button", { name: /transfer stock/i }));

    expect(await screen.findByText("Not enough stock")).toBeInTheDocument();
  });
});
