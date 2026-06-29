import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  WEBHOOK_SECRET_PREFIX,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  EVENT_HEADER,
  generateWebhookSecret,
  signWebhookPayload,
} from "./signing";

describe("webhook signing", () => {
  describe("generateWebhookSecret", () => {
    it("produces a secret in the whsec_<48 hex chars> format", () => {
      const secret = generateWebhookSecret();
      expect(secret.startsWith(WEBHOOK_SECRET_PREFIX)).toBe(true);
      const randomPart = secret.slice(WEBHOOK_SECRET_PREFIX.length);
      expect(randomPart).toMatch(/^[0-9a-f]{48}$/);
    });

    it("generates a unique secret on each call", () => {
      expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
    });
  });

  describe("signWebhookPayload", () => {
    const secret = "whsec_test_secret";
    const body = JSON.stringify({ event: "invoice.paid", data: { id: "inv-1" } });
    const timestamp = "1700000000000";

    it("formats the signature as sha256=<64 hex chars>", () => {
      const signature = signWebhookPayload(secret, body, timestamp);
      expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    });

    it("matches a manual HMAC over `<timestamp>.<body>`", () => {
      const expected = createHmac("sha256", secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
      expect(signWebhookPayload(secret, body, timestamp)).toBe(
        `sha256=${expected}`
      );
    });

    it("is deterministic for the same inputs", () => {
      expect(signWebhookPayload(secret, body, timestamp)).toBe(
        signWebhookPayload(secret, body, timestamp)
      );
    });

    it("differs when the secret differs", () => {
      expect(signWebhookPayload("whsec_a", body, timestamp)).not.toBe(
        signWebhookPayload("whsec_b", body, timestamp)
      );
    });

    it("differs when the timestamp differs (replay-resistant)", () => {
      expect(signWebhookPayload(secret, body, "1")).not.toBe(
        signWebhookPayload(secret, body, "2")
      );
    });

    it("differs when the body differs", () => {
      expect(signWebhookPayload(secret, "{}", timestamp)).not.toBe(
        signWebhookPayload(secret, "{ }", timestamp)
      );
    });
  });

  it("exposes stable, distinct header names", () => {
    expect(SIGNATURE_HEADER).toBe("X-Syncrate-Signature");
    expect(TIMESTAMP_HEADER).toBe("X-Syncrate-Timestamp");
    expect(EVENT_HEADER).toBe("X-Syncrate-Event");
  });
});
