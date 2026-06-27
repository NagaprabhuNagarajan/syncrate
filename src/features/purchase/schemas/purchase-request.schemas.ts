import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export const purchaseRequestItemSchema = z.object({
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
  estimatedPrice: z.coerce
    .number({ invalid_type_error: "Estimated price must be a number" })
    .min(0, "Estimated price cannot be negative")
    .max(99_999_999_999, "Estimated price is too large")
    .optional(),
});

export type PurchaseRequestItemFormValues = z.infer<
  typeof purchaseRequestItemSchema
>;

// ─────────────────────────────────────────────────────────────
// Create / Update purchase request (header + items)
// ─────────────────────────────────────────────────────────────

export const createPurchaseRequestSchema = z.object({
  requestNumber: z
    .string()
    .max(50, "Request number is too long")
    .trim()
    .optional()
    .or(z.literal("")),
  warehouseId: z.string().trim().optional().or(z.literal("")),
  requiredDate: z.string().trim().optional().or(z.literal("")),
  notes: z
    .string()
    .max(2000, "Notes are too long")
    .trim()
    .optional()
    .or(z.literal("")),
  items: z
    .array(purchaseRequestItemSchema)
    .min(1, "Add at least one line item"),
});

export type CreatePurchaseRequestFormValues = z.infer<
  typeof createPurchaseRequestSchema
>;

/** Update replaces the entire document, so it validates the same shape. */
export const updatePurchaseRequestSchema = createPurchaseRequestSchema;

export type UpdatePurchaseRequestFormValues = z.infer<
  typeof updatePurchaseRequestSchema
>;

// ─────────────────────────────────────────────────────────────
// Reject reason
// ─────────────────────────────────────────────────────────────

export const rejectPurchaseRequestSchema = z.object({
  reason: z
    .string({ required_error: "A reason is required" })
    .trim()
    .min(1, "A reason is required")
    .max(1000, "Reason is too long"),
});

export type RejectPurchaseRequestFormValues = z.infer<
  typeof rejectPurchaseRequestSchema
>;
