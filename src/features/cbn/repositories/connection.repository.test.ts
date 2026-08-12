import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { ConnectionRepository } from "./connection.repository";

type DbRow = Database["public"]["Tables"]["business_connections"]["Row"];

// ─────────────────────────────────────────────────────────────
// Chainable + thenable Supabase mock
// ─────────────────────────────────────────────────────────────

interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}

interface MockBuilder {
  select: Mock;
  update: Mock;
  eq: Mock;
  is: Mock;
  or: Mock;
  order: Mock;
  limit: Mock;
  range: Mock;
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
      update: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      or: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
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

function buildRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    id: "conn-1",
    organization_id: "org-1",
    requester_organization_id: "org-a",
    recipient_organization_id: "org-b",
    status: "pending",
    connection_message: "hello",
    requester_grants: ["receive_invoices"],
    recipient_grants: [],
    requested_at: "2026-01-01T00:00:00.000Z",
    accepted_at: null,
    rejected_at: null,
    disconnected_at: null,
    rejection_reason: null,
    requester_counterparty_role: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    deleted_at: null,
    created_by: "user-1",
    updated_by: null,
    deleted_by: null,
    version: 1,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ConnectionRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a row to the domain connection with null date fallbacks", async () => {
      const row = buildRow();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new ConnectionRepository(client);

      const conn = await repo.findById("conn-1");

      expect(conn).toEqual({
        id: "conn-1",
        organizationId: "org-1",
        requesterOrganizationId: "org-a",
        recipientOrganizationId: "org-b",
        status: "pending",
        connectionMessage: "hello",
        requesterGrants: ["receive_invoices"],
        recipientGrants: [],
        requestedAt: new Date("2026-01-01T00:00:00.000Z"),
        acceptedAt: null,
        rejectedAt: null,
        disconnectedAt: null,
        rejectionReason: null,
        requesterCounterpartyRole: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: "user-1",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("id", "conn-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("converts non-null timestamps to Date instances", async () => {
      const row = buildRow({
        status: "accepted",
        accepted_at: "2026-02-01T00:00:00.000Z",
        rejected_at: "2026-02-02T00:00:00.000Z",
        disconnected_at: "2026-02-03T00:00:00.000Z",
      });
      const { client } = createMockClient([{ data: row, error: null }]);
      const repo = new ConnectionRepository(client);

      const conn = await repo.findById("conn-1");
      expect(conn?.acceptedAt).toBeInstanceOf(Date);
      expect(conn?.rejectedAt).toBeInstanceOf(Date);
      expect(conn?.disconnectedAt).toBeInstanceOf(Date);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new ConnectionRepository(client);
      expect(await repo.findById("conn-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new ConnectionRepository(client);
      expect(await repo.findById("conn-1")).toBeNull();
    });
  });

  describe("findByOrg", () => {
    it("filters by requester/recipient and orders by requested_at desc", async () => {
      const rows = [buildRow({ id: "c1" }), buildRow({ id: "c2" })];
      const { client, builders } = createMockClient([
        { data: rows, error: null },
      ]);
      const repo = new ConnectionRepository(client);

      const result = await repo.findByOrg("org-x");

      expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
      expect(builders[0].or).toHaveBeenCalledWith(
        "requester_organization_id.eq.org-x,recipient_organization_id.eq.org-x"
      );
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].order).toHaveBeenCalledWith("requested_at", {
        ascending: false,
      });
      expect(builders[0].eq).not.toHaveBeenCalled();
    });

    it("applies status, limit and offset params", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new ConnectionRepository(client);

      await repo.findByOrg("org-x", {
        status: "accepted",
        limit: 10,
        offset: 5,
      });

      expect(builders[0].eq).toHaveBeenCalledWith("status", "accepted");
      expect(builders[0].limit).toHaveBeenCalledWith(10);
      expect(builders[0].range).toHaveBeenCalledWith(5, 14);
    });

    it("uses the default page size when offset is set without a limit", async () => {
      const { client, builders } = createMockClient([{ data: [], error: null }]);
      const repo = new ConnectionRepository(client);

      await repo.findByOrg("org-x", { offset: 5 });
      expect(builders[0].limit).not.toHaveBeenCalled();
      expect(builders[0].range).toHaveBeenCalledWith(5, 24);
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new ConnectionRepository(client);
      expect(await repo.findByOrg("org-x")).toEqual([]);
    });
  });

  describe("findBetweenOrgs", () => {
    it("builds the bidirectional OR filter and maps the row", async () => {
      const row = buildRow();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new ConnectionRepository(client);

      const conn = await repo.findBetweenOrgs("org-a", "org-b");
      expect(conn?.id).toBe("conn-1");
      expect(builders[0].or).toHaveBeenCalledWith(
        "and(requester_organization_id.eq.org-a,recipient_organization_id.eq.org-b),and(requester_organization_id.eq.org-b,recipient_organization_id.eq.org-a)"
      );
      expect(builders[0].limit).toHaveBeenCalledWith(1);
    });

    it("returns null when not found", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new ConnectionRepository(client);
      expect(await repo.findBetweenOrgs("org-a", "org-b")).toBeNull();
    });
  });

  describe("findPendingForOrg", () => {
    it("filters by recipient + pending status and maps rows", async () => {
      const rows = [buildRow({ id: "p1" })];
      const { client, builders } = createMockClient([
        { data: rows, error: null },
      ]);
      const repo = new ConnectionRepository(client);

      const result = await repo.findPendingForOrg("org-b");
      expect(result.map((c) => c.id)).toEqual(["p1"]);
      expect(builders[0].eq).toHaveBeenCalledWith(
        "recipient_organization_id",
        "org-b"
      );
      expect(builders[0].eq).toHaveBeenCalledWith("status", "pending");
      expect(builders[0].order).toHaveBeenCalledWith("requested_at", {
        ascending: false,
      });
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new ConnectionRepository(client);
      expect(await repo.findPendingForOrg("org-b")).toEqual([]);
    });
  });

  describe("softDelete", () => {
    it("stamps deleted_at/deleted_by and only touches live rows", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const repo = new ConnectionRepository(client);

      expect(await repo.softDelete("conn-1", "user-1")).toBe(true);
      const patch = builders[0]?.update.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(patch.deleted_at).toEqual(expect.any(String));
      expect(patch.deleted_by).toBe("user-1");
      expect(patch.updated_by).toBe("user-1");
      expect(builders[0]?.eq).toHaveBeenCalledWith("id", "conn-1");
      expect(builders[0]?.is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns false when the update errors", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "rls denied" } },
      ]);
      const repo = new ConnectionRepository(client);
      expect(await repo.softDelete("conn-1", "user-1")).toBe(false);
    });
  });
});
