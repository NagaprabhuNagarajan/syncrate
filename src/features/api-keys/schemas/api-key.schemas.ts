import { z } from "zod";
import { API_KEY_SCOPE_VALUES } from "@/features/api-keys/types/api-key.types";

/**
 * Validation for creating an API key.
 *
 * - `name` is a human label (required, trimmed).
 * - `scopes` must each be one of the known scopes and at least one is required.
 * - `expiresAt` is an optional ISO date (yyyy-mm-dd) that must be in the future.
 */
export const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name must be at most 120 characters"),
  scopes: z
    .array(
      z.string().refine((v) => API_KEY_SCOPE_VALUES.includes(v), {
        message: "Unknown scope",
      })
    )
    .min(1, "Select at least one scope"),
  expiresAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .refine((v) => {
      const time = Date.parse(`${v}T23:59:59.999Z`);
      return !Number.isNaN(time) && time > Date.now();
    }, "Expiry must be in the future")
    .optional()
    .or(z.literal("")),
});

export type CreateApiKeyFormValues = z.infer<typeof createApiKeySchema>;
