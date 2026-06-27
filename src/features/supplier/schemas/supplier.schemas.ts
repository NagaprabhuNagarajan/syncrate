import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Reusable validators (consistent with customer schemas)
// ─────────────────────────────────────────────────────────────

const optionalText = (max = 255) => z.string().max(max).trim().optional();

const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const optionalEmail = z
  .string()
  .email("Please enter a valid email address")
  .toLowerCase()
  .trim()
  .optional()
  .or(z.literal(""));

const optionalGst = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(gstPattern, "Invalid GST number format"))
  .optional()
  .or(z.literal(""));

const optionalPan = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(panPattern, "Invalid PAN number format"))
  .optional()
  .or(z.literal(""));

const optionalIfsc = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(ifscPattern, "Invalid IFSC code format"))
  .optional()
  .or(z.literal(""));

const optionalPhone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-().]{7,20}$/, "Invalid phone number")
  .optional()
  .or(z.literal(""));

const optionalPincode = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, "Invalid pincode — must be 6 digits")
  .optional()
  .or(z.literal(""));

const optionalWebsite = z
  .string()
  .trim()
  .url("Invalid website URL")
  .optional()
  .or(z.literal(""));

const money = z.coerce
  .number({ invalid_type_error: "Must be a number" })
  .min(0, "Cannot be negative")
  .max(99_999_999_999, "Value is too large");

const optionalRating = z.coerce
  .number({ invalid_type_error: "Must be a number" })
  .min(0, "Rating cannot be negative")
  .max(5, "Rating cannot exceed 5")
  .optional();

// ─────────────────────────────────────────────────────────────
// Create / Update supplier
// ─────────────────────────────────────────────────────────────

export const createSupplierSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(
      z
        .string()
        .regex(
          /^[A-Z0-9-]{2,20}$/,
          "Code must be 2–20 uppercase letters, digits or hyphens"
        )
    )
    .optional()
    .or(z.literal("")),
  name: z
    .string({ required_error: "Supplier name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be 150 characters or less")
    .trim(),
  contactPerson: optionalText(150),
  gstNumber: optionalGst,
  panNumber: optionalPan,
  mobile: optionalPhone,
  email: optionalEmail,
  website: optionalWebsite,
  addressLine1: optionalText(255),
  addressLine2: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  pincode: optionalPincode,
  country: z.string().length(2).optional(),
  bankAccountName: optionalText(150),
  bankAccountNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{6,20}$/, "Invalid bank account number")
    .optional()
    .or(z.literal("")),
  bankIfsc: optionalIfsc,
  bankName: optionalText(150),
  upiId: optionalText(100),
  paymentTermsDays: z.coerce
    .number()
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(365, "Cannot exceed 365 days")
    .optional(),
  openingBalance: money.optional(),
  rating: optionalRating,
  tags: z.array(z.string().trim().min(1)).optional(),
  notes: z.string().max(2000).trim().optional(),
});

export type CreateSupplierFormValues = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.extend({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be 150 characters or less")
    .trim()
    .optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

export type UpdateSupplierFormValues = z.infer<typeof updateSupplierSchema>;
