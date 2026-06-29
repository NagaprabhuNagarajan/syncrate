import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { MarketplaceRepository } from "./marketplace.repository";

type DbBrowseRow =
  Database["public"]["Functions"]["search_marketplace_listings"]["Returns"][number];
type DbReputationRow =
  Database["public"]["Functions"]["get_organization_reputation"]["Returns"][number];

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createRpcClient(result: QueryResult): {
  client: AppSupabaseClient;
  rpc: Mock;
} {
  const rpc = vi.fn(() => Promise.resolve(result));
  const client = { rpc } as unknown as AppSupabaseClient;
  return { client, rpc };
}

function buildBrowseRow(overrides: Partial<DbBrowseRow> = {}): DbBrowseRow {
  return {
    id: "list-1",
    organization_id: "seller-1",
    seller_name: "Acme Co",
    listing_type: "product",
    product_id: null,
    title: "Bulk widgets",
    description: "Great widgets",
    category: "Hardware",
    price: 49.5,
    currency: "INR",
    unit: "box",
    min_order_qty: 10,
    created_at: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("MarketplaceRepository.browse", () => {
  it("maps RPC rows to browse listings", async () => {
    const { client, rpc } = createRpcClient({
      data: [buildBrowseRow(), buildBrowseRow({ id: "list-2", listing_type: "supplier" })],
      error: null,
    });
    const repo = new MarketplaceRepository(client);

    const rows = await repo.browse(
      { query: "widget", listingType: "product", category: "Hardware" },
      25,
      0
    );

    expect(rpc).toHaveBeenCalledWith("search_marketplace_listings", {
      p_query: "widget",
      p_listing_type: "product",
      p_category: "Hardware",
      p_limit: 25,
      p_offset: 0,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "list-1",
      organizationId: "seller-1",
      sellerName: "Acme Co",
      listingType: "product",
      price: 49.5,
      minOrderQty: 10,
      reputation: null,
    });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
    expect(rows[1].listingType).toBe("supplier");
  });

  it("passes undefined for blank query/category filters", async () => {
    const { client, rpc } = createRpcClient({ data: [], error: null });
    const repo = new MarketplaceRepository(client);

    await repo.browse({ query: "  ", category: "" }, 10, 5);

    expect(rpc).toHaveBeenCalledWith("search_marketplace_listings", {
      p_query: undefined,
      p_listing_type: undefined,
      p_category: undefined,
      p_limit: 10,
      p_offset: 5,
    });
  });

  it("returns an empty array on RPC error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: new Error("rpc failed"),
    });
    const repo = new MarketplaceRepository(client);

    const rows = await repo.browse({}, 25, 0);
    expect(rows).toEqual([]);
  });

  it("normalizes a null price and missing min order qty", async () => {
    const { client } = createRpcClient({
      data: [buildBrowseRow({ price: null, min_order_qty: null })],
      error: null,
    });
    const repo = new MarketplaceRepository(client);

    const rows = await repo.browse({}, 25, 0);
    expect(rows[0].price).toBeNull();
    expect(rows[0].minOrderQty).toBeNull();
  });
});

describe("MarketplaceRepository.getReputation", () => {
  function buildReputationRow(
    overrides: Partial<DbReputationRow> = {}
  ): DbReputationRow {
    return {
      review_count: 4,
      average_rating: 4.5,
      recommended_count: 3,
      recommend_percent: 75,
      ...overrides,
    };
  }

  it("maps the first reputation row", async () => {
    const { client, rpc } = createRpcClient({
      data: [buildReputationRow()],
      error: null,
    });
    const repo = new MarketplaceRepository(client);

    const rep = await repo.getReputation("seller-1");

    expect(rpc).toHaveBeenCalledWith("get_organization_reputation", {
      p_org_id: "seller-1",
    });
    expect(rep).toEqual({
      reviewCount: 4,
      averageRating: 4.5,
      recommendedCount: 3,
      recommendPercent: 75,
    });
  });

  it("returns null when there is no reputation row", async () => {
    const { client } = createRpcClient({ data: [], error: null });
    const repo = new MarketplaceRepository(client);
    expect(await repo.getReputation("seller-1")).toBeNull();
  });

  it("returns null on RPC error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: new Error("boom"),
    });
    const repo = new MarketplaceRepository(client);
    expect(await repo.getReputation("seller-1")).toBeNull();
  });
});
