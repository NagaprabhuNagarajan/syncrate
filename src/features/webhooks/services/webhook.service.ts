import type { AppSupabaseClient } from "@/lib/supabase/types";
import {
  WebhookDeliveryRepository,
  WebhookEndpointRepository,
} from "@/features/webhooks/repositories/webhook.repository";
import { generateWebhookSecret } from "@/features/webhooks/utils/signing";
import { WEBHOOK_EVENT_TYPE_VALUES } from "@/features/webhooks/types/webhook.types";
import type {
  CreateWebhookEndpointInput,
  CreatedWebhookEndpoint,
  UpdateWebhookEndpointInput,
  WebhookActionResult,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookError,
  WebhookErrorCode,
} from "@/features/webhooks/types/webhook.types";

function ok<T>(data: T): WebhookActionResult<T> {
  return { success: true, data };
}

function fail(
  code: WebhookErrorCode,
  message: string
): WebhookActionResult<never> {
  const error: WebhookError = { code, message };
  return { success: false, error };
}

/** Normalizes an optional string: trims and converts "" → null. */
function nz(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Validates an event-type list against the known catalog; de-duplicates. */
function normalizeEventTypes(eventTypes: readonly string[]): string[] | null {
  const seen = new Set<string>();
  for (const type of eventTypes) {
    if (!WEBHOOK_EVENT_TYPE_VALUES.includes(type)) {
      return null;
    }
    seen.add(type);
  }
  return [...seen];
}

export class WebhookService {
  private readonly endpoints: WebhookEndpointRepository;
  private readonly deliveries: WebhookDeliveryRepository;

  constructor(supabase: AppSupabaseClient) {
    this.endpoints = new WebhookEndpointRepository(supabase);
    this.deliveries = new WebhookDeliveryRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listEndpoints(organizationId: string): Promise<WebhookEndpoint[]> {
    return this.endpoints.listByOrg(organizationId);
  }

  async getEndpoint(
    id: string,
    organizationId: string
  ): Promise<WebhookActionResult<WebhookEndpoint>> {
    const endpoint = await this.endpoints.findById(id, organizationId);
    if (!endpoint) {
      return fail("not_found", "Webhook endpoint not found");
    }
    return ok(endpoint);
  }

  async listDeliveries(
    endpointId: string,
    organizationId: string,
    limit?: number
  ): Promise<WebhookDelivery[]> {
    return this.deliveries.listByEndpoint(endpointId, organizationId, limit);
  }

  // ── Create ─────────────────────────────────────────────────

  /**
   * Generates a signing secret server-side, persists it, and returns the
   * plaintext secret exactly once for one-time display. The secret is never
   * surfaced again by any read path.
   */
  async createEndpoint(
    input: CreateWebhookEndpointInput,
    organizationId: string,
    userId: string
  ): Promise<WebhookActionResult<CreatedWebhookEndpoint>> {
    const url = input.url.trim();
    if (url === "") {
      return fail("validation", "URL is required");
    }
    const eventTypes = normalizeEventTypes(input.eventTypes);
    if (!eventTypes || eventTypes.length === 0) {
      return fail("validation", "Select at least one valid event type");
    }

    const secret = generateWebhookSecret();

    const created = await this.endpoints.create({
      organization_id: organizationId,
      url,
      description: nz(input.description),
      secret,
      event_types: eventTypes,
      is_active: input.isActive ?? true,
      created_by: userId,
      updated_by: userId,
    });

    if (!created) {
      return fail("unknown", "Could not create the webhook endpoint");
    }

    return ok({ endpoint: created, secret });
  }

  // ── Update ─────────────────────────────────────────────────

  async updateEndpoint(
    id: string,
    input: UpdateWebhookEndpointInput,
    organizationId: string,
    userId: string
  ): Promise<WebhookActionResult<WebhookEndpoint>> {
    const existing = await this.endpoints.findById(id, organizationId);
    if (!existing) {
      return fail("not_found", "Webhook endpoint not found");
    }

    const patch: Record<string, unknown> = {};

    if (input.url !== undefined) {
      const url = input.url.trim();
      if (url === "") {
        return fail("validation", "URL is required");
      }
      patch.url = url;
    }
    if (input.description !== undefined) {
      patch.description = nz(input.description);
    }
    if (input.eventTypes !== undefined) {
      const eventTypes = normalizeEventTypes(input.eventTypes);
      if (!eventTypes || eventTypes.length === 0) {
        return fail("validation", "Select at least one valid event type");
      }
      patch.event_types = eventTypes;
    }
    if (input.isActive !== undefined) {
      patch.is_active = input.isActive;
    }

    const updated = await this.endpoints.update(
      id,
      organizationId,
      patch,
      input.version,
      userId
    );

    if (!updated) {
      // The version guard failed (or the row vanished): a concurrent edit won.
      return fail(
        "conflict",
        "This endpoint was modified elsewhere. Reload and try again."
      );
    }

    return ok(updated);
  }

  // ── Delete (soft) ──────────────────────────────────────────

  async deleteEndpoint(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<WebhookActionResult<WebhookEndpoint>> {
    const existing = await this.endpoints.findById(id, organizationId);
    if (!existing) {
      return fail("not_found", "Webhook endpoint not found");
    }

    const deleted = await this.endpoints.softDelete(
      id,
      organizationId,
      userId
    );
    if (!deleted) {
      return fail("unknown", "Could not delete the webhook endpoint");
    }
    return ok(existing);
  }
}
