"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { ApiKeyService } from "@/features/api-keys/services/api-key.service";
import { createApiKeySchema } from "@/features/api-keys/schemas/api-key.schemas";
import type {
  ApiKey,
  ApiKeyActionResult,
  CreatedApiKey,
} from "@/features/api-keys/types/api-key.types";

const SETTINGS_PATH = "/settings/api-keys";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): ApiKeyActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): ApiKeyActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

/**
 * Resolves the caller, verifies org membership, and checks a permission.
 * Returns the authenticated userId on success.
 */
async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  { ok: true; userId: string } | { ok: false; result: ApiKeyActionResult<never> }
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
// Create
// ─────────────────────────────────────────────────────────────

export async function createApiKeyAction(
  organizationId: string,
  formData: FormData
): Promise<ApiKeyActionResult<CreatedApiKey>> {
  const parsed = createApiKeySchema.safeParse({
    name: formData.get("name"),
    scopes: formData.getAll("scopes"),
    expiresAt: formData.get("expiresAt") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "api_key.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ApiKeyService(supabase);
  const result = await service.createApiKey(
    {
      name: parsed.data.name,
      scopes: parsed.data.scopes,
      expiresAt: parsed.data.expiresAt || null,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    // NEVER log the plaintext key or the hash — only name + non-secret prefix.
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "api_key.create",
      entityType: "api_key",
      entityId: result.data.apiKey.id,
      summary: `Created API key "${result.data.apiKey.name}" (${result.data.apiKey.keyPrefix})`,
      metadata: {
        keyPrefix: result.data.apiKey.keyPrefix,
        scopes: result.data.apiKey.scopes,
      },
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Revoke
// ─────────────────────────────────────────────────────────────

export async function revokeApiKeyAction(
  organizationId: string,
  apiKeyId: string
): Promise<ApiKeyActionResult<ApiKey>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "api_key.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ApiKeyService(supabase);
  const result = await service.revokeApiKey(
    apiKeyId,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "api_key.revoke",
      entityType: "api_key",
      entityId: result.data.id,
      summary: `Revoked API key "${result.data.name}" (${result.data.keyPrefix})`,
      metadata: { keyPrefix: result.data.keyPrefix },
    });
  }

  return result;
}
