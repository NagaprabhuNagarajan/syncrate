import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Valid India GST slabs. */
export const SALES_GST_RATES = [0, 5, 12, 18, 28] as const;

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export const quotationItemSchema = z.object({
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
    .max(8, "HSN code must be at most 8 characters")
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
      (value) => SALES_GST_RATES.includes(value as (typeof SALES_GST_RATES)[number]),
      "GST rate must be one of 0, 5, 12, 18 or 28"
    )
    .optional(),
  sortOrder: z.coerce
    .number({ invalid_type_error: "Sort order must be a number" })
    .int("Sort order must be an integer")
    .min(0)
    .optional(),
});

export type QuotationItemFormValues = z.infer<typeof quotationItemSchema>;

// ─────────────────────────────────────────────────────────────
// Create quotation (header + items)
// ─────────────────────────────────────────────────────────────

export const createQuotationSchema = z.object({
  customerId: z
    .string({ required_error: "Customer is required" })
    .min(1, "Customer is required"),
  branchId: z.string().trim().optional().or(z.literal("")),
  salespersonId: z.string().trim().optional().or(z.literal("")),
  referenceNumber: z
    .string()
    .max(100, "Reference number is too long")
    .trim()
    .optional()
    .or(z.literal("")),
  quotationDate: z.string().trim().optional().or(z.literal("")),
  expiryDate: z.string().trim().optional().or(z.literal("")),
  supplyState: z
    .string()
    .max(100, "State name is too long")
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
  items: z.array(quotationItemSchema).min(1, "Add at least one line item"),
});

export type CreateQuotationFormValues = z.infer<typeof createQuotationSchema>;

/**
 * Update replaces the entire document and additionally carries the optimistic
 * locking `version` the client loaded the quotation at.
 */
export const updateQuotationSchema = createQuotationSchema.extend({
  version: z.coerce
    .number({ invalid_type_error: "Version must be a number" })
    .int("Version must be an integer")
    .min(1, "Version is required"),
});

export type UpdateQuotationFormValues = z.infer<typeof updateQuotationSchema>;
