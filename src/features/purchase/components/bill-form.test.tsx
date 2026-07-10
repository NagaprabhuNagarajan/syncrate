import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import type { PurchaseInvoiceWithItems } from "@/features/purchase/types/purchase-invoice.types";
import {
  PurchaseInvoiceForm,
  type ProductOption,
  type SupplierOption,
} from "./purchase-invoice-form";
import {
  OCR_PURCHASE_DRAFT_KEY,
  buildOcrPurchaseDraft,
  saveOcrPurchaseDraft,
} from "@/features/ai/ocr/utils/purchase-draft";

const { mockPush, createActionMock, updateActionMock } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  createActionMock: vi.fn(),
  updateActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/purchase/actions/purchase-invoice.actions", () => ({
  createPurchaseInvoiceAction: createActionMock,
  updatePurchaseInvoiceAction: updateActionMock,
}));

const suppliers: SupplierOption[] = [{ id: "sup-1", name: "Acme Supply" }];
const products: ProductOption[] = [
  { id: "p-1", name: "Widget", purchasePrice: 100, gstRate: 18 },
  { id: "p-2", name: "Gadget", purchasePrice: 50, gstRate: 5 },
];

function renderForm() {
  return render(
    <PurchaseInvoiceForm
      organizationId="org-1"
      suppliers={suppliers}
      products={products}
    />
  );
}

function buildEditInvoice(version = 7): PurchaseInvoiceWithItems {
  return {
    id: "pinv-1",
    organizationId: "org-1",
    invoiceNumber: "PINV-00001",
    supplierInvoiceNumber: null,
    purchaseOrderId: null,
    supplierId: "sup-1",
    status: "draft",
    invoiceDate: new Date("2026-06-01"),
    dueDate: null,
    subtotal: 100,
    discountAmount: 0,
    taxAmount: 18,
    totalAmount: 118,
    amountPaid: 0,
    notes: null,
    postedAt: null,
    postedBy: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version,
    items: [
      {
        id: "item-1",
        organizationId: "org-1",
        purchaseInvoiceId: "pinv-1",
        productId: "p-1",
        description: null,
        quantity: 1,
        unitPrice: 100,
        taxRate: 18,
        taxAmount: 18,
        lineTotal: 118,
        createdAt: new Date("2026-06-01"),
        createdBy: "user-1",
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PurchaseInvoiceForm", () => {
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
    createActionMock.mockResolvedValue({ success: true, data: { id: "pinv-9" } });
    renderForm();

    await user.selectOptions(screen.getByRole("combobox", { name: "Supplier" }), "sup-1");
    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");
    await user.click(
      screen.getByRole("button", { name: /create purchase invoice/i })
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
    expect(items[0]).toMatchObject({
      productId: "p-1",
      quantity: 1,
      taxRate: 18,
    });

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/purchases/invoices/pinv-9")
    );
  });

  it("surfaces a server error and does not navigate", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Could not save" },
    });
    renderForm();

    await user.selectOptions(screen.getByRole("combobox", { name: "Supplier" }), "sup-1");
    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");
    await user.click(
      screen.getByRole("button", { name: /create purchase invoice/i })
    );

    expect(await screen.findByText("Could not save")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("blocks submission when no supplier is selected", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText("Product for line 1"), "p-1");
    await user.click(
      screen.getByRole("button", { name: /create purchase invoice/i })
    );

    await waitFor(() =>
      expect(screen.getByText("Supplier is required")).toBeInTheDocument()
    );
    expect(createActionMock).not.toHaveBeenCalled();
  });

  it("renders a hidden version field and submits it for optimistic locking on edit", async () => {
    const user = userEvent.setup();
    updateActionMock.mockResolvedValue({
      success: true,
      data: { id: "pinv-1" },
    });
    const { container } = render(
      <PurchaseInvoiceForm
        organizationId="org-1"
        suppliers={suppliers}
        products={products}
        purchaseInvoice={buildEditInvoice(7)}
      />
    );

    const hidden = container.querySelector(
      'input[name="version"]'
    ) as HTMLInputElement | null;
    expect(hidden).not.toBeNull();
    expect(hidden?.value).toBe("7");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(updateActionMock).toHaveBeenCalled());
    const fd = updateActionMock.mock.calls[0][2] as FormData;
    expect(fd.get("version")).toBe("7");
  });

  it("falls back to a zero tax rate for products outside the allowed slabs", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseInvoiceForm
        organizationId="org-1"
        suppliers={suppliers}
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
});

describe("PurchaseInvoiceForm — OCR prefill", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  function seedDraft(): void {
    saveOcrPurchaseDraft(
      buildOcrPurchaseDraft({
        supplierName: "Kumar Traders",
        supplierInvoiceNumber: "INV-9",
        invoiceDate: "2026-06-01",
        items: [
          {
            description: "Steel rod",
            quantity: "10",
            unitPrice: "250",
            taxPercent: "18",
          },
        ],
      })
    );
  }

  it("prefills header + line values from the stored draft when fromOcr", () => {
    seedDraft();
    render(
      <PurchaseInvoiceForm
        organizationId="org-1"
        suppliers={suppliers}
        products={products}
        fromOcr
      />
    );

    expect(screen.getByText(/prefilled from your document/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Supplier invoice no.")).toHaveValue("INV-9");
    expect(screen.getByLabelText("Quantity for line 1")).toHaveValue(10);
    expect(screen.getByLabelText("Unit price for line 1")).toHaveValue(250);
    expect(
      (screen.getByLabelText(/tax rate for line 1/i) as HTMLSelectElement).value
    ).toBe("18");
    // The draft is consumed (cleared) so a refresh won't re-apply it.
    expect(window.sessionStorage.getItem(OCR_PURCHASE_DRAFT_KEY)).toBeNull();
  });

  it("ignores the draft when fromOcr is not set", () => {
    seedDraft();
    renderForm();
    expect(
      screen.queryByText(/prefilled from your document/i)
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Supplier invoice no.")).toHaveValue("");
  });
});
