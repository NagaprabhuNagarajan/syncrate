import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const SALES_RETURN_REASONS = [
  "damaged",
  "wrong_product",
  "expired",
  "customer_rejection",
  "warranty",
  "other",
] as const;

export const SALES_RETURN_TAX_RATES = [0, 5, 12, 18, 28] as const;

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export const salesReturnItemSchema = z.object({
  productId: z
    .string({ required_error: "Product is required" })
    .min(1, "Product is required"),
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
        SALES_RETURN_TAX_RATES.includes(
          value as (typeof SALES_RETURN_TAX_RATES)[number]
        ),
      "Tax rate must be one of 0, 5, 12, 18 or 28"
    )
    .optional(),
  batchId: z.string().trim().optional().or(z.literal("")),
});

export type SalesReturnItemFormValues = z.infer<typeof salesReturnItemSchema>;

// ─────────────────────────────────────────────────────────────
// Create / Update sales return (header + items)
// ─────────────────────────────────────────────────────────────

export const createSalesReturnSchema = z.object({
  returnNumber: z
    .string()
    .max(50, "Return number is too long")
    .trim()
    .optional()
    .or(z.literal("")),
  invoiceId: z.string().trim().optional().or(z.literal("")),
  customerId: z
    .string({ required_error: "Customer is required" })
    .min(1, "Customer is required"),
  warehouseId: z.string().trim().optional().or(z.literal("")),
  returnDate: z.string().trim().optional().or(z.literal("")),
  reason: z.enum(SALES_RETURN_REASONS, {
    required_error: "Return reason is required",
  }),
  notes: z
    .string()
    .max(2000, "Notes are too long")
    .trim()
    .optional()
    .or(z.literal("")),
  items: z
    .array(salesReturnItemSchema)
    .min(1, "Add at least one line item"),
});

export type CreateSalesReturnFormValues = z.infer<
  typeof createSalesReturnSchema
>;

/** Update replaces the entire document, so it validates the same shape. */
export const updateSalesReturnSchema = createSalesReturnSchema;

export type UpdateSalesReturnFormValues = z.infer<
  typeof updateSalesReturnSchema
>;
