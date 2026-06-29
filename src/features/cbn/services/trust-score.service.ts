import type { AppSupabaseClient } from "@/lib/supabase/types";
import {
  calculateTrustScore,
  type TrustScoreComponents,
} from "@/features/cbn/utils/trust-score";
import type { CbnActionResult, CbnErrorCode } from "@/features/cbn/types/cbn.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): CbnActionResult<T> {
  return { success: true, data };
}

function fail(code: CbnErrorCode, message: string): CbnActionResult<never> {
  return { success: false, error: { code, message } };
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class TrustScoreService {
  constructor(private readonly supabase: AppSupabaseClient) {}

  /**
   * Delegates to the `compute_trust_score` Postgres function which calculates
   * and persists the composite trust score for the given org.
   */
  async computeTrustScore(orgId: string): Promise<CbnActionResult<number>> {
    const { data, error } = await this.supabase.rpc("compute_trust_score", {
      p_org_id: orgId,
    });

    if (error) {
      return fail("unknown", error.message);
    }

    return ok(data as number);
  }

  /**
   * Pure function — no DB. Exposed on the service for convenience so callers
   * don't need to import from utils directly.
   */
  calculateTrustScore(components: TrustScoreComponents): number {
    return calculateTrustScore(components);
  }
}

export type { TrustScoreComponents };
