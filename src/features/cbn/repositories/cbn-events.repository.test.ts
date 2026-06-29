import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { CbnEventsRepository } from "./cbn-events.repository";

type DbRow = Database["public"]["Tables"]["cbn_events"]["Row"];

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface MockBuilder {
  select: Mock;
  eq: Mock;
  order: Mock;
  range: Mock;
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
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };

    builders.push(builder);
    return builder;
  });

  const client = { from } as unknown as AppSupabaseClient;
  return { client, from, builders };
}

function buildRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    id: "evt-1",
    organization_id: "org-1",
    connection_id: "conn-1",
    event_type: "connection_requested",
    actor_user_id: "user-1",
    source_organization_id: "org-1",
    target_organization_id: "org-2",
    reference_type: "connection",
    reference_id: "conn-1",
    correlation_id: "corr-1",
    metadata: { foo: "bar" },
    status: "success",
    error_message: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CbnEventsRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("listByOrg", () => {
    it("maps rows, passes metadata through and orders by created_at desc", async () => {
      const rows = [buildRow({ id: "e1" }), buildRow({ id: "e2" })];
      const { client, builders } = createMockClient([
        { data: rows, error: null },
      ]);
      const repo = new CbnEventsRepository(client);

      const events = await repo.listByOrg("org-1");
      expect(events.map((e) => e.id)).toEqual(["e1", "e2"]);
      expect(events[0].metadata).toEqual({ foo: "bar" });
      expect(events[0].correlationId).toBe("corr-1");
      expect(events[0].status).toBe("success");
      expect(events[0].createdAt).toBeInstanceOf(Date);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(builders[0].range).not.toHaveBeenCalled();
    });

    it("applies eventType filter and pagination", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new CbnEventsRepository(client);

      await repo.listByOrg("org-1", {
        eventType: "invoice_synced",
        limit: 5,
        offset: 10,
      });
      expect(builders[0].eq).toHaveBeenCalledWith(
        "event_type",
        "invoice_synced"
      );
      expect(builders[0].range).toHaveBeenCalledWith(10, 14);
    });

    it("ranges from offset 0 when only a limit is given", async () => {
      const { client, builders } = createMockClient([{ data: [], error: null }]);
      const repo = new CbnEventsRepository(client);

      await repo.listByOrg("org-1", { limit: 3 });
      expect(builders[0].range).toHaveBeenCalledWith(0, 2);
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CbnEventsRepository(client);
      expect(await repo.listByOrg("org-1")).toEqual([]);
    });
  });

  describe("listByConnection", () => {
    it("filters by connection_id with optional filters", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow({ connection_id: "conn-9" })], error: null },
      ]);
      const repo = new CbnEventsRepository(client);

      await repo.listByConnection("conn-9", {
        eventType: "po_synced",
        limit: 2,
      });
      expect(builders[0].eq).toHaveBeenCalledWith("connection_id", "conn-9");
      expect(builders[0].eq).toHaveBeenCalledWith("event_type", "po_synced");
      expect(builders[0].range).toHaveBeenCalledWith(0, 1);
    });

    it("maps rows with no params", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new CbnEventsRepository(client);

      const events = await repo.listByConnection("conn-1");
      expect(events).toHaveLength(1);
      expect(builders[0].range).not.toHaveBeenCalled();
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CbnEventsRepository(client);
      expect(await repo.listByConnection("conn-1")).toEqual([]);
    });
  });
});
