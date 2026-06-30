import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import {
  PurchaseRequestForm,
  type PrProductOption,
} from "./purchase-request-form";
import type { PurchaseRequestWithItems } from "@/features/purchase/types/purchase-request.types";

const { mockPush, createActionMock, updateActionMock } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  createActionMock: vi.fn(),
  updateActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/purchase/actions/purchase-request.actions", () => ({
  createPurchaseRequestAction: createActionMock,
  updatePurchaseRequestAction: updateActionMock,
}));

const products: PrProductOption[] = [
  { id: "p-1", name: "Widget", purchasePrice: 100 },
  { id: "p-2", name: "Gadget", purchasePrice: 50 },
];

function renderForm(purchaseRequest?: PurchaseRequestWithItems) {
  return render(
    <PurchaseRequestForm
      organizationId="org-1"
      branches={[{ id: "wh-1", name: "Main WH" }]}
      products={products}
      purchaseRequest={purchaseRequest}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PurchaseRequestForm", () => {
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
    await user.click(screen.getByRole("button", { name: /remove line 2/i }));
    expect(
      screen.queryByLabelText("Product for line 2")
    ).not.toBeInTheDocument();
  });

  it("pre-fills the estimated price from the chosen product", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");
    expect(screen.getByLabelText("Estimated price for line 1")).toHaveValue(100);
  });

  it("submits a valid new request", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({
      success: true,
      data: { id: "pr-9" },
    });
    renderForm();

    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");
    await user.click(
      screen.getByRole("button", { name: /create purchase request/i })
    );

    await waitFor(() => expect(createActionMock).toHaveBeenCalled());
    const [orgId, formData] = createActionMock.mock.calls[0];
    expect(orgId).toBe("org-1");
    const items = JSON.parse(formData.get("items") as string) as Array<{
      productId: string;
    }>;
    expect(items[0].productId).toBe("p-1");
    expect(formData.get("version")).toBeNull();
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/purchases/requests/pr-9")
    );
  });

  it("includes the version hidden field when editing", async () => {
    const user = userEvent.setup();
    updateActionMock.mockResolvedValue({
      success: true,
      data: { id: "pr-1" },
    });
    const existing: PurchaseRequestWithItems = {
      id: "pr-1",
      organizationId: "org-1",
      requestNumber: "PR-00001",
      status: "draft",
      branchId: "wh-1",
      requiredDate: null,
      notes: null,
      approvedBy: null,
      approvedAt: null,
      rejectedReason: null,
      convertedPoId: null,
      createdAt: new Date("2026-06-01"),
      updatedAt: new Date("2026-06-01"),
      createdBy: "user-1",
      version: 7,
      items: [
        {
          id: "item-1",
          organizationId: "org-1",
          purchaseRequestId: "pr-1",
          productId: "p-1",
          description: "Widget",
          quantity: 3,
          estimatedPrice: 100,
          createdAt: new Date("2026-06-01"),
          createdBy: "user-1",
        },
      ],
    };
    renderForm(existing);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(updateActionMock).toHaveBeenCalled());
    const [, , formData] = updateActionMock.mock.calls[0];
    expect(formData.get("version")).toBe("7");
  });

  it("surfaces a server error", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({
      success: false,
      error: { code: "conflict", message: "Changed by someone else" },
    });
    renderForm();
    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");
    await user.click(
      screen.getByRole("button", { name: /create purchase request/i })
    );
    expect(
      await screen.findByText("Changed by someone else")
    ).toBeInTheDocument();
  });
});
