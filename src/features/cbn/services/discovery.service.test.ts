import { describe, expect, it, vi, beforeEach } from "vitest";
import { DiscoveryService } from "./discovery.service";
import type { AppSupabaseClient } from "@/lib/supabase/types";

// ─────────────────────────────────────────────────────────────
// Fixture factories
// ─────────────────────────────────────────────────────────────

function makeSearchRow(overrides?: Record<string, unknown>) {
  return {
    id: "org-1",
    name: "Acme Supplies",
    display_name: "Acme",
    business_id: "SYN-MH-000001",
    gst_number: "27AABCU9603R1ZX",
    business_type: "Supplier",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    logo_url: null,
    verification_status: "gst_verified",
    verification_level: 3,
    trust_score: 82,
    is_connected: false,
    connection_status: null,
    ...overrides,
  };
}

function makePublicProfileRow(overrides?: Record<string, unknown>) {
  return {
    id: "org-1",
    name: "Acme Supplies",
    display_name: "Acme",
    business_id: "SYN-MH-000001",
    gst_number: "27AABCU9603R1ZX",
    business_type: "Supplier",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    logo_url: null,
    website: "https://acme.example.com",
    email: "hello@acme.example.com",
    phone: "+919876543210",
    verification_status: "gst_verified",
    verification_level: 3,
    trust_score: 82,
    catalog_enabled: true,
    total_connections: 5,
    is_connected: false,
    connection_id: null,
    connection_status: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// searchBusinesses
// ─────────────────────────────────────────────────────────────

describe("DiscoveryService.searchBusinesses", () => {
  it("returns mapped BusinessSearchResult array", async () => {
    const rows = [makeSearchRow(), makeSearchRow({ id: "org-2", name: "Beta Co." })];
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
    } as unknown as AppSupabaseClient;

    const service = new DiscoveryService(supabase);
    const results = await service.searchBusinesses("acme", 20, 0);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("org-1");
    expect(results[0].name).toBe("Acme Supplies");
    expect(results[0].trustScore).toBe(82);
    expect(supabase.rpc).toHaveBeenCalledWith("search_businesses", {
      p_query: "acme",
      p_limit: 20,
      p_offset: 0,
    });
  });

  it("returns empty array when RPC errors", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      }),
    } as unknown as AppSupabaseClient;

    const service = new DiscoveryService(supabase);
    const results = await service.searchBusinesses("acme");

    expect(results).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// getPublicProfile
// ─────────────────────────────────────────────────────────────

describe("DiscoveryService.getPublicProfile", () => {
  it("returns the profile on success", async () => {
    const rows = [makePublicProfileRow()];
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
    } as unknown as AppSupabaseClient;

    const service = new DiscoveryService(supabase);
    const result = await service.getPublicProfile("org-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("org-1");
      expect(result.data.trustScore).toBe(82);
      expect(result.data.catalogEnabled).toBe(true);
    }
  });

  it("returns not_found when RPC returns empty array", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as AppSupabaseClient;

    const service = new DiscoveryService(supabase);
    const result = await service.getPublicProfile("org-missing");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("returns not_found when RPC errors", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "not found" },
      }),
    } as unknown as AppSupabaseClient;

    const service = new DiscoveryService(supabase);
    const result = await service.getPublicProfile("org-x");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// updateDiscoverySettings
// ─────────────────────────────────────────────────────────────

describe("DiscoveryService.updateDiscoverySettings", () => {
  it("returns success when update succeeds", async () => {
    const isNull = vi.fn().mockResolvedValue({ error: null });
    const eqOrg = vi.fn().mockReturnValue({ is: isNull });
    const update = vi.fn().mockReturnValue({ eq: eqOrg });
    const from = vi.fn().mockReturnValue({ update });

    const supabase = { from, rpc: vi.fn() } as unknown as AppSupabaseClient;
    const service = new DiscoveryService(supabase);

    const result = await service.updateDiscoverySettings("org-1", true);

    expect(result.success).toBe(true);
  });

  it("returns error when update fails", async () => {
    const isNull = vi.fn().mockResolvedValue({ error: { message: "DB error" } });
    const eqOrg = vi.fn().mockReturnValue({ is: isNull });
    const update = vi.fn().mockReturnValue({ eq: eqOrg });
    const from = vi.fn().mockReturnValue({ update });

    const supabase = { from, rpc: vi.fn() } as unknown as AppSupabaseClient;
    const service = new DiscoveryService(supabase);

    const result = await service.updateDiscoverySettings("org-1", false);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
