import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Condition — validated, never trust raw JSON
// ─────────────────────────────────────────────────────────────

const fieldSchema = z
  .string({ required_error: "A condition field is required" })
  .trim()
  .min(1, "A condition field is required")
  .max(100, "Field name is too long");

/** Numeric comparison operators require a numeric target value. */
const numericConditionSchema = z.object({
  field: fieldSchema,
  operator: z.enum(["gte", "gt", "lte", "lt"]),
  value: z.number({ invalid_type_error: "A numeric value is required" }).finite(),
});

/** Equality may compare a number, string or boolean. */
const equalityConditionSchema = z.object({
  field: fieldSchema,
  operator: z.literal("eq"),
  value: z.union([z.number().finite(), z.string().max(255), z.boolean()]),
});

/**
 * The canonical, validated condition shape. Discriminated by `operator` so the
 * value's type is enforced per-operator.
 */
export const conditionSchema = z.discriminatedUnion("operator", [
  numericConditionSchema,
  equalityConditionSchema,
]);

export type ConditionValues = z.infer<typeof conditionSchema>;

// ─────────────────────────────────────────────────────────────
// Condition built from raw form fields (operator + field + value string)
// ─────────────────────────────────────────────────────────────

const NUMERIC_OPERATORS = new Set(["gte", "gt", "lte", "lt"]);

/**
 * Interprets a raw form value string against the chosen operator: numeric
 * operators parse to a number; `eq` infers boolean ("true"/"false"), then
 * number, then falls back to the trimmed string.
 */
function coerceFormValue(
  operator: string,
  raw: string
): number | string | boolean {
  const trimmed = raw.trim();
  if (NUMERIC_OPERATORS.has(operator)) {
    return Number(trimmed);
  }
  const lower = trimmed.toLowerCase();
  if (lower === "true") {
    return true;
  }
  if (lower === "false") {
    return false;
  }
  if (trimmed !== "" && Number.isFinite(Number(trimmed))) {
    return Number(trimmed);
  }
  return trimmed;
}

/**
 * Parses the loose `{ field, operator, value:string }` produced by an HTML form
 * into a validated `ApprovalCondition`.
 */
export const conditionFromFormSchema = z
  .object({
    field: fieldSchema,
    operator: z.enum(["gte", "gt", "lte", "lt", "eq"], {
      errorMap: () => ({ message: "Select a valid operator" }),
    }),
    value: z
      .string({ required_error: "A condition value is required" })
      .min(1, "A condition value is required"),
  })
  .transform((input) => ({
    field: input.field,
    operator: input.operator,
    value: coerceFormValue(input.operator, input.value),
  }))
  .pipe(conditionSchema);

// ─────────────────────────────────────────────────────────────
// Rule create / update
// ─────────────────────────────────────────────────────────────

const nameSchema = z
  .string({ required_error: "A rule name is required" })
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(120, "Name must be 120 characters or less");

const descriptionSchema = z
  .string()
  .trim()
  .max(500, "Description must be 500 characters or less")
  .optional()
  .or(z.literal(""));

const entityTypeSchema = z
  .string({ required_error: "An entity type is required" })
  .trim()
  .min(1, "An entity type is required")
  .max(60, "Entity type is too long");

const approverRoleIdSchema = z
  .string()
  .uuid("Select a valid role")
  .optional()
  .or(z.literal(""));

export const createRuleSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  entityType: entityTypeSchema,
  condition: conditionSchema,
  approverRoleId: approverRoleIdSchema,
  isActive: z.boolean().optional(),
});

export type CreateRuleFormValues = z.infer<typeof createRuleSchema>;

export const updateRuleSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema,
  entityType: entityTypeSchema.optional(),
  condition: conditionSchema.optional(),
  approverRoleId: approverRoleIdSchema,
  isActive: z.boolean().optional(),
  version: z.coerce
    .number({ invalid_type_error: "A version is required" })
    .int("Version must be an integer")
    .min(1, "Version must be at least 1"),
});

export type UpdateRuleFormValues = z.infer<typeof updateRuleSchema>;

// ─────────────────────────────────────────────────────────────
// Decision (approve / reject / cancel)
// ─────────────────────────────────────────────────────────────

export const decisionSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Reason must be 500 characters or less")
    .optional()
    .or(z.literal("")),
});

export type DecisionFormValues = z.infer<typeof decisionSchema>;
