import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** GST slabs supported for sales invoice line items (India). */
export const SALES_GST_RATES = [0, 5, 12, 18, 28] as const;

export const INVOICE_TYPES = [
  "tax_invoice",
  "retail_invoice",
  "proforma_invoice",
  "commercial_invoice",
  "export_invoice",
] as const;

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export const invoiceItemSchema = z.object({
  productId: z
    .string({ required_error: "Product is required" })
    .min(1, "Product is required"),
  description: z
    .string()
    .max(500, "Description is too long")
    .trim()
    .optional()
    .or(z.literal("")),
  hsnCode: z
    .string()
    .max(8, "HSN code is too long")
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
  discountPercent: z.coerce
    .number({ invalid_type_error: "Discount must be a number" })
    .min(0, "Discount cannot be negative")
    .max(100, "Discount cannot exceed 100%")
    .optional(),
  gstRate: z.coerce
    .number({ invalid_type_error: "GST rate must be a number" })
    .refine(
      (value) =>
        SALES_GST_RATES.includes(value as (typeof SALES_GST_RATES)[number]),
      "GST rate must be one of 0, 5, 12, 18 or 28"
    )
    .optional(),
});

export type InvoiceItemFormValues = z.infer<typeof invoiceItemSchema>;

// ─────────────────────────────────────────────────────────────
// Create / Update sales invoice (header + items)
// ─────────────────────────────────────────────────────────────

export const createInvoiceSchema = z.object({
  customerId: z
    .string({ required_error: "Customer is required" })
    .min(1, "Customer is required"),
  salesOrderId: z.string().trim().optional().or(z.literal("")),
  quotationId: z.string().trim().optional().or(z.literal("")),
  branchId: z.string().trim().optional().or(z.literal("")),
  warehouseId: z.string().trim().optional().or(z.literal("")),
  invoiceDate: z.string().trim().optional().or(z.literal("")),
  dueDate: z.string().trim().optional().or(z.literal("")),
  paymentTermsDays: z.coerce
    .number()
    .int()
    .min(0)
    .max(365)
    .optional(),
  supplyState: z.string().trim().optional().or(z.literal("")),
  isInterstate: z.boolean().optional(),
  invoiceType: z.enum(INVOICE_TYPES).optional(),
  referenceNumber: z
    .string()
    .max(50, "Reference number is too long")
    .trim()
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(2000, "Notes are too long")
    .trim()
    .optional()
    .or(z.literal("")),
  terms: z
    .string()
    .max(2000, "Terms are too long")
    .trim()
    .optional()
    .or(z.literal("")),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item"),
});

export type CreateInvoiceFormValues = z.infer<typeof createInvoiceSchema>;

/** Update replaces the entire document, so it validates the same shape. */
export const updateInvoiceSchema = createInvoiceSchema;

export type UpdateInvoiceFormValues = z.infer<typeof updateInvoiceSchema>;
