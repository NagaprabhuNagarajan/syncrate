import { z } from "zod";

const optionalText = (max = 255) => z.string().max(max).trim().optional();

const money = z.coerce
  .number({ invalid_type_error: "Must be a number" })
  .min(0, "Cannot be negative")
  .max(99_999_999_999, "Value is too large");

const quantity = z.coerce
  .number({ invalid_type_error: "Must be a number" })
  .min(0, "Cannot be negative")
  .max(99_999_999_999, "Value is too large");

const optionalCode = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z
      .string()
      .regex(
        /^[A-Z0-9-]{2,40}$/,
        "Must be 2–40 uppercase letters, digits or hyphens"
      )
  )
  .optional()
  .or(z.literal(""));

const optionalUuid = z
  .string()
  .uuid("Invalid selection")
  .optional()
  .or(z.literal(""))
  .nullable();

export const createProductSchema = z.object({
  code: optionalCode,
  name: z
    .string({ required_error: "Product name is required" })
    .min(1, "Product name is required")
    .max(200, "Name must be 200 characters or less")
    .trim(),
  description: z.string().max(2000).trim().optional(),
  type: z.enum(["inventory", "service", "digital", "bundle"]).optional(),
  categoryId: optionalUuid,
  brandId: optionalUuid,
  unitId: optionalUuid,
  manufacturer: optionalText(150),
  hsnCode: z
    .string()
    .trim()
    .regex(/^[0-9]{4,8}$/, "HSN must be 4–8 digits")
    .optional()
    .or(z.literal("")),
  gstRate: z.coerce
    .number()
    .refine((v) => [0, 5, 12, 18, 28].includes(v), {
      message: "GST must be 0, 5, 12, 18 or 28",
    })
    .optional(),
  taxInclusive: z.boolean().optional(),
  purchasePrice: money.optional(),
  sellingPrice: money.optional(),
  dealerPrice: money.optional(),
  wholesalePrice: money.optional(),
  retailPrice: money.optional(),
  minSellingPrice: money.optional(),
  sku: z
    .string()
    .trim()
    .max(60, "SKU is too long")
    .optional()
    .or(z.literal("")),
  barcode: z
    .string()
    .trim()
    .max(60, "Barcode is too long")
    .optional()
    .or(z.literal("")),
  qrCode: optionalText(255),
  trackInventory: z.boolean().optional(),
  reorderLevel: quantity.optional(),
  maxStock: quantity.optional(),
  openingStock: quantity.optional(),
  preferredSupplierId: optionalUuid,
  tags: z.array(z.string().trim().min(1)).optional(),
});

export type CreateProductFormValues = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.extend({
  name: z
    .string()
    .min(1, "Product name is required")
    .max(200, "Name must be 200 characters or less")
    .trim()
    .optional(),
  status: z.enum(["draft", "active", "discontinued", "archived"]).optional(),
});

export type UpdateProductFormValues = z.infer<typeof updateProductSchema>;
