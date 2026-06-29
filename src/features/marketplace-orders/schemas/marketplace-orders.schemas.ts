import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Reusable validators
// ─────────────────────────────────────────────────────────────

const orgId = z
  .string({ required_error: "Organization is required" })
  .uuid("Invalid organization reference");

const quantity = z.coerce
  .number({ invalid_type_error: "Quantity must be a number" })
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(9_999_999, "Quantity is too large");

const unitPrice = z.coerce
  .number({ invalid_type_error: "Price must be a number" })
  .min(0, "Price cannot be negative")
  .max(99_999_999_999, "Price is too large");

const currency = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().length(3, "Currency must be a 3-letter ISO code"))
  .optional()
  .or(z.literal(""));

const notes = z
  .string()
  .max(2000, "Notes are too long")
  .trim()
  .optional()
  .or(z.literal(""));

// ─────────────────────────────────────────────────────────────
// Place order (buyer)
// ─────────────────────────────────────────────────────────────

export const placeOrderSchema = z.object({
  sellerOrganizationId: orgId,
  listingId: z.string().uuid("Invalid listing reference").optional().or(z.literal("")),
  quantity,
  unitPrice,
  currency,
  notes,
});

export type PlaceOrderFormValues = z.infer<typeof placeOrderSchema>;

// ─────────────────────────────────────────────────────────────
// Order transition
// ─────────────────────────────────────────────────────────────

export const orderActionSchema = z.object({
  action: z.enum(["confirm", "cancel", "fulfil", "complete"], {
    invalid_type_error: "Invalid order action",
  }),
  version: z.coerce
    .number({ required_error: "Version is required", invalid_type_error: "Invalid version" })
    .int("Version must be a whole number")
    .min(1, "Invalid version"),
});

export type OrderActionValues = z.infer<typeof orderActionSchema>;

// ─────────────────────────────────────────────────────────────
// Payment action
// ─────────────────────────────────────────────────────────────

export const paymentActionSchema = z.object({
  action: z.enum(["hold", "release", "refund"], {
    invalid_type_error: "Invalid payment action",
  }),
});

export type PaymentActionValues = z.infer<typeof paymentActionSchema>;
