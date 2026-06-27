import { z } from "zod";

const uuid = z.string().uuid("Invalid identifier");

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional()
  .or(z.literal(""));

const quantity = z.coerce
  .number({ invalid_type_error: "Quantity must be a number" })
  .min(0, "Quantity cannot be negative")
  .max(9_999_999_999, "Quantity is too large");

export const createBatchSchema = z
  .object({
    productId: uuid,
    batchNumber: z
      .string({ required_error: "Batch number is required" })
      .min(1, "Batch number is required")
      .max(100, "Batch number is too long")
      .trim(),
    manufacturingDate: optionalDate,
    expiryDate: optionalDate,
    supplierBatch: z.string().max(100).trim().optional().or(z.literal("")),
    receivedQuantity: quantity,
    remainingQuantity: quantity.optional(),
  })
  .refine(
    (data) =>
      !data.manufacturingDate ||
      !data.expiryDate ||
      data.expiryDate >= data.manufacturingDate,
    {
      message: "Expiry date must be on or after the manufacturing date",
      path: ["expiryDate"],
    }
  );

export type CreateBatchFormValues = z.infer<typeof createBatchSchema>;
