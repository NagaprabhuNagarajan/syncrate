import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@/tests/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConnections } from "./useConnections";

interface QueryResult {
  data: unknown;
  error: unknown;
}

const { fromMock, queryResultRef, builderCalls } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  queryResultRef: { current: { data: [], error: null } as QueryResult },
  builderCalls: { eq: vi.fn() },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: fromMock }),
}));

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "or", "is", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.eq = vi.fn((...args: unknown[]) => {
    builderCalls.eq(...args);
    return builder;
  });
  builder.then = (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(queryResultRef.current).then(onFulfilled, onRejected);
  return builder;
}

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

const dbRow = {
  id: "conn-1",
  organization_id: "org-1",
  requester_organization_id: "org-1",
  recipient_organization_id: "org-2",
  status: "accepted",
  connection_message: "Hi",
  requester_grants: ["receive_invoices"],
  recipient_grants: [],
  requested_at: "2026-01-01T10:00:00Z",
  accepted_at: "2026-02-01T10:00:00Z",
  rejected_at: null,
  disconnected_at: null,
  rejection_reason: null,
  created_at: "2026-01-01T10:00:00Z",
  updated_at: "2026-01-01T10:00:00Z",
  deleted_at: null,
  created_by: "user-1",
  updated_by: null,
  deleted_by: null,
  version: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  queryResultRef.current = { data: [], error: null };
  fromMock.mockImplementation(() => makeBuilder());
});

describe("useConnections", () => {
  it("starts in a loading state then resolves with mapped connections", async () => {
    queryResultRef.current = { data: [dbRow], error: null };
    const { result } = renderHook(
      () => useConnections({ organizationId: "org-1" }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const connections = result.current.data ?? [];
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({
      id: "conn-1",
      organizationId: "org-1",
      requesterOrganizationId: "org-1",
      status: "accepted",
      connectionMessage: "Hi",
      createdBy: "user-1",
    });
    expect(connections[0]?.acceptedAt).toBeInstanceOf(Date);
    expect(connections[0]?.rejectedAt).toBeNull();
    expect(connections[0]?.disconnectedAt).toBeNull();
    expect(fromMock).toHaveBeenCalledWith("business_connections");
  });

  it("maps optional dates when they are present", async () => {
    queryResultRef.current = {
      data: [
        {
          ...dbRow,
          accepted_at: null,
          rejected_at: "2026-03-01T10:00:00Z",
          disconnected_at: "2026-04-01T10:00:00Z",
        },
      ],
      error: null,
    };
    const { result } = renderHook(
      () => useConnections({ organizationId: "org-1" }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const connection = result.current.data?.[0];
    expect(connection?.acceptedAt).toBeNull();
    expect(connection?.rejectedAt).toBeInstanceOf(Date);
    expect(connection?.disconnectedAt).toBeInstanceOf(Date);
  });

  it("applies a status filter via eq when provided", async () => {
    queryResultRef.current = { data: [dbRow], error: null };
    const { result } = renderHook(
      () => useConnections({ organizationId: "org-1", status: "pending" }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(builderCalls.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("returns an empty array when the query errors", async () => {
    queryResultRef.current = { data: null, error: new Error("boom") };
    const { result } = renderHook(
      () => useConnections({ organizationId: "org-1" }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("stays disabled when no organization id is supplied", () => {
    const { result } = renderHook(
      () => useConnections({ organizationId: "" }),
      { wrapper: createWrapper() }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(fromMock).not.toHaveBeenCalled();
  });
});
