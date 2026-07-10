import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { OcrVerificationForm } from "@/features/ai/ocr/components/ocr-verification-form";
import type { OcrExtraction } from "@/features/ai/ocr/schemas/ocrExtractionSchema";
import {
  OCR_PURCHASE_DRAFT_KEY,
  parseOcrPurchaseDraft,
} from "@/features/ai/ocr/utils/purchase-draft";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  mockPush.mockClear();
  window.sessionStorage.clear();
});

// Framer Motion is not needed for behavior assertions; render children plainly.
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

function buildExtraction(overrides: Partial<OcrExtraction> = {}): OcrExtraction {
  return {
    documentType: "tax_invoice",
    supplierName: "Kumar Traders",
    invoiceNumber: "INV-2026-001",
    invoiceDate: "2026-06-01",
    gstNumber: "22AAAAA0000A1Z5",
    currency: "INR",
    lineItems: [
      {
        description: "Steel rod 12mm",
        quantity: 10,
        unitPrice: 250,
        taxPercent: 18,
        lineTotal: 2950,
      },
    ],
    subtotal: 2500,
    taxTotal: 450,
    grandTotal: 2950,
    confidence: 0.92,
    fieldConfidence: {
      supplierName: 0.95,
      invoiceNumber: 0.9,
      invoiceDate: 0.88,
      gstNumber: 0.8,
      totals: 0.93,
      lineItems: 0.91,
    },
    overallNotes: "Clear scan.",
    ...overrides,
  };
}

describe("OcrVerificationForm", () => {
  it("pre-fills the editable fields from the extraction", () => {
    render(
      <OcrVerificationForm
        extraction={buildExtraction()}
        model="claude-test"
        onReset={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Kumar Traders")).toBeInTheDocument();
    expect(screen.getByDisplayValue("INV-2026-001")).toBeInTheDocument();
    expect(screen.getByDisplayValue("22AAAAA0000A1Z5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Steel rod 12mm")).toBeInTheDocument();
    expect(screen.getByText("92% overall confidence")).toBeInTheDocument();
  });

  it("lets the user edit a field", async () => {
    const user = userEvent.setup();
    render(
      <OcrVerificationForm
        extraction={buildExtraction()}
        model="claude-test"
        onReset={vi.fn()}
      />
    );

    const supplier = screen.getByDisplayValue("Kumar Traders");
    await user.clear(supplier);
    await user.type(supplier, "Acme Supplies");

    expect(screen.getByDisplayValue("Acme Supplies")).toBeInTheDocument();
  });

  it("adds and removes line items", async () => {
    const user = userEvent.setup();
    render(
      <OcrVerificationForm
        extraction={buildExtraction()}
        model="claude-test"
        onReset={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /add line/i }));
    expect(
      screen.getByLabelText("Line 2 description")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove line 1/i }));
    expect(
      screen.queryByDisplayValue("Steel rod 12mm")
    ).not.toBeInTheDocument();
  });

  it("shows a confirmation message and calls onReset", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <OcrVerificationForm
        extraction={buildExtraction()}
        model="claude-test"
        onReset={onReset}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /mark as verified/i })
    );
    expect(screen.getByText(/values verified/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /upload another/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("hands the verified draft to the purchase-bill form on Create", async () => {
    const user = userEvent.setup();
    render(
      <OcrVerificationForm
        extraction={buildExtraction()}
        model="claude-test"
        onReset={vi.fn()}
        organizationId="org-123"
      />
    );

    await user.click(
      screen.getByRole("button", { name: /create purchase bill/i })
    );

    // Navigates to the real purchase-invoice form in OCR-prefill mode.
    expect(mockPush).toHaveBeenCalledWith(
      "/purchases/bills/new?fromOcr=1&org=org-123"
    );

    // And stashes a valid draft for that form to read.
    const stored = window.sessionStorage.getItem(OCR_PURCHASE_DRAFT_KEY);
    expect(stored).not.toBeNull();
    const draft = parseOcrPurchaseDraft(JSON.parse(stored ?? "null"));
    expect(draft?.supplierName).toBe("Kumar Traders");
    expect(draft?.supplierInvoiceNumber).toBe("INV-2026-001");
    expect(draft?.items[0]?.description).toBe("Steel rod 12mm");
  });

  it("renders a graceful message when no line items were detected", () => {
    render(
      <OcrVerificationForm
        extraction={buildExtraction({ lineItems: [] })}
        model="claude-test"
        onReset={vi.fn()}
      />
    );

    expect(
      screen.getByText(/no line items were detected/i)
    ).toBeInTheDocument();
  });
});
