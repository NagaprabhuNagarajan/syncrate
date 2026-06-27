/**
 * Audit domain types. The audit trail is append-only and immutable.
 */

export interface LogAuditInput {
  readonly organizationId: string;
  readonly actorUserId: string | null;
  /** module.action verb, e.g. "customer.create" */
  readonly action: string;
  /** entity kind, e.g. "customer", "branch", "invitation" */
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly summary?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface AuditLog {
  readonly id: string;
  readonly organizationId: string;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly summary: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface AuditListParams {
  readonly entityType?: string;
  readonly entityId?: string;
  readonly limit?: number;
}
