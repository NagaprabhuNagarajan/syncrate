import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { DOMAIN_EVENTS } from "@/features/events/domain-events";
import {
  DomainEventService,
  type DomainEvent,
  type DomainEventDeps,
} from "./domain-event.service";

const fakeSupabase = {} as unknown as AppSupabaseClient;

function buildEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    organizationId: "org-1",
    eventType: DOMAIN_EVENTS.INVOICE_CREATED,
    entityType: "sales_invoice",
    entityId: "inv-1",
    actorUserId: "user-1",
    payload: { total: 5000 },
    ...overrides,
  };
}

function buildDeps(over: Partial<DomainEventDeps> = {}): DomainEventDeps {
  return {
    webhookDispatch: { dispatch: vi.fn().mockResolvedValue({ dispatched: 0, deliveries: [] }) },
    workflows: { findActiveByTriggerEvent: vi.fn().mockResolvedValue([]) },
    engine: { startWorkflow: vi.fn().mockResolvedValue({ success: true, data: {} }) },
    ...over,
  };
}

describe("DomainEventService.emit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dispatches webhooks for the event type", async () => {
    const deps = buildDeps();
    await new DomainEventService(fakeSupabase, deps).emit(buildEvent());

    expect(deps.webhookDispatch.dispatch).toHaveBeenCalledWith({
      organizationId: "org-1",
      eventType: DOMAIN_EVENTS.INVOICE_CREATED,
      payload: { total: 5000 },
    });
  });

  it("starts every active workflow whose trigger matches", async () => {
    const deps = buildDeps({
      workflows: {
        findActiveByTriggerEvent: vi
          .fn()
          .mockResolvedValue([{ id: "wf-1" }, { id: "wf-2" }]),
      },
    });
    await new DomainEventService(fakeSupabase, deps).emit(buildEvent());

    expect(deps.engine.startWorkflow).toHaveBeenCalledTimes(2);
    expect(deps.engine.startWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        workflowId: "wf-1",
        entityType: "sales_invoice",
        entityId: "inv-1",
        context: { total: 5000 },
        actorUserId: "user-1",
      })
    );
  });

  it("falls back to 'system' actor when none is provided", async () => {
    const deps = buildDeps({
      workflows: {
        findActiveByTriggerEvent: vi.fn().mockResolvedValue([{ id: "wf-1" }]),
      },
    });
    await new DomainEventService(fakeSupabase, deps).emit(
      buildEvent({ actorUserId: null })
    );
    expect(deps.engine.startWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: "system" })
    );
  });

  it("swallows a webhook failure and still triggers workflows", async () => {
    const startWorkflow = vi.fn().mockResolvedValue({ success: true, data: {} });
    const deps = buildDeps({
      webhookDispatch: { dispatch: vi.fn().mockRejectedValue(new Error("net")) },
      workflows: {
        findActiveByTriggerEvent: vi.fn().mockResolvedValue([{ id: "wf-1" }]),
      },
      engine: { startWorkflow },
    });

    await expect(
      new DomainEventService(fakeSupabase, deps).emit(buildEvent())
    ).resolves.toBeUndefined();
    expect(startWorkflow).toHaveBeenCalledOnce();
  });

  it("swallows a workflow-lookup failure and still dispatches webhooks", async () => {
    const dispatch = vi.fn().mockResolvedValue({ dispatched: 0, deliveries: [] });
    const deps = buildDeps({
      webhookDispatch: { dispatch },
      workflows: {
        findActiveByTriggerEvent: vi.fn().mockRejectedValue(new Error("db")),
      },
    });

    await expect(
      new DomainEventService(fakeSupabase, deps).emit(buildEvent())
    ).resolves.toBeUndefined();
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it("swallows a single workflow run failure without throwing", async () => {
    const deps = buildDeps({
      workflows: {
        findActiveByTriggerEvent: vi.fn().mockResolvedValue([{ id: "wf-1" }]),
      },
      engine: { startWorkflow: vi.fn().mockRejectedValue(new Error("boom")) },
    });
    await expect(
      new DomainEventService(fakeSupabase, deps).emit(buildEvent())
    ).resolves.toBeUndefined();
  });
});
