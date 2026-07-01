import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AuthRepository } from "@/features/identity/repositories/auth.repository";
import type {
  User,
  AuthSession,
  AuthActionResult,
  AuthError,
  AuthErrorCode,
  OtpRequestInput,
  OtpVerifyInput,
} from "@/features/identity/types/auth.types";

// ─────────────────────────────────────────────────────────────
// Error mapping
// ─────────────────────────────────────────────────────────────

function mapSupabaseAuthError(message: string): AuthError {
  const lower = message.toLowerCase();

  let code: AuthErrorCode = "unknown";

  if (
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("email rate limit")
  ) {
    code = "too_many_requests";
  } else if (lower.includes("expired")) {
    code = "otp_expired";
  } else if (
    lower.includes("invalid") &&
    (lower.includes("otp") || lower.includes("token") || lower.includes("code"))
  ) {
    code = "otp_invalid";
  } else if (
    lower.includes("token has expired or is invalid") ||
    lower.includes("otp")
  ) {
    code = "otp_invalid";
  }

  return { code, message };
}

/** User-facing copy that never leaks provider internals. */
function friendly(error: AuthError): AuthError {
  switch (error.code) {
    case "too_many_requests":
      return {
        code: error.code,
        message: "Too many attempts. Please wait a minute and try again.",
      };
    case "otp_expired":
      return {
        code: error.code,
        message: "That code has expired. Request a new one.",
      };
    case "otp_invalid":
      return {
        code: error.code,
        message: "That code isn't valid. Check it and try again.",
      };
    default:
      return error;
  }
}

function ok<T>(data: T): AuthActionResult<T> {
  return { success: true, data };
}

function fail(error: AuthError): AuthActionResult<never> {
  return { success: false, error };
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class AuthService {
  private readonly repo: AuthRepository;

  constructor(private readonly supabase: AppSupabaseClient) {
    this.repo = new AuthRepository(supabase);
  }

  // ── Request email OTP ─────────────────────────────────────

  /**
   * Sends a one-time login code to the given email. Passwordless: the same
   * entry point serves both sign-up and sign-in — `shouldCreateUser` provisions
   * a new auth user (and, via the on_auth_user_created trigger, a public.users
   * row) on first login. No password is ever set.
   */
  async requestEmailOtp(
    input: OtpRequestInput
  ): Promise<AuthActionResult<void>> {
    const { error } = await this.supabase.auth.signInWithOtp({
      email: input.email.toLowerCase().trim(),
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return fail(friendly(mapSupabaseAuthError(error.message)));
    }

    return ok(undefined);
  }

  // ── Verify email OTP ──────────────────────────────────────

  /**
   * Verifies the 6-digit code and establishes a session. Enforces the same
   * account-status gates as the old password sign-in.
   */
  async verifyEmailOtp(
    input: OtpVerifyInput
  ): Promise<AuthActionResult<AuthSession>> {
    const { data, error } = await this.supabase.auth.verifyOtp({
      email: input.email.toLowerCase().trim(),
      token: input.token.trim(),
      type: "email",
    });

    if (error || !data.session || !data.user) {
      return fail(
        friendly(mapSupabaseAuthError(error?.message ?? "Verification failed"))
      );
    }

    const profile = await this.repo.findById(data.user.id);
    if (!profile) {
      return fail({ code: "unknown", message: "User profile not found" });
    }

    if (profile.status === "suspended") {
      await this.supabase.auth.signOut();
      return fail({
        code: "account_suspended",
        message: "Your account has been suspended. Please contact support.",
      });
    }

    if (profile.status === "inactive") {
      await this.supabase.auth.signOut();
      return fail({
        code: "account_disabled",
        message: "Your account is inactive.",
      });
    }

    const session: AuthSession = {
      user: profile,
      accessToken: data.session.access_token,
      expiresAt: data.session.expires_at ?? 0,
    };

    return ok(session);
  }

  // ── Sign out ──────────────────────────────────────────────

  async signOut(): Promise<AuthActionResult<void>> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      return fail(mapSupabaseAuthError(error.message));
    }
    return ok(undefined);
  }

  // ── Get current session ───────────────────────────────────

  async getSession(): Promise<AuthSession | null> {
    const { data } = await this.supabase.auth.getSession();
    if (!data.session) {
      return null;
    }

    const profile = await this.repo.findById(data.session.user.id);
    if (!profile) {
      return null;
    }

    return {
      user: profile,
      accessToken: data.session.access_token,
      expiresAt: data.session.expires_at ?? 0,
    };
  }

  // ── Get current user ──────────────────────────────────────

  async getCurrentUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    if (!data.user) {
      return null;
    }
    return this.repo.findById(data.user.id);
  }

  // ── Update profile ────────────────────────────────────────

  async updateProfile(
    userId: string,
    patch: { fullName?: string; phone?: string | null }
  ): Promise<AuthActionResult<User>> {
    const updated = await this.repo.update(userId, {
      ...(patch.fullName !== undefined && { full_name: patch.fullName }),
      ...(patch.phone !== undefined && { phone: patch.phone }),
    });

    if (!updated) {
      return fail({ code: "unknown", message: "Failed to update profile" });
    }

    return ok(updated);
  }
}
