import { z } from "zod";

const uuid = z.string().uuid("Invalid identifier");

const optionalText = (max = 500) => z.string().max(max).trim().optional();

// ─────────────────────────────────────────────────────────────
// Adjust stock — signed quantity (must be non-zero)
// ─────────────────────────────────────────────────────────────

export const adjustStockSchema = z.object({
  productId: uuid,
  warehouseId: uuid,
  quantity: z.coerce
    .number({ invalid_type_error: "Quantity must be a number" })
    .refine((value) => value !== 0, "Quantity cannot be zero")
    .refine(
      (value) => Math.abs(value) <= 9_999_999_999,
      "Quantity is too large"
    ),
  reason: optionalText(500),
});

export type AdjustStockFormValues = z.infer<typeof adjustStockSchema>;

// ─────────────────────────────────────────────────────────────
// Transfer stock — positive quantity, distinct warehouses
// ─────────────────────────────────────────────────────────────

export const transferStockSchema = z
  .object({
    productId: uuid,
    fromWarehouseId: uuid,
    toWarehouseId: uuid,
    quantity: z.coerce
      .number({ invalid_type_error: "Quantity must be a number" })
      .positive("Quantity must be greater than zero")
      .max(9_999_999_999, "Quantity is too large"),
    note: optionalText(500),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: "Source and destination warehouses must be different",
    path: ["toWarehouseId"],
  });

export type TransferStockFormValues = z.infer<typeof transferStockSchema>;

// ─────────────────────────────────────────────────────────────
// Opening stock — non-negative quantity
// ─────────────────────────────────────────────────────────────

export const openingStockSchema = z.object({
  productId: uuid,
  warehouseId: uuid,
  quantity: z.coerce
    .number({ invalid_type_error: "Quantity must be a number" })
    .min(0, "Quantity cannot be negative")
    .max(9_999_999_999, "Quantity is too large"),
  note: optionalText(500),
});

export type OpeningStockFormValues = z.infer<typeof openingStockSchema>;
