"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createWorkflowAction,
  updateWorkflowAction,
} from "@/features/workflows/actions/workflow.actions";
import type {
  Workflow,
  WorkflowStep,
  WorkflowStepType,
} from "@/features/workflows/types/workflow.types";

// ─────────────────────────────────────────────────────────────
// Catalog + styling
// ─────────────────────────────────────────────────────────────

const TRIGGER_EVENT_SUGGESTIONS: readonly string[] = [
  "invoice.created",
  "invoice.paid",
  "quotation.accepted",
  "payment.received",
  "customer.created",
  "supplier.created",
  "purchase_order.created",
  "inventory.low_stock",
];

const STEP_TYPE_OPTIONS: readonly { value: WorkflowStepType; label: string }[] =
  [
    { value: "log", label: "Log — record an entry" },
    { value: "noop", label: "No-op — do nothing" },
    { value: "webhook", label: "Webhook — dispatch an event" },
    { value: "approval", label: "Approval — block until decided" },
  ];

const INPUT_CLASS =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500";

const LABEL_CLASS = "mb-1 block text-sm font-medium text-slate-700";

// ─────────────────────────────────────────────────────────────
// Step draft model (UI-only; serialized to a WorkflowStep on submit)
// ─────────────────────────────────────────────────────────────

interface StepDraft {
  readonly key: string;
  readonly id: string;
  readonly name: string;
  readonly type: WorkflowStepType;
  readonly message: string;
  readonly eventType: string;
  readonly entityType: string;
}

let draftCounter = 0;

function newKey(): string {
  draftCounter += 1;
  return `step-draft-${draftCounter}-${Date.now()}`;
}

function emptyDraft(): StepDraft {
  const key = newKey();
  return {
    key,
    id: key,
    name: "",
    type: "log",
    message: "",
    eventType: "invoice.created",
    entityType: "purchase_invoice",
  };
}

function toDraft(step: WorkflowStep): StepDraft {
  const base = { key: newKey(), id: step.id, name: step.name };
  switch (step.type) {
    case "log":
    case "noop":
      return {
        ...base,
        type: step.type,
        message: step.config.message ?? "",
        eventType: "invoice.created",
        entityType: "purchase_invoice",
      };
    case "webhook":
      return {
        ...base,
        type: "webhook",
        message: "",
        eventType: step.config.eventType,
        entityType: "purchase_invoice",
      };
    case "approval":
      return {
        ...base,
        type: "approval",
        message: "",
        eventType: "invoice.created",
        entityType: step.config.entityType,
      };
    default:
      return { ...emptyDraft() };
  }
}

