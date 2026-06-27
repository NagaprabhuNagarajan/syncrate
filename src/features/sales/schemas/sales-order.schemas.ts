import { z } from "zod";
import { SALES_GST_RATES } from "./quotation.schemas";
export { SALES_GST_RATES } from "./quotation.schemas";

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export const salesOrderItemSchema = z.object({
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

export type SalesOrderItemFormValues = z.infer<typeof salesOrderItemSchema>;

// ─────────────────────────────────────────────────────────────
// Create sales order (header + items)
// ─────────────────────────────────────────────────────────────

export const createSalesOrderSchema = z.object({
  customerId: z
    .string({ required_error: "Customer is required" })
    .min(1, "Customer is required"),
  quotationId: z.string().trim().optional().or(z.literal("")),
  branchId: z.string().trim().optional().or(z.literal("")),
  warehouseId: z.string().trim().optional().or(z.literal("")),
  salespersonId: z.string().trim().optional().or(z.literal("")),
  referenceNumber: z
    .string()
    .max(100, "Reference number is too long")
    .trim()
    .optional()
    .or(z.literal("")),
  orderDate: z.string().trim().optional().or(z.literal("")),
  deliveryDate: z.string().trim().optional().or(z.literal("")),
  paymentTermsDays: z.coerce
    .number({ invalid_type_error: "Payment terms must be a number" })
    .int("Payment terms must be an integer")
    .min(0, "Payment terms cannot be negative")
    .max(365, "Payment terms cannot exceed 365 days")
    .optional(),
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
  items: z.array(salesOrderItemSchema).min(1, "Add at least one line item"),
});

export type CreateSalesOrderFormValues = z.infer<typeof createSalesOrderSchema>;

/**
 * Update replaces the entire document and additionally carries the optimistic
 * locking `version` the client loaded the sales order at.
 */
export const updateSalesOrderSchema = createSalesOrderSchema.extend({
  version: z.coerce
    .number({ invalid_type_error: "Version must be a number" })
    .int("Version must be an integer")
    .min(1, "Version is required"),
});

export type UpdateSalesOrderFormValues = z.infer<typeof updateSalesOrderSchema>;
