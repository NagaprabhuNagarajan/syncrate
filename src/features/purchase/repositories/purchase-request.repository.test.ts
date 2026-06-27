import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { PurchaseRequestRepository } from "./purchase-request.repository";

type DbPurchaseRequest =
  Database["public"]["Tables"]["purchase_requests"]["Row"];
type DbPurchaseRequestItem =
  Database["public"]["Tables"]["purchase_request_items"]["Row"];

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
      or: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
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

function buildDbRequest(
  overrides: Partial<DbPurchaseRequest> = {}
): DbPurchaseRequest {
  return {
    id: "pr-1",
    organization_id: "org-1",
    request_number: "PR-00001",
    status: "draft",
    warehouse_id: "wh-1",
    required_date: "2026-06-10",
    notes: "note",
    approved_by: null,
    approved_at: null,
    rejected_reason: null,
    converted_po_id: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    deleted_at: null,
    created_by: "user-1",
    updated_by: null,
    deleted_by: null,
    version: 1,
    ...overrides,
  };
}

function buildDbItem(
  overrides: Partial<DbPurchaseRequestItem> = {}
): DbPurchaseRequestItem {
  return {
    id: "item-1",
    organization_id: "org-1",
    purchase_request_id: "pr-1",
    product_id: "prod-1",
    description: "Widget",
    quantity: 10,
    estimated_price: 100,
    created_at: "2026-06-01T00:00:00.000Z",
    created_by: "user-1",
    ...overrides,
  };
}

