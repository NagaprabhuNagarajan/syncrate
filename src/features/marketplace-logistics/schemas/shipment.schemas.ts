import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Reusable validators
// ─────────────────────────────────────────────────────────────

const optionalText = (max: number, message: string) =>
  z.string().max(max, message).trim().optional().or(z.literal(""));

/** Only the manual provider exists today; the column is provider-agnostic. */
const providerKey = z
  .enum(["manual"], { invalid_type_error: "Unsupported logistics provider" })
  .optional();

const orderId = z
  .string({ required_error: "An order is required" })
  .uuid("Invalid order reference");

const version = z.coerce
  .number({
    required_error: "Version is required",
    invalid_type_error: "Invalid version",
  })
  .int("Version must be a whole number")
  .min(1, "Invalid version");

// ─────────────────────────────────────────────────────────────
// Create shipment
// ─────────────────────────────────────────────────────────────

export const createShipmentSchema = z.object({
  orderId,
  provider: providerKey,
  carrier: optionalText(120, "Carrier name is too long"),
  trackingNumber: optionalText(120, "Tracking number is too long"),
  notes: optionalText(2000, "Notes are too long"),
});

export type CreateShipmentFormValues = z.infer<typeof createShipmentSchema>;

// ─────────────────────────────────────────────────────────────
// Advance status
// ─────────────────────────────────────────────────────────────

/** Only valid transition targets — `pending` is the creation state, never a target. */
export const shipmentTransitionTargetSchema = z.enum(
  ["in_transit", "delivered", "cancelled"],
  { invalid_type_error: "Invalid shipment status" }
);

export const advanceShipmentSchema = z.object({
  status: shipmentTransitionTargetSchema,
  version,
});

export type AdvanceShipmentFormValues = z.infer<typeof advanceShipmentSchema>;
