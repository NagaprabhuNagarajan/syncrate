import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AuthRepository } from "@/features/identity/repositories/auth.repository";
import type {
  User,
  AuthSession,
  AuthActionResult,
  AuthError,
  AuthErrorCode,
  SignUpInput,
  SignInInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "@/features/identity/types/auth.types";

// ─────────────────────────────────────────────────────────────
// Error mapping
// ─────────────────────────────────────────────────────────────

function mapSupabaseAuthError(message: string): AuthError {
  const lower = message.toLowerCase();

  let code: AuthErrorCode = "unknown";

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid_credentials")
  ) {
    code = "invalid_credentials";
  } else if (
    lower.includes("email not confirmed") ||
    lower.includes("email_not_confirmed")
  ) {
    code = "email_not_confirmed";
  } else if (
    lower.includes("user already registered") ||
    lower.includes("already registered")
  ) {
    code = "email_already_registered";
  } else if (
    lower.includes("too many requests") ||
    lower.includes("rate limit")
  ) {
    code = "too_many_requests";
  } else if (lower.includes("weak password") || lower.includes("password")) {
    code = "weak_password";
  } else if (lower.includes("token") && lower.includes("expired")) {
    code = "token_expired";
  } else if (
    lower.includes("invalid token") ||
    lower.includes("token is invalid")
  ) {
    code = "invalid_token";
  }

  return { code, message };
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

  // ── Sign up ───────────────────────────────────────────────

  async signUp(input: SignUpInput): Promise<AuthActionResult<void>> {
    const { error } = await this.supabase.auth.signUp({
      email: input.email.toLowerCase().trim(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
        },
      },
    });

    if (error) {
      return fail(mapSupabaseAuthError(error.message));
    }

    return ok(undefined);
  }

  // ── Sign in ───────────────────────────────────────────────

  async signIn(input: SignInInput): Promise<AuthActionResult<AuthSession>> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: input.email.toLowerCase().trim(),
      password: input.password,
    });

    if (error || !data.session || !data.user) {
      return fail(mapSupabaseAuthError(error?.message ?? "Sign-in failed"));
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

  // ── Forgot password ───────────────────────────────────────

  async forgotPassword(
    input: ForgotPasswordInput,
    redirectTo: string
  ): Promise<AuthActionResult<void>> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(
      input.email.toLowerCase().trim(),
      { redirectTo }
    );

    // Supabase returns success even for non-existent email addresses, so
    // email enumeration is prevented at the provider level. We still
    // propagate real infrastructure errors (e.g. rate limiting) so the
    // caller can surface them to the user.
    if (error) {
      return fail(mapSupabaseAuthError(error.message));
    }

    return ok(undefined);
  }

  // ── Reset password ────────────────────────────────────────

  async resetPassword(
    input: ResetPasswordInput
  ): Promise<AuthActionResult<void>> {
    const { error } = await this.supabase.auth.updateUser({
      password: input.password,
    });

    if (error) {
      return fail(mapSupabaseAuthError(error.message));
    }

    return ok(undefined);
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
