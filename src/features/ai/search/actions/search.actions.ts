"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SmartSearchService } from "@/features/ai/search/services/smart-search.service";
import type { AiResult } from "@/features/ai/types/ai.types";
import type { SmartSearchResult } from "@/features/ai/search/types/search.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function failure(
  code: "forbidden" | "validation",
  message: string
): AiResult<never> {
  return { success: false, error: { code, message } };
}

/**
 * Resolves the caller, verifies org membership, and checks a permission.
 * Returns the authenticated userId on success. Mirrors the customer actions'
 * authorize() pattern.
 */
async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  { ok: true; userId: string } | { ok: false; result: AiResult<never> }
> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { ok: false, result: failure("forbidden", "Not authenticated") };
  }

  const orgService = new OrganizationService(supabase);
  const context = await orgService.getOrganizationContext(
    organizationId,
    authData.user.id
  );
  if (!context) {
    return {
      ok: false,
      result: failure("forbidden", "You do not have access to this organization"),
    };
  }
  if (!context.permissions.includes(permission)) {
    return {
      ok: false,
      result: failure(
        "forbidden",
        "You do not have permission to use AI features"
      ),
    };
  }

  return { ok: true, userId: authData.user.id };
}

// ─────────────────────────────────────────────────────────────
// Smart Search
// ─────────────────────────────────────────────────────────────

/**
 * Runs an AI Smart Search: parses the natural-language query into a structured
 * intent and executes it against the real, tenant-scoped repositories.
 */
export async function runSmartSearchAction(
  organizationId: string,
  query: string
): Promise<AiResult<SmartSearchResult>> {
  const trimmed = query?.trim() ?? "";
  if (trimmed.length === 0) {
    return failure("validation", "Enter a search query.");
  }
  if (trimmed.length > 500) {
    return failure("validation", "Search query is too long.");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "ai.generate");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SmartSearchService(supabase);
  return service.search(trimmed, organizationId, auth.userId);
}
