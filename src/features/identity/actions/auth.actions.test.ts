import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  AuthActionResult,
  AuthSession,
} from "@/features/identity/types/auth.types";
import {
  signInAction,
  signUpAction,
  signOutAction,
  forgotPasswordAction,
  resetPasswordAction,
} from "./auth.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const { mockService, redirectMock, headersGetMock, createClientMock } =
  vi.hoisted(() => ({
    mockService: {
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    },
    redirectMock: vi.fn(),
    headersGetMock: vi.fn(),
    createClientMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: headersGetMock })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createClientMock,
}));

vi.mock("@/features/identity/services/auth.service", () => ({
  AuthService: vi.fn(() => mockService),
}));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }
  return form;
}

const fakeSupabase = {} as unknown as AppSupabaseClient;

function okSession(): AuthActionResult<AuthSession> {
  return {
    success: true,
    data: {
      user: {
        id: "user-1",
        email: "user@example.com",
        fullName: "User One",
        avatarUrl: null,
        phone: null,
        status: "active",
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      accessToken: "token",
      expiresAt: 0,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  headersGetMock.mockReturnValue("app.syncrate.test");
});

// ─────────────────────────────────────────────────────────────
// signInAction
// ─────────────────────────────────────────────────────────────

describe("signInAction", () => {
  it("returns invalid_credentials error and does not call the service on invalid input", async () => {
    const result = await signInAction(fd({ email: "not-an-email", password: "" }));

    expect(result).toEqual({
      success: false,
      error: { code: "invalid_credentials", message: expect.any(String) },
    });
    expect(mockService.signIn).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("surfaces the service failure result", async () => {
    const failure: AuthActionResult<AuthSession> = {
      success: false,
      error: { code: "invalid_credentials", message: "bad creds" },
    };
    mockService.signIn.mockResolvedValue(failure);

    const result = await signInAction(
      fd({ email: "user@example.com", password: "password" })
    );

    expect(result).toBe(failure);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("parses input (lowercasing email) and redirects to /dashboard by default on success", async () => {
    mockService.signIn.mockResolvedValue(okSession());

    await signInAction(
      fd({ email: "USER@Example.com", password: "password", rememberMe: "on" })
    );

    expect(mockService.signIn).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password",
      rememberMe: true,
    });
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to a safe relative redirectTo path", async () => {
    mockService.signIn.mockResolvedValue(okSession());

    await signInAction(
      fd({
        email: "user@example.com",
        password: "password",
        redirectTo: "/invoices",
      })
    );

    expect(redirectMock).toHaveBeenCalledWith("/invoices");
  });

  it("falls back to /dashboard for an unsafe protocol-relative redirectTo", async () => {
    mockService.signIn.mockResolvedValue(okSession());

    await signInAction(
      fd({
        email: "user@example.com",
        password: "password",
        redirectTo: "//evil.com",
      })
    );

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});

// ─────────────────────────────────────────────────────────────
// signUpAction
// ─────────────────────────────────────────────────────────────

describe("signUpAction", () => {
  it("returns unknown error and does not call the service on invalid input", async () => {
    const result = await signUpAction(
      fd({
        fullName: "A",
        email: "bad",
        password: "weak",
        confirmPassword: "weak",
      })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: expect.any(String) },
    });
    expect(mockService.signUp).not.toHaveBeenCalled();
  });

  it("surfaces the service failure result", async () => {
    const failure: AuthActionResult<void> = {
      success: false,
      error: { code: "email_already_registered", message: "exists" },
    };
    mockService.signUp.mockResolvedValue(failure);

    const result = await signUpAction(
      fd({
        fullName: "Jane Doe",
        email: "jane@example.com",
        password: "Password1",
        confirmPassword: "Password1",
        acceptTerms: "on",
      })
    );

    expect(result).toBe(failure);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("calls the service with parsed args and redirects to /verify-email on success", async () => {
    mockService.signUp.mockResolvedValue({ success: true, data: undefined });

    await signUpAction(
      fd({
        fullName: "Jane Doe",
        email: "JANE@example.com",
        password: "Password1",
        confirmPassword: "Password1",
        acceptTerms: "on",
      })
    );

    expect(mockService.signUp).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "Password1",
      fullName: "Jane Doe",
    });
    expect(redirectMock).toHaveBeenCalledWith("/verify-email");
  });
});

// ─────────────────────────────────────────────────────────────
// signOutAction
// ─────────────────────────────────────────────────────────────

describe("signOutAction", () => {
  it("signs out and redirects to /login", async () => {
    mockService.signOut.mockResolvedValue({ success: true, data: undefined });

    await signOutAction();

    expect(mockService.signOut).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});

// ─────────────────────────────────────────────────────────────
// forgotPasswordAction
// ─────────────────────────────────────────────────────────────

describe("forgotPasswordAction", () => {
  it("returns unknown error and does not call the service on invalid input", async () => {
    const result = await forgotPasswordAction(fd({ email: "nope" }));

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: expect.any(String) },
    });
    expect(mockService.forgotPassword).not.toHaveBeenCalled();
  });

  it("returns the service result with an http base url redirect target", async () => {
    const success: AuthActionResult<void> = { success: true, data: undefined };
    mockService.forgotPassword.mockResolvedValue(success);

    const result = await forgotPasswordAction(fd({ email: "user@example.com" }));

    expect(mockService.forgotPassword).toHaveBeenCalledWith(
      { email: "user@example.com" },
      "http://app.syncrate.test/reset-password"
    );
    expect(result).toBe(success);
  });

  it("defaults the host to localhost when no host header is present", async () => {
    headersGetMock.mockReturnValue(null);
    mockService.forgotPassword.mockResolvedValue({ success: true, data: undefined });

    await forgotPasswordAction(fd({ email: "user@example.com" }));

    expect(mockService.forgotPassword).toHaveBeenCalledWith(
      { email: "user@example.com" },
      "http://localhost:3000/reset-password"
    );
  });
});

// ─────────────────────────────────────────────────────────────
// resetPasswordAction
// ─────────────────────────────────────────────────────────────

describe("resetPasswordAction", () => {
  it("returns unknown error and does not call the service on invalid input", async () => {
    const result = await resetPasswordAction(
      fd({ password: "weak", confirmPassword: "weak", token: "t" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: expect.any(String) },
    });
    expect(mockService.resetPassword).not.toHaveBeenCalled();
  });

  it("surfaces the service failure result", async () => {
    const failure: AuthActionResult<void> = {
      success: false,
      error: { code: "token_expired", message: "expired" },
    };
    mockService.resetPassword.mockResolvedValue(failure);

    const result = await resetPasswordAction(
      fd({
        password: "Password1",
        confirmPassword: "Password1",
        token: "abc",
      })
    );

    expect(result).toBe(failure);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("passes the token through and redirects on success", async () => {
    mockService.resetPassword.mockResolvedValue({ success: true, data: undefined });

    await resetPasswordAction(
      fd({
        password: "Password1",
        confirmPassword: "Password1",
        token: "abc",
      })
    );

    expect(mockService.resetPassword).toHaveBeenCalledWith({
      password: "Password1",
      confirmPassword: "Password1",
      token: "abc",
    });
    expect(redirectMock).toHaveBeenCalledWith("/login?message=password-reset");
  });

  it("defaults the token to an empty string when absent", async () => {
    mockService.resetPassword.mockResolvedValue({ success: true, data: undefined });

    const form = fd({
      password: "Password1",
      confirmPassword: "Password1",
    });

    await resetPasswordAction(form);

    expect(mockService.resetPassword).toHaveBeenCalledWith({
      password: "Password1",
      confirmPassword: "Password1",
      token: "",
    });
  });
});
