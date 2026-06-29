import type { AppSupabaseClient } from "@/lib/supabase/types";
import { DiscoveryRepository } from "@/features/cbn/repositories/discovery.repository";
import type {
  BusinessProfile,
  BusinessPublicProfile,
  BusinessSearchResult,
  CbnActionResult,
  CbnErrorCode,
} from "@/features/cbn/types/cbn.types";

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

export class DiscoveryService {
  private readonly repo: DiscoveryRepository;

  constructor(private readonly supabase: AppSupabaseClient) {
    this.repo = new DiscoveryRepository(supabase);
  }

  async searchBusinesses(
    query: string,
    limit = 20,
    offset = 0
  ): Promise<BusinessSearchResult[]> {
    return this.repo.searchBusinesses(query, limit, offset);
  }

  async getPublicProfile(
    orgId: string
  ): Promise<CbnActionResult<BusinessPublicProfile>> {
    const profile = await this.repo.getPublicProfile(orgId);
    if (!profile) {return fail("not_found", "Business profile not found");}
    return ok(profile);
  }

  async getOwnProfile(orgId: string): Promise<CbnActionResult<BusinessProfile>> {
    const profile = await this.repo.getBusinessProfile(orgId);
    if (!profile) {return fail("not_found", "Business profile not found");}
    return ok(profile);
  }

  async updateDiscoverySettings(
    orgId: string,
    isDiscoverable: boolean
  ): Promise<CbnActionResult<void>> {
    const { error } = await this.supabase
      .from("business_profiles")
      .update({ is_discoverable: isDiscoverable })
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) {
      return fail("unknown", error.message);
    }

    return ok(undefined);
  }
}
