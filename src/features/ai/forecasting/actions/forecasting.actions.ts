"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ForecastingService } from "@/features/ai/forecasting/services/forecasting.service";
import { forecastTypeSchema } from "@/features/ai/forecasting/schemas/forecastSchema";
import type { ForecastResult } from "@/features/ai/forecasting/types/forecast.types";
import type { AiResult } from "@/features/ai/types/ai.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): AiResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

/**
 * Resolves the caller, verifies org membership, and checks a permission.
 * Returns the authenticated userId on success. Mirrors the customer action's
 * authorize() so AI actions enforce the same auth → membership → permission
 * chain (spec §14).
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
    return { ok: false, result: forbidden("Not authenticated") };
  }

  const orgService = new OrganizationService(supabase);
  const context = await orgService.getOrganizationContext(
    organizationId,
    authData.user.id
  );
  if (!context) {
    return {
      ok: false,
      result: forbidden("You do not have access to this organization"),
    };
  }
  if (!context.permissions.includes(permission)) {
    return {
      ok: false,
      result: forbidden("You do not have permission to perform this action"),
    };
  }

  return { ok: true, userId: authData.user.id };
}

// ─────────────────────────────────────────────────────────────
// Generate forecast
// ─────────────────────────────────────────────────────────────

/**
 * Generates an AI forecast of the requested type for an organization (spec §8).
 * Validates input, enforces the `ai.generate` permission, then delegates to the
 * forecasting service (which audits via the AI Gateway).
 */
export async function generateForecastAction(
  organizationId: string,
  forecastType: string
): Promise<AiResult<ForecastResult>> {
  const parsed = forecastTypeSchema.safeParse(forecastType);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "validation", message: "Unknown forecast type." },
    };
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "ai.generate");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ForecastingService(supabase);
  return service.generateForecast(parsed.data, {
    organizationId,
    userId: auth.userId,
  });
}
