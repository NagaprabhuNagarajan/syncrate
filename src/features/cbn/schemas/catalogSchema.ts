import { z } from "zod";

const STOCK_AVAILABILITY = [
  "available",
  "limited",
  "out_of_stock",
  "pre_order",
] as const;

export const createCatalogItemSchema = z.object({
  productId: z.string().uuid("Product ID must be a valid UUID"),
  catalogPrice: z.number().positive("Catalog price must be positive"),
  currency: z.string().length(3, "Currency must be a 3-letter ISO code").default("INR"),
  moq: z.number().int().positive("MOQ must be a positive integer").default(1),
  leadTimeDays: z
    .number()
    .int()
    .nonnegative("Lead time must be non-negative")
    .nullable()
    .optional(),
  stockAvailability: z.enum(STOCK_AVAILABILITY).optional().default("available"),
  isPublished: z.boolean().optional().default(false),
  catalogNotes: z
    .string()
    .max(1000, "Catalog notes must not exceed 1000 characters")
    .nullable()
    .optional(),
});

export type CreateCatalogItemInput = z.infer<typeof createCatalogItemSchema>;

export const updateCatalogItemSchema = createCatalogItemSchema.partial().omit({
  productId: true,
});

export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;
