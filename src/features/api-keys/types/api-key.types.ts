/**
 * API Key domain types (Enterprise — programmatic access).
 *
 * The plaintext key is NEVER persisted and NEVER part of the listed/stored
 * `ApiKey` shape. Only `keyPrefix` (a non-secret display fragment) is exposed.
 * The full key is surfaced exactly once at creation via `CreatedApiKey`.
 */

export type ApiKeyStatus = "active" | "expired" | "revoked";

/** A stored API key as exposed to the application — never includes the hash. */
export interface ApiKey {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  /** Non-secret display fragment, e.g. "syk_live_a1b2". */
  readonly keyPrefix: string;
  readonly scopes: readonly string[];
  readonly lastUsedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly revokedBy: string | null;
  readonly createdAt: Date;
  readonly createdBy: string | null;
}

/**
 * Result of creating a key. `plaintextKey` is the only time the full secret is
 * ever available — the UI shows it once and it can never be retrieved again.
 */
export interface CreatedApiKey {
  readonly apiKey: ApiKey;
  readonly plaintextKey: string;
}

export interface CreateApiKeyInput {
  readonly name: string;
  readonly scopes: readonly string[];
  /** ISO date string (yyyy-mm-dd) or null for no expiry. */
  readonly expiresAt?: string | null;
}

/** Minimal identity returned by `verifyApiKey` for downstream request auth. */
export interface VerifiedApiKey {
  readonly id: string;
  readonly organizationId: string;
  readonly scopes: readonly string[];
}

// ─────────────────────────────────────────────────────────────
// Scopes
// ─────────────────────────────────────────────────────────────

export const API_KEY_SCOPES = [
  { value: "read", label: "Read — all resources" },
  { value: "write", label: "Write — all resources" },
  { value: "invoices:read", label: "Invoices — read" },
  { value: "invoices:write", label: "Invoices — write" },
  { value: "inventory:read", label: "Inventory — read" },
  { value: "inventory:write", label: "Inventory — write" },
  { value: "customers:read", label: "Customers — read" },
  { value: "customers:write", label: "Customers — write" },
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]["value"];

export const API_KEY_SCOPE_VALUES: readonly string[] = API_KEY_SCOPES.map(
  (s) => s.value
);

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type ApiKeyErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "already_revoked"
  | "unknown";

export interface ApiKeyError {
  readonly code: ApiKeyErrorCode;
  readonly message: string;
}

export type ApiKeyActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: ApiKeyError };
