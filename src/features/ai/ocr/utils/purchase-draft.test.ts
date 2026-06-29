import { describe, expect, it } from "vitest";
import {
  buildOcrPurchaseDraft,
  parseOcrPurchaseDraft,
} from "@/features/ai/ocr/utils/purchase-draft";

describe("buildOcrPurchaseDraft", () => {
  it("trims values, normalizes the date, and drops blank-description lines", () => {
    const draft = buildOcrPurchaseDraft({
      supplierName: "  Kumar Traders  ",
      supplierInvoiceNumber: " INV-1 ",
      invoiceDate: "2026-06-01T00:00:00.000Z",
      items: [
        {
          description: "  Steel rod ",
          quantity: " 10 ",
          unitPrice: " 250 ",
          taxPercent: " 18 ",
        },
        { description: "   ", quantity: "1", unitPrice: "0", taxPercent: "0" },
      ],
    });

    expect(draft.supplierName).toBe("Kumar Traders");
    expect(draft.supplierInvoiceNumber).toBe("INV-1");
    expect(draft.invoiceDate).toBe("2026-06-01");
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]).toEqual({
      description: "Steel rod",
      quantity: "10",
      unitPrice: "250",
      taxRate: "18",
    });
  });

  it("blanks an unparseable date", () => {
    const draft = buildOcrPurchaseDraft({
      supplierName: "X",
      supplierInvoiceNumber: "",
      invoiceDate: "June 1st",
      items: [],
    });
    expect(draft.invoiceDate).toBe("");
  });
});

describe("parseOcrPurchaseDraft", () => {
  it("round-trips a built draft", () => {
    const draft = buildOcrPurchaseDraft({
      supplierName: "X",
      supplierInvoiceNumber: "INV-2",
      invoiceDate: "2026-01-01",
      items: [
        { description: "A", quantity: "2", unitPrice: "5", taxPercent: "5" },
      ],
    });
    expect(parseOcrPurchaseDraft(JSON.parse(JSON.stringify(draft)))).toEqual(
      draft
    );
  });

  it("rejects non-objects and missing fields", () => {
    expect(parseOcrPurchaseDraft(null)).toBeNull();
    expect(parseOcrPurchaseDraft("nope")).toBeNull();
    expect(parseOcrPurchaseDraft({ supplierName: "X" })).toBeNull();
  });

  it("rejects malformed item entries", () => {
    expect(
      parseOcrPurchaseDraft({
        supplierName: "X",
        supplierInvoiceNumber: "",
        invoiceDate: "",
        items: [{ description: "A", quantity: 2, unitPrice: "5", taxRate: "5" }],
      })
    ).toBeNull();
  });
});
