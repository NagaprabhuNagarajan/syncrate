import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Create / Update brand
// ─────────────────────────────────────────────────────────────

export const createBrandSchema = z.object({
  name: z
    .string({ required_error: "Brand name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  description: z.string().max(500).trim().optional().or(z.literal("")),
  status: z.enum(["active", "archived"]).optional(),
});

export type CreateBrandFormValues = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = createBrandSchema.extend({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or less")
    .trim()
    .optional(),
});

export type UpdateBrandFormValues = z.infer<typeof updateBrandSchema>;
