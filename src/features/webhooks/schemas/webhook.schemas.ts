import { z } from "zod";
import { WEBHOOK_EVENT_TYPE_VALUES } from "@/features/webhooks/types/webhook.types";

/**
 * Validation for a webhook endpoint URL.
 *
 * SECURITY: the endpoint MUST be HTTPS — payloads are HMAC-signed but still
 * carry business data, so plaintext HTTP delivery is rejected outright.
 */
const httpsUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(2048, "URL is too long")
  .url("Enter a valid URL")
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must use https://");

const eventTypesSchema = z
  .array(
    z.string().refine((v) => WEBHOOK_EVENT_TYPE_VALUES.includes(v), {
      message: "Unknown event type",
    })
  )
  .min(1, "Select at least one event type");

export const createWebhookEndpointSchema = z.object({
  url: httpsUrlSchema,
  description: z
    .string()
    .trim()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .or(z.literal("")),
  eventTypes: eventTypesSchema,
  isActive: z.boolean().optional(),
});

export const updateWebhookEndpointSchema = z.object({
  url: httpsUrlSchema.optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .or(z.literal("")),
  eventTypes: eventTypesSchema.optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().nonnegative(),
});

export type CreateWebhookEndpointFormValues = z.infer<
  typeof createWebhookEndpointSchema
>;
export type UpdateWebhookEndpointFormValues = z.infer<
  typeof updateWebhookEndpointSchema
>;
