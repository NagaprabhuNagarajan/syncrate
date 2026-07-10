import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** GST slabs supported for purchase invoice line items. */
export const PURCHASE_TAX_RATES = [0, 5, 12, 18, 28] as const;

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export const purchaseInvoiceItemSchema = z.object({
  productId: z
    .string({ required_error: "Product is required" })
    .min(1, "Product is required"),
  description: z
    .string()
    .max(500, "Description is too long")
    .trim()
    .optional()
    .or(z.literal("")),
  quantity: z.coerce
    .number({ invalid_type_error: "Quantity must be a number" })
    .positive("Quantity must be greater than 0")
    .max(9_999_999, "Quantity is too large"),
  unitPrice: z.coerce
    .number({ invalid_type_error: "Unit price must be a number" })
    .min(0, "Unit price cannot be negative")
    .max(99_999_999_999, "Unit price is too large"),
  taxRate: z.coerce
    .number({ invalid_type_error: "Tax rate must be a number" })
    .refine(
      (value) =>
        PURCHASE_TAX_RATES.includes(value as (typeof PURCHASE_TAX_RATES)[number]),
      "Tax rate must be one of 0, 5, 12, 18 or 28"
    )
    .optional(),
});

export type PurchaseInvoiceItemFormValues = z.infer<
  typeof purchaseInvoiceItemSchema
>;

// ─────────────────────────────────────────────────────────────
// Create / Update purchase invoice (header + items)
// ─────────────────────────────────────────────────────────────

export const createPurchaseInvoiceSchema = z.object({
  supplierId: z
    .string({ required_error: "Supplier is required" })
    .min(1, "Supplier is required"),
  invoiceNumber: z
    .string()
    .max(50, "Invoice number is too long")
    .trim()
    .optional()
    .or(z.literal("")),
  supplierInvoiceNumber: z
    .string()
    .max(50, "Supplier invoice number is too long")
    .trim()
    .optional()
    .or(z.literal("")),
  purchaseOrderId: z.string().trim().optional().or(z.literal("")),
  invoiceDate: z.string().trim().optional().or(z.literal("")),
  dueDate: z.string().trim().optional().or(z.literal("")),
  notes: z
    .string()
    .max(2000, "Notes are too long")
    .trim()
    .optional()
    .or(z.literal("")),
  items: z.array(purchaseInvoiceItemSchema).min(1, "Add at least one line item"),
});

export type CreatePurchaseInvoiceFormValues = z.infer<
  typeof createPurchaseInvoiceSchema
>;

/** Update replaces the entire document, so it validates the same shape. */
export const updatePurchaseInvoiceSchema = createPurchaseInvoiceSchema;

export type UpdatePurchaseInvoiceFormValues = z.infer<
  typeof updatePurchaseInvoiceSchema
>;
