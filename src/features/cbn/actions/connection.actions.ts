"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { requestConnectionSchema } from "@/features/cbn/schemas/connectionSchema";
import type { CbnActionResult } from "@/features/cbn/types/cbn.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): CbnActionResult<never> {
  return { success: false, error: { code: "permission_denied", message } };
}

function invalid(message: string): CbnActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

function unknown(message: string): CbnActionResult<never> {
  return { success: false, error: { code: "unknown", message } };
}

async function authenticate(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  | { ok: true; userId: string }
  | { ok: false; result: CbnActionResult<never> }
> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { ok: false, result: forbidden("Not authenticated") };
  }

  const orgService = new OrganizationService(supabase);
  const context = await orgService.getOrganizationContext(
    organizationId,
    data.user.id
  );
  if (!context) {
    return { ok: false, result: forbidden("Organization not found") };
  }
  if (!context.permissions.includes(permission)) {
    return { ok: false, result: forbidden("Permission denied") };
  }

  return { ok: true, userId: data.user.id };
}

// ─────────────────────────────────────────────────────────────
// Send connection request
// ─────────────────────────────────────────────────────────────

export async function sendConnectionRequest(
  formData: FormData
): Promise<CbnActionResult<string>> {
  const parsed = requestConnectionSchema.safeParse({
    requesterOrgId: formData.get("requesterOrgId"),
    recipientOrgId: formData.get("recipientOrgId"),
    message: formData.get("message") ?? undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(
    supabase,
    parsed.data.requesterOrgId,
    "cbn.connect"
  );
  if (!auth.ok) {return auth.result;}

  const { data, error } = await supabase.rpc("request_business_connection", {
    p_requester_org_id: parsed.data.requesterOrgId,
    p_recipient_org_id: parsed.data.recipientOrgId,
    p_message: parsed.data.message ?? null,
  });

  if (error) {
    if (error.message.includes("duplicate")) {
      return {
        success: false,
        error: { code: "duplicate", message: "Connection request already exists" },
      };
    }
    return unknown(error.message);
  }

  revalidatePath("/cbn");
  revalidatePath("/cbn/connections");
  revalidatePath("/cbn/discover");

  return { success: true, data: data as string };
}

// ─────────────────────────────────────────────────────────────
// Accept connection request
// ─────────────────────────────────────────────────────────────

export async function acceptConnectionRequest(
  connectionId: string,
  organizationId: string
): Promise<CbnActionResult<void>> {
  if (!connectionId || !organizationId) {
    return invalid("Connection ID and organization ID are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, organizationId, "cbn.connect");
  if (!auth.ok) {return auth.result;}

  const { error } = await supabase.rpc("accept_connection_request", {
    p_connection_id: connectionId,
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/cbn");
  revalidatePath("/cbn/connections");
  revalidatePath(`/cbn/connections/${connectionId}`);

  return { success: true, data: undefined };
}

// ─────────────────────────────────────────────────────────────
// Reject connection request
// ─────────────────────────────────────────────────────────────

export async function rejectConnectionRequest(
  connectionId: string,
  organizationId: string,
  reason?: string
): Promise<CbnActionResult<void>> {
  if (!connectionId || !organizationId) {
    return invalid("Connection ID and organization ID are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, organizationId, "cbn.connect");
  if (!auth.ok) {return auth.result;}

  const { error } = await supabase.rpc("reject_connection_request", {
    p_connection_id: connectionId,
    p_reason: reason ?? null,
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/cbn");
  revalidatePath("/cbn/connections");

  return { success: true, data: undefined };
}

// ─────────────────────────────────────────────────────────────
// Disconnect business
// ─────────────────────────────────────────────────────────────

export async function disconnectBusiness(
  connectionId: string,
  organizationId: string,
  reason?: string
): Promise<CbnActionResult<void>> {
  if (!connectionId || !organizationId) {
    return invalid("Connection ID and organization ID are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, organizationId, "cbn.connect");
  if (!auth.ok) {return auth.result;}

  const { error } = await supabase.rpc("disconnect_business", {
    p_connection_id: connectionId,
    p_reason: reason ?? null,
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/cbn");
  revalidatePath("/cbn/connections");
  revalidatePath(`/cbn/connections/${connectionId}`);

  return { success: true, data: undefined };
}

// ─────────────────────────────────────────────────────────────
// Update connection permissions
// ─────────────────────────────────────────────────────────────

export async function updateConnectionPermissions(
  connectionId: string,
  organizationId: string,
  grants: string[]
): Promise<CbnActionResult<void>> {
  if (!connectionId || !organizationId) {
    return invalid("Connection ID and organization ID are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, organizationId, "cbn.connect");
  if (!auth.ok) {return auth.result;}

  const { error } = await supabase.rpc("update_connection_permissions", {
    p_connection_id: connectionId,
    p_my_grants: grants,
  });

  if (error) {return unknown(error.message);}

  revalidatePath(`/cbn/connections/${connectionId}`);

  return { success: true, data: undefined };
}
