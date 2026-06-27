"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AuthService } from "@/features/identity/services/auth.service";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/features/identity/schemas/auth.schemas";
import type { AuthActionResult } from "@/features/identity/types/auth.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function getBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${host}`;
}

// ─────────────────────────────────────────────────────────────
// Sign In
// ─────────────────────────────────────────────────────────────

export async function signInAction(
  formData: FormData
): Promise<AuthActionResult<void>> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "on",
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "invalid_credentials",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const service = new AuthService(supabase);
  const result = await service.signIn(parsed.data);

  if (!result.success) {
    return result;
  }

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
// Sign Up
// ─────────────────────────────────────────────────────────────

export async function signUpAction(
  formData: FormData
): Promise<AuthActionResult<void>> {
  const raw = {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptTerms: formData.get("acceptTerms") === "on" ? true : false,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "unknown",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const service = new AuthService(supabase);

  const result = await service.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    fullName: parsed.data.fullName,
  });

  if (!result.success) {
    return result;
  }

  redirect("/verify-email");
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

// ─────────────────────────────────────────────────────────────
// Forgot Password
// ─────────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  formData: FormData
): Promise<AuthActionResult<void>> {
  const raw = { email: formData.get("email") };

  const parsed = forgotPasswordSchema.safeParse(raw);
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

  const redirectTo = `${await getBaseUrl()}/reset-password`;
  return service.forgotPassword(parsed.data, redirectTo);
}

// ─────────────────────────────────────────────────────────────
// Reset Password
// ─────────────────────────────────────────────────────────────

export async function resetPasswordAction(
  formData: FormData
): Promise<AuthActionResult<void>> {
  const raw = {
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    token: formData.get("token"),
  };

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "unknown",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const service = new AuthService(supabase);

  const result = await service.resetPassword({
    ...parsed.data,
    token: typeof raw.token === "string" ? raw.token : "",
  });

  if (!result.success) {
    return result;
  }

  redirect("/login?message=password-reset");
}
