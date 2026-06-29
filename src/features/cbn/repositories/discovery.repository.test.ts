import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { DiscoveryRepository } from "./discovery.repository";

type DbProfileRow = Database["public"]["Tables"]["business_profiles"]["Row"];
type DbSearchRow =
  Database["public"]["Functions"]["search_businesses"]["Returns"][number];
type DbPublicProfileRow =
  Database["public"]["Functions"]["get_business_public_profile"]["Returns"][number];

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface MockBuilder {
  select: Mock;
  eq: Mock;
  is: Mock;
  single: Mock;
}

interface MockClient {
  client: AppSupabaseClient;
  from: Mock;
  rpc: Mock;
  builders: MockBuilder[];
}

function createMockClient(
  fromResults: QueryResult[],
  rpcResult: QueryResult = { data: null, error: null }
): MockClient {
  const builders: MockBuilder[] = [];
  let index = 0;

  const from = vi.fn(() => {
    const result = fromResults[index] ?? { data: null, error: null };
    index += 1;

    const builder: MockBuilder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
    };

    builders.push(builder);
    return builder;
  });

  const rpc = vi.fn(() => Promise.resolve(rpcResult));
  const client = { from, rpc } as unknown as AppSupabaseClient;
  return { client, from, rpc, builders };
}

function buildProfileRow(overrides: Partial<DbProfileRow> = {}): DbProfileRow {
  return {
    id: "bp-1",
    organization_id: "org-1",
    verification_level: 2,
    trust_score: 80,
    is_discoverable: true,
    catalog_enabled: true,
    total_connections: 5,
    total_invoices_sent: 10,
    total_invoices_received: 8,
    total_pos_sent: 3,
    total_pos_received: 4,
    payment_rating: 90,
    delivery_rating: 85,
    dispute_score: 2,
    customer_rating: 88,
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

function buildSearchRow(overrides: Partial<DbSearchRow> = {}): DbSearchRow {
  return {
    id: "org-2",
    name: "Beta Traders",
    display_name: "Beta",
    business_id: "BIZ-2",
    gst_number: "22BBBBB0000B1Z5",
    business_type: "wholesaler",
    city: "Mumbai",
    state: "MH",
    country: "IN",
    logo_url: "https://logo.test/b.png",
    verification_status: "verified",
    verification_level: 2,
    trust_score: 75,
    is_connected: false,
    connection_status: null,
    ...overrides,
  };
}

function buildPublicProfileRow(
  overrides: Partial<DbPublicProfileRow> = {}
): DbPublicProfileRow {
  return {
    id: "org-2",
    name: "Beta Traders",
    display_name: "Beta",
    business_id: "BIZ-2",
    gst_number: "22BBBBB0000B1Z5",
    business_type: "wholesaler",
    city: "Mumbai",
    state: "MH",
    country: "IN",
    logo_url: "https://logo.test/b.png",
    website: "https://beta.test",
    email: "hi@beta.test",
    phone: "+919999999999",
    verification_status: "verified",
    verification_level: 2,
    trust_score: 75,
    catalog_enabled: true,
    total_connections: 12,
    is_connected: true,
    connection_id: "conn-7",
    connection_status: "accepted",
    ...overrides,
  };
}

describe("DiscoveryRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("searchBusinesses", () => {
    it("calls the search_businesses RPC with defaults and maps rows", async () => {
      const { client, rpc } = createMockClient([], {
        data: [buildSearchRow()],
        error: null,
      });
      const repo = new DiscoveryRepository(client);

      const results = await repo.searchBusinesses("beta");
      expect(rpc).toHaveBeenCalledWith("search_businesses", {
        p_query: "beta",
        p_limit: 20,
        p_offset: 0,
      });
      expect(results).toEqual([
        {
          id: "org-2",
          name: "Beta Traders",
          displayName: "Beta",
          businessId: "BIZ-2",
          gstNumber: "22BBBBB0000B1Z5",
          businessType: "wholesaler",
          city: "Mumbai",
          state: "MH",
          country: "IN",
          logoUrl: "https://logo.test/b.png",
          verificationStatus: "verified",
          verificationLevel: 2,
          trustScore: 75,
          isConnected: false,
          connectionStatus: null,
        },
      ]);
    });

    it("forwards custom limit and offset", async () => {
      const { client, rpc } = createMockClient([], {
        data: [],
        error: null,
      });
      const repo = new DiscoveryRepository(client);

      await repo.searchBusinesses("beta", 50, 100);
      expect(rpc).toHaveBeenCalledWith("search_businesses", {
        p_query: "beta",
        p_limit: 50,
        p_offset: 100,
      });
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([], {
        data: null,
        error: { message: "x" },
      });
      const repo = new DiscoveryRepository(client);
      expect(await repo.searchBusinesses("beta")).toEqual([]);
    });

    it("returns [] when data is null", async () => {
      const { client } = createMockClient([], { data: null, error: null });
      const repo = new DiscoveryRepository(client);
      expect(await repo.searchBusinesses("beta")).toEqual([]);
    });
  });

  describe("getPublicProfile", () => {
    it("calls the RPC and maps the first row", async () => {
      const { client, rpc } = createMockClient([], {
        data: [buildPublicProfileRow()],
        error: null,
      });
      const repo = new DiscoveryRepository(client);

      const profile = await repo.getPublicProfile("org-2");
      expect(rpc).toHaveBeenCalledWith("get_business_public_profile", {
        p_organization_id: "org-2",
      });
      expect(profile?.id).toBe("org-2");
      expect(profile?.website).toBe("https://beta.test");
      expect(profile?.connectionId).toBe("conn-7");
      expect(profile?.isConnected).toBe(true);
    });

    it("returns null when the RPC returns an empty array", async () => {
      const { client } = createMockClient([], { data: [], error: null });
      const repo = new DiscoveryRepository(client);
      expect(await repo.getPublicProfile("org-2")).toBeNull();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([], {
        data: null,
        error: { message: "x" },
      });
      const repo = new DiscoveryRepository(client);
      expect(await repo.getPublicProfile("org-2")).toBeNull();
    });

    it("returns null when data is null", async () => {
      const { client } = createMockClient([], { data: null, error: null });
      const repo = new DiscoveryRepository(client);
      expect(await repo.getPublicProfile("org-2")).toBeNull();
    });
  });

  describe("getBusinessProfile", () => {
    it("queries business_profiles and maps the row", async () => {
      const { client, builders } = createMockClient([
        { data: buildProfileRow(), error: null },
      ]);
      const repo = new DiscoveryRepository(client);

      const profile = await repo.getBusinessProfile("org-1");
      expect(profile).toEqual({
        id: "bp-1",
        organizationId: "org-1",
        verificationLevel: 2,
        trustScore: 80,
        isDiscoverable: true,
        catalogEnabled: true,
        totalConnections: 5,
        totalInvoicesSent: 10,
        totalInvoicesReceived: 8,
        totalPosSent: 3,
        totalPosReceived: 4,
        paymentRating: 90,
        deliveryRating: 85,
        disputeScore: 2,
        customerRating: 88,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: "user-1",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new DiscoveryRepository(client);
      expect(await repo.getBusinessProfile("org-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new DiscoveryRepository(client);
      expect(await repo.getBusinessProfile("org-1")).toBeNull();
    });
  });
});