describe("PurchaseRequestRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB row to the domain purchase request", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbRequest(), error: null },
      ]);
      const request = await new PurchaseRequestRepository(client).findById(
        "pr-1"
      );
      expect(request?.id).toBe("pr-1");
      expect(request?.requestNumber).toBe("PR-00001");
      expect(request?.requiredDate).toBeInstanceOf(Date);
      expect(request?.version).toBe(1);
      expect(builders[0].eq).toHaveBeenCalledWith("id", "pr-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("maps a null required date", async () => {
      const { client } = createMockClient([
        { data: buildDbRequest({ required_date: null }), error: null },
      ]);
      const request = await new PurchaseRequestRepository(client).findById(
        "pr-1"
      );
      expect(request?.requiredDate).toBeNull();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      expect(
        await new PurchaseRequestRepository(client).findById("pr-1")
      ).toBeNull();
    });
  });

  describe("findByNumber", () => {
    it("uppercases/trims the request number", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbRequest(), error: null },
      ]);
      const request = await new PurchaseRequestRepository(client).findByNumber(
        "org-1",
        "  pr-00001 "
      );
      expect(request?.id).toBe("pr-1");
      expect(builders[0].eq).toHaveBeenCalledWith("request_number", "PR-00001");
    });

    it("returns null when not found", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      expect(
        await new PurchaseRequestRepository(client).findByNumber("org-1", "PR-1")
      ).toBeNull();
    });
  });

  describe("findItems / findWithItems", () => {
    it("maps items ordered by created_at", async () => {
      const { client, builders } = createMockClient([
        { data: [buildDbItem(), buildDbItem({ id: "item-2" })], error: null },
      ]);
      const items = await new PurchaseRequestRepository(client).findItems(
        "pr-1"
      );
      expect(items.map((i) => i.id)).toEqual(["item-1", "item-2"]);
      expect(items[0].estimatedPrice).toBe(100);
      expect(builders[0].eq).toHaveBeenCalledWith("purchase_request_id", "pr-1");
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseRequestRepository(client).findItems("pr-1")
      ).toEqual([]);
    });

    it("combines header and items", async () => {
      const { client } = createMockClient([
        { data: buildDbRequest(), error: null },
        { data: [buildDbItem()], error: null },
      ]);
      const request = await new PurchaseRequestRepository(client).findWithItems(
        "pr-1"
      );
      expect(request?.items).toHaveLength(1);
    });

    it("returns null when the header is missing", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      expect(
        await new PurchaseRequestRepository(client).findWithItems("pr-1")
      ).toBeNull();
    });
  });

  describe("list", () => {
    it("maps rows, reads the joined warehouse name, applies defaults", async () => {
      const rows = [
        { ...buildDbRequest(), warehouses: { name: "Main WH" } },
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 5 },
      ]);
      const result = await new PurchaseRequestRepository(client).list("org-1");
      expect(result.items[0].warehouseName).toBe("Main WH");
      expect(result.total).toBe(5);
      expect(result.pageSize).toBe(20);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].range).toHaveBeenCalledWith(0, 19);
    });

    it("reads the warehouse name from an array join shape", async () => {
      const rows = [
        { ...buildDbRequest(), warehouses: [{ name: "Depot" }] },
      ];
      const { client } = createMockClient([
        { data: rows, error: null, count: 1 },
      ]);
      const result = await new PurchaseRequestRepository(client).list("org-1");
      expect(result.items[0].warehouseName).toBe("Depot");
    });

    it("defaults warehouse name to null when the join is empty", async () => {
      const rows = [{ ...buildDbRequest(), warehouses: null }];
      const { client } = createMockClient([
        { data: rows, error: null, count: 1 },
      ]);
      const result = await new PurchaseRequestRepository(client).list("org-1");
      expect(result.items[0].warehouseName).toBeNull();
    });

    it("applies status filter, search, custom sort and pagination", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new PurchaseRequestRepository(client).list("org-1", {
        status: "approved",
        search: "pr-001",
        page: 2,
        pageSize: 10,
        sortBy: "request_number",
        sortDir: "asc",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("status", "approved");
      expect(builders[0].ilike).toHaveBeenCalledWith(
        "request_number",
        "%pr-001%"
      );
      expect(builders[0].order).toHaveBeenCalledWith("request_number", {
        ascending: true,
      });
      expect(builders[0].range).toHaveBeenCalledWith(10, 19);
    });

    it("skips search when the sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new PurchaseRequestRepository(client).list("org-1", {
        search: "(),",
      });
      expect(builders[0].ilike).not.toHaveBeenCalled();
    });

    it("returns an empty result on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const result = await new PurchaseRequestRepository(client).list("org-1", {
        page: 3,
        pageSize: 5,
      });
      expect(result).toEqual({ items: [], total: 0, page: 3, pageSize: 5 });
    });

    it("clamps page and pageSize", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new PurchaseRequestRepository(client).list("org-1", {
        page: 0,
        pageSize: 1000,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 99);
    });
  });

  describe("createHeader / insertItems / replaceItems", () => {
    it("inserts and maps the created header", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbRequest(), error: null },
      ]);
      const request = await new PurchaseRequestRepository(client).createHeader({
        organization_id: "org-1",
        request_number: "PR-00001",
      });
      expect(request?.id).toBe("pr-1");
      expect(builders[0].insert).toHaveBeenCalled();
    });

    it("returns null on header insert error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseRequestRepository(client).createHeader({
          organization_id: "org-1",
          request_number: "PR-1",
        })
      ).toBeNull();
    });

    it("returns true without querying when there are no items", async () => {
      const { client, from } = createMockClient([]);
      expect(
        await new PurchaseRequestRepository(client).insertItems([])
      ).toBe(true);
      expect(from).not.toHaveBeenCalled();
    });

    it("inserts items and returns true", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      expect(
        await new PurchaseRequestRepository(client).insertItems([
          {
            organization_id: "org-1",
            purchase_request_id: "pr-1",
            product_id: "prod-1",
            quantity: 1,
          },
        ])
      ).toBe(true);
    });

    it("returns false on item insert error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseRequestRepository(client).insertItems([
          {
            organization_id: "org-1",
            purchase_request_id: "pr-1",
            product_id: "prod-1",
            quantity: 1,
          },
        ])
      ).toBe(false);
    });

    it("deletes existing items then inserts the new set", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
        { data: null, error: null },
      ]);
      const result = await new PurchaseRequestRepository(client).replaceItems(
        "pr-1",
        [
          {
            organization_id: "org-1",
            purchase_request_id: "pr-1",
            product_id: "prod-1",
            quantity: 1,
          },
        ]
      );
      expect(result).toBe(true);
      expect(builders[0].delete).toHaveBeenCalled();
      expect(builders[1].insert).toHaveBeenCalled();
    });

    it("returns false when the delete fails and does not insert", async () => {
      const { client, from } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const result = await new PurchaseRequestRepository(client).replaceItems(
        "pr-1",
        [
          {
            organization_id: "org-1",
            purchase_request_id: "pr-1",
            product_id: "prod-1",
            quantity: 1,
          },
        ]
      );
      expect(result).toBe(false);
      expect(from).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateHeader (optimistic locking)", () => {
    it("applies the patch and matches on the expected version", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbRequest({ notes: "updated", version: 2 }), error: null },
      ]);
      const request = await new PurchaseRequestRepository(client).updateHeader(
        "pr-1",
        { notes: "updated" },
        "user-9",
        1
      );
      expect(request?.notes).toBe("updated");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "pr-1");
      expect(builders[0].eq).toHaveBeenCalledWith("version", 1);
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.notes).toBe("updated");
      expect(patch.updated_by).toBe("user-9");
    });

    it("returns null (version conflict) when no row matches the version", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: { message: "no rows" } },
      ]);
      const request = await new PurchaseRequestRepository(client).updateHeader(
        "pr-1",
        { notes: "x" },
        "user-9",
        5
      );
      expect(request).toBeNull();
      expect(builders[0].eq).toHaveBeenCalledWith("version", 5);
    });
  });

  describe("updateStatus", () => {
    it("sets the status without extras by default", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbRequest({ status: "submitted" }), error: null },
      ]);
      const request = await new PurchaseRequestRepository(client).updateStatus(
        "pr-1",
        "submitted",
        "user-9"
      );
      expect(request?.status).toBe("submitted");
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.approved_by).toBeUndefined();
      expect(patch.rejected_reason).toBeUndefined();
      expect(patch.converted_po_id).toBeUndefined();
    });

    it("stamps the approver when approving", async () => {
      const { client, builders } = createMockClient([
        {
          data: buildDbRequest({
            status: "approved",
            approved_by: "user-9",
            approved_at: "2026-06-02T00:00:00.000Z",
          }),
          error: null,
        },
      ]);
      const request = await new PurchaseRequestRepository(client).updateStatus(
        "pr-1",
        "approved",
        "user-9",
        { approve: true }
      );
      expect(request?.approvedBy).toBe("user-9");
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.approved_by).toBe("user-9");
      expect(typeof patch.approved_at).toBe("string");
    });

    it("stores the rejection reason when rejecting", async () => {
      const { client, builders } = createMockClient([
        {
          data: buildDbRequest({
            status: "rejected",
            rejected_reason: "No budget",
          }),
          error: null,
        },
      ]);
      const request = await new PurchaseRequestRepository(client).updateStatus(
        "pr-1",
        "rejected",
        "user-9",
        { rejectedReason: "No budget" }
      );
      expect(request?.rejectedReason).toBe("No budget");
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.rejected_reason).toBe("No budget");
    });

    it("stores the converted PO id when converting", async () => {
      const { client, builders } = createMockClient([
        {
          data: buildDbRequest({
            status: "converted",
            converted_po_id: "po-9",
          }),
          error: null,
        },
      ]);
      const request = await new PurchaseRequestRepository(client).updateStatus(
        "pr-1",
        "converted",
        "user-9",
        { convertedPoId: "po-9" }
      );
      expect(request?.convertedPoId).toBe("po-9");
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.converted_po_id).toBe("po-9");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseRequestRepository(client).updateStatus(
          "pr-1",
          "submitted",
          "user-9"
        )
      ).toBeNull();
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at/deleted_by and returns true", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const result = await new PurchaseRequestRepository(client).softDelete(
        "pr-1",
        "user-9"
      );
      expect(result).toBe(true);
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.deleted_by).toBe("user-9");
    });

    it("returns false on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseRequestRepository(client).softDelete("pr-1", "user-9")
      ).toBe(false);
    });
  });
});
