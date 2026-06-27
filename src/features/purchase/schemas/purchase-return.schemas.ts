import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** GST slabs supported for purchase return line items. */
export const PURCHASE_TAX_RATES = [0, 5, 12, 18, 28] as const;

/** Reasons a buyer returns goods to a supplier. */
export const PURCHASE_RETURN_REASONS = [
  "damaged",
  "wrong_item",
  "expired",
  "quality_issue",
  "other",
] as const;

export const PURCHASE_RETURN_REASON_LABELS: Record<
  (typeof PURCHASE_RETURN_REASONS)[number],
  string
> = {
  damaged: "Damaged",
  wrong_item: "Wrong item",
  expired: "Expired",
  quality_issue: "Quality issue",
  other: "Other",
};

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export const purchaseReturnItemSchema = z.object({
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
        PURCHASE_TAX_RATES.includes(value as (typeof PURCHASE_TAX_RATES)[number]),
      "Tax rate must be one of 0, 5, 12, 18 or 28"
    )
    .optional(),
  batchId: z.string().trim().optional().or(z.literal("")),
});

export type PurchaseReturnItemFormValues = z.infer<
  typeof purchaseReturnItemSchema
>;

// ─────────────────────────────────────────────────────────────
// Create / Update purchase return (header + items)
// ─────────────────────────────────────────────────────────────

export const createPurchaseReturnSchema = z.object({
  returnNumber: z.string().trim().optional().or(z.literal("")),
  purchaseOrderId: z.string().trim().optional().or(z.literal("")),
  supplierId: z
    .string({ required_error: "Supplier is required" })
    .min(1, "Supplier is required"),
  warehouseId: z
    .string({ required_error: "Warehouse is required" })
    .min(1, "Warehouse is required"),
  returnDate: z.string().trim().optional().or(z.literal("")),
  reason: z.enum(PURCHASE_RETURN_REASONS, {
    required_error: "Reason is required",
    invalid_type_error: "Select a valid reason",
  }),
  notes: z
    .string()
    .max(2000, "Notes are too long")
    .trim()
    .optional()
    .or(z.literal("")),
  items: z.array(purchaseReturnItemSchema).min(1, "Add at least one line item"),
});

export type CreatePurchaseReturnFormValues = z.infer<
  typeof createPurchaseReturnSchema
>;

/** Update replaces the entire document, so it validates the same shape. */
export const updatePurchaseReturnSchema = createPurchaseReturnSchema;

export type UpdatePurchaseReturnFormValues = z.infer<
  typeof updatePurchaseReturnSchema
>;
