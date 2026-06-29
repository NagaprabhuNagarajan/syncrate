import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { ApiKey } from "@/features/api-keys/types/api-key.types";
import { ApiKeyService } from "./api-key.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    listByOrg: vi.fn(),
    findById: vi.fn(),
    findByHash: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    touchLastUsed: vi.fn(),
  },
}));

vi.mock("@/features/api-keys/repositories/api-key.repository", () => ({
  ApiKeyRepository: vi.fn(() => mockRepo),
}));

// A trivial stand-in — the service never touches the client directly.
const supabase = {} as AppSupabaseClient;

function buildApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: "key-1",
    organizationId: "org-1",
    name: "Production",
    keyPrefix: "syk_live_a1b2",
    scopes: ["read"],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    revokedBy: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ApiKeyService", () => {
  describe("createApiKey", () => {
    it("returns the plaintext once and stores only the hash + prefix", async () => {
      mockRepo.create.mockImplementation((input) =>
        Promise.resolve(
          buildApiKey({
            keyPrefix: input.key_prefix,
            scopes: input.scopes,
          })
        )
      );

      const service = new ApiKeyService(supabase);
      const result = await service.createApiKey(
        { name: "Production", scopes: ["read", "write"] },
        "org-1",
        "user-1"
      );

      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }

      const plaintext = result.data.plaintextKey;
      expect(plaintext).toMatch(/^syk_live_[0-9a-f]{48}$/);

      // The repository must receive a hash, not the plaintext.
      const insert = mockRepo.create.mock.calls[0]?.[0];
      expect(insert.key_hash).toBe(
        createHash("sha256").update(plaintext).digest("hex")
      );
      expect(insert.key_hash).not.toBe(plaintext);
      expect(insert.key_prefix).toBe(plaintext.slice(0, insert.key_prefix.length));
      expect(insert.organization_id).toBe("org-1");
      expect(insert.created_by).toBe("user-1");

      // The returned ApiKey must not carry any hash field.
      expect(result.data.apiKey).not.toHaveProperty("keyHash");
    });

    it("rejects an empty name", async () => {
      const service = new ApiKeyService(supabase);
      const result = await service.createApiKey(
        { name: "   ", scopes: ["read"] },
        "org-1",
        "user-1"
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("validation");
      }
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it("rejects when no scopes are selected", async () => {
      const service = new ApiKeyService(supabase);
      const result = await service.createApiKey(
        { name: "Production", scopes: [] },
        "org-1",
        "user-1"
      );
      expect(result.success).toBe(false);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it("converts an expiry date to an end-of-day ISO timestamp", async () => {
      mockRepo.create.mockResolvedValue(buildApiKey());
      const service = new ApiKeyService(supabase);
      await service.createApiKey(
        { name: "Production", scopes: ["read"], expiresAt: "2030-01-15" },
        "org-1",
        "user-1"
      );
      const insert = mockRepo.create.mock.calls[0]?.[0];
      expect(insert.expires_at).toBe("2030-01-15T23:59:59.999Z");
    });

    it("returns unknown when the repository fails to insert", async () => {
      mockRepo.create.mockResolvedValue(null);
      const service = new ApiKeyService(supabase);
      const result = await service.createApiKey(
        { name: "Production", scopes: ["read"] },
        "org-1",
        "user-1"
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("unknown");
      }
    });
  });

  describe("revokeApiKey", () => {
    it("sets a tombstone via the repository", async () => {
      mockRepo.findById.mockResolvedValue(buildApiKey());
      mockRepo.revoke.mockResolvedValue(
        buildApiKey({
          revokedAt: new Date("2026-02-01T00:00:00Z"),
          revokedBy: "user-1",
        })
      );

      const service = new ApiKeyService(supabase);
      const result = await service.revokeApiKey("key-1", "org-1", "user-1");

      expect(result.success).toBe(true);
      expect(mockRepo.revoke).toHaveBeenCalledWith("key-1", "org-1", "user-1");
      if (result.success) {
        expect(result.data.revokedAt).not.toBeNull();
      }
    });

    it("returns not_found for an unknown key", async () => {
      mockRepo.findById.mockResolvedValue(null);
      const service = new ApiKeyService(supabase);
      const result = await service.revokeApiKey("missing", "org-1", "user-1");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("not_found");
      }
      expect(mockRepo.revoke).not.toHaveBeenCalled();
    });

    it("returns already_revoked when the key is already tombstoned", async () => {
      mockRepo.findById.mockResolvedValue(
        buildApiKey({ revokedAt: new Date("2026-01-10T00:00:00Z") })
      );
      const service = new ApiKeyService(supabase);
      const result = await service.revokeApiKey("key-1", "org-1", "user-1");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("already_revoked");
      }
      expect(mockRepo.revoke).not.toHaveBeenCalled();
    });
  });

  describe("verifyApiKey", () => {
    it("returns the org + scopes for a valid key and records usage", async () => {
      mockRepo.findByHash.mockResolvedValue(
        buildApiKey({ scopes: ["read", "write"] })
      );
      mockRepo.touchLastUsed.mockResolvedValue(undefined);

      const service = new ApiKeyService(supabase);
      const verified = await service.verifyApiKey("syk_live_anything");

      expect(verified).toEqual({
        id: "key-1",
        organizationId: "org-1",
        scopes: ["read", "write"],
      });
      // It must look up by the hash of the input, not the raw value.
      const expectedHash = createHash("sha256")
        .update("syk_live_anything")
        .digest("hex");
      expect(mockRepo.findByHash).toHaveBeenCalledWith(expectedHash);
      expect(mockRepo.touchLastUsed).toHaveBeenCalledWith("key-1");
    });

    it("returns null for an unknown key", async () => {
      mockRepo.findByHash.mockResolvedValue(null);
      const service = new ApiKeyService(supabase);
      expect(await service.verifyApiKey("syk_live_x")).toBeNull();
      expect(mockRepo.touchLastUsed).not.toHaveBeenCalled();
    });

    it("returns null for a revoked key", async () => {
      mockRepo.findByHash.mockResolvedValue(
        buildApiKey({ revokedAt: new Date("2026-01-01T00:00:00Z") })
      );
      const service = new ApiKeyService(supabase);
      expect(await service.verifyApiKey("syk_live_x")).toBeNull();
      expect(mockRepo.touchLastUsed).not.toHaveBeenCalled();
    });

    it("returns null for an expired key", async () => {
      mockRepo.findByHash.mockResolvedValue(
        buildApiKey({ expiresAt: new Date("2000-01-01T00:00:00Z") })
      );
      const service = new ApiKeyService(supabase);
      expect(await service.verifyApiKey("syk_live_x")).toBeNull();
      expect(mockRepo.touchLastUsed).not.toHaveBeenCalled();
    });

    it("returns null for an empty input", async () => {
      const service = new ApiKeyService(supabase);
      expect(await service.verifyApiKey("   ")).toBeNull();
      expect(mockRepo.findByHash).not.toHaveBeenCalled();
    });
  });

  describe("listApiKeys", () => {
    it("delegates to the repository", async () => {
      const keys = [buildApiKey()];
      mockRepo.listByOrg.mockResolvedValue(keys);
      const service = new ApiKeyService(supabase);
      expect(await service.listApiKeys("org-1")).toBe(keys);
      expect(mockRepo.listByOrg).toHaveBeenCalledWith("org-1");
    });
  });
});
