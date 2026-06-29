"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ScrollText,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonTable } from "@/components/ui/skeleton";
import {
  exportAuditCenterAction,
  fetchAuditCenterAction,
} from "@/features/audit-center/actions/audit-center.actions";
import { AUDIT_CENTER_SOURCE_LABEL } from "@/features/audit-center/utils/auditCenterCsv";
import type {
  AuditCenterEntry,
  AuditCenterFilters,
  AuditCenterPage,
  AuditCenterSource,
  AuditCenterSourceFilter,
} from "@/features/audit-center/types/audit-center.types";

// ─────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────

const SOURCE_BADGE: Record<AuditCenterSource, BadgeProps["variant"]> = {
  business: "info",
  ai: "secondary",
  network: "success",
};

const SOURCE_OPTIONS: ReadonlyArray<{
  value: AuditCenterSourceFilter;
  label: string;
}> = [
  { value: "all", label: "All sources" },
  { value: "business", label: "Business" },
  { value: "ai", label: "AI" },
  { value: "network", label: "Network" },
];

const SEARCH_DEBOUNCE_MS = 300;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadCsv(filename: string, csv: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────

interface AuditRowProps {
  readonly entry: AuditCenterEntry;
  readonly index: number;
}

function AuditRow({ entry, index }: AuditRowProps) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, delay: Math.min(index, 10) * 0.02 }}
      className="border-b border-slate-100 last:border-0"
    >
      <td className="px-4 py-3 align-top">
        <Badge variant={SOURCE_BADGE[entry.source]}>
          {AUDIT_CENTER_SOURCE_LABEL[entry.source]}
        </Badge>
      </td>
      <td className="px-4 py-3 align-top">
        <span className="font-mono text-xs text-slate-700">{entry.action}</span>
      </td>
      <td className="px-4 py-3 align-top">
        <span className="text-sm text-slate-600">
          {entry.actor ?? "System"}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <span className="text-sm text-slate-900">{entry.summary}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top">
        <span className="text-xs text-slate-500">
          {formatTimestamp(entry.timestamp)}
        </span>
      </td>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────

interface AuditCenterViewProps {
  readonly organizationId: string;
  readonly initialData: AuditCenterPage;
}

export function AuditCenterView({
  organizationId,
  initialData,
}: AuditCenterViewProps) {
  const pageSize = initialData.pageSize;

  const [data, setData] = useState<AuditCenterPage>(initialData);
  const [source, setSource] = useState<AuditCenterSourceFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Skip the effect-driven fetch on first mount — we already have initialData.
  const isFirstRender = useRef(true);

  // Debounce the free-text search field.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const buildFilters = useCallback(
    (targetPage: number): AuditCenterFilters => ({
      source,
      search: search || undefined,
      from: from || undefined,
      to: to || undefined,
      page: targetPage,
      pageSize,
    }),
    [source, search, from, to, pageSize]
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAuditCenterAction(organizationId, buildFilters(page))
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error.message);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load audit entries.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, buildFilters, page]);

  const handleSourceChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setSource(event.target.value as AuditCenterSourceFilter);
      setPage(1);
    },
    []
  );

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchInput(event.target.value);
    },
    []
  );

  const handleFromChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFrom(event.target.value);
      setPage(1);
    },
    []
  );

  const handleToChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTo(event.target.value);
      setPage(1);
    },
    []
  );

  const handlePrev = useCallback(() => {
    setPage((current) => Math.max(1, current - 1));
  }, []);

  const handleNext = useCallback(() => {
    setPage((current) => current + 1);
  }, []);

  const handleExport = useCallback(() => {
    setExporting(true);
    setError(null);
    exportAuditCenterAction(organizationId, buildFilters(1))
      .then((result) => {
        if (result.success) {
          const stamp = new Date().toISOString().slice(0, 10);
          downloadCsv(`audit-center-${stamp}.csv`, result.data);
        } else {
          setError(result.error.message);
        }
      })
      .catch(() => {
        setError("Failed to export audit entries.");
      })
      .finally(() => {
        setExporting(false);
      });
  }, [organizationId, buildFilters]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const rangeStart = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const rangeEnd = Math.min(data.total, data.page * data.pageSize);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Audit Center"
        description="Browse, filter and export your organization's immutable audit trails."
        icon={ScrollText}
      >
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          loading={exporting}
          disabled={exporting || data.total === 0}
        >
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Export CSV
        </Button>
      </PageHeader>

      {/* Filter bar */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="audit-source"
            className="text-xs font-medium text-slate-600"
          >
            Source
          </label>
          <select
            id="audit-source"
            value={source}
            onChange={handleSourceChange}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label
            htmlFor="audit-search"
            className="text-xs font-medium text-slate-600"
          >
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="audit-search"
              type="search"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="Action, summary, or actor"
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="audit-from"
            className="text-xs font-medium text-slate-600"
          >
            From
          </label>
          <input
            id="audit-from"
            type="date"
            value={from}
            onChange={handleFromChange}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="audit-to"
            className="text-xs font-medium text-slate-600"
          >
            To
          </label>
          <input
            id="audit-to"
            type="date"
            value={to}
            onChange={handleToChange}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Table */}
      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {error ? (
          <div className="p-5">
            <ErrorState message={error} />
          </div>
        ) : loading ? (
          <div className="p-5">
            <SkeletonTable rows={6} cols={5} />
          </div>
        ) : data.entries.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={ScrollText}
              title="No audit entries"
              description="No activity matches your current filters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                    Source
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                    Action
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                    Summary
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry, i) => (
                  <AuditRow key={entry.id} entry={entry} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pagination */}
      {data.total > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {rangeStart}–{rangeEnd} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={data.page <= 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Prev
            </Button>
            <span className="text-xs text-slate-500">
              Page {data.page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={data.page >= totalPages || loading}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
