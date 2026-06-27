/**
 * Authentication domain types.
 * These are application-level types, not database types.
 * Database types live in src/types/database.types.ts.
 */

export type UserStatus = "active" | "inactive" | "suspended";

export interface User {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly avatarUrl: string | null;
  readonly phone: string | null;
  readonly status: UserStatus;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AuthSession {
  readonly user: User;
  readonly accessToken: string;
  readonly expiresAt: number;
}

export interface AuthError {
  readonly code: AuthErrorCode;
  readonly message: string;
}

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "account_disabled"
  | "account_suspended"
  | "too_many_requests"
  | "weak_password"
  | "email_already_registered"
  | "invalid_token"
  | "token_expired"
  | "unknown";

export interface SignUpInput {
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
}

export interface SignInInput {
  readonly email: string;
  readonly password: string;
  readonly rememberMe?: boolean;
}

export interface ForgotPasswordInput {
  readonly email: string;
}

export interface ResetPasswordInput {
  readonly password: string;
  readonly confirmPassword: string;
  readonly token: string;
}

export type AuthActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: AuthError };
