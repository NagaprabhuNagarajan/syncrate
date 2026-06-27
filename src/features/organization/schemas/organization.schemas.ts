import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Reusable field helpers
// ─────────────────────────────────────────────────────────────

const optionalText = (max = 255) => z.string().max(max).trim().optional();

const optionalEmail = z
  .string()
  .email("Please enter a valid email address")
  .toLowerCase()
  .trim()
  .optional()
  .or(z.literal(""));

const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const cinPattern = /^[LUu][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}$/;

// ─────────────────────────────────────────────────────────────
// Create Organization (onboarding step)
// ─────────────────────────────────────────────────────────────

export const createOrganizationSchema = z.object({
  name: z
    .string({ required_error: "Organization name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be 150 characters or less")
    .trim(),
  // .or(z.literal("")) mirrors the pattern used by every other optional
  // input field in this schema. The HTML <select> always emits "" when no
  // option is chosen, but z.enum().optional() only accepts undefined — not
  // the empty string — so without this the form would reject unselected
  // business type even though the field is optional.
  businessType: z
    .enum([
      "sole_proprietorship",
      "partnership",
      "llp",
      "private_limited",
      "public_limited",
      "one_person_company",
      "other",
    ])
    .optional()
    .or(z.literal("")),
  gstNumber: z
    .string()
    .trim()
    .regex(gstPattern, "Invalid GST number format")
    .toUpperCase()
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-().]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  email: optionalEmail,
  city: optionalText(100),
  state: optionalText(100),
  country: z
    .string()
    .length(2, "Country must be a 2-letter ISO code")
    .optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "Invalid pincode — must be 6 digits")
    .optional()
    .or(z.literal("")),
  addressLine1: optionalText(255),
});

export type CreateOrganizationFormValues = z.infer<
  typeof createOrganizationSchema
>;

// ─────────────────────────────────────────────────────────────
// Update Organization (settings page)
// ─────────────────────────────────────────────────────────────

export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be 150 characters or less")
    .trim()
    .optional(),
  displayName: optionalText(150),
  businessType: z
    .enum([
      "sole_proprietorship",
      "partnership",
      "llp",
      "private_limited",
      "public_limited",
      "one_person_company",
      "other",
    ])
    .optional()
    .or(z.literal("")),
  gstNumber: z
    .string()
    .trim()
    .regex(gstPattern, "Invalid GST number format")
    .toUpperCase()
    .optional()
    .or(z.literal("")),
  panNumber: z
    .string()
    .trim()
    .regex(panPattern, "Invalid PAN number format")
    .toUpperCase()
    .optional()
    .or(z.literal("")),
  cinNumber: z
    .string()
    .trim()
    .regex(cinPattern, "Invalid CIN format")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-().]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  email: optionalEmail,
  website: z
    .string()
    .trim()
    .url("Invalid website URL")
    .optional()
    .or(z.literal("")),
  addressLine1: optionalText(255),
  addressLine2: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  country: z
    .string()
    .length(2, "Country must be a 2-letter ISO code")
    .optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "Invalid pincode — must be 6 digits")
    .optional()
    .or(z.literal("")),
});

export type UpdateOrganizationFormValues = z.infer<
  typeof updateOrganizationSchema
>;

// ─────────────────────────────────────────────────────────────
// Invite User
// ─────────────────────────────────────────────────────────────

export const inviteUserSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  fullName: z.string().max(100).trim().optional(),
  roleId: z
    .string({ required_error: "Please select a role" })
    .uuid("Invalid role"),
  branchId: z.string().uuid("Invalid branch").optional(),
});

export type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

// ─────────────────────────────────────────────────────────────
// Branch
// ─────────────────────────────────────────────────────────────

const branchCodePattern = /^[A-Z0-9]{2,10}$/;

export const createBranchSchema = z.object({
  name: z
    .string({ required_error: "Branch name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  code: z
    .string({ required_error: "Branch code is required" })
    .trim()
    .toUpperCase()
    .pipe(
      z
        .string()
        .regex(
          branchCodePattern,
          "Code must be 2–10 uppercase letters or digits"
        )
    ),
  isHeadquarters: z.boolean().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-().]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  email: optionalEmail,
  addressLine1: optionalText(255),
  addressLine2: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "Invalid pincode — must be 6 digits")
    .optional()
    .or(z.literal("")),
  gstNumber: z
    .string()
    .trim()
    .regex(gstPattern, "Invalid GST number format")
    .toUpperCase()
    .optional()
    .or(z.literal("")),
});

export type CreateBranchFormValues = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or less")
    .trim()
    .optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(
      z
        .string()
        .regex(
          branchCodePattern,
          "Code must be 2–10 uppercase letters or digits"
        )
    )
    .optional(),
  isHeadquarters: z.boolean().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-().]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  email: optionalEmail,
  addressLine1: optionalText(255),
  addressLine2: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "Invalid pincode — must be 6 digits")
    .optional()
    .or(z.literal("")),
  gstNumber: z
    .string()
    .trim()
    .regex(gstPattern, "Invalid GST number format")
    .toUpperCase()
    .optional()
    .or(z.literal("")),
  status: z.enum(["active", "inactive", "closed"]).optional(),
});

export type UpdateBranchFormValues = z.infer<typeof updateBranchSchema>;
