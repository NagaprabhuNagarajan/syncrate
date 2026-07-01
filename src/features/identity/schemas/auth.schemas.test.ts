import { describe, expect, it } from "vitest";
import { otpRequestSchema, otpVerifySchema } from "./auth.schemas";

// ─────────────────────────────────────────────────────────────
// otpRequestSchema
// ─────────────────────────────────────────────────────────────

describe("otpRequestSchema", () => {
  it("accepts a valid email", () => {
    expect(
      otpRequestSchema.safeParse({ email: "user@example.com" }).success
    ).toBe(true);
  });

  it("normalizes email to lowercase", () => {
    const result = otpRequestSchema.safeParse({ email: "User@EXAMPLE.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects an invalid email", () => {
    expect(otpRequestSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false
    );
  });

  it("rejects an empty email", () => {
    expect(otpRequestSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// otpVerifySchema
// ─────────────────────────────────────────────────────────────

describe("otpVerifySchema", () => {
  const valid = { email: "user@example.com", token: "123456" };

  it("accepts a valid email and 6-digit code", () => {
    expect(otpVerifySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a code that is not 6 digits", () => {
    expect(
      otpVerifySchema.safeParse({ ...valid, token: "1234" }).success
    ).toBe(false);
  });

  it("rejects a non-numeric code", () => {
    expect(
      otpVerifySchema.safeParse({ ...valid, token: "abcdef" }).success
    ).toBe(false);
  });

  it("trims surrounding whitespace on the code", () => {
    const result = otpVerifySchema.safeParse({ ...valid, token: " 123456 " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe("123456");
    }
  });

  it("rejects an invalid email", () => {
    expect(
      otpVerifySchema.safeParse({ email: "bad", token: "123456" }).success
    ).toBe(false);
  });
});
