import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Reusable field validators
// ─────────────────────────────────────────────────────────────

const emailField = z
  .string({ required_error: "Email is required" })
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .toLowerCase()
  .trim();

// ─────────────────────────────────────────────────────────────
// Passwordless (email OTP) schemas
// ─────────────────────────────────────────────────────────────

/** Step 1 — request a login code for an email address. */
export const otpRequestSchema = z.object({
  email: emailField,
});

export type OtpRequestFormValues = z.infer<typeof otpRequestSchema>;

/** Step 2 — verify the 6-digit code sent to the email address. */
export const otpVerifySchema = z.object({
  email: emailField,
  token: z
    .string({ required_error: "Enter the 6-digit code" })
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export type OtpVerifyFormValues = z.infer<typeof otpVerifySchema>;
