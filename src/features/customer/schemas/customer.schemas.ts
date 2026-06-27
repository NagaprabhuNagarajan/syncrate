import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Reusable validators (consistent with organization schemas)
// ─────────────────────────────────────────────────────────────

const optionalText = (max = 255) => z.string().max(max).trim().optional();

const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

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

// ─────────────────────────────────────────────────────────────
// Create / Update customer
// ─────────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
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
    .string({ required_error: "Customer name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be 150 characters or less")
    .trim(),
  company: optionalText(150),
  gstNumber: optionalGst,
  panNumber: optionalPan,
  mobile: optionalPhone,
  email: optionalEmail,
  website: optionalWebsite,
  billingAddressLine1: optionalText(255),
  billingAddressLine2: optionalText(255),
  billingCity: optionalText(100),
  billingState: optionalText(100),
  billingPincode: optionalPincode,
  billingCountry: z.string().length(2).optional(),
  shippingAddressLine1: optionalText(255),
  shippingAddressLine2: optionalText(255),
  shippingCity: optionalText(100),
  shippingState: optionalText(100),
  shippingPincode: optionalPincode,
  shippingCountry: z.string().length(2).optional().or(z.literal("")),
  creditLimit: money.optional(),
  paymentTermsDays: z.coerce
    .number()
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(365, "Cannot exceed 365 days")
    .optional(),
  preferredPaymentMethod: optionalText(50),
  openingBalance: money.optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  notes: z.string().max(2000).trim().optional(),
});

export type CreateCustomerFormValues = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.extend({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be 150 characters or less")
    .trim()
    .optional(),
  status: z.enum(["active", "inactive", "blacklisted", "archived"]).optional(),
});

export type UpdateCustomerFormValues = z.infer<typeof updateCustomerSchema>;
