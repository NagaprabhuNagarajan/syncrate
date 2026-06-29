/**
 * Hand-off contract between AI OCR and the purchase-invoice creation flow.
 *
 * OCR extracts free-text supplier / line descriptions — not the `supplierId` /
 * `productId` the purchase-invoice schema requires. So instead of silently
 * auto-creating a bill (which could link the wrong supplier/product), the
 * verified draft is stashed here and the user is taken to the real
 * purchase-invoice form to map supplier + products with full validation,
 * the `purchase.create` permission, and the normal audit trail
 * (spec §6: "the AI prepares … for review before submission").
 */

export const OCR_PURCHASE_DRAFT_KEY = "syncrate.ocr.purchaseDraft";

export interface OcrPurchaseDraftItem {
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly taxRate: string;
}

export interface OcrPurchaseDraft {
  /** Detected supplier name — shown to help the user pick the real supplier. */
  readonly supplierName: string;
  /** The supplier's own invoice/bill number from the document. */
  readonly supplierInvoiceNumber: string;
  /** ISO date (YYYY-MM-DD) or empty. */
  readonly invoiceDate: string;
  readonly items: readonly OcrPurchaseDraftItem[];
}

/** Normalizes an arbitrary date string to YYYY-MM-DD (or empty). */
function toDateInput(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  return "";
}

/** Builds a draft from the verification form's edited values. */
export function buildOcrPurchaseDraft(input: {
  readonly supplierName: string;
  readonly supplierInvoiceNumber: string;
  readonly invoiceDate: string;
  readonly items: ReadonlyArray<{
    readonly description: string;
    readonly quantity: string;
    readonly unitPrice: string;
    readonly taxPercent: string;
  }>;
}): OcrPurchaseDraft {
  return {
    supplierName: input.supplierName.trim(),
    supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
    invoiceDate: toDateInput(input.invoiceDate),
    items: input.items
      .filter((it) => it.description.trim() !== "")
      .map((it) => ({
        description: it.description.trim(),
        quantity: it.quantity.trim(),
        unitPrice: it.unitPrice.trim(),
        taxRate: it.taxPercent.trim(),
      })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Parses an unknown value into an OcrPurchaseDraft, or null if malformed. */
export function parseOcrPurchaseDraft(value: unknown): OcrPurchaseDraft | null {
  if (!isRecord(value)) {
    return null;
  }
  const { supplierName, supplierInvoiceNumber, invoiceDate, items } = value;
  if (
    typeof supplierName !== "string" ||
    typeof supplierInvoiceNumber !== "string" ||
    typeof invoiceDate !== "string" ||
    !Array.isArray(items)
  ) {
    return null;
  }
  const parsedItems: OcrPurchaseDraftItem[] = [];
  for (const raw of items) {
    if (!isRecord(raw)) {
      return null;
    }
    const { description, quantity, unitPrice, taxRate } = raw;
    if (
      typeof description !== "string" ||
      typeof quantity !== "string" ||
      typeof unitPrice !== "string" ||
      typeof taxRate !== "string"
    ) {
      return null;
    }
    parsedItems.push({ description, quantity, unitPrice, taxRate });
  }
  return { supplierName, supplierInvoiceNumber, invoiceDate, items: parsedItems };
}

/** Persists the draft for the purchase form to read after navigation. */
export function saveOcrPurchaseDraft(draft: OcrPurchaseDraft): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(OCR_PURCHASE_DRAFT_KEY, JSON.stringify(draft));
}

/** Reads and validates a stored draft (does not clear it). */
export function readOcrPurchaseDraft(): OcrPurchaseDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(OCR_PURCHASE_DRAFT_KEY);
  if (!raw) {
    return null;
  }
  try {
    return parseOcrPurchaseDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Removes the stored draft (call after consuming it). */
export function clearOcrPurchaseDraft(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(OCR_PURCHASE_DRAFT_KEY);
}
