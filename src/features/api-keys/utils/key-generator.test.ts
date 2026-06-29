import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  API_KEY_PREFIX,
  generateApiKey,
  hashApiKey,
} from "./key-generator";

describe("key-generator", () => {
  describe("generateApiKey", () => {
    it("produces a key in the syk_live_<40+ chars> format", () => {
      const { fullKey } = generateApiKey();
      expect(fullKey.startsWith(API_KEY_PREFIX)).toBe(true);
      const randomPart = fullKey.slice(API_KEY_PREFIX.length);
      // 24 random bytes → 48 hex chars (> 40 required).
      expect(randomPart).toMatch(/^[0-9a-f]{48}$/);
      expect(randomPart.length).toBeGreaterThanOrEqual(40);
    });

    it("derives a non-secret display prefix (first ~12 chars)", () => {
      const { fullKey, keyPrefix } = generateApiKey();
      expect(keyPrefix).toBe(fullKey.slice(0, keyPrefix.length));
      expect(keyPrefix.startsWith(API_KEY_PREFIX)).toBe(true);
      expect(keyPrefix.length).toBe(API_KEY_PREFIX.length + 4);
      // The prefix must not reveal the full secret.
      expect(keyPrefix.length).toBeLessThan(fullKey.length);
    });

    it("stores only the SHA-256 hash, never the plaintext", () => {
      const { fullKey, keyHash } = generateApiKey();
      expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
      expect(keyHash).not.toBe(fullKey);
      expect(keyHash).not.toContain(fullKey);
      // Hash matches the documented derivation.
      expect(keyHash).toBe(
        createHash("sha256").update(fullKey).digest("hex")
      );
    });

    it("generates a unique key on each call", () => {
      const a = generateApiKey();
      const b = generateApiKey();
      expect(a.fullKey).not.toBe(b.fullKey);
      expect(a.keyHash).not.toBe(b.keyHash);
    });
  });

  describe("hashApiKey", () => {
    it("is deterministic for the same input", () => {
      const raw = "syk_live_deadbeef";
      expect(hashApiKey(raw)).toBe(hashApiKey(raw));
    });

    it("differs for different inputs", () => {
      expect(hashApiKey("syk_live_a")).not.toBe(hashApiKey("syk_live_b"));
    });

    it("never returns the plaintext", () => {
      const raw = "syk_live_secret_value";
      expect(hashApiKey(raw)).not.toBe(raw);
    });
  });
});
