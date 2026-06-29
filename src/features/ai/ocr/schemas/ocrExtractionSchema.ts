// AI structured-output schemas MUST use Zod v4 — required by the SDK's
// `zodOutputFormat` helper used inside the AI Gateway. Do NOT switch this to the
// classic `zod` import; form/input validation elsewhere may use classic zod.
import { z } from "zod/v4";

/**
 * AI OCR extraction schema (spec §7).
 *
 * Structured-output contract the model must satisfy when extracting data from
 * an uploaded purchase bill / tax invoice / receipt / delivery challan /
 * product label. Every field is always present; unknown values are `null` so
 * the human reviewer sees an explicit gap rather than a fabricated value.
 *
 * Confidence scores are calibrated in [0, 1]. The extraction is shown in an
 * editable verification form and is NEVER auto-persisted (human-in-the-loop).
 */

export const OCR_DOCUMENT_TYPES = [
  "purchase_bill",
  "tax_invoice",
  "receipt",
  "delivery_challan",
  "product_label",
  "other",
] as const;

export const ocrLineItemSchema = z.object({
  description: z
    .string()
    .describe("Item / product / service description exactly as printed."),
  quantity: z
    .number()
    .nullable()
    .describe("Quantity of the line item; null if not shown."),
  unitPrice: z
    .number()
    .nullable()
    .describe("Price per unit before tax; null if not shown."),
  taxPercent: z
    .number()
    .nullable()
    .describe("Tax / GST percentage for this line (e.g. 18); null if absent."),
  lineTotal: z
    .number()
    .nullable()
    .describe("Total amount for this line as printed; null if not shown."),
});

const confidenceScore = z
  .number()
  .min(0)
  .max(1)
  .describe("Calibrated confidence in [0, 1].");

export const ocrFieldConfidenceSchema = z.object({
  supplierName: confidenceScore.nullable(),
  invoiceNumber: confidenceScore.nullable(),
  invoiceDate: confidenceScore.nullable(),
  gstNumber: confidenceScore.nullable(),
  totals: confidenceScore.nullable(),
  lineItems: confidenceScore.nullable(),
});

export const ocrExtractionSchema = z.object({
  documentType: z
    .enum(OCR_DOCUMENT_TYPES)
    .describe("Best classification of the uploaded document."),
  supplierName: z
    .string()
    .nullable()
    .describe("Name of the supplier / vendor / seller; null if not found."),
  invoiceNumber: z
    .string()
    .nullable()
    .describe("Invoice or bill number / reference; null if not found."),
  invoiceDate: z
    .string()
    .nullable()
    .describe("Invoice date in ISO 8601 (YYYY-MM-DD); null if not found."),
  gstNumber: z
    .string()
    .nullable()
    .describe("Supplier GSTIN / tax registration number; null if not found."),
  currency: z
    .string()
    .describe("ISO 4217 currency code (e.g. INR). Default to INR if unclear."),
  lineItems: z
    .array(ocrLineItemSchema)
    .describe("All line items found on the document; empty array if none."),
  subtotal: z
    .number()
    .nullable()
    .describe("Sum of line items before tax; null if not shown."),
  taxTotal: z
    .number()
    .nullable()
    .describe("Total tax / GST amount; null if not shown."),
  grandTotal: z
    .number()
    .nullable()
    .describe("Final payable amount including tax; null if not shown."),
  confidence: confidenceScore.describe(
    "Overall confidence in the whole extraction, in [0, 1]."
  ),
  fieldConfidence: ocrFieldConfidenceSchema.describe(
    "Per-field confidence; null per field where not applicable."
  ),
  overallNotes: z
    .string()
    .describe(
      "Short notes on ambiguity, unreadable regions, or assumptions made."
    ),
});

export type OcrLineItem = z.infer<typeof ocrLineItemSchema>;
export type OcrFieldConfidence = z.infer<typeof ocrFieldConfidenceSchema>;
export type OcrExtraction = z.infer<typeof ocrExtractionSchema>;
export type OcrDocumentType = (typeof OCR_DOCUMENT_TYPES)[number];
