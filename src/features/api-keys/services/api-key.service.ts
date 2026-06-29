import type { AppSupabaseClient } from "@/lib/supabase/types";
import { ApiKeyRepository } from "@/features/api-keys/repositories/api-key.repository";
import {
  generateApiKey,
  hashApiKey,
} from "@/features/api-keys/utils/key-generator";
import { getApiKeyStatus } from "@/features/api-keys/utils/api-key-status";
import type {
  ApiKey,
  ApiKeyActionResult,
  ApiKeyError,
  ApiKeyErrorCode,
  CreateApiKeyInput,
  CreatedApiKey,
  VerifiedApiKey,
} from "@/features/api-keys/types/api-key.types";

function ok<T>(data: T): ApiKeyActionResult<T> {
  return { success: true, data };
}

function fail(
  code: ApiKeyErrorCode,
  message: string
): ApiKeyActionResult<never> {
  const error: ApiKeyError = { code, message };
  return { success: false, error };
}

/** Normalizes an optional ISO date: trims and converts "" → null. */
function normalizeExpiry(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  // Store as an end-of-day UTC timestamp so the key is valid through the day.
  return new Date(`${trimmed}T23:59:59.999Z`).toISOString();
}

export class ApiKeyService {
  private readonly repo: ApiKeyRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new ApiKeyRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listApiKeys(organizationId: string): Promise<ApiKey[]> {
    return this.repo.listByOrg(organizationId);
  }

  // ── Create ─────────────────────────────────────────────────

  /**
   * Generates a key server-side, stores only its hash + display prefix, and
   * returns the full plaintext exactly once for one-time display.
   */
  async createApiKey(
    input: CreateApiKeyInput,
    organizationId: string,
    userId: string
  ): Promise<ApiKeyActionResult<CreatedApiKey>> {
    const name = input.name.trim();
    if (name === "") {
      return fail("validation", "Name is required");
    }
    if (input.scopes.length === 0) {
      return fail("validation", "Select at least one scope");
    }

    const { fullKey, keyPrefix, keyHash } = generateApiKey();

    const created = await this.repo.create({
      organization_id: organizationId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: [...input.scopes],
      expires_at: normalizeExpiry(input.expiresAt),
      created_by: userId,
      updated_by: userId,
    });

    if (!created) {
      return fail("unknown", "Could not create the API key");
    }

    return ok({ apiKey: created, plaintextKey: fullKey });
  }

  // ── Revoke ─────────────────────────────────────────────────

  async revokeApiKey(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<ApiKeyActionResult<ApiKey>> {
    const existing = await this.repo.findById(id, organizationId);
    if (!existing) {
      return fail("not_found", "API key not found");
    }
    if (existing.revokedAt) {
      return fail("already_revoked", "This API key is already revoked");
    }

    const revoked = await this.repo.revoke(id, organizationId, userId);
    if (!revoked) {
      return fail("unknown", "Could not revoke the API key");
    }
    return ok(revoked);
  }

  // ── Verify (server-only foundation for request auth) ───────

  /**
   * Hashes the supplied raw key, finds the matching non-revoked, non-expired
   * row, records `last_used_at`, and returns the owning org + scopes. Returns
   * null for unknown, revoked, or expired keys. Never logs the plaintext.
   */
  async verifyApiKey(rawKey: string): Promise<VerifiedApiKey | null> {
    const candidate = rawKey?.trim();
    if (!candidate) {
      return null;
    }

    const keyHash = hashApiKey(candidate);
    const key = await this.repo.findByHash(keyHash);
    if (!key) {
      return null;
    }

    if (getApiKeyStatus(key) !== "active") {
      return null;
    }

    await this.repo.touchLastUsed(key.id);

    return {
      id: key.id,
      organizationId: key.organizationId,
      scopes: key.scopes,
    };
  }
}
