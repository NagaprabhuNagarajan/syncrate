import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { SalesOrderRepository } from "./sales-order.repository";

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
  eq: Mock;
  neq: Mock;
  is: Mock;
  or: Mock;
  ilike: Mock;
  in: Mock;
  order: Mock;
  range: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  single: Mock;
  maybeSingle: Mock;
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
      neq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      or: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };

    builders.push(builder);
    return builder;
  });

  const client = { from } as unknown as AppSupabaseClient;
  return { client, from, builders };
}

describe("SalesOrderRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getStats", () => {
    it("aggregates status counts and sums total_amount for non-cancelled orders", async () => {
      const { client } = createMockClient([
        { data: null, error: null, count: 3 }, // draft
        { data: null, error: null, count: 2 }, // submitted (awaitingApproval)
        { data: null, error: null, count: 4 }, // approved
        { data: null, error: null, count: 1 }, // processing
        { data: null, error: null, count: 5 }, // partially_delivered
        {
          data: [{ total_amount: 100 }, { total_amount: 250.5 }],
          error: null,
        }, // value rows
      ]);
      const stats = await new SalesOrderRepository(client).getStats("org-1");
      expect(stats).toEqual({
        totalValue: 350.5,
        draft: 3,
        awaitingApproval: 2,
        open: 10, // approved + processing + partially_delivered
      });
    });

    it("defaults counts to 0 and totalValue to 0 when data is missing", async () => {
      const { client } = createMockClient([
        { data: null, error: null, count: null },
        { data: null, error: null, count: undefined },
        { data: null, error: null, count: null },
        { data: null, error: null, count: null },
        { data: null, error: null, count: null },
        { data: null, error: null },
      ]);
      const stats = await new SalesOrderRepository(client).getStats("org-1");
      expect(stats).toEqual({
        totalValue: 0,
        draft: 0,
        awaitingApproval: 0,
        open: 0,
      });
    });
  });
});
