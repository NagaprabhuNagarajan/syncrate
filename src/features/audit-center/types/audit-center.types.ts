/**
 * Audit Center domain types.
 *
 * The Audit Center is a unified, READ-ONLY surface over the three immutable
 * trails Syncrate maintains:
 *   - `audit_logs`     → general business actions   (source: "business")
 *   - `ai_interactions`→ AI platform activity       (source: "ai")
 *   - `cbn_events`     → cross-org network events   (source: "network")
 *
 * Entries from every trail are normalized into a single {@link AuditCenterEntry}
 * shape so they can be browsed, filtered and exported together. Nothing here
 * ever writes to a trail — the trails are append-only and immutable by design.
 */

export type AuditCenterSource = "business" | "ai" | "network";

/** "all" is the UI default — surface every trail. */
export type AuditCenterSourceFilter = AuditCenterSource | "all";

/** A single, source-agnostic audit entry. */
export interface AuditCenterEntry {
  /** Globally unique within the Audit Center: `${source}:${rowId}`. */
  readonly id: string;
  readonly source: AuditCenterSource;
  /** The verb/kind: business action, AI capability, or network event type. */
  readonly action: string;
  /** Acting user id, or `null` for system/automated entries. */
  readonly actor: string | null;
  /** Human-readable one-line description. */
  readonly summary: string;
  /** ISO-8601 timestamp (normalized from each trail's created_at). */
  readonly timestamp: string;
  /** Optional outcome status, where the trail records one. */
  readonly status: string | null;
  /** Full source-specific payload for drill-down / export. */
  readonly details: Record<string, unknown>;
}

/** Filters applied across the aggregated entries. */
export interface AuditCenterFilters {
  readonly source?: AuditCenterSourceFilter;
  /** Free-text match against action, summary and actor. */
  readonly search?: string;
  /** Substring match against the actor id. */
  readonly actor?: string;
  /** Inclusive lower bound (ISO date or datetime). */
  readonly from?: string;
  /** Inclusive upper bound (ISO date or datetime). */
  readonly to?: string;
  /** 1-based page number. */
  readonly page?: number;
  readonly pageSize?: number;
}

/** A paginated slice of aggregated, filtered entries. */
export interface AuditCenterPage {
  readonly entries: readonly AuditCenterEntry[];
  /** Total number of entries matching the filters (before pagination). */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ─────────────────────────────────────────────────────────────
// Action result envelope (mirrors the domain action-result pattern)
// ─────────────────────────────────────────────────────────────

export type AuditCenterErrorCode = "forbidden" | "validation" | "unknown";

export interface AuditCenterError {
  readonly code: AuditCenterErrorCode;
  readonly message: string;
}

export type AuditCenterActionResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: AuditCenterError };
