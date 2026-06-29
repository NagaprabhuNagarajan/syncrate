import type { ApprovalCondition } from "@/features/approvals/types/approval.types";

/**
 * Coerces an arbitrary field value to a finite number, or returns null if it
 * cannot be sensibly interpreted as one. Numeric strings (e.g. "1000") are
 * accepted; empty strings, booleans, objects and NaN are not.
 */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Compares a raw field value against a boolean target, tolerating the common
 * string encodings ("true"/"false") produced by form inputs.
 */
function equalsBoolean(raw: unknown, target: boolean): boolean {
  if (typeof raw === "boolean") {
    return raw === target;
  }
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true") {
      return target === true;
    }
    if (normalized === "false") {
      return target === false;
    }
  }
  return false;
}

/**
 * Pure, side-effect-free evaluation of a single rule condition against a flat
 * map of entity fields.
 *
 * Semantics:
 *  - A missing field (`undefined`/`null`) never matches.
 *  - Numeric operators (gte/gt/lte/lt) coerce the field to a number; a value
 *    that cannot be coerced never matches.
 *  - `eq` compares by the target's type: numbers compare numerically (with
 *    coercion), booleans compare loosely against "true"/"false" strings, and
 *    everything else compares by string equality.
 */
export function evaluateCondition(
  condition: ApprovalCondition,
  fields: Record<string, unknown>
): boolean {
  const raw = fields[condition.field];
  if (raw === undefined || raw === null) {
    return false;
  }

  switch (condition.operator) {
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const left = toNumber(raw);
      if (left === null) {
        return false;
      }
      // For numeric operators the schema guarantees a numeric target, but we
      // coerce defensively so untrusted callers cannot break evaluation.
      const right = toNumber(condition.value);
      if (right === null) {
        return false;
      }
      switch (condition.operator) {
        case "gt":
          return left > right;
        case "gte":
          return left >= right;
        case "lt":
          return left < right;
        case "lte":
          return left <= right;
        default:
          return false;
      }
    }
    case "eq": {
      const target = condition.value;
      if (typeof target === "number") {
        const left = toNumber(raw);
        return left !== null && left === target;
      }
      if (typeof target === "boolean") {
        return equalsBoolean(raw, target);
      }
      return String(raw) === target;
    }
    default:
      return false;
  }
}
