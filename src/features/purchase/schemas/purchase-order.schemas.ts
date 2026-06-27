import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** GST slabs supported for purchase line items. */
export const PURCHASE_TAX_RATES = [0, 5, 12, 18, 28] as const;

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export const purchaseOrderItemSchema = z.object({
  productId: z.string({ required_error: "Product is required" }).min(1, "Product is required"),
  description: z.string().max(500, "Description is too long").trim().optional().or(z.literal("")),
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
  taxRate: z.coerce
    .number({ invalid_type_error: "Tax rate must be a number" })
    .refine(
      (value) => PURCHASE_TAX_RATES.includes(value as (typeof PURCHASE_TAX_RATES)[number]),
      "Tax rate must be one of 0, 5, 12, 18 or 28"
    )
    .optional(),
});

export type PurchaseOrderItemFormValues = z.infer<typeof purchaseOrderItemSchema>;

// ─────────────────────────────────────────────────────────────
// Create / Update purchase order (header + items)
// ─────────────────────────────────────────────────────────────

export const createPurchaseOrderSchema = z.object({
  supplierId: z
    .string({ required_error: "Supplier is required" })
    .min(1, "Supplier is required"),
  warehouseId: z.string().trim().optional().or(z.literal("")),
  orderDate: z.string().trim().optional().or(z.literal("")),
  expectedDeliveryDate: z.string().trim().optional().or(z.literal("")),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, "Currency must be a 3-letter code")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(2000, "Notes are too long").trim().optional().or(z.literal("")),
  terms: z.string().max(2000, "Terms are too long").trim().optional().or(z.literal("")),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, "Add at least one line item"),
});

export type CreatePurchaseOrderFormValues = z.infer<typeof createPurchaseOrderSchema>;

/** Update replaces the entire document, so it validates the same shape. */
export const updatePurchaseOrderSchema = createPurchaseOrderSchema;

export type UpdatePurchaseOrderFormValues = z.infer<typeof updatePurchaseOrderSchema>;
