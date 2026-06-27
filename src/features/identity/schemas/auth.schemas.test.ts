import { describe, expect, it } from "vitest";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.schemas";

// ─────────────────────────────────────────────────────────────
// registerSchema
// ─────────────────────────────────────────────────────────────

describe("registerSchema", () => {
  const valid = {
    fullName: "Jane Doe",
    email: "jane@example.com",
    password: "Password1",
    confirmPassword: "Password1",
    acceptTerms: true as const,
  };

  it("accepts a fully valid registration", () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase", () => {
    const result = registerSchema.safeParse({
      ...valid,
      email: "Jane@EXAMPLE.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jane@example.com");
    }
  });

  it("rejects an email with surrounding whitespace (validated before trim)", () => {
    const result = registerSchema.safeParse({
      ...valid,
      email: "  jane@example.com  ",
    });
    expect(result.success).toBe(false);
  });

  it("trims the full name", () => {
    const result = registerSchema.safeParse({ ...valid, fullName: "  Jane  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Jane");
    }
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = registerSchema.safeParse({ ...valid, fullName: "J" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email address", () => {
    const result = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a password under 8 characters", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "Pass1",
      confirmPassword: "Pass1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password missing an uppercase letter", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "password1",
      confirmPassword: "password1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password missing a digit", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "Passwordd",
      confirmPassword: "Passwordd",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when passwords do not match (error on confirmPassword)", () => {
    const result = registerSchema.safeParse({
      ...valid,
      confirmPassword: "Different1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });

  it("rejects when terms are not accepted", () => {
    const result = registerSchema.safeParse({ ...valid, acceptTerms: false });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// loginSchema
// ─────────────────────────────────────────────────────────────

describe("loginSchema", () => {
  it("accepts a valid login with rememberMe", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "anything",
      rememberMe: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid login without rememberMe", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "anything",
    });
    expect(result.success).toBe(true);
  });

  it("does not enforce password complexity on login", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "x",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "x" });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// forgotPasswordSchema
// ─────────────────────────────────────────────────────────────

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "user@example.com" }).success
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "bad" }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// resetPasswordSchema
// ─────────────────────────────────────────────────────────────

describe("resetPasswordSchema", () => {
  it("accepts matching strong passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "Password1",
      confirmPassword: "Password1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords with the error on confirmPassword", () => {
    const result = resetPasswordSchema.safeParse({
      password: "Password1",
      confirmPassword: "Password2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });

  it("rejects a weak password", () => {
    const result = resetPasswordSchema.safeParse({
      password: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
  });
});
