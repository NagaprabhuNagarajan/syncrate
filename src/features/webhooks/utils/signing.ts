import "server-only";

import { createHmac, randomBytes } from "node:crypto";

/**
 * HMAC signing material for outbound webhooks.
 *
 * SECURITY: this module is `server-only` and must never be imported into a
 * client component. The signing secret is generated here, persisted once, and
 * returned to the UI exactly once for a one-time reveal (like API keys). It is
 * never logged. Receivers verify the `X-Syncrate-Signature` header by computing
 * the same HMAC over `"<timestamp>.<rawBody>"` with their copy of the secret.
 */

/** Public, non-secret prefix that identifies a webhook signing secret. */
export const WEBHOOK_SECRET_PREFIX = "whsec_";

/** 24 random bytes → 48 hex chars of entropy. */
const SECRET_RANDOM_BYTES = 24;

/** Header carrying the hex HMAC signature, e.g. `sha256=<hex>`. */
export const SIGNATURE_HEADER = "X-Syncrate-Signature";
/** Header carrying the unix-millisecond timestamp included in the signature. */
export const TIMESTAMP_HEADER = "X-Syncrate-Timestamp";
/** Header carrying the event type of the delivered payload. */
export const EVENT_HEADER = "X-Syncrate-Event";

/** Generates a new signing secret: `whsec_<48 hex chars>`. */
export function generateWebhookSecret(): string {
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes(SECRET_RANDOM_BYTES).toString("hex")}`;
}

/**
 * Computes the signature for a payload. The signed content binds the timestamp
 * to the body (`"<timestamp>.<body>"`) so a captured signature cannot be
 * replayed against a different timestamp. Deterministic for the same inputs.
 *
 * @returns the header value, formatted `sha256=<hex>`.
 */
export function signWebhookPayload(
  secret: string,
  body: string,
  timestamp: string
): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `sha256=${digest}`;
}
