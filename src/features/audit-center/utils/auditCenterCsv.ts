import { objectsToCsv } from "@/utils/csv";
import type {
  AuditCenterEntry,
  AuditCenterSource,
} from "@/features/audit-center/types/audit-center.types";

/** Human-readable label per source, used in exports and the UI. */
export const AUDIT_CENTER_SOURCE_LABEL: Record<AuditCenterSource, string> = {
  business: "Business",
  ai: "AI",
  network: "Network",
};

const CSV_COLUMNS = [
  "timestamp",
  "source",
  "action",
  "actor",
  "status",
  "summary",
  "details",
] as const;

type CsvRow = Record<(typeof CSV_COLUMNS)[number], string>;

/**
 * Serializes aggregated audit entries to CSV. The `details` blob is emitted as
 * a JSON string so the export stays a single, flat table while remaining
 * lossless for compliance review.
 */
export function toAuditCenterCsv(
  entries: ReadonlyArray<AuditCenterEntry>
): string {
  const records: CsvRow[] = entries.map((entry) => ({
    timestamp: entry.timestamp,
    source: AUDIT_CENTER_SOURCE_LABEL[entry.source],
    action: entry.action,
    actor: entry.actor ?? "System",
    status: entry.status ?? "",
    summary: entry.summary,
    details: JSON.stringify(entry.details),
  }));

  return objectsToCsv(CSV_COLUMNS, records);
}
