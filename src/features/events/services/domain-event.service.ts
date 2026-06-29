import "server-only";

import type { AppSupabaseClient } from "@/lib/supabase/types";
import { WebhookDispatchService } from "@/features/webhooks/services/webhook-dispatch.service";
import { WorkflowEngineService } from "@/features/workflows/services/workflow-engine.service";
import { WorkflowRepository } from "@/features/workflows/repositories/workflow.repository";
import type { DomainEventType } from "@/features/events/domain-events";

/**
 * Central domain-event dispatcher — the bridge that makes the Sprint 9
 * automation engines actually fire. A business action calls `emit()` after it
 * succeeds; the dispatcher fans the event out to:
 *   1. Webhooks — every active endpoint subscribed to the event type.
 *   2. Workflows — every active workflow whose trigger matches (each run may in
 *      turn contain webhook and approval steps, so approvals are reached here
 *      transitively, by design).
 *
 * `emit()` is strictly best-effort: it never throws and never blocks the
 * outcome of the triggering action. Automation failing must not fail the
 * business operation that caused it. Each side-effect is independently guarded
 * so one failure can't suppress the others.
 */

export interface DomainEvent {
  readonly organizationId: string;
  readonly eventType: DomainEventType;
  readonly entityType: string;
  readonly entityId: string;
  readonly actorUserId: string | null;
  /** Sent verbatim to webhooks and used as the workflow run context. */
  readonly payload: Record<string, unknown>;
}

/** Injectable collaborators (for unit testing without a live client). */
export interface DomainEventDeps {
  readonly webhookDispatch: Pick<WebhookDispatchService, "dispatch">;
  readonly workflows: Pick<WorkflowRepository, "findActiveByTriggerEvent">;
  readonly engine: Pick<WorkflowEngineService, "startWorkflow">;
}

export class DomainEventService {
  private readonly webhookDispatch: DomainEventDeps["webhookDispatch"];
  private readonly workflows: DomainEventDeps["workflows"];
  private readonly engine: DomainEventDeps["engine"];

  constructor(supabase: AppSupabaseClient, deps?: Partial<DomainEventDeps>) {
    this.webhookDispatch =
      deps?.webhookDispatch ?? new WebhookDispatchService(supabase);
    this.workflows = deps?.workflows ?? new WorkflowRepository(supabase);
    this.engine = deps?.engine ?? new WorkflowEngineService(supabase);
  }

  /** Fan an emitted event out to webhooks and matching workflows. Never throws. */
  async emit(event: DomainEvent): Promise<void> {
    await Promise.allSettled([
      this.dispatchWebhooks(event),
      this.triggerWorkflows(event),
    ]);
  }

  private async dispatchWebhooks(event: DomainEvent): Promise<void> {
    try {
      await this.webhookDispatch.dispatch({
        organizationId: event.organizationId,
        eventType: event.eventType,
        payload: event.payload,
      });
    } catch {
      // Best-effort: a webhook failure must not affect the business action.
    }
  }

  private async triggerWorkflows(event: DomainEvent): Promise<void> {
    try {
      const matches = await this.workflows.findActiveByTriggerEvent(
        event.organizationId,
        event.eventType
      );
      // Each workflow runs independently; one failing must not block the rest.
      await Promise.allSettled(
        matches.map((workflow) =>
          this.engine.startWorkflow({
            organizationId: event.organizationId,
            workflowId: workflow.id,
            entityType: event.entityType,
            entityId: event.entityId,
            context: event.payload,
            actorUserId: event.actorUserId ?? "system",
          })
        )
      );
    } catch {
      // Best-effort: workflow triggering must not affect the business action.
    }
  }
}
