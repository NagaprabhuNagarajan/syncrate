"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AuthService } from "@/features/identity/services/auth.service";
import {
  otpRequestSchema,
  otpVerifySchema,
} from "@/features/identity/schemas/auth.schemas";
import type { AuthActionResult } from "@/features/identity/types/auth.types";

// ─────────────────────────────────────────────────────────────
// Request login code (passwordless — step 1)
// ─────────────────────────────────────────────────────────────

export async function requestOtpAction(
  formData: FormData
): Promise<AuthActionResult<void>> {
  const parsed = otpRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "unknown",
        message: parsed.error.errors[0]?.message ?? "Invalid email",
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const service = new AuthService(supabase);
  return service.requestEmailOtp(parsed.data);
}

// ─────────────────────────────────────────────────────────────
// Verify login code (passwordless — step 2)
// ─────────────────────────────────────────────────────────────

export async function verifyOtpAction(
  formData: FormData
): Promise<AuthActionResult<void>> {
  const parsed = otpVerifySchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "otp_invalid",
        message: parsed.error.errors[0]?.message ?? "Invalid code",
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const service = new AuthService(supabase);
  const result = await service.verifyEmailOtp(parsed.data);

  if (!result.success) {
    return result;
  }

  // A verified session always lands on /dashboard; its guard redirects new
  // users (no organization yet) to /create-organization (Account Setup) and
  // existing users to the dashboard.
  const redirectTo = formData.get("redirectTo");
  const safePath =
    typeof redirectTo === "string" &&
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//")
      ? redirectTo
      : "/dashboard";

  redirect(safePath);
}

// ─────────────────────────────────────────────────────────────
// Sign Out
// ─────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const service = new AuthService(supabase);
  await service.signOut();
  redirect("/login");
}
