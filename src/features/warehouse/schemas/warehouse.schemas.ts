import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Reusable validators
// ─────────────────────────────────────────────────────────────

const optionalText = (max = 255) => z.string().max(max).trim().optional();

const optionalPincode = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, "Invalid pincode — must be 6 digits")
  .optional()
  .or(z.literal(""));

const optionalUuid = z
  .string()
  .trim()
  .uuid("Invalid branch reference")
  .optional()
  .or(z.literal(""));

// ─────────────────────────────────────────────────────────────
// Create / Update warehouse
// ─────────────────────────────────────────────────────────────

export const createWarehouseSchema = z.object({
  code: z
    .string({ required_error: "Warehouse code is required" })
    .trim()
    .toUpperCase()
    .pipe(
      z
        .string()
        .regex(
          /^[A-Z0-9-]{2,20}$/,
          "Code must be 2–20 uppercase letters, digits or hyphens"
        )
    ),
  name: z
    .string({ required_error: "Warehouse name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be 150 characters or less")
    .trim(),
  branchId: optionalUuid,
  addressLine1: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  pincode: optionalPincode,
  capacity: z.coerce
    .number({ invalid_type_error: "Capacity must be a number" })
    .min(0, "Capacity cannot be negative")
    .max(9_999_999_999, "Capacity is too large")
    .optional(),
  isDefault: z.coerce.boolean().optional(),
});

export type CreateWarehouseFormValues = z.infer<typeof createWarehouseSchema>;

export const updateWarehouseSchema = createWarehouseSchema.extend({
  code: createWarehouseSchema.shape.code.optional(),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be 150 characters or less")
    .trim()
    .optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

export type UpdateWarehouseFormValues = z.infer<typeof updateWarehouseSchema>;
