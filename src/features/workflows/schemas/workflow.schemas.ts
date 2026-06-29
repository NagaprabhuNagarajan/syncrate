import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Step — validated discriminated union on `type`. NEVER trust the raw
// `definition` JSON: it is always parsed through `stepSchema` first.
// ─────────────────────────────────────────────────────────────

const stepIdSchema = z
  .string({ required_error: "A step id is required" })
  .trim()
  .min(1, "A step id is required")
  .max(100, "Step id is too long");

const stepNameSchema = z
  .string({ required_error: "A step name is required" })
  .trim()
  .min(1, "A step name is required")
  .max(120, "Step name is too long");

const messageSchema = z
  .string()
  .trim()
  .max(500, "Message must be 500 characters or less")
  .optional();

const eventTypeSchema = z
  .string({ required_error: "An event type is required" })
  .trim()
  .min(1, "An event type is required")
  .max(120, "Event type is too long");

const entityTypeSchema = z
  .string({ required_error: "An entity type is required" })
  .trim()
  .min(1, "An entity type is required")
  .max(60, "Entity type is too long");

const logStepSchema = z.object({
  id: stepIdSchema,
  name: stepNameSchema,
  type: z.literal("log"),
  config: z.object({ message: messageSchema }).default({}),
});

const noopStepSchema = z.object({
  id: stepIdSchema,
  name: stepNameSchema,
  type: z.literal("noop"),
  config: z.object({ message: messageSchema }).default({}),
});

const webhookStepSchema = z.object({
  id: stepIdSchema,
  name: stepNameSchema,
  type: z.literal("webhook"),
  config: z.object({ eventType: eventTypeSchema }),
});

const approvalStepSchema = z.object({
  id: stepIdSchema,
  name: stepNameSchema,
  type: z.literal("approval"),
  config: z
    .object({ entityType: entityTypeSchema })
    .passthrough(),
});

/** A single, fully-validated workflow step. */
export const stepSchema = z.discriminatedUnion("type", [
  logStepSchema,
  noopStepSchema,
  webhookStepSchema,
  approvalStepSchema,
]);

export type StepValues = z.infer<typeof stepSchema>;

/** An ordered list of steps. */
export const stepsSchema = z
  .array(stepSchema)
  .max(50, "A workflow can have at most 50 steps");

/** The canonical `definition` jsonb shape: `{ steps: [...] }`. */
export const definitionSchema = z.object({
  steps: stepsSchema.default([]),
});

export type DefinitionValues = z.infer<typeof definitionSchema>;

/**
 * Parses the `steps` JSON produced by the form's hidden field. Accepts either a
 * JSON array string or an already-parsed array, returning a typed result.
 */
export function parseStepsJson(
  raw: unknown
): { success: true; data: StepValues[] } | { success: false; message: string } {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = raw.trim() === "" ? [] : JSON.parse(raw);
    } catch {
      return { success: false, message: "Steps must be valid JSON" };
    }
  }
  const parsed = stepsSchema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.errors[0]?.message ?? "Invalid steps",
    };
  }
  return { success: true, data: parsed.data };
}

// ─────────────────────────────────────────────────────────────
// Workflow create / update
// ─────────────────────────────────────────────────────────────

const nameSchema = z
  .string({ required_error: "A workflow name is required" })
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(120, "Name must be 120 characters or less");

const descriptionSchema = z
  .string()
  .trim()
  .max(500, "Description must be 500 characters or less")
  .optional()
  .or(z.literal(""));

const triggerEventSchema = z
  .string({ required_error: "A trigger event is required" })
  .trim()
  .min(1, "A trigger event is required")
  .max(120, "Trigger event is too long");

export const createWorkflowSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  triggerEvent: triggerEventSchema,
  steps: stepsSchema,
  isActive: z.boolean().optional(),
});

export type CreateWorkflowFormValues = z.infer<typeof createWorkflowSchema>;

export const updateWorkflowSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema,
  triggerEvent: triggerEventSchema.optional(),
  steps: stepsSchema.optional(),
  isActive: z.boolean().optional(),
  version: z.coerce
    .number({ invalid_type_error: "A version is required" })
    .int("Version must be an integer")
    .min(1, "Version must be at least 1"),
});

export type UpdateWorkflowFormValues = z.infer<typeof updateWorkflowSchema>;
