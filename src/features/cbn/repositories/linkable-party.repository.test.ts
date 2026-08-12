import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { LinkablePartyRepository } from "./linkable-party.repository";

interface Builder {
  select: Mock;
  eq: Mock;
  is: Mock;
  order: Mock;
  limit: Mock;
  single: Mock;
}

function createClient(result: { data: unknown; error: unknown }): {
  client: AppSupabaseClient;
  from: Mock;
  builder: Builder;
} {
  const builder = {} as Builder;
  Object.assign(builder, {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  });
  const from = vi.fn(() => builder);
  return { client: { from } as unknown as AppSupabaseClient, from, builder };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LinkablePartyRepository.listUnlinked", () => {
  it("reads customers when the role is customer", async () => {
    const { client, from, builder } = createClient({
      data: [{ id: "c1", code: "CUS-001", name: "Bharat Traders" }],
      error: null,
    });

    const result = await new LinkablePartyRepository(client).listUnlinked(
      "org-1",
      "customer"
    );

    expect(from).toHaveBeenCalledWith("customers");
    expect(result).toEqual([
      { id: "c1", code: "CUS-001", name: "Bharat Traders" },
    ]);
    expect(builder.eq).toHaveBeenCalledWith("organization_id", "org-1");
    // Only unlinked, active records may be offered.
    expect(builder.eq).toHaveBeenCalledWith("status", "active");
    expect(builder.is).toHaveBeenCalledWith("cbn_connection_id", null);
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("reads suppliers when the role is supplier", async () => {
    const { client, from } = createClient({ data: [], error: null });

    await new LinkablePartyRepository(client).listUnlinked("org-1", "supplier");

    expect(from).toHaveBeenCalledWith("suppliers");
  });

  it("returns an empty list on error rather than throwing", async () => {
    const { client } = createClient({ data: null, error: { message: "rls" } });

    const result = await new LinkablePartyRepository(client).listUnlinked(
      "org-1",
      "customer"
    );

    expect(result).toEqual([]);
  });
});

describe("LinkablePartyRepository.findLinked", () => {
  it("returns the record bound to the connection", async () => {
    const { client, builder } = createClient({
      data: { id: "s1", code: "SUP-001", name: "Acme Steel" },
      error: null,
    });

    const result = await new LinkablePartyRepository(client).findLinked(
      "org-1",
      "supplier",
      "conn-1"
    );

    expect(result).toEqual({ id: "s1", code: "SUP-001", name: "Acme Steel" });
    expect(builder.eq).toHaveBeenCalledWith("cbn_connection_id", "conn-1");
  });

  it("returns null when nothing is linked", async () => {
    const { client } = createClient({
      data: null,
      error: { message: "no rows" },
    });

    const result = await new LinkablePartyRepository(client).findLinked(
      "org-1",
      "supplier",
      "conn-1"
    );

    expect(result).toBeNull();
  });
});
