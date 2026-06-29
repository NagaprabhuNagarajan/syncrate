import { describe, expect, it, vi, beforeEach } from "vitest";
import { InvoiceSyncService } from "./invoice-sync.service";
import type { AppSupabaseClient } from "@/lib/supabase/types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeSupabase(
  rpcResult: { data: unknown; error: null | { message: string } }
): AppSupabaseClient {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const auditInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: "audit-1" }, error: null }),
    }),
  });
  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {return { insert: auditInsert };}
    // for repo list methods — not exercised in these tests
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    };
  });
  return { from, rpc } as unknown as AppSupabaseClient;
}

// ─────────────────────────────────────────────────────────────
// sendInvoice
// ─────────────────────────────────────────────────────────────

describe("InvoiceSyncService.sendInvoice", () => {
  it("returns the CBN invoice ID on success", async () => {
    const supabase = makeSupabase({ data: "cbn-inv-1", error: null });
    const service = new InvoiceSyncService(supabase);

    const result = await service.sendInvoice("inv-1", "conn-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("cbn-inv-1");
    }
    expect(supabase.rpc).toHaveBeenCalledWith("send_cbn_invoice", {
      p_invoice_id: "inv-1",
      p_connection_id: "conn-1",
    });
  });

  it("maps invalid_status RPC error when invoice not posted", async () => {
    const supabase = makeSupabase({
      data: null,
      error: { message: "invalid_status: invoice must be posted to send" },
    });
    const service = new InvoiceSyncService(supabase);

    const result = await service.sendInvoice("inv-draft", "conn-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
  });

  it("maps permission_denied RPC error", async () => {
    const supabase = makeSupabase({
      data: null,
      error: { message: "permission_denied: receive_invoices not granted" },
    });
    const service = new InvoiceSyncService(supabase);

    const result = await service.sendInvoice("inv-1", "conn-no-perm");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("permission_denied");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// acceptInvoice
// ─────────────────────────────────────────────────────────────

describe("InvoiceSyncService.acceptInvoice", () => {
  it("returns the purchase invoice ID on success", async () => {
    const supabase = makeSupabase({ data: "pur-inv-1", error: null });
    const service = new InvoiceSyncService(supabase);

    const result = await service.acceptInvoice("cbn-inv-1", "org-buyer", "Looks good");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("pur-inv-1");
    }
    expect(supabase.rpc).toHaveBeenCalledWith("accept_cbn_invoice", {
      p_cbn_invoice_id: "cbn-inv-1",
      p_buyer_org_id: "org-buyer",
      p_notes: "Looks good",
    });
  });

  it("passes null notes when not provided", async () => {
    const supabase = makeSupabase({ data: "pur-inv-2", error: null });
    const service = new InvoiceSyncService(supabase);

    await service.acceptInvoice("cbn-inv-1", "org-buyer");

    expect(supabase.rpc).toHaveBeenCalledWith("accept_cbn_invoice", {
      p_cbn_invoice_id: "cbn-inv-1",
      p_buyer_org_id: "org-buyer",
      p_notes: null,
    });
  });

  it("returns error when RPC fails", async () => {
    const supabase = makeSupabase({
      data: null,
      error: { message: "not_found: cbn invoice not found" },
    });
    const service = new InvoiceSyncService(supabase);

    const result = await service.acceptInvoice("missing", "org-buyer");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// rejectInvoice
// ─────────────────────────────────────────────────────────────

describe("InvoiceSyncService.rejectInvoice", () => {
  it("returns success on happy path", async () => {
    const supabase = makeSupabase({ data: undefined, error: null });
    const service = new InvoiceSyncService(supabase);

    const result = await service.rejectInvoice(
      "cbn-inv-1",
      "org-buyer",
      "Wrong amount"
    );

    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("reject_cbn_invoice", {
      p_cbn_invoice_id: "cbn-inv-1",
      p_buyer_org_id: "org-buyer",
      p_reason: "Wrong amount",
    });
  });

  it("returns error when RPC fails", async () => {
    const supabase = makeSupabase({
      data: null,
      error: { message: "invalid_status: already accepted" },
    });
    const service = new InvoiceSyncService(supabase);

    const result = await service.rejectInvoice(
      "cbn-inv-1",
      "org-buyer",
      "reason"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
