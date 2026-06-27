import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { AuthRepository } from "./auth.repository";

type DbUser = Database["public"]["Tables"]["users"]["Row"];

// ─────────────────────────────────────────────────────────────
// Chainable Supabase mock
// ─────────────────────────────────────────────────────────────

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface MockBuilder {
  select: Mock;
  eq: Mock;
  is: Mock;
  update: Mock;
  single: Mock;
}

interface MockClient {
  client: AppSupabaseClient;
  from: Mock;
  builders: MockBuilder[];
}

function createMockClient(results: QueryResult[]): MockClient {
  const builders: MockBuilder[] = [];
  let index = 0;

  const from = vi.fn(() => {
    const result = results[index] ?? { data: null, error: null };
    index += 1;

    const builder: MockBuilder & {
      then: (
        onFulfilled?: ((value: QueryResult) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => Promise<unknown>;
    } = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      update: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };

    builders.push(builder);
    return builder;
  });

  const client = { from } as unknown as AppSupabaseClient;
  return { client, from, builders };
}

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function buildDbUser(overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: "user-1",
    email: "alice@example.com",
    full_name: "Alice",
    avatar_url: "https://cdn/avatar.png",
    phone: "+919999999999",
    status: "active",
    last_login_at: "2026-01-02T03:04:05.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T12:00:00.000Z",
    deleted_at: null,
    created_by: null,
    updated_by: null,
    deleted_by: null,
    version: 1,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("AuthRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB row to the domain User on success", async () => {
      const row = buildDbUser();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new AuthRepository(client);

      const user = await repo.findById("user-1");

      expect(user).not.toBeNull();
      expect(user).toEqual({
        id: "user-1",
        email: "alice@example.com",
        fullName: "Alice",
        avatarUrl: "https://cdn/avatar.png",
        phone: "+919999999999",
        status: "active",
        lastLoginAt: new Date("2026-01-02T03:04:05.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T12:00:00.000Z"),
      });
      // Verify date conversions are real Date instances.
      expect(user?.lastLoginAt).toBeInstanceOf(Date);
      expect(user?.createdAt).toBeInstanceOf(Date);
      expect(user?.updatedAt).toBeInstanceOf(Date);
      // Verify the soft-delete guard is applied.
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].eq).toHaveBeenCalledWith("id", "user-1");
    });

    it("returns null lastLoginAt when last_login_at is null", async () => {
      const row = buildDbUser({ last_login_at: null });
      const { client } = createMockClient([{ data: row, error: null }]);
      const repo = new AuthRepository(client);

      const user = await repo.findById("user-1");

      expect(user?.lastLoginAt).toBeNull();
    });

    it("falls back to 'active' status when row status is missing", async () => {
      const row = buildDbUser();
      // Force a nullish status to exercise the `?? 'active'` fallback.
      const rowWithoutStatus = {
        ...row,
        status: null,
      } as unknown as DbUser;
      const { client } = createMockClient([
        { data: rowWithoutStatus, error: null },
      ]);
      const repo = new AuthRepository(client);

      const user = await repo.findById("user-1");

      expect(user?.status).toBe("active");
    });

    it("returns null when the query returns an error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new AuthRepository(client);

      expect(await repo.findById("user-1")).toBeNull();
    });

    it("returns null when no data is returned", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new AuthRepository(client);

      expect(await repo.findById("missing")).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("lowercases and trims the email before querying", async () => {
      const row = buildDbUser();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new AuthRepository(client);

      const user = await repo.findByEmail("  Alice@Example.com  ");

      expect(user?.email).toBe("alice@example.com");
      expect(builders[0].eq).toHaveBeenCalledWith(
        "email",
        "alice@example.com"
      );
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "nope" } },
      ]);
      const repo = new AuthRepository(client);

      expect(await repo.findByEmail("x@y.com")).toBeNull();
    });

    it("returns null when no data is returned", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new AuthRepository(client);

      expect(await repo.findByEmail("x@y.com")).toBeNull();
    });
  });

  describe("update", () => {
    it("applies the patch, sets updated_at, and maps the result", async () => {
      const updated = buildDbUser({ full_name: "Alice Updated" });
      const { client, builders } = createMockClient([
        { data: updated, error: null },
      ]);
      const repo = new AuthRepository(client);

      const user = await repo.update("user-1", { full_name: "Alice Updated" });

      expect(user?.fullName).toBe("Alice Updated");
      expect(builders[0].update).toHaveBeenCalledTimes(1);
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.full_name).toBe("Alice Updated");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "fail" } },
      ]);
      const repo = new AuthRepository(client);

      expect(await repo.update("user-1", { phone: "+910000000000" })).toBeNull();
    });

    it("returns null when no data is returned", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new AuthRepository(client);

      expect(await repo.update("user-1", { status: "inactive" })).toBeNull();
    });
  });
});
