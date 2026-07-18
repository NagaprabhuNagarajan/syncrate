"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ScrollText,
  Search,
} from "lucide-react";
import type { BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonTable } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
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

// Past-tense labels for the trailing verb of a dotted action key. Covers both
// present ("create") and already-past ("created") forms.
const ACTION_VERB: Record<string, string> = {
  create: "created",
  created: "created",
  update: "updated",
  updated: "updated",
  delete: "deleted",
  deleted: "deleted",
  post: "posted",
  posted: "posted",
  cancel: "cancelled",
  cancelled: "cancelled",
  approve: "approved",
  approved: "approved",
  reject: "rejected",
  rejected: "rejected",
  send: "sent",
  sent: "sent",
  test: "test",
  invite: "invited",
  invited: "invited",
  remove: "removed",
  removed: "removed",
  resend: "resent",
  revoke: "revoked",
  revoked: "revoked",
  generate: "generated",
  assign: "assigned",
  adjust: "adjusted",
  receive: "received",
  complete: "completed",
  completed: "completed",
  submit: "submitted",
  submitted: "submitted",
  convert: "converted",
  restore: "restored",
  accept: "accepted",
  decline: "declined",
  declined: "declined",
};

/**
 * Turns a dotted action key into a readable phrase — "role.permissions.update"
 * → "Role permissions updated", "approval.request.rejected" → "Approval request
 * rejected". The trailing segment is treated as the verb; the rest is the noun.
 */
function humanizeAction(action: string): string {
  const parts = action.split(".");
  if (parts.length < 2) {
    return action;
  }
  const verb = parts[parts.length - 1] ?? "";
  const noun = parts
    .slice(0, -1)
    .join(" ")
    .replace(/_/g, " ");
  const phrase = `${noun} ${ACTION_VERB[verb] ?? verb}`.trim();
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

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
  readonly teamHref: string;
}

function AuditRow({ entry, teamHref }: AuditRowProps) {
  return (
    <TableRow>
      <TableCell className="align-top">
        <StatusBadge
          variant={SOURCE_BADGE[entry.source]}
          label={AUDIT_CENTER_SOURCE_LABEL[entry.source]}
        />
      </TableCell>
      <TableCell className="align-top">
        <span
          className="text-sm text-slate-700 dark:text-slate-300"
          title={entry.action}
        >
          {humanizeAction(entry.action)}
        </span>
      </TableCell>
      <TableCell className="align-top">
        {entry.actor ? (
          <Link
            href={teamHref}
            title={entry.actor}
            className="block max-w-[16rem] truncate text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            {entry.actor}
          </Link>
        ) : (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            System
          </span>
        )}
      </TableCell>
      <TableCell className="align-top text-sm text-slate-900 dark:text-slate-100">
        {entry.summary}
      </TableCell>
      <TableCell className="whitespace-nowrap align-top text-xs text-slate-500 dark:text-slate-400">
        {formatTimestamp(entry.timestamp)}
      </TableCell>
    </TableRow>
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

  const searchParams = useSearchParams();
  const org = searchParams.get("org");
  const settingsHref = org ? `/settings?org=${org}` : "/settings";
  const teamHref = org ? `/settings/team?org=${org}` : "/settings/team";

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
    <div className="p-4 lg:p-6">
      {/* Back to settings */}
      <Link
        href={settingsHref}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Settings
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
            <ScrollText className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Audit Center
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {data.total}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Browse, filter and export your organization&apos;s immutable audit
              trails
            </p>
          </div>
        </div>

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
      </motion.div>

      {/* Filter bar */}
      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="audit-source"
            className="text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Source
          </label>
          <select
            id="audit-source"
            value={source}
            onChange={handleSourceChange}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
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
            className="text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
            <Input
              id="audit-search"
              type="search"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="Action, summary, or actor"
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="audit-from"
            className="text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            From
          </label>
          <Input
            id="audit-from"
            type="date"
            value={from}
            onChange={handleFromChange}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="audit-to"
            className="text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            To
          </label>
          <Input
            id="audit-to"
            type="date"
            value={to}
            onChange={handleToChange}
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-5">
        {error ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <ErrorState message={error} />
          </div>
        ) : loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <SkeletonTable rows={6} cols={5} />
          </div>
        ) : data.entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No audit entries"
            description="No activity matches your current filters."
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
          >
            <Table
              className="[&_td]:px-5 [&_th]:px-5"
              wrapperClassName="rounded-none border-0 bg-transparent"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} teamHref={teamHref} />
                ))}
              </TableBody>
            </Table>
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      {data.total > 0 && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
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
            <span className="text-xs text-slate-500 dark:text-slate-400">
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
