"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { WebhookService } from "@/features/webhooks/services/webhook.service";
import { WebhookDispatchService } from "@/features/webhooks/services/webhook-dispatch.service";
import {
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
} from "@/features/webhooks/schemas/webhook.schemas";
import type {
  CreatedWebhookEndpoint,
  WebhookActionResult,
  WebhookDelivery,
  WebhookEndpoint,
} from "@/features/webhooks/types/webhook.types";

const SETTINGS_PATH = "/settings/webhooks";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): WebhookActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): WebhookActionResult<never> {
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
  | { ok: true; userId: string }
  | { ok: false; result: WebhookActionResult<never> }
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

function parseBoolean(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on" || value === "1";
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export async function createWebhookEndpointAction(
  organizationId: string,
  formData: FormData
): Promise<WebhookActionResult<CreatedWebhookEndpoint>> {
  const parsed = createWebhookEndpointSchema.safeParse({
    url: formData.get("url"),
    description: formData.get("description") || undefined,
    eventTypes: formData.getAll("eventTypes"),
    isActive: formData.has("isActive")
      ? parseBoolean(formData.get("isActive"))
      : undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "webhook.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new WebhookService(supabase);
  const result = await service.createEndpoint(
    {
      url: parsed.data.url,
      description: parsed.data.description || null,
      eventTypes: parsed.data.eventTypes,
      isActive: parsed.data.isActive,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    // NEVER log the signing secret — only the non-secret endpoint metadata.
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "webhook.create",
      entityType: "webhook_endpoint",
      entityId: result.data.endpoint.id,
      summary: `Created webhook endpoint ${result.data.endpoint.url}`,
      metadata: {
        url: result.data.endpoint.url,
        eventTypes: result.data.endpoint.eventTypes,
        isActive: result.data.endpoint.isActive,
      },
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateWebhookEndpointAction(
  organizationId: string,
  endpointId: string,
  formData: FormData
): Promise<WebhookActionResult<WebhookEndpoint>> {
  const parsed = updateWebhookEndpointSchema.safeParse({
    url: formData.get("url") || undefined,
    description: formData.has("description")
      ? formData.get("description") || ""
      : undefined,
    eventTypes: formData.has("eventTypes")
      ? formData.getAll("eventTypes")
      : undefined,
    isActive: formData.has("isActive")
      ? parseBoolean(formData.get("isActive"))
      : undefined,
    version: Number(formData.get("version")),
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "webhook.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new WebhookService(supabase);
  const result = await service.updateEndpoint(
    endpointId,
    {
      url: parsed.data.url,
      description: parsed.data.description,
      eventTypes: parsed.data.eventTypes,
      isActive: parsed.data.isActive,
      version: parsed.data.version,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "webhook.update",
      entityType: "webhook_endpoint",
      entityId: result.data.id,
      summary: `Updated webhook endpoint ${result.data.url}`,
      metadata: {
        url: result.data.url,
        eventTypes: result.data.eventTypes,
        isActive: result.data.isActive,
      },
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Delete (soft)
// ─────────────────────────────────────────────────────────────

export async function deleteWebhookEndpointAction(
  organizationId: string,
  endpointId: string
): Promise<WebhookActionResult<WebhookEndpoint>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "webhook.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new WebhookService(supabase);
  const result = await service.deleteEndpoint(
    endpointId,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "webhook.delete",
      entityType: "webhook_endpoint",
      entityId: result.data.id,
      summary: `Deleted webhook endpoint ${result.data.url}`,
      metadata: { url: result.data.url },
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Send test event
// ─────────────────────────────────────────────────────────────

export async function sendTestWebhookAction(
  organizationId: string,
  endpointId: string
): Promise<WebhookActionResult<WebhookDelivery>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "webhook.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const dispatch = new WebhookDispatchService(supabase);
  const result = await dispatch.sendTestEvent(endpointId, organizationId);

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "webhook.test",
      entityType: "webhook_endpoint",
      entityId: endpointId,
      summary: `Sent test event to webhook endpoint (${result.data.status})`,
      metadata: {
        status: result.data.status,
        responseStatus: result.data.responseStatus,
      },
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Read deliveries (log)
// ─────────────────────────────────────────────────────────────

export async function listWebhookDeliveriesAction(
  organizationId: string,
  endpointId: string
): Promise<WebhookActionResult<readonly WebhookDelivery[]>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "webhook.view");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new WebhookService(supabase);
  const deliveries = await service.listDeliveries(endpointId, organizationId);
  return { success: true, data: deliveries };
}
