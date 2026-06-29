import { describe, expect, it } from "vitest";
import {
  OCR_DOCUMENT_TYPES,
  ocrExtractionSchema,
  ocrLineItemSchema,
} from "@/features/ai/ocr/schemas/ocrExtractionSchema";
import type { OcrExtraction } from "@/features/ai/ocr/schemas/ocrExtractionSchema";

function validExtraction(overrides: Partial<OcrExtraction> = {}): OcrExtraction {
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

describe("ocrExtractionSchema", () => {
  it("parses a fully populated extraction", () => {
    const result = ocrExtractionSchema.safeParse(validExtraction());
    expect(result.success).toBe(true);
  });

  it("accepts null for absent optional values", () => {
    const result = ocrExtractionSchema.safeParse(
      validExtraction({
        supplierName: null,
        invoiceNumber: null,
        invoiceDate: null,
        gstNumber: null,
        subtotal: null,
        taxTotal: null,
        grandTotal: null,
        lineItems: [],
        fieldConfidence: {
          supplierName: null,
          invoiceNumber: null,
          invoiceDate: null,
          gstNumber: null,
          totals: null,
          lineItems: null,
        },
      })
    );
    expect(result.success).toBe(true);
  });

  it("accepts every supported document type", () => {
    for (const type of OCR_DOCUMENT_TYPES) {
      const result = ocrExtractionSchema.safeParse(
        validExtraction({ documentType: type })
      );
      expect(result.success).toBe(true);
    }
  });

  it("rejects an unknown document type", () => {
    const result = ocrExtractionSchema.safeParse(
      validExtraction({
        // @ts-expect-error testing invalid enum value
        documentType: "spaceship_manual",
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects overall confidence outside [0, 1]", () => {
    expect(
      ocrExtractionSchema.safeParse(validExtraction({ confidence: 1.5 })).success
    ).toBe(false);
    expect(
      ocrExtractionSchema.safeParse(validExtraction({ confidence: -0.1 })).success
    ).toBe(false);
  });

  it("requires the confidence field", () => {
    const { confidence: _confidence, ...rest } = validExtraction();
    const result = ocrExtractionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a non-string supplier name", () => {
    const result = ocrExtractionSchema.safeParse(
      validExtraction({
        // @ts-expect-error testing invalid type
        supplierName: 42,
      })
    );
    expect(result.success).toBe(false);
  });
});

describe("ocrLineItemSchema", () => {
  it("parses a valid line item", () => {
    const result = ocrLineItemSchema.safeParse({
      description: "Widget",
      quantity: 2,
      unitPrice: 100,
      taxPercent: 5,
      lineTotal: 210,
    });
    expect(result.success).toBe(true);
  });

  it("allows null numeric fields but requires a description", () => {
    expect(
      ocrLineItemSchema.safeParse({
        description: "Unpriced sample",
        quantity: null,
        unitPrice: null,
        taxPercent: null,
        lineTotal: null,
      }).success
    ).toBe(true);

    expect(
      ocrLineItemSchema.safeParse({
        quantity: 1,
        unitPrice: 1,
        taxPercent: 0,
        lineTotal: 1,
      }).success
    ).toBe(false);
  });

  it("rejects a non-numeric quantity", () => {
    const result = ocrLineItemSchema.safeParse({
      description: "Widget",
      quantity: "two",
      unitPrice: 100,
      taxPercent: 5,
      lineTotal: 210,
    });
    expect(result.success).toBe(false);
  });
});
