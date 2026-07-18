/**
 * Approval engine domain types.
 *
 * Two aggregates:
 *  - ApprovalRule    — configurable rule (what triggers an approval).
 *  - ApprovalRequest — a pending/decided approval raised against an entity.
 *
 * All application-level types use camelCase and mirror the DB schema.
 */

// ─────────────────────────────────────────────────────────────
// Condition model
// ─────────────────────────────────────────────────────────────

/** Comparison operators supported by a rule condition. */
export type ApprovalOperator = "gte" | "gt" | "lte" | "lt" | "eq";

/** Values that a numeric comparison operator can target. */
export type NumericOperator = "gte" | "gt" | "lte" | "lt";

/**
 * A structured, JSON-serialisable rule condition. Evaluated against a flat
 * `Record<string, unknown>` of entity fields at request time.
 *
 * Numeric operators (gte/gt/lte/lt) always compare numbers; `eq` may compare
 * a number, string or boolean.
 */
export interface ApprovalCondition {
  readonly field: string;
  readonly operator: ApprovalOperator;
  readonly value: number | string | boolean;
}

// ─────────────────────────────────────────────────────────────
// Aggregates
// ─────────────────────────────────────────────────────────────

export interface ApprovalRule {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly description: string | null;
  readonly entityType: string;
  readonly condition: ApprovalCondition;
  readonly approverRoleId: string | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export type ApprovalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface ApprovalRequest {
  readonly id: string;
  readonly organizationId: string;
  readonly ruleId: string | null;
  readonly entityType: string;
  readonly entityId: string;
  readonly requestedBy: string | null;
  readonly status: ApprovalRequestStatus;
  readonly decidedBy: string | null;
  readonly decidedAt: Date | null;
  readonly decisionReason: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

/**
 * A document-facing view of an approval request: the request plus its rule name
 * and whether the current viewer is allowed to decide it. Rendered on bill and
 * invoice detail pages.
 */
export interface EntityApproval {
  readonly id: string;
  readonly status: ApprovalRequestStatus;
  readonly ruleName: string | null;
  readonly decisionReason: string | null;
  readonly decidedAt: Date | null;
  readonly createdAt: Date;
  readonly canDecide: boolean;
  /** Display name of the user who submitted the document for approval. */
  readonly requestedByName: string | null;
  /** Role of the user who submitted the document. */
  readonly requestedByRole: string | null;
  /** Display name of the user who approved or rejected it. */
  readonly decidedByName: string | null;
  /** Role of the user who approved or rejected it. */
  readonly decidedByRole: string | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateRuleInput {
  readonly name: string;
  readonly description?: string;
  readonly entityType: string;
  readonly condition: ApprovalCondition;
  readonly approverRoleId?: string | null;
  readonly isActive?: boolean;
}

export interface UpdateRuleInput {
  readonly name?: string;
  readonly description?: string;
  readonly entityType?: string;
  readonly condition?: ApprovalCondition;
  readonly approverRoleId?: string | null;
  readonly isActive?: boolean;
  /** Expected version for optimistic locking. */
  readonly version: number;
}

/**
 * Drives `evaluateAndRaise`. `organizationId` is required because rules and
 * the requests they raise are strictly org-scoped.
 */
export interface EvaluateAndRaiseInput {
  readonly organizationId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly fields: Record<string, unknown>;
  readonly requestedBy: string;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type ApprovalErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "conflict"
  | "unknown";

export interface ApprovalError {
  readonly code: ApprovalErrorCode;
  readonly message: string;
}

export type ApprovalResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: ApprovalError };
