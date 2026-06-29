import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Reusable validators
// ─────────────────────────────────────────────────────────────

const optionalText = (max: number) =>
  z.string().max(max).trim().optional().or(z.literal(""));

const listingType = z.enum(["product", "supplier"], {
  required_error: "Listing type is required",
  invalid_type_error: "Listing type must be 'product' or 'supplier'",
});

const listingStatus = z.enum(["active", "paused", "archived"], {
  invalid_type_error: "Invalid listing status",
});

/** Optional price; empty means quote-on-request. */
const optionalPrice = z.coerce
  .number({ invalid_type_error: "Price must be a number" })
  .min(0, "Price cannot be negative")
  .max(99_999_999_999, "Price is too large")
  .optional();

const optionalMinOrderQty = z.coerce
  .number({ invalid_type_error: "Minimum order quantity must be a number" })
  .int("Minimum order quantity must be a whole number")
  .min(1, "Minimum order quantity must be at least 1")
  .max(9_999_999, "Minimum order quantity is too large")
  .optional();

const optionalCurrency = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().length(3, "Currency must be a 3-letter ISO code"))
  .optional()
  .or(z.literal(""));

const title = z
  .string({ required_error: "Title is required" })
  .min(2, "Title must be at least 2 characters")
  .max(150, "Title must be 150 characters or less")
  .trim();

// ─────────────────────────────────────────────────────────────
// Create listing
// ─────────────────────────────────────────────────────────────

export const createListingSchema = z.object({
  listingType,
  productId: z.string().uuid("Invalid product reference").optional().or(z.literal("")),
  title,
  description: z.string().max(2000, "Description is too long").trim().optional().or(z.literal("")),
  category: optionalText(100),
  price: optionalPrice,
  currency: optionalCurrency,
  unit: optionalText(50),
  minOrderQty: optionalMinOrderQty,
});

export type CreateListingFormValues = z.infer<typeof createListingSchema>;

// ─────────────────────────────────────────────────────────────
// Update listing (full edit form + optimistic-lock version)
// ─────────────────────────────────────────────────────────────

export const updateListingSchema = createListingSchema.extend({
  version: z.coerce
    .number({ required_error: "Version is required", invalid_type_error: "Invalid version" })
    .int("Version must be a whole number")
    .min(1, "Invalid version"),
});

export type UpdateListingFormValues = z.infer<typeof updateListingSchema>;

// ─────────────────────────────────────────────────────────────
// Status change
// ─────────────────────────────────────────────────────────────

export const listingStatusSchema = z.object({
  status: listingStatus,
});

export type ListingStatusValue = z.infer<typeof listingStatusSchema>["status"];