function serializeDraft(draft: StepDraft): WorkflowStep {
  const id = draft.id.trim() || draft.key;
  const name = draft.name.trim() || id;
  switch (draft.type) {
    case "webhook":
      return {
        id,
        name,
        type: "webhook",
        config: { eventType: draft.eventType.trim() },
      };
    case "approval":
      return {
        id,
        name,
        type: "approval",
        config: { entityType: draft.entityType.trim() },
      };
    case "noop":
      return {
        id,
        name,
        type: "noop",
        config: draft.message.trim() ? { message: draft.message.trim() } : {},
      };
    case "log":
    default:
      return {
        id,
        name,
        type: "log",
        config: draft.message.trim() ? { message: draft.message.trim() } : {},
      };
  }
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface WorkflowFormProps {
  readonly organizationId: string;
  readonly workflow?: Workflow;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

export function WorkflowForm({
  organizationId,
  workflow,
  onClose,
  onSaved,
}: WorkflowFormProps) {
  const isEdit = Boolean(workflow);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [steps, setSteps] = useState<StepDraft[]>(
    workflow ? workflow.steps.map(toDraft) : [emptyDraft()]
  );

  const addStep = (): void => {
    setSteps((prev) => [...prev, emptyDraft()]);
  };

  const removeStep = (key: string): void => {
    setSteps((prev) => prev.filter((step) => step.key !== key));
  };

  const moveStep = (index: number, delta: number): void => {
    setSteps((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      if (moved) {
        next.splice(target, 0, moved);
      }
      return next;
    });
  };

  const patchStep = (key: string, patch: Partial<StepDraft>): void => {
    setSteps((prev) =>
      prev.map((step) => (step.key === key ? { ...step, ...patch } : step))
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set(
      "steps",
      JSON.stringify(steps.map(serializeDraft))
    );
    startSaving(async () => {
      const response = workflow
        ? await updateWorkflowAction(organizationId, workflow.id, formData)
        : await createWorkflowAction(organizationId, formData);
      if (!response.success) {
        setError(response.error.message);
        return;
      }
      onSaved();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={isEdit ? "Edit workflow" : "Create workflow"}
      className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      {workflow && (
        <input type="hidden" name="version" value={String(workflow.version)} />
      )}

      {error && (
        <p
          role="alert"
          className="text-error-700 bg-error-50 border-error-200 mb-4 rounded-lg border px-3 py-2.5 text-sm"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="workflow-name" className={LABEL_CLASS}>
            Workflow name
          </label>
          <input
            id="workflow-name"
            name="name"
            type="text"
            required
            defaultValue={workflow?.name ?? ""}
            placeholder="e.g. Notify on large invoices"
            className={INPUT_CLASS}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="workflow-description" className={LABEL_CLASS}>
            Description
          </label>
          <input
            id="workflow-description"
            name="description"
            type="text"
            defaultValue={workflow?.description ?? ""}
            placeholder="Optional — what this workflow does"
            className={INPUT_CLASS}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="workflow-trigger" className={LABEL_CLASS}>
            Trigger event
          </label>
          <input
            id="workflow-trigger"
            name="triggerEvent"
            type="text"
            required
            list="workflow-trigger-options"
            defaultValue={workflow?.triggerEvent ?? "invoice.created"}
            placeholder="e.g. invoice.created"
            className={INPUT_CLASS}
          />
          <datalist id="workflow-trigger-options">
            {TRIGGER_EVENT_SUGGESTIONS.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </div>
      </div>

      <fieldset className="mt-5 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">
          Steps
        </legend>
        <p className="mb-3 text-xs text-slate-500">
          Steps run in order. Approval steps pause the run until a decision is
          made.
        </p>

        {steps.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500">
            No steps yet — add one below.
          </p>
        ) : (
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li
                key={step.key}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Step {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move step ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => moveStep(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move step ${index + 1} down`}
                      disabled={index === steps.length - 1}
                      onClick={() => moveStep(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove step ${index + 1}`}
                      onClick={() => removeStep(step.key)}
                    >
                      <Trash2
                        className="h-4 w-4 text-error"
                        aria-hidden="true"
                      />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`${step.key}-name`}
                      className={LABEL_CLASS}
                    >
                      Step name
                    </label>
                    <input
                      id={`${step.key}-name`}
                      type="text"
                      value={step.name}
                      placeholder="e.g. Notify finance"
                      className={INPUT_CLASS}
                      onChange={(event) =>
                        patchStep(step.key, { name: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${step.key}-type`}
                      className={LABEL_CLASS}
                    >
                      Type
                    </label>
                    <select
                      id={`${step.key}-type`}
                      value={step.type}
                      className={INPUT_CLASS}
                      onChange={(event) =>
                        patchStep(step.key, {
                          type: event.target.value as WorkflowStepType,
                        })
                      }
                    >
                      {STEP_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(step.type === "log" || step.type === "noop") && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`${step.key}-message`}
                        className={LABEL_CLASS}
                      >
                        Message (optional)
                      </label>
                      <input
                        id={`${step.key}-message`}
                        type="text"
                        value={step.message}
                        placeholder="e.g. Workflow reached this step"
                        className={INPUT_CLASS}
                        onChange={(event) =>
                          patchStep(step.key, { message: event.target.value })
                        }
                      />
                    </div>
                  )}

                  {step.type === "webhook" && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`${step.key}-event`}
                        className={LABEL_CLASS}
                      >
                        Event type
                      </label>
                      <input
                        id={`${step.key}-event`}
                        type="text"
                        value={step.eventType}
                        list="workflow-trigger-options"
                        placeholder="e.g. invoice.paid"
                        className={INPUT_CLASS}
                        onChange={(event) =>
                          patchStep(step.key, { eventType: event.target.value })
                        }
                      />
                    </div>
                  )}

                  {step.type === "approval" && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`${step.key}-entity`}
                        className={LABEL_CLASS}
                      >
                        Entity type
                      </label>
                      <input
                        id={`${step.key}-entity`}
                        type="text"
                        value={step.entityType}
                        placeholder="e.g. purchase_invoice"
                        className={INPUT_CLASS}
                        onChange={(event) =>
                          patchStep(step.key, {
                            entityType: event.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-3">
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add step
          </Button>
        </div>
      </fieldset>

      <div className="mt-4 flex items-center gap-2">
        <input
          id="workflow-active"
          name="isActive"
          type="checkbox"
          value="true"
          defaultChecked={workflow?.isActive ?? true}
          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="workflow-active" className="text-sm text-slate-700">
          Active
        </label>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isSaving}>
          {isEdit ? "Save changes" : "Create workflow"}
        </Button>
      </div>
    </form>
  );
}
