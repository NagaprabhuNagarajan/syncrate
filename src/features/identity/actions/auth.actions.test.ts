import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  AuthActionResult,
  AuthSession,
} from "@/features/identity/types/auth.types";
import {
  requestOtpAction,
  verifyOtpAction,
  signOutAction,
} from "./auth.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const { mockService, redirectMock, createClientMock } = vi.hoisted(() => ({
  mockService: {
    requestEmailOtp: vi.fn(),
    verifyEmailOtp: vi.fn(),
    signOut: vi.fn(),
  },
  redirectMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
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
});

// ─────────────────────────────────────────────────────────────
// requestOtpAction
// ─────────────────────────────────────────────────────────────

describe("requestOtpAction", () => {
  it("returns an error and does not call the service on an invalid email", async () => {
    const result = await requestOtpAction(fd({ email: "not-an-email" }));

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: expect.any(String) },
    });
    expect(mockService.requestEmailOtp).not.toHaveBeenCalled();
  });

  it("calls the service with a lowercased email and returns its result", async () => {
    const success: AuthActionResult<void> = { success: true, data: undefined };
    mockService.requestEmailOtp.mockResolvedValue(success);

    const result = await requestOtpAction(fd({ email: "USER@Example.com" }));

    expect(mockService.requestEmailOtp).toHaveBeenCalledWith({
      email: "user@example.com",
    });
    expect(result).toBe(success);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// verifyOtpAction
// ─────────────────────────────────────────────────────────────

describe("verifyOtpAction", () => {
  it("returns otp_invalid and does not call the service on invalid input", async () => {
    const result = await verifyOtpAction(
      fd({ email: "user@example.com", token: "12" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "otp_invalid", message: expect.any(String) },
    });
    expect(mockService.verifyEmailOtp).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("surfaces the service failure result", async () => {
    const failure: AuthActionResult<AuthSession> = {
      success: false,
      error: { code: "otp_expired", message: "expired" },
    };
    mockService.verifyEmailOtp.mockResolvedValue(failure);

    const result = await verifyOtpAction(
      fd({ email: "user@example.com", token: "123456" })
    );

    expect(result).toBe(failure);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("verifies and redirects to /dashboard by default on success", async () => {
    mockService.verifyEmailOtp.mockResolvedValue(okSession());

    await verifyOtpAction(fd({ email: "USER@Example.com", token: "123456" }));

    expect(mockService.verifyEmailOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
    });
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to a safe relative redirectTo path", async () => {
    mockService.verifyEmailOtp.mockResolvedValue(okSession());

    await verifyOtpAction(
      fd({ email: "user@example.com", token: "123456", redirectTo: "/invoices" })
    );

    expect(redirectMock).toHaveBeenCalledWith("/invoices");
  });

  it("falls back to /dashboard for an unsafe protocol-relative redirectTo", async () => {
    mockService.verifyEmailOtp.mockResolvedValue(okSession());

    await verifyOtpAction(
      fd({ email: "user@example.com", token: "123456", redirectTo: "//evil.com" })
    );

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
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
