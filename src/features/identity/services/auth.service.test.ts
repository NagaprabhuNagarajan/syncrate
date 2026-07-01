import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { User } from "@/features/identity/types/auth.types";
import { AuthService } from "./auth.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/features/identity/repositories/auth.repository", () => ({
  AuthRepository: vi.fn(() => mockRepo),
}));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "user@example.com",
    fullName: "Test User",
    avatarUrl: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function buildAuthMock() {
  return {
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
  };
}

let auth: ReturnType<typeof buildAuthMock>;
let service: AuthService;

beforeEach(() => {
  vi.clearAllMocks();
  auth = buildAuthMock();
  const supabase = { auth } as unknown as AppSupabaseClient;
  service = new AuthService(supabase);
});

// ─────────────────────────────────────────────────────────────
// requestEmailOtp
// ─────────────────────────────────────────────────────────────

describe("AuthService.requestEmailOtp", () => {
  it("sends a code, normalizes the email, and allows user creation", async () => {
    auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });

    const result = await service.requestEmailOtp({
      email: "  NEW@Example.com ",
    });

    expect(result.success).toBe(true);
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "new@example.com",
      options: { shouldCreateUser: true },
    });
  });

  it("maps a rate-limit error to too_many_requests with friendly copy", async () => {
    auth.signInWithOtp.mockResolvedValue({
      data: {},
      error: { message: "email rate limit exceeded" },
    });

    const result = await service.requestEmailOtp({ email: "x@example.com" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("too_many_requests");
      expect(result.error.message).toMatch(/wait/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// verifyEmailOtp
// ─────────────────────────────────────────────────────────────

describe("AuthService.verifyEmailOtp", () => {
  const session = {
    access_token: "token-abc",
    expires_at: 12345,
    user: { id: "user-1" },
  };

  it("returns a session for an active user", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { session, user: { id: "user-1" } },
      error: null,
    });
    mockRepo.findById.mockResolvedValue(buildUser());

    const result = await service.verifyEmailOtp({
      email: "user@example.com",
      token: "123456",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accessToken).toBe("token-abc");
      expect(result.data.expiresAt).toBe(12345);
      expect(result.data.user.id).toBe("user-1");
    }
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
      type: "email",
    });
  });

  it("maps an expired code to otp_expired", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Token has expired" },
    });

    const result = await service.verifyEmailOtp({
      email: "user@example.com",
      token: "000000",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("otp_expired");
    }
  });

  it("maps an invalid code to otp_invalid", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid OTP" },
    });

    const result = await service.verifyEmailOtp({
      email: "user@example.com",
      token: "999999",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("otp_invalid");
    }
  });

  it("fails when the profile cannot be found", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { session, user: { id: "user-1" } },
      error: null,
    });
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.verifyEmailOtp({
      email: "user@example.com",
      token: "123456",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("signs out and fails for a suspended account", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { session, user: { id: "user-1" } },
      error: null,
    });
    mockRepo.findById.mockResolvedValue(buildUser({ status: "suspended" }));
    auth.signOut.mockResolvedValue({ error: null });

    const result = await service.verifyEmailOtp({
      email: "user@example.com",
      token: "123456",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("account_suspended");
    }
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("signs out and fails for an inactive account", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { session, user: { id: "user-1" } },
      error: null,
    });
    mockRepo.findById.mockResolvedValue(buildUser({ status: "inactive" }));
    auth.signOut.mockResolvedValue({ error: null });

    const result = await service.verifyEmailOtp({
      email: "user@example.com",
      token: "123456",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("account_disabled");
    }
    expect(auth.signOut).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// signOut
// ─────────────────────────────────────────────────────────────

describe("AuthService.signOut", () => {
  it("succeeds when Supabase returns no error", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    const result = await service.signOut();
    expect(result.success).toBe(true);
  });

  it("fails when Supabase returns an error", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "boom" } });
    const result = await service.signOut();
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// getSession / getCurrentUser
// ─────────────────────────────────────────────────────────────

describe("AuthService.getSession", () => {
  it("returns null when there is no session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    expect(await service.getSession()).toBeNull();
  });

  it("returns null when the profile is missing", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "t", expires_at: 1, user: { id: "u" } } },
    });
    mockRepo.findById.mockResolvedValue(null);
    expect(await service.getSession()).toBeNull();
  });

  it("returns a hydrated session when both exist", async () => {
    auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: "t", expires_at: 99, user: { id: "user-1" } },
      },
    });
    mockRepo.findById.mockResolvedValue(buildUser());

    const result = await service.getSession();
    expect(result?.accessToken).toBe("t");
    expect(result?.expiresAt).toBe(99);
    expect(result?.user.id).toBe("user-1");
  });
});

describe("AuthService.getCurrentUser", () => {
  it("returns null when there is no authenticated user", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await service.getCurrentUser()).toBeNull();
  });

  it("returns the profile for an authenticated user", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const user = buildUser();
    mockRepo.findById.mockResolvedValue(user);
    expect(await service.getCurrentUser()).toBe(user);
  });
});

// ─────────────────────────────────────────────────────────────
// updateProfile
// ─────────────────────────────────────────────────────────────

describe("AuthService.updateProfile", () => {
  it("forwards only the provided fields to the repository", async () => {
    const updated = buildUser({ fullName: "Renamed" });
    mockRepo.update.mockResolvedValue(updated);

    const result = await service.updateProfile("user-1", {
      fullName: "Renamed",
    });

    expect(result.success).toBe(true);
    expect(mockRepo.update).toHaveBeenCalledWith("user-1", {
      full_name: "Renamed",
    });
  });

  it("forwards a null phone when explicitly cleared", async () => {
    mockRepo.update.mockResolvedValue(buildUser());
    await service.updateProfile("user-1", { phone: null });
    expect(mockRepo.update).toHaveBeenCalledWith("user-1", { phone: null });
  });

  it("fails when the repository returns null", async () => {
    mockRepo.update.mockResolvedValue(null);
    const result = await service.updateProfile("user-1", { fullName: "X" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});
