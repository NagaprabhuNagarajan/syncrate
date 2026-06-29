import type { ApiKey, ApiKeyStatus } from "@/features/api-keys/types/api-key.types";

/**
 * Derives the lifecycle status of a key. Pure (no secrets, no I/O) so it can be
 * used in both client UI and server code. Revocation takes precedence over
 * expiry.
 */
export function getApiKeyStatus(
  key: Pick<ApiKey, "revokedAt" | "expiresAt">,
  now: Date = new Date()
): ApiKeyStatus {
  if (key.revokedAt) {
    return "revoked";
  }
  if (key.expiresAt && key.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "active";
}
