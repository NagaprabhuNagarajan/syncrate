import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { ProductLinkRepository } from "./product-link.repository";

interface Builder {
  select: Mock;
  eq: Mock;
  in: Mock;
  is: Mock;
}

function createClient(result: { data: unknown; error: unknown }): {
  client: AppSupabaseClient;
  builder: Builder;
} {
  const builder = {} as Builder;
  Object.assign(builder, {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => Promise.resolve(result)),
  });
  return {
    client: { from: vi.fn(() => builder) } as unknown as AppSupabaseClient,
    builder,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductLinkRepository.findForConnection", () => {
  it("maps supplier product ids to this org's products", async () => {
    const { client, builder } = createClient({
      data: [
        { counterparty_product_id: "their-1", product_id: "mine-1" },
        { counterparty_product_id: "their-2", product_id: "mine-2" },
      ],
      error: null,
    });

    const result = await new ProductLinkRepository(client).findForConnection(
      "org-1",
      "conn-1",
      ["their-1", "their-2"]
    );

    expect(result.get("their-1")).toBe("mine-1");
    expect(result.get("their-2")).toBe("mine-2");
    expect(builder.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(builder.eq).toHaveBeenCalledWith("connection_id", "conn-1");
  });

  it("does not query at all for an empty id list", async () => {
    const { client } = createClient({ data: [], error: null });

    const result = await new ProductLinkRepository(client).findForConnection(
      "org-1",
      "conn-1",
      []
    );

    expect(result.size).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("de-duplicates repeated ids before querying", async () => {
    const { client, builder } = createClient({ data: [], error: null });

    await new ProductLinkRepository(client).findForConnection("org-1", "conn-1", [
      "their-1",
      "their-1",
    ]);

    expect(builder.in).toHaveBeenCalledWith("counterparty_product_id", ["their-1"]);
  });

  it("degrades to an empty map on error rather than throwing", async () => {
    // Losing the memory only costs the user a prompt; throwing would take down
    // the whole inbox.
    const { client } = createClient({ data: null, error: { message: "rls" } });

    const result = await new ProductLinkRepository(client).findForConnection(
      "org-1",
      "conn-1",
      ["their-1"]
    );

    expect(result.size).toBe(0);
  });
});
