import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { AcceptInvoiceDialog } from "./AcceptInvoiceDialog";
import type { ResolvedInvoiceLine } from "@/features/cbn/types/cbn.types";

const { mockAccept, mockResolve } = vi.hoisted(() => ({
  mockAccept: vi.fn(),
  mockResolve: vi.fn(),
}));

vi.mock("@/features/cbn/actions/sync.actions", () => ({
  acceptCbnInvoice: mockAccept,
  resolveCbnInvoiceLines: mockResolve,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PRODUCTS = [
  { id: "my-prod-1", code: "PRD-001", name: "Coca-Cola 500ml" },
  { id: "my-prod-2", code: "PRD-002", name: "Pepsi 500ml" },
];

function makeLine(
  overrides: Partial<ResolvedInvoiceLine> = {}
): ResolvedInvoiceLine {
  return {
    line: {
      id: "line-1",
      cbnInvoiceId: "cbn-inv-1",
      sortOrder: 0,
      supplierProductId: "their-prod-1",
      productName: "Coke 500ml",
      productSku: "SKU-COKE",
      productBarcode: "8901234567890",
      hsnCode: "2202",
      description: "Coke 500ml",
      quantity: 2,
      unitPrice: 300,
      gstRate: 0,
      taxAmount: 0,
      lineTotal: 600,
    },
    productId: null,
    productName: null,
    matchedBy: "none",
    ...overrides,
  };
}

function renderDialog(
  props: Partial<React.ComponentProps<typeof AcceptInvoiceDialog>> = {}
) {
  return render(
    <AcceptInvoiceDialog
      cbnInvoiceId="cbn-inv-1"
      connectionId="conn-1"
      organizationId="org-1"
      senderName="Acme Steel"
      invoiceNumber="INV-00001"
      products={PRODUCTS}
      onClose={vi.fn()}
      {...props}
    />
  );
}

describe("AcceptInvoiceDialog", () => {
  it("shows the incoming line with its quantity and amount", async () => {
    mockResolve.mockResolvedValue({ success: true, data: [makeLine()] });
    renderDialog();

    expect(await screen.findByText("Coke 500ml")).toBeInTheDocument();
    expect(screen.getByText(/600/)).toBeInTheDocument();
  });

  it("pre-fills an auto-matched line and says how it matched", async () => {
    mockResolve.mockResolvedValue({
      success: true,
      data: [
        makeLine({
          productId: "my-prod-1",
          productName: "Coca-Cola 500ml",
          matchedBy: "barcode",
        }),
      ],
    });
    renderDialog();

    expect(await screen.findByText(/matched by barcode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your product/i)).toHaveValue("my-prod-1");
    expect(screen.getByText(/all lines matched/i)).toBeInTheDocument();
  });

  it("blocks accepting while any line is unmatched", async () => {
    mockResolve.mockResolvedValue({ success: true, data: [makeLine()] });
    renderDialog();

    // The button exists before the lines load, so wait for the line itself.
    await screen.findByText("Coke 500ml");

    expect(
      screen.getByRole("button", { name: /accept as bill/i })
    ).toBeDisabled();
    expect(screen.getByText(/1 line still needs a product/i)).toBeInTheDocument();
  });

  it("enables accepting once the user picks a product", async () => {
    mockResolve.mockResolvedValue({ success: true, data: [makeLine()] });
    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(
      await screen.findByLabelText(/your product/i),
      "my-prod-2"
    );

    expect(
      screen.getByRole("button", { name: /accept as bill/i })
    ).toBeEnabled();
  });

  it("sends one mapping per line to the server", async () => {
    mockResolve.mockResolvedValue({
      success: true,
      data: [
        makeLine({
          productId: "my-prod-1",
          productName: "Coca-Cola 500ml",
          matchedBy: "link",
        }),
      ],
    });
    mockAccept.mockResolvedValue({ success: true, data: "pur-inv-1" });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onClose });

    await user.click(
      await screen.findByRole("button", { name: /accept as bill/i })
    );

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalledWith("cbn-inv-1", "org-1", [
        { cbnInvoiceItemId: "line-1", productId: "my-prod-1" },
      ]);
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("lets the user override an auto-match", async () => {
    mockResolve.mockResolvedValue({
      success: true,
      data: [
        makeLine({
          productId: "my-prod-1",
          productName: "Coca-Cola 500ml",
          matchedBy: "sku",
        }),
      ],
    });
    mockAccept.mockResolvedValue({ success: true, data: "pur-inv-1" });
    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(
      await screen.findByLabelText(/your product/i),
      "my-prod-2"
    );
    await user.click(screen.getByRole("button", { name: /accept as bill/i }));

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalledWith("cbn-inv-1", "org-1", [
        { cbnInvoiceItemId: "line-1", productId: "my-prod-2" },
      ]);
    });
  });

  it("keeps the dialog open and reports a server rejection", async () => {
    mockResolve.mockResolvedValue({
      success: true,
      data: [makeLine({ productId: "my-prod-1", matchedBy: "link" })],
    });
    mockAccept.mockResolvedValue({
      success: false,
      error: {
        code: "prerequisite",
        message: "this connection is not linked to a supplier in your books",
      },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onClose });

    await user.click(
      await screen.findByRole("button", { name: /accept as bill/i })
    );

    expect(
      await screen.findByText(/not linked to a supplier/i)
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("explains an invoice that arrived with no lines", async () => {
    mockResolve.mockResolvedValue({ success: true, data: [] });
    renderDialog();

    expect(
      await screen.findByText(/no line items arrived with this document/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /accept as bill/i })
    ).toBeDisabled();
    // "All lines matched" here would read as ready-to-accept.
    expect(screen.queryByText(/all lines matched/i)).not.toBeInTheDocument();
  });

  it("surfaces a failure to load the lines", async () => {
    mockResolve.mockResolvedValue({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
    renderDialog();

    expect(await screen.findByText(/permission denied/i)).toBeInTheDocument();
  });
});
