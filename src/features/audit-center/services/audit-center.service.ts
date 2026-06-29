import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AuditService } from "@/features/audit/services/audit.service";
import { AiInteractionService } from "@/features/ai/services/ai-interaction.service";
import { CbnEventsRepository } from "@/features/cbn/repositories/cbn-events.repository";
import type { AuditLog } from "@/features/audit/types/audit.types";
import type { AiInteraction } from "@/features/ai/types/ai.types";
import type { CbnEvent } from "@/features/cbn/types/cbn.types";
import { toAuditCenterCsv } from "@/features/audit-center/utils/auditCenterCsv";
import type {
  AuditCenterEntry,
  AuditCenterFilters,
  AuditCenterPage,
  AuditCenterSourceFilter,
} from "@/features/audit-center/types/audit-center.types";

/**
 * How many rows to pull from each underlying trail before merging. The Audit
 * Center is a compliance browser, not a streaming feed; a generous, bounded
 * window keeps aggregation predictable without unbounded reads.
 */
const FETCH_LIMIT = 500;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

/** Normalizes a Date or ISO string into an ISO-8601 string. */
function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapBusiness(log: AuditLog): AuditCenterEntry {
  return {
    id: `business:${log.id}`,
    source: "business",
    action: log.action,
    actor: log.actorUserId,
    summary: log.summary ?? log.action,
    timestamp: toIso(log.createdAt),
    status: null,
    details: {
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
    },
  };
}

function mapAi(interaction: AiInteraction): AuditCenterEntry {
  return {
    id: `ai:${interaction.id}`,
    source: "ai",
    action: interaction.capability,
    actor: interaction.actorUserId,
    summary:
      interaction.promptSummary ??
      interaction.responseSummary ??
      interaction.capability,
    timestamp: toIso(interaction.createdAt),
    status: interaction.status,
    details: {
      model: interaction.model,
      promptSummary: interaction.promptSummary,
      responseSummary: interaction.responseSummary,
      confidence: interaction.confidence,
      inputTokens: interaction.inputTokens,
      outputTokens: interaction.outputTokens,
      executionMs: interaction.executionMs,
      approvalStatus: interaction.approvalStatus,
      errorMessage: interaction.errorMessage,
      metadata: interaction.metadata,
    },
  };
}

function mapNetwork(event: CbnEvent): AuditCenterEntry {
  const summary = event.referenceType
    ? `${event.eventType} (${event.referenceType})`
    : event.eventType;
  return {
    id: `network:${event.id}`,
    source: "network",
    action: event.eventType,
    actor: event.actorUserId,
    summary,
    timestamp: toIso(event.createdAt),
    status: event.status,
    details: {
      connectionId: event.connectionId,
      sourceOrganizationId: event.sourceOrganizationId,
      targetOrganizationId: event.targetOrganizationId,
      referenceType: event.referenceType,
      referenceId: event.referenceId,
      correlationId: event.correlationId,
      errorMessage: event.errorMessage,
      metadata: event.metadata,
    },
  };
}

function wants(source: AuditCenterSourceFilter, target: string): boolean {
  return source === "all" || source === target;
}

function matchesFilters(
  entry: AuditCenterEntry,
  filters: AuditCenterFilters
): boolean {
  if (filters.actor && filters.actor.trim() !== "") {
    const actor = entry.actor?.toLowerCase() ?? "";
    if (!actor.includes(filters.actor.trim().toLowerCase())) {
      return false;
    }
  }

  if (filters.search && filters.search.trim() !== "") {
    const needle = filters.search.trim().toLowerCase();
    const haystack = [entry.action, entry.summary, entry.actor ?? ""]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(needle)) {
      return false;
    }
  }

  const time = new Date(entry.timestamp).getTime();
  if (filters.from && filters.from.trim() !== "") {
    const from = new Date(filters.from).getTime();
    if (!Number.isNaN(from) && time < from) {
      return false;
    }
  }
  if (filters.to && filters.to.trim() !== "") {
    const to = new Date(filters.to).getTime();
    if (!Number.isNaN(to) && time > to) {
      return false;
    }
  }

  return true;
}

function byNewestFirst(a: AuditCenterEntry, b: AuditCenterEntry): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

/**
 * Aggregates the three immutable trails into one unified, filterable view.
 *
 * Read-only by contract: this service NEVER writes to any trail. It composes
 * the existing {@link AuditService}, {@link AiInteractionService} and
 * {@link CbnEventsRepository} rather than duplicating their data access.
 */
export class AuditCenterService {
  private readonly auditService: AuditService;
  private readonly aiService: AiInteractionService;
  private readonly cbnEventsRepo: CbnEventsRepository;

  constructor(supabase: AppSupabaseClient) {
    this.auditService = new AuditService(supabase);
    this.aiService = new AiInteractionService(supabase);
    this.cbnEventsRepo = new CbnEventsRepository(supabase);
  }

  /** Fetches, normalizes, filters and sorts (newest first) — no pagination. */
  private async collect(
    organizationId: string,
    filters: AuditCenterFilters
  ): Promise<AuditCenterEntry[]> {
    const source = filters.source ?? "all";

    const [business, ai, network] = await Promise.all([
      wants(source, "business")
        ? this.auditService.list(organizationId, { limit: FETCH_LIMIT })
        : Promise.resolve<AuditLog[]>([]),
      wants(source, "ai")
        ? this.aiService.list(organizationId, { limit: FETCH_LIMIT })
        : Promise.resolve<AiInteraction[]>([]),
      wants(source, "network")
        ? this.cbnEventsRepo.listByOrg(organizationId, { limit: FETCH_LIMIT })
        : Promise.resolve<CbnEvent[]>([]),
    ]);

    const entries = [
      ...business.map(mapBusiness),
      ...ai.map(mapAi),
      ...network.map(mapNetwork),
    ].filter((entry) => matchesFilters(entry, filters));

    entries.sort(byNewestFirst);
    return entries;
  }

  /** Returns a paginated slice of the aggregated, filtered entries. */
  async list(
    organizationId: string,
    filters: AuditCenterFilters = {}
  ): Promise<AuditCenterPage> {
    const all = await this.collect(organizationId, filters);

    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const page = Math.max(1, filters.page ?? 1);
    const start = (page - 1) * pageSize;

    return {
      entries: all.slice(start, start + pageSize),
      total: all.length,
      page,
      pageSize,
    };
  }

  /** Serializes every matching entry (ignoring pagination) to CSV. */
  async exportCsv(
    organizationId: string,
    filters: AuditCenterFilters = {}
  ): Promise<string> {
    const all = await this.collect(organizationId, filters);
    return toAuditCenterCsv(all);
  }
}
