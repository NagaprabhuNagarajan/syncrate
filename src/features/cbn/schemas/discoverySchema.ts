import { z } from "zod";

export const searchBusinessesSchema = z.object({
  query: z
    .string()
    .min(1, "Search query must not be empty")
    .max(200, "Search query must not exceed 200 characters"),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

export type SearchBusinessesInput = z.infer<typeof searchBusinessesSchema>;

export const catalogSearchSchema = z.object({
  supplierOrgId: z.string().uuid("Supplier org ID must be a valid UUID"),
  query: z
    .string()
    .max(200, "Search query must not exceed 200 characters")
    .optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

export type CatalogSearchInput = z.infer<typeof catalogSearchSchema>;
