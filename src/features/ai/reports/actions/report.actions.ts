"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SmartReportService } from "@/features/ai/reports/services/smart-report.service";
import {
  REPORT_TYPES,
  type ReportType,
} from "@/features/ai/reports/schemas/reportSchema";
import type { AiResult } from "@/features/ai/types/ai.types";
import type { SmartReport } from "@/features/ai/reports/types/report.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function failure(
  code: "forbidden" | "validation",
  message: string
): AiResult<never> {
  return { success: false, error: { code, message } };
}

function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

/** Resolves the caller, verifies org membership, and checks a permission. */
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
// Smart Reports
// ─────────────────────────────────────────────────────────────

/** Generates an AI Smart Report of the requested type for an organization. */
export async function runSmartReportAction(
  organizationId: string,
  reportType: string
): Promise<AiResult<SmartReport>> {
  if (!isReportType(reportType)) {
    return failure("validation", "Unknown report type.");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "ai.generate");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SmartReportService(supabase);
  return service.generate(reportType, organizationId, auth.userId);
}
