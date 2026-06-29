import { describe, expect, it, vi, type MockedFunction } from "vitest";
import { TrustScoreService } from "./trust-score.service";
import type { AppSupabaseClient } from "@/lib/supabase/types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeSupabase(
  rpcResult: { data: unknown; error: null | { message: string } }
): AppSupabaseClient {
  const rpc = vi.fn().mockResolvedValue(rpcResult) as MockedFunction<
    AppSupabaseClient["rpc"]
  >;
  return { rpc } as unknown as AppSupabaseClient;
}

// ─────────────────────────────────────────────────────────────
// calculateTrustScore (pure method)
// ─────────────────────────────────────────────────────────────

describe("TrustScoreService.calculateTrustScore", () => {
  it("computes the weighted score correctly", () => {
    const supabase = makeSupabase({ data: null, error: null });
    const service = new TrustScoreService(supabase);
    // 80*0.4 + 60*0.3 + 40*0.15 + 20*0.15 = 59
    expect(
      service.calculateTrustScore({
        paymentRating: 80,
        deliveryRating: 60,
        disputeScore: 40,
        customerRating: 20,
      })
    ).toBe(59);
  });

  it("returns 100 for perfect scores", () => {
    const supabase = makeSupabase({ data: null, error: null });
    const service = new TrustScoreService(supabase);
    expect(
      service.calculateTrustScore({
        paymentRating: 100,
        deliveryRating: 100,
        disputeScore: 100,
        customerRating: 100,
      })
    ).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────
// computeTrustScore (RPC)
// ─────────────────────────────────────────────────────────────

describe("TrustScoreService.computeTrustScore", () => {
  it("returns the RPC result on success", async () => {
    const supabase = makeSupabase({ data: 82.5, error: null });
    const service = new TrustScoreService(supabase);
    const result = await service.computeTrustScore("org-uuid");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(82.5);
    }
    expect(supabase.rpc).toHaveBeenCalledWith("compute_trust_score", {
      p_org_id: "org-uuid",
    });
  });

  it("returns an error when RPC fails", async () => {
    const supabase = makeSupabase({
      data: null,
      error: { message: "something went wrong" },
    });
    const service = new TrustScoreService(supabase);
    const result = await service.computeTrustScore("org-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});
