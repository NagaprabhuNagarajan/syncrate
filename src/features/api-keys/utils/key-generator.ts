import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Cryptographic key material for API keys.
 *
 * SECURITY: this module is `server-only` and must never be imported into a
 * client component. The plaintext key is generated here and returned to the
 * caller exactly once; only the SHA-256 hash and a non-secret display prefix
 * are ever persisted. The plaintext is never logged or stored.
 */

/** Public, non-secret prefix that identifies the key environment. */
export const API_KEY_PREFIX = "syk_live_";

/** Number of random bytes — 24 bytes → 48 hex chars (>40 as required). */
const RANDOM_BYTES = 24;

/** Length of the stored, non-secret display prefix (e.g. "syk_live_a1b2"). */
const DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 4;

export interface GeneratedApiKey {
  /** Full plaintext secret — returned to the UI exactly once, never stored. */
  readonly fullKey: string;
  /** Non-secret fragment safe to persist and display, e.g. "syk_live_a1b2". */
  readonly keyPrefix: string;
  /** SHA-256 hex digest of the full key — the only secret material stored. */
  readonly keyHash: string;
}

/** SHA-256 hex digest of an arbitrary input. Deterministic. */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Generates a new API key: a cryptographically random secret, its display
 * prefix, and its hash. The full key is `syk_live_<48 hex chars>`.
 */
export function generateApiKey(): GeneratedApiKey {
  const randomPart = randomBytes(RANDOM_BYTES).toString("hex");
  const fullKey = `${API_KEY_PREFIX}${randomPart}`;
  const keyPrefix = fullKey.slice(0, DISPLAY_PREFIX_LENGTH);
  const keyHash = hashApiKey(fullKey);
  return { fullKey, keyPrefix, keyHash };
}
