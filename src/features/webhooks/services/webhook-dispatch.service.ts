import "server-only";

import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Json } from "@/types/database.types";
import {
  WebhookDeliveryRepository,
  WebhookEndpointRepository,
} from "@/features/webhooks/repositories/webhook.repository";
import {
  EVENT_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  signWebhookPayload,
} from "@/features/webhooks/utils/signing";
import {
  WEBHOOK_TEST_EVENT_TYPE,
  type DispatchInput,
  type DispatchSummary,
  type WebhookActionResult,
  type WebhookDelivery,
  type WebhookEndpointWithSecret,
} from "@/features/webhooks/types/webhook.types";

/** Maximum delivery attempts (initial try + retries). */
const MAX_ATTEMPTS = 3;
/** Per-attempt request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 10_000;

interface AttemptOutcome {
  readonly success: boolean;
  readonly attempts: number;
  readonly responseStatus: number | null;
  readonly error: string | null;
}

/**
 * Outbound webhook delivery engine.
 *
 * SECURITY: `server-only` — signs payloads with each endpoint's secret using
 * HMAC-SHA256 and must never be imported into client code. Every attempt is
 * persisted to `webhook_deliveries` (metadata only — never the secret).
 */
export class WebhookDispatchService {
  private readonly endpoints: WebhookEndpointRepository;
  private readonly deliveries: WebhookDeliveryRepository;

  constructor(supabase: AppSupabaseClient) {
    this.endpoints = new WebhookEndpointRepository(supabase);
    this.deliveries = new WebhookDeliveryRepository(supabase);
  }

  /**
   * Fans an event out to every active endpoint subscribed to `eventType`,
   * delivering and recording each. Endpoints that are inactive, soft-deleted,
   * or not subscribed are skipped by the repository query.
   */
  async dispatch(input: DispatchInput): Promise<DispatchSummary> {
    const endpoints = await this.endpoints.findActiveForDispatch(
      input.organizationId,
      input.eventType
    );

    const deliveries: WebhookDelivery[] = [];
    for (const endpoint of endpoints) {
      const delivery = await this.deliverToEndpoint(
        endpoint,
        input.eventType,
        input.payload
      );
      if (delivery) {
        deliveries.push(delivery);
      }
    }

    return { dispatched: endpoints.length, deliveries };
  }

  /**
   * Sends a synthetic test event to a single endpoint to verify connectivity
   * and signature configuration. Records the attempt like any other delivery.
   */
  async sendTestEvent(
    endpointId: string,
    organizationId: string
  ): Promise<WebhookActionResult<WebhookDelivery>> {
    const endpoint = await this.endpoints.findByIdForDispatch(
      endpointId,
      organizationId
    );
    if (!endpoint) {
      return { success: false, error: { code: "not_found", message: "Webhook endpoint not found" } };
    }

    const payload: Record<string, unknown> = {
      message: "This is a test event from Syncrate.",
      sentAt: new Date().toISOString(),
    };

    const delivery = await this.deliverToEndpoint(
      endpoint,
      WEBHOOK_TEST_EVENT_TYPE,
      payload
    );

    if (!delivery) {
      return { success: false, error: { code: "unknown", message: "Could not record the test delivery" } };
    }
    return { success: true, data: delivery };
  }

  // ── Internals ──────────────────────────────────────────────

  private async deliverToEndpoint(
    endpoint: WebhookEndpointWithSecret,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<WebhookDelivery | null> {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
      event: eventType,
      timestamp,
      data: payload,
    });
    const signature = signWebhookPayload(endpoint.secret, body, timestamp);

    const outcome = await this.deliverWithRetry(endpoint.url, body, {
      "Content-Type": "application/json",
      [SIGNATURE_HEADER]: signature,
      [TIMESTAMP_HEADER]: timestamp,
      [EVENT_HEADER]: eventType,
    });

    return this.deliveries.create({
      organization_id: endpoint.organizationId,
      endpoint_id: endpoint.id,
      event_type: eventType,
      payload: payload as Json,
      status: outcome.success ? "success" : "failed",
      attempts: outcome.attempts,
      response_status: outcome.responseStatus,
      error: outcome.error,
      delivered_at: outcome.success ? new Date().toISOString() : null,
    });
  }

  private async deliverWithRetry(
    url: string,
    body: string,
    headers: Record<string, string>
  ): Promise<AttemptOutcome> {
    let attempts = 0;
    let responseStatus: number | null = null;
    let error: string | null = null;

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      attempts += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
        responseStatus = response.status;
        if (response.ok) {
          return { success: true, attempts, responseStatus, error: null };
        }
        error = `Endpoint responded with HTTP ${response.status}`;
      } catch (cause) {
        responseStatus = null;
        error =
          cause instanceof Error ? cause.message : "Network request failed";
      } finally {
        clearTimeout(timer);
      }
    }

    return { success: false, attempts, responseStatus, error };
  }
}
