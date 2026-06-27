import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Create / Update unit
// ─────────────────────────────────────────────────────────────

export const createUnitSchema = z.object({
  name: z
    .string({ required_error: "Unit name is required" })
    .min(1, "Unit name is required")
    .max(50, "Name must be 50 characters or less")
    .trim(),
  symbol: z
    .string({ required_error: "Symbol is required" })
    .min(1, "Symbol is required")
    .max(10, "Symbol must be 10 characters or less")
    .trim(),
  status: z.enum(["active", "archived"]).optional(),
});

export type CreateUnitFormValues = z.infer<typeof createUnitSchema>;

export const updateUnitSchema = createUnitSchema.extend({
  name: z
    .string()
    .min(1, "Unit name is required")
    .max(50, "Name must be 50 characters or less")
    .trim()
    .optional(),
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .max(10, "Symbol must be 10 characters or less")
    .trim()
    .optional(),
});

export type UpdateUnitFormValues = z.infer<typeof updateUnitSchema>;
