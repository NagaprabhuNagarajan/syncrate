"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import type { AiContext } from "@/features/ai/types/ai.types";
import { InsightService } from "../services/insight.service";
import type { InsightServiceResult } from "../types/insight.types";

/**
 * Resolves the caller, verifies org membership, and checks the AI-generate
 * permission. Mirrors the authorize() pattern in customer.actions.ts.
 */
async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  { ok: true; userId: string } | { ok: false; result: InsightServiceResult }
> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return {
      ok: false,
      result: {
        success: false,
        error: { code: "forbidden", message: "Not authenticated" },
      },
    };
  }

  const orgService = new OrganizationService(supabase);
  const context = await orgService.getOrganizationContext(
    organizationId,
    authData.user.id
  );
  if (!context) {
    return {
      ok: false,
      result: {
        success: false,
        error: {
          code: "forbidden",
          message: "You do not have access to this organization",
        },
      },
    };
  }
  if (!context.permissions.includes(permission)) {
    return {
      ok: false,
      result: {
        success: false,
        error: {
          code: "forbidden",
          message: "You do not have permission to perform this action",
        },
      },
    };
  }

  return { ok: true, userId: authData.user.id };
}

/**
 * Generates AI business-intelligence insights for the organization
 * (spec §13). Requires the `ai.generate` permission; auditing/timing happen
 * inside the gateway.
 */
export async function generateInsightsAction(
  organizationId: string
): Promise<InsightServiceResult> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "ai.generate");
  if (!auth.ok) {
    return auth.result;
  }

  const context: AiContext = { organizationId, userId: auth.userId };
  const service = new InsightService(supabase);
  return service.generate(context);
}
