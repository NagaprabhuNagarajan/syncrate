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
  | "account_disabled"
  | "account_suspended"
  | "too_many_requests"
  | "otp_invalid"
  | "otp_expired"
  | "unknown";

/** Request a one-time login code to be emailed to this address. */
export interface OtpRequestInput {
  readonly email: string;
}

/** Verify the 6-digit code the user received by email. */
export interface OtpVerifyInput {
  readonly email: string;
  readonly token: string;
}

export type AuthActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: AuthError };
