import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Create / Update category
// ─────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z
    .string({ required_error: "Category name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  parentId: z
    .union([z.string().uuid("Invalid parent category"), z.literal(""), z.null()])
    .optional(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .trim()
    .optional()
    .or(z.literal("")),
  status: z.enum(["active", "archived"]).optional(),
});

export type CreateCategoryFormValues = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.extend({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or less")
    .trim()
    .optional(),
});

export type UpdateCategoryFormValues = z.infer<typeof updateCategorySchema>;
