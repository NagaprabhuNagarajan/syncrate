import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Line item
// ─────────────────────────────────────────────────────────────

export const goodsReceiptItemSchema = z
  .object({
    purchaseOrderItemId: z
      .string({ required_error: "Purchase order line is required" })
      .min(1, "Purchase order line is required"),
    productId: z
      .string({ required_error: "Product is required" })
      .min(1, "Product is required"),
    receivedQuantity: z.coerce
      .number({ invalid_type_error: "Received quantity must be a number" })
      .min(0, "Received quantity cannot be negative")
      .max(9_999_999, "Received quantity is too large"),
    rejectedQuantity: z.coerce
      .number({ invalid_type_error: "Rejected quantity must be a number" })
      .min(0, "Rejected quantity cannot be negative")
      .max(9_999_999, "Rejected quantity is too large")
      .optional(),
    batchId: z.string().trim().optional().or(z.literal("")),
  })
  .refine(
    (item) => (item.receivedQuantity ?? 0) + (item.rejectedQuantity ?? 0) > 0,
    {
      message: "Each line must record a received or rejected quantity",
      path: ["receivedQuantity"],
    }
  );

export type GoodsReceiptItemFormValues = z.infer<typeof goodsReceiptItemSchema>;

// ─────────────────────────────────────────────────────────────
// Create goods receipt (header + items)
// ─────────────────────────────────────────────────────────────

export const createGoodsReceiptSchema = z.object({
  purchaseOrderId: z
    .string({ required_error: "Purchase order is required" })
    .min(1, "Purchase order is required"),
  warehouseId: z
    .string({ required_error: "Warehouse is required" })
    .min(1, "Warehouse is required"),
  receivedDate: z.string().trim().optional().or(z.literal("")),
  notes: z
    .string()
    .max(2000, "Notes are too long")
    .trim()
    .optional()
    .or(z.literal("")),
  items: z
    .array(goodsReceiptItemSchema)
    .min(1, "Add at least one line item")
    .refine(
      (items) => items.some((item) => (item.receivedQuantity ?? 0) > 0),
      "Record a received quantity for at least one line"
    ),
});

export type CreateGoodsReceiptFormValues = z.infer<
  typeof createGoodsReceiptSchema
>;
