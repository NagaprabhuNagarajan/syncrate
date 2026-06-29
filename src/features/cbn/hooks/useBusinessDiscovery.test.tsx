import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@/tests/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBusinessDiscovery } from "./useBusinessDiscovery";

interface RpcResult {
  data: unknown;
  error: unknown;
}

const { rpcMock, rpcResultRef } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  rpcResultRef: { current: { data: [], error: null } as RpcResult },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: rpcMock }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const dbSearchRow = {
  id: "org-2",
  name: "Acme Steel Works",
  display_name: "Acme",
  business_id: "SYN-MH-123456",
  gst_number: "27AABCU9603R1ZM",
  business_type: "manufacturer",
  city: "Mumbai",
  state: "Maharashtra",
  country: "IN",
  logo_url: null,
  verification_status: "verified",
  verification_level: 3,
  trust_score: 82,
  is_connected: false,
  connection_status: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  rpcResultRef.current = { data: [], error: null };
  rpcMock.mockImplementation(() => Promise.resolve(rpcResultRef.current));
});

describe("useBusinessDiscovery", () => {
  it("searches and maps results once the query is long enough", async () => {
    rpcResultRef.current = { data: [dbSearchRow], error: null };
    const { result } = renderHook(
      () => useBusinessDiscovery({ query: "acme" }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const results = result.current.data ?? [];
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "org-2",
      name: "Acme Steel Works",
      displayName: "Acme",
      businessId: "SYN-MH-123456",
      verificationLevel: 3,
      trustScore: 82,
      isConnected: false,
    });
    expect(rpcMock).toHaveBeenCalledWith("search_businesses", {
      p_query: "acme",
      p_limit: 20,
      p_offset: 0,
    });
  });

  it("forwards a custom limit to the rpc call", async () => {
    rpcResultRef.current = { data: [dbSearchRow], error: null };
    const { result } = renderHook(
      () => useBusinessDiscovery({ query: "acme", limit: 5 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpcMock).toHaveBeenCalledWith("search_businesses", {
      p_query: "acme",
      p_limit: 5,
      p_offset: 0,
    });
  });

  it("stays disabled for queries shorter than two characters", () => {
    const { result } = renderHook(
      () => useBusinessDiscovery({ query: "a" }),
      { wrapper: createWrapper() }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns an empty array when the rpc errors", async () => {
    rpcResultRef.current = { data: null, error: new Error("boom") };
    const { result } = renderHook(
      () => useBusinessDiscovery({ query: "acme" }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
