import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Reusable validators
// ─────────────────────────────────────────────────────────────

/** A single serial number: required, trimmed, 1–100 chars. */
export const serialNumberSchema = z
  .string({ required_error: "Serial number is required" })
  .trim()
  .min(1, "Serial number is required")
  .max(100, "Serial number must be 100 characters or less");

const productIdSchema = z
  .string({ required_error: "Product is required" })
  .uuid("Please select a valid product");

/** Optional UUID that also tolerates "" / null (unselected option). */
const optionalUuid = z
  .union([z.string().uuid("Invalid identifier"), z.literal(""), z.null()])
  .optional();

const optionalNotes = z.string().max(2000).trim().optional();

const SERIAL_STATUSES = [
  "in_stock",
  "reserved",
  "sold",
  "returned",
  "damaged",
] as const;

export const serialStatusSchema = z.enum(SERIAL_STATUSES);

// ─────────────────────────────────────────────────────────────
// Create (single)
// ─────────────────────────────────────────────────────────────

export const createSerialSchema = z.object({
  productId: productIdSchema,
  serialNumber: serialNumberSchema,
  branchId: optionalUuid,
  batchId: optionalUuid,
  notes: optionalNotes,
});

export type CreateSerialFormValues = z.infer<typeof createSerialSchema>;

// ─────────────────────────────────────────────────────────────
// Bulk create (newline / comma separated serials)
// ─────────────────────────────────────────────────────────────

export const bulkSerialSchema = z.object({
  productId: productIdSchema,
  serials: z
    .array(serialNumberSchema)
    .min(1, "Enter at least one serial number")
    .max(1000, "You can register at most 1000 serials at once"),
  branchId: optionalUuid,
  batchId: optionalUuid,
  notes: optionalNotes,
});

export type BulkSerialFormValues = z.infer<typeof bulkSerialSchema>;

/** Splits a raw textarea value into unique, trimmed serial tokens. */
export function splitSerials(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of raw.split(/[\n,]/)) {
    const trimmed = token.trim();
    if (trimmed !== "" && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export const updateSerialSchema = z.object({
  serialNumber: serialNumberSchema.optional(),
  branchId: optionalUuid,
  batchId: optionalUuid,
  status: serialStatusSchema.optional(),
  notes: optionalNotes,
});

export type UpdateSerialFormValues = z.infer<typeof updateSerialSchema>;
